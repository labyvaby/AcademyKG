import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Box,
    Grid2,
    useMediaQuery,
    useTheme,
    Paper,
    Typography,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Card,
    CardContent,
    Avatar,
    CircularProgress,
    alpha
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PaymentsIcon from '@mui/icons-material/Payments';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import WalletIcon from '@mui/icons-material/Wallet';
import AnalyticsOutlined from "@mui/icons-material/AnalyticsOutlined";

import { PageHeader, MonthNavigation, ReportBranchSelect } from "../../components/ui";
import { AppointmentsSummaryCards, SummaryCard } from "./components/AppointmentsSummaryCards";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useAvailableReportMonths } from "../../hooks/useAvailableReportMonths";
import { formatKGS } from "../../utility/format";
import { getFinancialReport } from "../../services/reports";
import { useReportBranchScope } from "../../hooks/useReportBranchScope";
import { apiFetch } from "../../utility/apiClient";
import { DailyFinancialData, FinancialReportResponse } from "../../types/reports";
import dayjs from "dayjs";
import 'dayjs/locale/ru';

dayjs.locale('ru');

const toNumber = (value: number | string | null | undefined): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDailyFinancialData = (day: Partial<DailyFinancialData>): DailyFinancialData => ({
    date: String(day.date ?? ""),
    servicesSum: toNumber(day.servicesSum),
    productsSum: toNumber(day.productsSum),
    cashSum: toNumber(day.cashSum),
    cardSum: toNumber(day.cardSum),
    balanceSum: toNumber(day.balanceSum),
    bonusesSum: toNumber(day.bonusesSum),
    discountSum: toNumber(day.discountSum),
    debtSum: toNumber(day.debtSum),
    appointmentsCount: toNumber(day.appointmentsCount),
    proceduresCount: toNumber(day.proceduresCount),
    dayCount: toNumber(day.dayCount),
    nightCount: toNumber(day.nightCount),
    waitingCount: toNumber(day.waitingCount),
    hasActivity: Boolean(day.hasActivity),
});

const emptyFinancialReport: FinancialReportResponse = {
    canView: true,
    month: "",
    days: [],
    displayDays: [],
    totals: {
        servicesSum: 0,
        productsSum: 0,
        cashSum: 0,
        cardSum: 0,
        balanceSum: 0,
        bonusesSum: 0,
        discountSum: 0,
        debtSum: 0,
        appointmentsCount: 0,
        proceduresCount: 0,
        dayCount: 0,
        nightCount: 0,
        waitingCount: 0,
        hasActivity: false,
    },
    summaryCards: {
        appointments: 0,
        procedures: 0,
        day: 0,
        night: 0,
        servicesSum: 0,
        productsSum: 0,
        cashAndCardSum: 0,
        debtSum: 0,
    },
};

const normalizeFinancialReport = (report: FinancialReportResponse | null | undefined): FinancialReportResponse => {
    if (!report) return emptyFinancialReport;

    const normalizedTotals = normalizeDailyFinancialData(report.totals as Record<string, unknown>);
    return {
        canView: Boolean(report.canView),
        month: report.month ?? "",
        days: Array.isArray(report.days) ? report.days.map((day) => normalizeDailyFinancialData(day)) : [],
        displayDays: Array.isArray(report.displayDays)
            ? report.displayDays.map((day) => normalizeDailyFinancialData(day))
            : [],
        totals: normalizedTotals,
        summaryCards: {
            appointments: toNumber(report.summaryCards?.appointments),
            procedures: toNumber(report.summaryCards?.procedures),
            day: toNumber(report.summaryCards?.day),
            night: toNumber(report.summaryCards?.night),
            servicesSum: toNumber(report.summaryCards?.servicesSum),
            productsSum: toNumber(report.summaryCards?.productsSum),
            cashAndCardSum: toNumber(report.summaryCards?.cashAndCardSum),
            debtSum: toNumber(report.summaryCards?.debtSum),
        },
    };
};

const getDayRevenue = (day: Partial<DailyFinancialData>): number =>
    toNumber(day.servicesSum) + toNumber(day.productsSum);

const hasFinancialActivity = (day: Partial<DailyFinancialData>): boolean =>
    Boolean(day.hasActivity) ||
    getDayRevenue(day) > 0 ||
    toNumber(day.discountSum) > 0 ||
    toNumber(day.debtSum) > 0 ||
    toNumber(day.appointmentsCount) > 0 ||
    toNumber(day.waitingCount) > 0;

const ReportsPage: React.FC = () => {
    usePageTitle("Отчеты");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
    const { open: notify } = useNotification();
    const { branchId, ready: branchReady } = useReportBranchScope();
    // Financial State
    const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
    const [financialLoading, setFinancialLoading] = useState(false);
    const [financialError, setFinancialError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<FinancialReportResponse>(emptyFinancialReport);
    const activeMonths = useAvailableReportMonths("financialMonths");
    const branchKey = branchId ?? "all";
    const month = useMemo(() => dayjs(selectedDate).format('YYYY-MM'), [selectedDate]);
    const scopeKey = useMemo(() => `${branchKey}:${month}`, [branchKey, month]);
    const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);

    // Расходы за месяц
    const [totalExpenses, setTotalExpenses] = useState<number>(0);
    const [expensesByDate, setExpensesByDate] = useState<Record<string, number>>({});

    // Session cache: key = 'branch:YYYY-MM', invalidated on branch/month change
    const cache = React.useRef(new Map<string, FinancialReportResponse>());

    const fetchFinancialData = useCallback(async (signal?: AbortSignal, forceRefresh = false) => {
        const cacheKey = `${branchKey}:${month}`;

        if (!forceRefresh && cache.current.has(cacheKey)) {
            setReportData(cache.current.get(cacheKey)!);
            setLoadedScopeKey(cacheKey);
            setFinancialError(null);
            setFinancialLoading(false);
            return;
        }

        try {
            setFinancialLoading(true);
            setFinancialError(null);
            setLoadedScopeKey(null);
            setReportData(emptyFinancialReport);
            const res = await getFinancialReport(
                month,
                branchId,
                undefined,
                signal,
            );
            if (signal?.aborted) return;
            const normalized = normalizeFinancialReport(res?.data);
            cache.current.set(cacheKey, normalized);
            setReportData(normalized);
            setLoadedScopeKey(cacheKey);
        } catch (e) {
            if (signal?.aborted) return;
            console.error(e);
            const message = e instanceof Error ? e.message : "Ошибка загрузки финансового отчета";
            setFinancialError(message);
            setLoadedScopeKey(null);
            notify?.({ type: "error", message });
        } finally {
            if (!signal?.aborted) setFinancialLoading(false);
        }
    }, [branchKey, month, notify, branchId]);

    useEffect(() => {
        // Ждём профиль: до него branchId не определён, и запрос без ?branch=
        // у мульти-филиального сотрудника закэшировал бы данные всей организации.
        if (!branchReady) return;
        const controller = new AbortController();
        void fetchFinancialData(controller.signal);
        return () => controller.abort();
    }, [fetchFinancialData, branchReady]);

    useEffect(() => {
        if (!branchReady) return;
        let cancelled = false;
        const load = async () => {
            try {
                const params = new URLSearchParams({ month });
                if (branchId) params.set("branch", branchId);
                const res: any = await apiFetch(`/api/v1/reports/expenses-monthly/?${params}`);
                if (cancelled) return;
                const d = res?.data ?? res;
                setTotalExpenses(toNumber(d?.totals?.totalExpenses));
                const byDateArr: any[] = Array.isArray(d?.byDate) ? d.byDate : [];
                const byDateMap: Record<string, number> = {};
                byDateArr.forEach((entry: any) => {
                    if (entry?.date) byDateMap[entry.date] = toNumber(entry.totalExpenses);
                });
                setExpensesByDate(byDateMap);
            } catch {
                if (!cancelled) { setTotalExpenses(0); setExpensesByDate({}); }
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [month, branchId, branchReady]);

    useEffect(() => {
        if (!activeMonths || activeMonths.size === 0) return;
        if (activeMonths.has(month)) return;

        const todayMonth = dayjs().format("YYYY-MM");
        const fallbackMonth = activeMonths.has(todayMonth)
            ? todayMonth
            : Array.from(activeMonths).sort((a, b) => a.localeCompare(b)).at(-1);

        if (fallbackMonth) {
            setSelectedDate(`${fallbackMonth}-01`);
        }
    }, [activeMonths, month]);

    const visibleReportData = loadedScopeKey === scopeKey ? reportData : emptyFinancialReport;
    const effectiveLoading = financialLoading || (!financialError && loadedScopeKey !== scopeKey);

    const dailyData = useMemo(
        () => (visibleReportData.displayDays.length > 0 ? visibleReportData.displayDays : visibleReportData.days).slice().sort((a, b) => b.date.localeCompare(a.date)),
        [visibleReportData],
    );

    const reportTotals = useMemo(
        () => normalizeDailyFinancialData(visibleReportData.totals as Record<string, unknown>),
        [visibleReportData],
    );

    const summaryCards = useMemo<SummaryCard[]>(() => {
        const servicesSum = toNumber(reportTotals.servicesSum);
        const productsSum = toNumber(reportTotals.productsSum);
        const totalRevenue = servicesSum + productsSum;
        // Карточку и таблицу держим на ОДНОМ поле (totals), иначе они расходятся:
        // summaryCards.appointments — отдельный месячный KPI бэка и может отличаться
        // от totals.appointmentsCount на 1 (см. docs/backend-reports-count-mismatch.md).
        // totals совпадает с поднеёвной разбивкой таблицы → берём его за основу,
        // summaryCards — только fallback, если totals пустой.
        const appointmentsCount = toNumber(reportTotals.appointmentsCount) || visibleReportData.summaryCards.appointments;
        const proceduresCount = toNumber(reportTotals.proceduresCount) || visibleReportData.summaryCards.procedures;

        return [
            {
                title: 'Услуги',
                primaryValue: formatKGS(servicesSum),
                secondaryText: `${appointmentsCount} записей`,
                color: 'primary',
            },
            {
                title: 'Расходы',
                primaryValue: formatKGS(totalExpenses),
                secondaryText: 'Операционные расходы',
                color: 'error',
            },
            {
                title: 'Общая выручка',
                primaryValue: formatKGS(totalRevenue),
                secondaryText: 'Услуги + товары',
                color: 'success',
            },
            {
                title: 'Скидки',
                primaryValue: formatKGS(reportTotals.discountSum),
                secondaryText: 'Сумма скидок',
                color: 'warning',
            },
            {
                title: 'Долги',
                primaryValue: formatKGS(reportTotals.debtSum),
                secondaryText: 'Остаток к оплате',
                color: 'error',
            },
        ];
    }, [reportTotals, visibleReportData]);

    return (
        <Box sx={{
            height: { xs: "calc(100dvh - 56px)", md: "calc(100vh - 64px)" },
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
        }}>
            <PageHeader
                title="Отчеты"
                showTitle={false}
                showSearch={false}
                dateNavigation={<MonthNavigation date={selectedDate} setDate={setSelectedDate} activeMonths={activeMonths} />}
            />

            <Box sx={(theme) => ({
                px: theme.appLayout.page.paddingX,
                pt: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: { xs: 'auto', lg: 'hidden' },
                WebkitOverflowScrolling: "touch",
                minHeight: 0
            })}>
                <Stack spacing={3} sx={(theme) => ({ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, pb: { xs: 15, md: theme.appLayout.page.paddingY } })}>
                    <ReportBranchSelect sx={{ alignSelf: 'flex-end' }} />
                    {financialError && !financialLoading ? (
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                borderRadius: 3,
                                borderColor: "error.main",
                                bgcolor: alpha(theme.palette.error.main, 0.05),
                            }}
                        >
                            <Typography variant="h6" color="error.main" sx={{ fontWeight: 700, mb: 1 }}>
                                Не удалось загрузить финансовый отчет
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {financialError}
                            </Typography>
                        </Paper>
                    ) : (
                        <>
                            <AppointmentsSummaryCards
                                cards={summaryCards}
                                loading={effectiveLoading}
                            />

                            {effectiveLoading ? <Box sx={{ textAlign: 'center', py: 5, flex: 1 }}><CircularProgress /></Box> : (
                        isMobile ? (
                            <Stack spacing={1.5} sx={{ flex: 1 }}>
                                {dailyData.filter(hasFinancialActivity).map(day => (
                                    <Card key={day.date} variant="outlined" sx={{ borderRadius: 3, '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } }}>
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                                <Avatar sx={{
                                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                    color: 'primary.main',
                                                    width: 40, height: 40
                                                }}>
                                                    <AnalyticsOutlined />
                                                </Avatar>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="subtitle1" fontWeight={800}>{dayjs(day.date).format('DD MMMM')}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {dayjs(day.date).format('dddd')} • Записей: {day.appointmentsCount}
                                                    </Typography>
                                                </Box>
                                            </Stack>

                                            <Grid2 container spacing={2}>
                                                <Grid2 size={6}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <PaymentsIcon sx={{ fontSize: 14, color: 'primary.main' }} /> Услуги
                                                    </Typography>
                                                    <Typography variant="subtitle1" fontWeight={800}>{formatKGS(day.servicesSum)}</Typography>
                                                </Grid2>
                                                <Grid2 size={6}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <WalletIcon sx={{ fontSize: 14, color: 'info.main' }} /> Товары
                                                    </Typography>
                                                    <Typography variant="subtitle1" color="info.main" fontWeight={800}>{formatKGS(day.productsSum)}</Typography>
                                                </Grid2>
                                                <Grid2 size={6}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <CreditCardIcon sx={{ fontSize: 14, color: 'success.main' }} /> Выручка
                                                    </Typography>
                                                    <Typography variant="subtitle1" color="success.main" fontWeight={800}>{formatKGS(getDayRevenue(day))}</Typography>
                                                </Grid2>
                                                {day.balanceSum > 0 && (
                                                    <Grid2 size={6}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <WalletIcon sx={{ fontSize: 14, color: 'secondary.main' }} /> Оплата балансом
                                                        </Typography>
                                                        <Typography variant="subtitle1" color="secondary.main" fontWeight={800}>{formatKGS(day.balanceSum)}</Typography>
                                                    </Grid2>
                                                )}
                                                {(day.discountSum > 0 || day.debtSum > 0) && (
                                                    <Grid2 size={12}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'space-between' }}>
                                                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                                                <TrendingDownIcon sx={{ fontSize: 14, color: 'warning.main' }} /> Скидка / долг
                                                            </Box>
                                                        </Typography>
                                                        <Stack direction="row" spacing={2}>
                                                            <Typography variant="subtitle2" color="warning.main" fontWeight={800}>
                                                                Скидка: {formatKGS(day.discountSum)}
                                                            </Typography>
                                                            <Typography variant="subtitle2" color="error.main" fontWeight={800}>
                                                                Долг: {formatKGS(day.debtSum)}
                                                            </Typography>
                                                        </Stack>
                                                    </Grid2>
                                                )}
                                            </Grid2>
                                        </CardContent>
                                    </Card>
                                ))}
                                {dailyData.filter(hasFinancialActivity).length === 0 && (
                                    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                                        <Typography color="text.secondary">Нет данных за этот период</Typography>
                                    </Paper>
                                )}
                            </Stack>
                        ) : (
                            <Paper variant="outlined" sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow>
                                                {['Дата', 'Записи', 'В ожидании', 'Услуги', 'Расходы', 'Выручка', 'Баланс', 'Скидка', 'Долг'].map(h => <TableCell key={h} align={h === 'Дата' ? 'left' : h === 'Записи' || h === 'В ожидании' ? 'center' : 'right'} sx={{ fontWeight: 800, ...(h === 'В ожидании' ? { color: 'error.main' } : {}) }}>{h}</TableCell>)}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dailyData.map(day => (
                                                <TableRow key={day.date} hover sx={{ opacity: hasFinancialActivity(day) ? 1 : 0.6 }}>
                                                    <TableCell sx={{ fontWeight: 600 }}>{dayjs(day.date).format('DD.MM (ddd)')}</TableCell>
                                                    <TableCell align="center">{day.appointmentsCount > 0 ? day.appointmentsCount : '-'}</TableCell>
                                                    <TableCell align="center" sx={{
                                                        fontWeight: day.waitingCount > 0 ? 700 : 400,
                                                        color: (day.waitingCount > 0 && dayjs(day.date).isBefore(dayjs(), 'day')) ? 'error.main' : 'text.secondary'
                                                    }}>
                                                        {day.waitingCount > 0 ? day.waitingCount : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">{formatKGS(day.servicesSum)}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'error.main' }}>{expensesByDate[day.date] != null ? formatKGS(expensesByDate[day.date]) : '—'}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{formatKGS(getDayRevenue(day))}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'secondary.main' }}>{day.balanceSum > 0 ? formatKGS(day.balanceSum) : '-'}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'warning.main' }}>{day.discountSum > 0 ? formatKGS(day.discountSum) : '-'}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'error.main' }}>{day.debtSum > 0 ? formatKGS(day.debtSum) : '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                                                <TableCell sx={{ fontWeight: 800 }}>ИТОГО</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 800 }}>{reportTotals.appointmentsCount}</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 800, color: 'error.main' }}>{reportTotals.waitingCount > 0 ? reportTotals.waitingCount : '-'}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800 }}>{formatKGS(reportTotals.servicesSum)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>{formatKGS(totalExpenses)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>{formatKGS(getDayRevenue(reportTotals))}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'secondary.main' }}>{formatKGS(reportTotals.balanceSum)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'warning.main' }}>{formatKGS(reportTotals.discountSum)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>{formatKGS(reportTotals.debtSum)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        )
                            )}
                        </>
                    )}
                </Stack>
            </Box>
        </Box>
    );
};

export default ReportsPage;

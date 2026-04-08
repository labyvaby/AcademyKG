import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Box,
    useMediaQuery,
    useTheme,
    Paper,
    Typography,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    alpha,
    CircularProgress,
    Skeleton,
    Button,
    Tooltip,
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlined from '@mui/icons-material/PrintOutlined';

import { PageHeader, MonthNavigation } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { useAvailableReportMonths } from "../../hooks/useAvailableReportMonths";
import { formatKGS } from "../../utility/format";
import { getPayrollReport } from "../../services/reports";
import { PayrollReportResponse, PayrollGroup } from "../../types/reports";
import { useBranchContext } from "../../contexts/branch-context";
import dayjs from "dayjs";
import SalaryReportRow from "./components/SalaryReportRow";

// Гармоничная палитра
const C = {
    day: '#3B82F6',
    night: '#8B5CF6',
    advance: '#F59E0B',
    payout: '#10B981',
    deduction: '#EF4444',
    net: '#0EA5E9',
};

const toNumber = (value: number | string | null | undefined): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePayrollReport = (report: PayrollReportResponse | null | undefined): PayrollReportResponse | null => {
    if (!report) return null;

    return {
        ...report,
        groups: Array.isArray(report.groups)
            ? report.groups.map((group) => ({
                ...group,
                rows: Array.isArray(group.rows)
                    ? group.rows.map((row) => ({
                        ...row,
                        dayHours: toNumber(row.dayHours),
                        nightHours: toNumber(row.nightHours),
                        paidAppointmentsCount: toNumber(row.paidAppointmentsCount),
                        distributedAppointmentsCount: toNumber(row.distributedAppointmentsCount),
                        advancesSum: toNumber(row.advancesSum),
                        payoutsSum: toNumber(row.payoutsSum),
                        deductionsSum: toNumber(row.deductionsSum),
                        expensesSum: toNumber(row.expensesSum),
                        grossEarnings: toNumber(row.grossEarnings),
                        netSalary: toNumber(row.netSalary),
                        percentSum: toNumber(row.percentSum),
                        fixedSum: toNumber(row.fixedSum),
                    }))
                    : [],
                totals: {
                    ...group.totals,
                    advancesSum: toNumber(group.totals?.advancesSum),
                    payoutsSum: toNumber(group.totals?.payoutsSum),
                    deductionsSum: toNumber(group.totals?.deductionsSum),
                    expensesSum: toNumber(group.totals?.expensesSum),
                    grossEarnings: toNumber(group.totals?.grossEarnings),
                    netSalary: toNumber(group.totals?.netSalary),
                },
            }))
            : [],
        totals: {
            ...report.totals,
            advancesSum: toNumber(report.totals?.advancesSum),
            payoutsSum: toNumber(report.totals?.payoutsSum),
            deductionsSum: toNumber(report.totals?.deductionsSum),
            expensesSum: toNumber(report.totals?.expensesSum),
            grossEarnings: toNumber(report.totals?.grossEarnings),
            netSalary: toNumber(report.totals?.netSalary),
        },
        summary: {
            ...report.summary,
            warningsCount: toNumber(report.summary?.warningsCount),
            openShiftsCount: toNumber(report.summary?.openShiftsCount),
            paidOutCount: toNumber(report.summary?.paidOutCount),
        },
    };
};

const SalaryReportsPage: React.FC = () => {
    usePageTitle("Отчет по ЗП");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
    const { open: notify } = useNotification();
    const { loading: permissionsLoading } = usePermissions();
    const { selectedBranch } = useBranchContext();


    // State
    const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<PayrollReportResponse | null>(null);
    const activeMonths = useAvailableReportMonths("payrollMonths");
    const month = useMemo(() => dayjs(selectedDate).format('YYYY-MM'), [selectedDate]);
    const branchKey = selectedBranch?.id ?? "all";
    const scopeKey = `${branchKey}:${month}`;
    const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);

    const fetchData = useCallback(async (signal?: AbortSignal) => {
        if (permissionsLoading) return;

        try {
            setLoading(true);
            setError(null);
            setLoadedScopeKey(null);
            setReportData(null);
            const res = await getPayrollReport(month, selectedBranch?.id ?? undefined, undefined, signal);
            if (signal?.aborted) return;
            if (res?.data) {
                setReportData(normalizePayrollReport(res.data));
                setLoadedScopeKey(scopeKey);
            }
        } catch (e: any) {
            if (signal?.aborted) return;
            console.error(e);
            const message = e?.message || "Ошибка загрузки данных зарплаты";
            setError(message);
            setLoadedScopeKey(null);
            notify?.({ type: "error", message });
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [month, notify, permissionsLoading, scopeKey, selectedBranch?.id]);

    useEffect(() => {
        const controller = new AbortController();
        void fetchData(controller.signal);
        return () => controller.abort();
    }, [fetchData]);

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

    if (permissionsLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
    );

    const visibleReportData = loadedScopeKey === scopeKey ? reportData : null;
    const effectiveLoading = loading || (!error && loadedScopeKey !== scopeKey);
    const { groups = [], totals = {} as PayrollReportResponse["totals"], summary = {} as PayrollReportResponse["summary"] } = visibleReportData || {};
    const netSalaryTotal = Number(totals.netSalary ?? 0);

    const monthLabel = month;

    const exportCSV = () => {
        const BOM = '\uFEFF';
        const lines: string[] = [];
        lines.push([
            'Сотрудник',
            'Группа',
            'День (ч)',
            'Ночь (ч)',
            'Оплаченные приемы',
            '% ЗП',
            'Оклад',
            'Авансы',
            'Выплаты',
            'Удержания',
            'Всего списано',
            'К выплате',
        ].join(';'));
        groups.forEach((group: PayrollGroup) => {
            group.rows.forEach((row) => {
                lines.push([
                    row.fullName,
                    group.title,
                    row.dayHours ?? 0,
                    row.nightHours ?? 0,
                    row.paidAppointmentsCount ?? 0,
                    row.percentSum ?? 0,
                    row.fixedSum ?? 0,
                    row.advancesSum ?? 0,
                    row.payoutsSum ?? 0,
                    row.deductionsSum ?? 0,
                    row.expensesSum ?? 0,
                    row.netSalary ?? 0,
                ].join(';'));
            });
        });
        lines.push([
            'ИТОГО',
            '',
            '',
            '',
            '',
            '',
            '',
            totals.advancesSum || 0,
            totals.payoutsSum || 0,
            totals.deductionsSum || 0,
            totals.expensesSum || 0,
            totals.netSalary || 0,
        ].join(';'));
        const csv = BOM + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary-report-${monthLabel}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Box
            sx={{
                height: { xs: "auto", lg: "100%" },
                minHeight: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
                display: "flex",
                flexDirection: "column",
                overflow: { xs: "visible", lg: "hidden" },
            }}
        >
            <PageHeader
                title="Отчет по зарплате"
                showTitle={false}
                showSearch={false}
                dateNavigation={<MonthNavigation date={selectedDate} setDate={setSelectedDate} activeMonths={activeMonths} />}
            />

            <Box sx={(theme) => ({
                px: theme.appLayout.page.paddingX,
                pb: theme.appLayout.page.paddingY,
                pt: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                WebkitOverflowScrolling: "touch",
                minHeight: 0
            })}>
                <Stack spacing={{ xs: 2, md: 3 }} sx={{ display: 'flex', flexDirection: 'column' }}>

                    {/* Summary Indicators */}
                    <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" flexWrap="wrap" useFlexGap sx={{ px: 0.5 }}>
                        {[
                            { icon: <ReportProblemIcon sx={{ fontSize: { xs: '0.85rem', md: '1.2rem' } }} />, color: C.advance, value: summary.warningsCount || 0, label: 'Предупр.' },
                            { icon: <AccessTimeIcon sx={{ fontSize: { xs: '0.85rem', md: '1.2rem' } }} />, color: C.night, value: summary.openShiftsCount || 0, label: 'Откр. смен' },
                            { icon: <CheckCircleOutlineIcon sx={{ fontSize: { xs: '0.85rem', md: '1.2rem' } }} />, color: C.payout, value: summary.paidOutCount || 0, label: 'Выплачено' },
                            { icon: <Typography fontWeight={800} sx={{ fontSize: { xs: '0.55rem', md: '0.72rem' }, lineHeight: 1 }}>KGS</Typography>, color: C.net, value: formatKGS(netSalaryTotal), label: 'К выплате' },
                        ].map((item, i) => (
                            <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ minWidth: { xs: 110, md: 160 }, bgcolor: alpha(item.color, 0.05), border: `1px solid ${alpha(item.color, 0.15)}`, borderRadius: 1.5, px: { xs: 1, md: 2 }, py: { xs: 0.75, md: 1.25 } }}>
                                <Box sx={{ color: item.color, display: 'flex', flexShrink: 0 }}>{item.icon}</Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography fontWeight={800} sx={{ fontSize: { xs: '0.85rem', md: '1.1rem' }, lineHeight: 1.1, color: i === 3 ? item.color : 'text.primary' }}>{item.value}</Typography>
                                    <Typography color="text.disabled" sx={{ fontSize: { xs: '0.6rem', md: '0.72rem' }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</Typography>
                                </Box>
                            </Stack>
                        ))}
                    </Stack>

                    {error && !loading ? (
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
                                Не удалось загрузить зарплатный отчет
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {error}
                            </Typography>
                        </Paper>
                    ) : effectiveLoading ? (
                        <Stack spacing={2}>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
                            ))}
                        </Stack>
                    ) : groups.length === 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                            <Typography color="text.secondary">Нет данных за выбранный месяц</Typography>
                        </Box>
                    ) : (
                        groups.map((group: PayrollGroup) => (
                            <Box key={group.key}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, px: 0.5 }}>
                                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: C.net, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {group.title}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" fontWeight={600}>
                                        Итого: <Box component="span" sx={{ color: C.net, fontWeight: 800 }}>{formatKGS(group.totals.netSalary)}</Box>
                                    </Typography>
                                </Stack>
                                {isMobile ? (
                                    <Stack spacing={1}>
                                        {group.rows.map((row) => (
                                            <SalaryReportRow key={row.employeeId} row={row} isMobile month={month} />
                                        ))}
                                    </Stack>
                                ) : (
                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: alpha(theme.palette.divider, 0.6) }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: '#E6E6FA' }}>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary', pl: 1.5 }}>Сотрудник</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: C.day }}>День (ч)</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: C.night }}>Ночь (ч)</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>Приемы</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: C.day }}>Распред.</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>ЗП (%)</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>Оклад</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: C.advance }}>Аванс</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: C.payout }}>Выплаты</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: C.deduction }}>Удерж.</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>Списано</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: C.net }}>К выплате</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {group.rows.map((row) => (
                                                    <SalaryReportRow key={row.employeeId} row={row} month={month} />
                                                ))}
                                                <TableRow sx={{ bgcolor: alpha(C.net, 0.04), '& td': { borderTop: `1px solid ${alpha(C.net, 0.15)}` } }}>
                                                    <TableCell colSpan={7} sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary', pl: 1.5 }}>ИТОГО {group.title.toUpperCase()}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: C.advance }}>{formatKGS(group.totals.advancesSum)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: C.payout }}>{formatKGS(group.totals.payoutsSum)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: C.deduction }}>{formatKGS(group.totals.deductionsSum)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{formatKGS(group.totals.expensesSum)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: C.net }}>{formatKGS(group.totals.netSalary)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </Paper>
                                )}
                            </Box>
                        ))
                    )}

                    {/* Overall Totals */}
                    {!effectiveLoading && visibleReportData && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: alpha(C.net, 0.04), borderColor: alpha(C.net, 0.2) }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
                                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
                                    Общий итог
                                </Typography>
                                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap alignItems="flex-end">
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.1 }}>Грязная ЗП</Typography>
                                        <Typography variant="body1" fontWeight={700}>{formatKGS(totals.grossEarnings)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" sx={{ color: C.advance, display: 'block', mb: 0.1 }}>Авансы</Typography>
                                        <Typography variant="body1" fontWeight={700} sx={{ color: C.advance }}>{formatKGS(totals.advancesSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" sx={{ color: C.payout, display: 'block', mb: 0.1 }}>Выплаты</Typography>
                                        <Typography variant="body1" fontWeight={700} sx={{ color: C.payout }}>{formatKGS(totals.payoutsSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" sx={{ color: C.deduction, display: 'block', mb: 0.1 }}>Удержания</Typography>
                                        <Typography variant="body1" fontWeight={700} sx={{ color: C.deduction }}>{formatKGS(totals.deductionsSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.1 }}>Всего списано</Typography>
                                        <Typography variant="body1" fontWeight={700}>{formatKGS(totals.expensesSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right" sx={{ pl: 2, borderLeft: `2px solid ${alpha(C.net, 0.3)}` }}>
                                        <Typography variant="caption" sx={{ color: C.net, display: 'block', mb: 0.1 }}>К выплате</Typography>
                                        <Typography variant="h6" fontWeight={900} sx={{ color: C.net }}>{formatKGS(netSalaryTotal)}</Typography>
                                    </Box>
                                </Stack>
                            </Stack>
                        </Paper>
                    )}
                </Stack>
            </Box>
        </Box>
    );
};

export default SalaryReportsPage;

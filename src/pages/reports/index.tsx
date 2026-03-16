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

import { PageHeader, MonthNavigation } from "../../components/ui";
import { AppointmentsSummaryCards } from "./components/AppointmentsSummaryCards";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { useActiveMonths } from "../../hooks/useActiveMonths";
import { formatKGS } from "../../utility/format";
import { apiFetch } from "../../utility/apiClient";
import dayjs from "dayjs";
import 'dayjs/locale/ru';
import { fetchNurses } from "../../services/employees";

dayjs.locale('ru');

interface DailyFinancialData {
    date: string;
    services_sum: number;
    products_sum: number;
    cash_sum: number;
    card_sum: number;
    balance_sum: number;
    bonuses_sum: number;
    discount_sum: number;
    debt_sum: number;
    appointments_count: number;
    procedures_count: number;
    waiting_count: number;
    day_count: number;   // приёмы до 18:00
    night_count: number; // приёмы с 18:00
}

const ReportsPage: React.FC = () => {
    usePageTitle("Отчеты");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
    const { open: notify } = useNotification();
    const { isSuperAdmin, hasRole } = usePermissions();

    const canSeeFinancial = useMemo(() => isSuperAdmin() || hasRole(['accountant', 'admin', 'manager']), [isSuperAdmin, hasRole]);

    // Financial State
    const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
    const [financialLoading, setFinancialLoading] = useState(false);
    const [dailyData, setDailyData] = useState<DailyFinancialData[]>([]);
    const [nurses, setNurses] = useState<{ id: string }[]>([]);
    const activeMonths = useActiveMonths('AppointmentsAggregated', 'appointment_at');

    // Session cache: key = 'YYYY-MM', invalidated on month change
    const cache = React.useRef(new Map<string, DailyFinancialData[]>());

    const { dateFrom, dateTo } = useMemo(() => {
        const startOfMonth = dayjs(selectedDate).startOf('month');
        let endOfMonth = dayjs(selectedDate).endOf('month');
        const today = dayjs().endOf('day');
        if (endOfMonth.isAfter(today)) {
            endOfMonth = today;
        }
        return {
            dateFrom: startOfMonth.toISOString(),
            dateTo: endOfMonth.toISOString(),
        };
    }, [selectedDate]);

    useEffect(() => {
        fetchNurses().then(setNurses).catch(console.error);
    }, []);

    const fetchFinancialData = useCallback(async (forceRefresh = false) => {
        if (!canSeeFinancial) return;

        const cacheKey = dayjs(selectedDate).format('YYYY-MM');

        if (!forceRefresh && cache.current.has(cacheKey)) {
            setDailyData(cache.current.get(cacheKey)!);
            setFinancialLoading(false);
            return;
        }

        try {
            setFinancialLoading(true);

            const nurseIds = nurses.map((n: any) => n.id);

            // Fetch all appointments for the month
            const res: any = await apiFetch(`/api/v1/appointments/?ordering=-appointmentAt`);
            const appointments: any[] = res?.data?.results ?? res?.results ?? [];

            const groupedMap = new Map<string, DailyFinancialData>();
            let current = dayjs(dateFrom);
            const end = dayjs(dateTo);
            while (current.isBefore(end) || current.isSame(end, 'day')) {
                const dateStr = current.format('YYYY-MM-DD');
                groupedMap.set(dateStr, {
                    date: dateStr,
                    services_sum: 0, products_sum: 0, cash_sum: 0, card_sum: 0,
                    balance_sum: 0, bonuses_sum: 0, discount_sum: 0, debt_sum: 0,
                    appointments_count: 0, procedures_count: 0, waiting_count: 0,
                    day_count: 0, night_count: 0,
                });
                current = current.add(1, 'day');
            }

            const fullyPaidStatuses = new Set(["completed", "Оплачено", "Со скидкой", "Частично оплачено", "Бесплатно"]);
            const waitingStatuses = new Set(["scheduled", "in_progress", "Ожидаем", "Клиент здесь"]);

            appointments.forEach((app: any) => {
                const at = app.appointmentAt ?? app.appointment_at;
                if (!at) return;
                const day = dayjs(at).format('YYYY-MM-DD');
                if (!groupedMap.has(day)) {
                    groupedMap.set(day, {
                        date: day, services_sum: 0, products_sum: 0, cash_sum: 0, card_sum: 0,
                        balance_sum: 0, bonuses_sum: 0, discount_sum: 0, debt_sum: 0,
                        appointments_count: 0, procedures_count: 0, waiting_count: 0, day_count: 0, night_count: 0,
                    });
                }
                const existing = groupedMap.get(day)!;
                const isFullyPaid = fullyPaidStatuses.has(app.status);
                const isWaiting = waitingStatuses.has(app.status);

                if (isFullyPaid) {
                    existing.services_sum += Number(app.total ?? app.total_amount ?? 0);
                    existing.cash_sum += Number(app.paidCash ?? app.paid_cash ?? 0);
                    existing.card_sum += Number(app.paidCard ?? app.paid_card ?? 0);
                    existing.balance_sum += Number(app.paidBalance ?? app.paid_balance ?? 0);
                    existing.bonuses_sum += Number(app.paidBonuses ?? app.paid_bonuses ?? 0);
                    existing.discount_sum += Number(app.discount ?? 0);
                    existing.debt_sum += Number(app.debt ?? 0);
                    existing.appointments_count += 1;
                    const hour = dayjs(at).hour();
                    if (hour >= 18) existing.night_count += 1;
                    else existing.day_count += 1;
                }
                if (isWaiting) existing.waiting_count += 1;
            });

            // Сортировка новые к старому
            const sorted = Array.from(groupedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
            cache.current.set(cacheKey, sorted);
            setDailyData(sorted);
        } catch (e) {
            console.error(e);
            notify?.({ type: "error", message: "Ошибка загрузки финансового отчета" });
        } finally {
            setFinancialLoading(false);
        }
    }, [dateFrom, dateTo, canSeeFinancial, nurses, notify]);

    useEffect(() => {
        if (nurses.length > 0 || !canSeeFinancial) {
            fetchFinancialData();
        }
    }, [fetchFinancialData, nurses.length, canSeeFinancial]);

    const financialTotals = useMemo(() => {
        return dailyData.reduce((acc, curr) => {
            // Реально выставленная сумма = нал + безнал + баланс + бонусы + долг
            // = total_amount - discount (т.е. finalPrice)
            // Мед. услуги = finalPrice - товары
            const finalPrice = curr.cash_sum + curr.card_sum + curr.balance_sum + curr.bonuses_sum + curr.debt_sum;
            return {
                services: acc.services + Math.max(0, finalPrice - curr.products_sum),
                products: acc.products + curr.products_sum,
                cash: acc.cash + curr.cash_sum,
                card: acc.card + curr.card_sum,
                discount: acc.discount + curr.discount_sum,
                debt: acc.debt + curr.debt_sum,
                appointmentsCount: acc.appointmentsCount + curr.appointments_count,
                proceduresCount: acc.proceduresCount + curr.procedures_count,
                waitingCount: acc.waitingCount + curr.waiting_count,
                dayCount: acc.dayCount + curr.day_count,
                nightCount: acc.nightCount + curr.night_count,
            };
        }, { services: 0, products: 0, cash: 0, card: 0, discount: 0, debt: 0, appointmentsCount: 0, proceduresCount: 0, waitingCount: 0, dayCount: 0, nightCount: 0 });
    }, [dailyData]);

    if (!canSeeFinancial) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">У вас нет доступа к этой странице</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{
            height: { xs: "calc(100dvh - 56px)", md: "calc(100vh - 64px)" },
            display: "flex",
            flexDirection: "column",
            overflow: 'hidden'
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
                minHeight: 0
            })}>
                <Stack spacing={3} sx={(theme) => ({ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, pb: { xs: 15, md: theme.appLayout.page.paddingY } })}>
                    <AppointmentsSummaryCards
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        extraCards={[
                            { title: 'Приёмы / Процедуры', primaryValue: `${financialTotals.appointmentsCount} / ${financialTotals.proceduresCount}`, secondaryText: 'Приёмы / Процедуры', color: 'primary' as const },
                            { title: 'День / Ночь', primaryValue: `${financialTotals.dayCount} / ${financialTotals.nightCount}`, secondaryText: 'до 18:00 / с 18:00', color: 'info' as const },
                            { title: 'Мед. услуги', primaryValue: formatKGS(financialTotals.services), secondaryText: 'Без товаров', color: 'primary' as const },
                            { title: 'Товары в приёмах', primaryValue: formatKGS(financialTotals.products), secondaryText: 'Продано в приёмах', color: 'secondary' as const },
                            { title: 'Нал + Безнал', primaryValue: formatKGS(financialTotals.cash + financialTotals.card), secondaryText: `Нал: ${formatKGS(financialTotals.cash)} · Безнал: ${formatKGS(financialTotals.card)}`, color: 'success' as const },
                            { title: 'Долги', primaryValue: formatKGS(financialTotals.debt), secondaryText: 'Не оплачено', color: 'warning' as const },
                        ]}
                    />

                    {financialLoading ? <Box sx={{ textAlign: 'center', py: 5, flex: 1 }}><CircularProgress /></Box> : (
                        isMobile ? (
                            <Stack spacing={1.5} sx={{ flex: 1 }}>
                                {dailyData.filter(d => (d.appointments_count + d.procedures_count) > 0).map(day => (
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
                                                        {dayjs(day.date).format('dddd')} • Приемы: {day.appointments_count} | Процедуры: {day.procedures_count}
                                                    </Typography>
                                                </Box>
                                            </Stack>

                                            <Grid2 container spacing={2}>
                                                <Grid2 size={6}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <PaymentsIcon sx={{ fontSize: 14, color: 'primary.main' }} /> Услуги
                                                    </Typography>
                                                    <Typography variant="subtitle1" fontWeight={800}>{formatKGS(Math.max(0, (day.cash_sum + day.card_sum + day.balance_sum + day.bonuses_sum + day.debt_sum) - day.products_sum))}</Typography>
                                                </Grid2>
                                                <Grid2 size={6}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <AnalyticsOutlined sx={{ fontSize: 14, color: 'secondary.main' }} /> Товары
                                                    </Typography>
                                                    <Typography variant="subtitle1" color="secondary.main" fontWeight={800}>{formatKGS(day.products_sum)}</Typography>
                                                </Grid2>
                                                <Grid2 size={6}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <WalletIcon sx={{ fontSize: 14, color: 'success.main' }} /> Наличные
                                                    </Typography>
                                                    <Typography variant="subtitle1" color="success.main" fontWeight={800}>{formatKGS(day.cash_sum)}</Typography>
                                                </Grid2>
                                                <Grid2 size={6}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <CreditCardIcon sx={{ fontSize: 14, color: 'info.main' }} /> Безнал
                                                    </Typography>
                                                    <Typography variant="subtitle1" color="info.main" fontWeight={800}>{formatKGS(day.card_sum)}</Typography>
                                                </Grid2>
                                                {(day.debt_sum > 0) && (
                                                    <Grid2 size={12}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <TrendingDownIcon sx={{ fontSize: 14, color: 'warning.main' }} /> Долг
                                                        </Typography>
                                                        <Typography variant="subtitle1" color="warning.main" fontWeight={800}>
                                                            {formatKGS(day.debt_sum)}
                                                        </Typography>
                                                    </Grid2>
                                                )}
                                            </Grid2>
                                        </CardContent>
                                    </Card>
                                ))}
                                {dailyData.filter(d => (d.appointments_count + d.procedures_count) > 0).length === 0 && (
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
                                                {['Дата', 'Приемы', 'Процедуры', 'В ожидании', 'Мед. услуги', 'Товары', 'Наличные', 'Безнал', 'Долг'].map(h => <TableCell key={h} align={h === 'Дата' ? 'left' : h === 'Приемы' || h === 'Процедуры' || h === 'В ожидании' ? 'center' : 'right'} sx={{ fontWeight: 800, ...(h === 'В ожидании' ? { color: 'error.main' } : {}) }}>{h}</TableCell>)}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dailyData.map(day => (
                                                <TableRow key={day.date} hover sx={{ opacity: (day.appointments_count + day.procedures_count) > 0 ? 1 : 0.6 }}>
                                                    <TableCell sx={{ fontWeight: 600 }}>{dayjs(day.date).format('DD.MM (ddd)')}</TableCell>
                                                    <TableCell align="center">{day.appointments_count > 0 ? day.appointments_count : '-'}</TableCell>
                                                    <TableCell align="center">{day.procedures_count > 0 ? day.procedures_count : '-'}</TableCell>
                                                    <TableCell align="center" sx={{
                                                        fontWeight: day.waiting_count > 0 ? 700 : 400,
                                                        color: (day.waiting_count > 0 && dayjs(day.date).isBefore(dayjs(), 'day')) ? 'error.main' : 'text.secondary'
                                                    }}>
                                                        {day.waiting_count > 0 ? day.waiting_count : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">{formatKGS(Math.max(0, (day.cash_sum + day.card_sum + day.balance_sum + day.bonuses_sum + day.debt_sum) - day.products_sum))}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'secondary.main' }}>{day.products_sum > 0 ? formatKGS(day.products_sum) : '-'}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{formatKGS(day.cash_sum)}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'info.main', fontWeight: 600 }}>{formatKGS(day.card_sum)}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'warning.main' }}>{day.debt_sum > 0 ? formatKGS(day.debt_sum) : '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                                                <TableCell sx={{ fontWeight: 800 }}>ИТОГО</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 800 }}>{financialTotals.appointmentsCount}</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 800 }}>{financialTotals.proceduresCount}</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 800, color: 'error.main' }}>{financialTotals.waitingCount > 0 ? financialTotals.waitingCount : '-'}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800 }}>{formatKGS(financialTotals.services)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'secondary.main' }}>{formatKGS(financialTotals.products)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>{formatKGS(financialTotals.cash)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'info.main' }}>{formatKGS(financialTotals.card)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'warning.main' }}>{formatKGS(financialTotals.debt)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        )
                    )}
                </Stack>
            </Box>
        </Box>
    );
};

export default ReportsPage;

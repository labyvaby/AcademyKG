import React, { useState, useCallback } from "react";
import {
    TableRow,
    TableCell,
    Typography,
    IconButton,
    Box,
    Table,
    TableBody,
    TableHead,
    CircularProgress,
    alpha,
    useTheme,
    Stack,
    Card,
    Divider,
    Collapse,
    Grid2,
    Tooltip,
} from "@mui/material";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { motion, AnimatePresence } from "framer-motion";
import dayjs from "dayjs";
import 'dayjs/locale/ru';

import { formatKGS } from "../../../utility/format";
import { calculateEmployeeSalary, SalaryRules } from "../../../features/employees/utils";

dayjs.locale('ru');

export interface ColumnConfig {
    hours: boolean;        // Дневные / Ночные / Сумма часов
    appointments: boolean; // Все приёмы
    distributed: boolean;  // Распределённые (регистраторы)
    createdBy: boolean;    // Создал (регистраторы)
    statusWaiting: boolean;   // Ожидание
    statusCancelled: boolean; // Отменены
    statusDiscount: boolean;  // Со скидкой
    bonuses: boolean;         // Бонусы
    percent: boolean;      // Зарплата (%)
    appointmentsLabel?: string; // Название колонки приёмов
}

export const COLUMNS_REGISTRATOR: ColumnConfig = { hours: true, appointments: true, distributed: true, createdBy: true, statusWaiting: true, statusCancelled: false, statusDiscount: false, bonuses: true, percent: true, appointmentsLabel: 'Все приёмы' };
export const COLUMNS_DOCTOR: ColumnConfig = { hours: true, appointments: true, distributed: false, createdBy: false, statusWaiting: true, statusCancelled: true, statusDiscount: true, bonuses: false, percent: true, appointmentsLabel: 'Все приёмы' };
export const COLUMNS_NURSE: ColumnConfig = { hours: true, appointments: true, distributed: false, createdBy: false, statusWaiting: false, statusCancelled: true, statusDiscount: false, bonuses: true, percent: true, appointmentsLabel: 'Все приёмы' };
export const COLUMNS_ADMIN: ColumnConfig = { hours: true, appointments: false, distributed: false, createdBy: false, statusWaiting: false, statusCancelled: false, statusDiscount: false, bonuses: false, percent: false };

interface SalaryReportRowProps {
    row: any;
    selectedDate: string;
    salaryRules: SalaryRules;
    allAppointments?: any[];
    allSalaryData?: any[];
    isMobile?: boolean;
    columns?: ColumnConfig;
}

const SalaryReportRow: React.FC<SalaryReportRowProps> = ({ row, selectedDate, salaryRules, allAppointments, allSalaryData, isMobile, columns }) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    const isRegistrator = row.role_name === 'registrator' || row.role_name === 'receptionist';
    const isNurse = row.role_name === 'nurse' || row.role_name === 'procedure';
    const cols = columns ?? (isRegistrator ? COLUMNS_REGISTRATOR : COLUMNS_DOCTOR);

    // Payment status
    // Use gross earnings (before advance deduction) to check if employee earned anything
    const grossEarnings = row.hours_sum + row.percent_sum;
    const isPaid = Math.round(row.total_salary) <= 0 && Math.round(grossEarnings) > 0;

    // Lightweight status check — runs always (needed for row indicator dot)
    const { aggregateStatus, hasWarningShifts } = React.useMemo(() => {
        const shifts = row.raw_shifts || [];
        let hasAnomalous = false;
        let hasActive = false;
        for (const s of shifts) {
            if (!s.clock_out) { hasActive = true; continue; }
            const dur = dayjs(s.clock_out).diff(dayjs(s.clock_in), 'hour', true);
            if (dur > 36) { hasAnomalous = true; }
        }
        const status: 'success' | 'info' | 'error' = hasAnomalous ? 'error' : hasActive ? 'success' : 'info';
        return { aggregateStatus: status, hasWarningShifts: hasAnomalous };
    }, [row.raw_shifts]);

    // Heavy per-day calculation — only runs when row is expanded
    const dailyData = React.useMemo(() => {
        if (!open) return [];

        const startOfMonth = dayjs(selectedDate).startOf('month');
        const daysInMonth = startOfMonth.daysInMonth();
        const daily: any[] = [];

        const shifts = row.raw_shifts || [];
        const appts = row.raw_appointments || [];
        const expenses = row.raw_expenses || [];

        for (let i = 1; i <= daysInMonth; i++) {
            const currentDay = startOfMonth.date(i);
            const dayShifts = shifts.filter((s: any) => dayjs(s.clock_in).isSame(currentDay, 'day'));
            const dayAppts = appts.filter((a: any) => dayjs(a.appointment_at).isSame(currentDay, 'day'));
            const dayExps = expenses.filter((e: any) => dayjs(e.created_at).isSame(currentDay, 'day'));

            const calculation = calculateEmployeeSalary(dayShifts, dayAppts, salaryRules, row.id, dayExps);

            let distributedAppointments = 0;
            let dayCreatedByCount = 0;

            if (isRegistrator && allAppointments) {
                const paidStatuses = ['Оплачено', 'Частично оплачено', 'Со скидкой', 'Бесплатно', 'Завершено'];
                const allCurrentDayAppts = allAppointments.filter(a => dayjs(a.appointment_at).isSame(currentDay, 'day'));

                dayCreatedByCount = allCurrentDayAppts.filter(a =>
                    a.created_by === row.id && paidStatuses.includes(a.status)
                ).length;

                // Shared distribution is now handled at the parent for the whole month
                // This row breakdown will show the share based on what was pre-calculated
                // or we can just derive it proportionally if we really need it here.
                // For performance, we lean on the parent's total or approximate it.
                if (row.distributed_appointments > 0) {
                    const totalMonthHours = (row.day_hours || 0) + (row.night_hours || 0);
                    const dailyHours = calculation.dayHours + calculation.nightHours;
                    // Approximate: distribute total monthly shared count by daily hours proportion
                    distributedAppointments = totalMonthHours > 0
                        ? Math.round((row.distributed_appointments * (dailyHours / totalMonthHours)) * 10) / 10
                        : 0;
                }
            }

            let dayStatus: 'success' | 'info' | 'error' = 'info';
            const hasActive = dayShifts.some((s: any) => !s.clock_out);
            const hasAnomalous = dayShifts.some((s: any) => {
                if (!s.clock_out) return false;
                return dayjs(s.clock_out).diff(dayjs(s.clock_in), 'hour', true) > 36;
            });
            if (hasAnomalous) dayStatus = 'error';
            else if (hasActive) dayStatus = 'success';

            const finalCalc = isRegistrator
                ? calculateEmployeeSalary(dayShifts, dayAppts, salaryRules, row.id, dayExps, distributedAppointments)
                : calculation;

            // Compute per-day bonus
            const dayBonusSum = isRegistrator
                ? (finalCalc.hoursSum - finalCalc.dayHoursSum - finalCalc.nightHoursSum)
                : isNurse
                    ? finalCalc.percentSum
                    : 0;

            daily.push({
                ...finalCalc,
                date: currentDay.format('DD.MM (dd)'),
                isWeekend: currentDay.day() === 0 || currentDay.day() === 6,
                status: dayStatus,
                distributedAppointments,
                dayCreatedByCount,
                dayBonusSum,
            });
        }

        return daily.filter(d =>
            d.totalSalary !== 0 || d.dayHours > 0 || d.nightHours > 0 || d.expensesSum > 0 || d.totalCount > 0
        );
    }, [open, row.raw_shifts, row.raw_appointments, row.raw_expenses, row.id, row.role_name, row.salary_rules, selectedDate, salaryRules, allAppointments, allSalaryData, isRegistrator]);

    const statusLabel = {
        'error': 'Аномалия в часах (>36ч)',
        'success': 'Сотрудник на смене',
        'info': 'Все смены завершены'
    };

    const cardRef = React.useRef<HTMLDivElement>(null);
    const collapseRef = React.useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        setOpen(!open);
    };

    // Scroll into view when collapse content appears
    React.useEffect(() => {
        if (open && collapseRef.current) {
            setTimeout(() => {
                collapseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 350);
        }
    }, [open]);

    // Mobile/tablet card layout
    if (isMobile) {
        return (
            <Card ref={cardRef} variant="outlined" sx={{ borderRadius: 1.5, transition: 'all 0.2s', boxShadow: open ? '0 4px 12px rgba(0,0,0,0.08)' : 'none', border: open ? `1px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ p: 1.25, cursor: 'pointer' }} onClick={handleToggle}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                <Tooltip title={statusLabel[aggregateStatus]}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: `${aggregateStatus}.main`, flexShrink: 0 }} />
                                </Tooltip>
                                <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                                    {row.full_name}
                                </Typography>
                                {isPaid && (
                                    <Box sx={{ px: 0.75, py: 0.15, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.dark', fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Выплачено</Box>
                                )}
                                <Box sx={{ display: 'inline-block', px: 0.75, py: 0.1, borderRadius: 0.75, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                                    <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                        {row.role}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.55rem', lineHeight: 1.2 }}>Итого ЗП</Typography>
                                <Typography fontWeight={800} color="primary.main" sx={{ fontSize: '0.95rem', lineHeight: 1.1 }}>
                                    {formatKGS(row.total_salary)}
                                </Typography>
                            </Box>
                            {open ? <KeyboardArrowUpIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} /> : <KeyboardArrowDownIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />}
                        </Stack>
                    </Stack>

                    <Grid2 container spacing={0.5}>
                        {cols.hours && (
                            <Grid2 size={4}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>Часы</Typography>
                                <Typography sx={{ fontSize: '0.78rem' }} fontWeight={700}>{Math.round((row.day_hours + row.night_hours) * 10) / 10} ч</Typography>
                            </Grid2>
                        )}
                        {cols.createdBy && isRegistrator && (
                            <Grid2 size={4}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>Создал</Typography>
                                <Typography sx={{ fontSize: '0.78rem' }} fontWeight={700} color="success.main">{row.created_by_count ?? 0}</Typography>
                            </Grid2>
                        )}
                        {cols.distributed && isRegistrator && (
                            <Grid2 size={4}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>Распред.</Typography>
                                <Typography sx={{ fontSize: '0.78rem' }} fontWeight={700} color="info.main">{row.distributed_appointments ?? 0}</Typography>
                            </Grid2>
                        )}
                        {cols.appointments && !isRegistrator && (
                            <Grid2 size={4}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>Все приёмы</Typography>
                                <Typography sx={{ fontSize: '0.78rem' }} fontWeight={700}>{row.total_count}</Typography>
                            </Grid2>
                        )}
                        <Grid2 size={4}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>Аванс</Typography>
                            <Typography sx={{ fontSize: '0.78rem' }} fontWeight={700} color="error.main">{formatKGS(row.expenses_sum)}</Typography>
                        </Grid2>
                    </Grid2>
                </Box>

                <Collapse in={open}>
                    <Divider />
                    <Box ref={collapseRef} sx={{ p: 1.5, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                            По дням
                        </Typography>
                        {dailyData.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>Нет данных за месяц</Typography>
                        ) : (
                            <Stack spacing={1.5} sx={{ pr: 0.5 }}>
                                {dailyData.map((day, idx) => (
                                    <Box
                                        key={idx}
                                        sx={{
                                            p: 2,
                                            borderRadius: 1.5,
                                            bgcolor: day.isWeekend ? alpha(theme.palette.info.main, 0.08) : theme.palette.background.paper,
                                            border: `1px solid ${theme.palette.divider}`,
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                        }}
                                    >
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                            <Typography variant="body2" fontWeight={800} color={day.isWeekend ? 'info.main' : 'text.primary'}>
                                                {day.date}
                                            </Typography>
                                            <Typography variant="body1" fontWeight={800} color="primary.main">
                                                {formatKGS(day.totalSalary)}
                                            </Typography>
                                        </Stack>

                                        <Grid2 container spacing={2}>
                                            <Grid2 size={4}>
                                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', mb: 0.5 }}>Часы</Typography>
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    <Typography variant="body2" fontWeight={700}>{Math.round(day.dayHours * 10) / 10} / {Math.round(day.nightHours * 10) / 10}</Typography>
                                                    {day.hasWarning && (
                                                        <Tooltip title="Аномальная длительность (> 36ч)">
                                                            <ReportProblemIcon sx={{ color: 'error.main', fontSize: '0.85rem' }} />
                                                        </Tooltip>
                                                    )}
                                                </Stack>
                                            </Grid2>
                                            {isRegistrator ? (
                                                <>
                                                    <Grid2 size={4}>
                                                        <Typography variant="caption" color="success.main" sx={{ fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', mb: 0.5 }}>Создал</Typography>
                                                        <Typography variant="body2" fontWeight={700} color="success.main">{day.dayCreatedByCount ?? 0}</Typography>
                                                    </Grid2>
                                                    <Grid2 size={4}>
                                                        <Typography variant="caption" color="info.main" sx={{ fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', mb: 0.5 }}>Распред.</Typography>
                                                        <Typography variant="body2" fontWeight={700} color="info.main">{day.distributedAppointments ?? 0}</Typography>
                                                    </Grid2>
                                                </>
                                            ) : (
                                                <Grid2 size={4}>
                                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', mb: 0.5 }}>Приемы</Typography>
                                                    <Typography variant="body2" fontWeight={700}>{day.appointmentsCount}</Typography>
                                                </Grid2>
                                            )}
                                            <Grid2 size={4}>
                                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', mb: 0.5 }}>Процент</Typography>
                                                <Typography variant="body2" fontWeight={700}>{formatKGS(day.percentSum)}</Typography>
                                            </Grid2>
                                            {day.expensesSum > 0 && (
                                                <Grid2 size={12}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                                        <Typography variant="caption" color="error.main" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
                                                            ВЫПЛАЧЕНО: {formatKGS(day.expensesSum)}
                                                        </Typography>
                                                    </Box>
                                                </Grid2>
                                            )}
                                        </Grid2>
                                    </Box>
                                ))}
                                <Box sx={{ pt: 1, pb: 0.5, display: 'flex', justifyContent: 'center' }}>
                                    <Typography
                                        variant="caption"
                                        fontWeight={800}
                                        color="primary.main"
                                        sx={{
                                            cursor: 'pointer',
                                            textTransform: 'uppercase',
                                            letterSpacing: 1,
                                            p: 1,
                                            '&:hover': { opacity: 0.8 }
                                        }}
                                        onClick={handleToggle}
                                    >
                                        Свернуть
                                    </Typography>
                                </Box>
                            </Stack>
                        )}
                    </Box>
                </Collapse>
            </Card>
        );
    }

    // Desktop table row layout
    return (
        <>
            <TableRow
                hover
                onClick={handleToggle}
                sx={{
                    cursor: 'pointer',
                    '&:last-child td': { border: 0 },
                    bgcolor: open ? alpha(theme.palette.primary.main, 0.02) : 'inherit'
                }}
            >
                <TableCell sx={{ py: 1.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton size="small">
                            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                        <Typography variant="body2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center' }}>
                            <Tooltip title={statusLabel[aggregateStatus]}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: `${aggregateStatus}.main`, mr: 1.5, flexShrink: 0 }} />
                            </Tooltip>
                            {row.full_name}
                            {hasWarningShifts && (
                                <Tooltip title="Внимание: обнаружены аномально долгие смены, часы были ограничены">
                                    <ReportProblemIcon sx={{ ml: 1, color: 'error.main', fontSize: '1rem' }} />
                                </Tooltip>
                            )}
                        </Typography>
                        {isPaid && (
                            <Box sx={{ ml: 1, px: 0.75, py: 0.2, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.dark', fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Выплачено</Box>
                        )}
                    </Stack>
                </TableCell>
                {cols.hours && <TableCell align="center">{Math.round(row.day_hours * 10) / 10}</TableCell>}
                {cols.hours && <TableCell align="center">{Math.round(row.night_hours * 10) / 10}</TableCell>}
                {cols.hours && <TableCell align="right">{formatKGS(isRegistrator ? (row.day_hours_sum + row.night_hours_sum) : row.hours_sum)}</TableCell>}
                {cols.appointments && (
                    <TableCell align="center">
                        <Tooltip title={`Оплачено: ${row.paid_count} · Отменено: ${row.cancelled_count} · Ожидание: ${row.waiting_count}`} placement="top">
                            <Typography variant="body2" sx={{ cursor: 'default' }}>{row.total_count}</Typography>
                        </Tooltip>
                    </TableCell>
                )}
                {cols.distributed && (
                    <TableCell align="center">
                        <Typography variant="body2" fontWeight={700} color="info.main">
                            {row.distributed_appointments ?? 0}
                        </Typography>
                    </TableCell>
                )}
                {cols.createdBy && (
                    <TableCell align="center">
                        <Typography variant="body2" fontWeight={700} color="success.main">
                            {row.created_by_count ?? 0}
                        </Typography>
                    </TableCell>
                )}
                {cols.statusWaiting && <TableCell align="center">{row.waiting_count}</TableCell>}
                {cols.statusCancelled && <TableCell align="center">{row.cancelled_count}</TableCell>}
                {cols.statusDiscount && <TableCell align="center">{row.discounted_count}</TableCell>}
                {cols.bonuses && <TableCell align="right">{formatKGS(isRegistrator ? (row.hours_sum - row.day_hours_sum - row.night_hours_sum) : row.percent_sum)}</TableCell>}
                {cols.percent && <TableCell align="right">{formatKGS(isRegistrator ? row.hours_sum : isNurse ? (row.hours_sum + row.percent_sum) : row.percent_sum)}</TableCell>}
                <TableCell align="right">
                    <Typography variant="body2" fontWeight={700} color="error.main">{formatKGS(row.expenses_sum)}</Typography>
                </TableCell>
                <TableCell align="right">
                    <Typography variant="body2" fontWeight={800} color="primary.main">{formatKGS(row.total_salary)}</Typography>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0, borderBottom: 'none' }} colSpan={
                    1 + (cols.hours ? 3 : 0) + (cols.appointments ? 1 : 0) + (cols.distributed ? 1 : 0) + (cols.createdBy ? 1 : 0) + (cols.statusWaiting ? 1 : 0) + (cols.statusCancelled ? 1 : 0) + (cols.statusDiscount ? 1 : 0) + (cols.bonuses ? 1 : 0) + (cols.percent ? 1 : 0) + 2
                }>
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                style={{ overflow: 'hidden' }}
                            >
                                <Box sx={{ py: 2, pl: 6, pr: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={800} color="text.secondary">
                                        Детализация по дням
                                    </Typography>
                                    {dailyData.length === 0 ? (
                                        <Typography variant="caption" color="text.secondary" sx={{ py: 2, display: 'block' }}>
                                            Нет данных за этот период
                                        </Typography>
                                    ) : (
                                        <Table size="small" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: 'hidden' }}>
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: alpha(theme.palette.info.main, 0.15) }}>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Дата</TableCell>
                                                    {cols.hours && <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Дн. часы</TableCell>}
                                                    {cols.hours && <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Ноч. часы</TableCell>}
                                                    {cols.hours && <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Сумма ч.</TableCell>}
                                                    {cols.appointments && <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Все</TableCell>}
                                                    {cols.distributed && <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'info.main' }}>Распред.</TableCell>}
                                                    {cols.createdBy && <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'success.main' }}>Создал</TableCell>}
                                                    {cols.statusWaiting && <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Ожид.</TableCell>}
                                                    {cols.statusCancelled && <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Отмен.</TableCell>}
                                                    {cols.statusDiscount && <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Скидка</TableCell>}
                                                    {cols.bonuses && <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Бонусы</TableCell>}
                                                    {cols.percent && <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Зарплата</TableCell>}
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'error.main' }}>Аванс</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'primary.main' }}>К выплате</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {dailyData.map((day, idx) => (
                                                    <TableRow key={idx} sx={{ bgcolor: day.isWeekend ? alpha(theme.palette.info.main, 0.05) : 'inherit' }}>
                                                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: day.isWeekend ? 700 : 400 }}>{day.date}</TableCell>
                                                        {cols.hours && (
                                                            <TableCell align="center" sx={{ fontSize: '0.75rem', color: day.status === 'error' ? 'error.main' : day.status === 'success' ? 'success.main' : 'inherit', fontWeight: day.status !== 'info' ? 700 : 400 }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {Math.round(day.dayHours * 10) / 10}
                                                                    {day.hasWarning && <Tooltip title="Аномальная длительность (> 36ч)"><ReportProblemIcon sx={{ ml: 0.5, color: 'error.main', fontSize: '0.9rem' }} /></Tooltip>}
                                                                </Box>
                                                            </TableCell>
                                                        )}
                                                        {cols.hours && (
                                                            <TableCell align="center" sx={{ fontSize: '0.75rem', color: day.status === 'error' ? 'error.main' : day.status === 'success' ? 'success.main' : 'inherit', fontWeight: day.status !== 'info' ? 700 : 400 }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {Math.round(day.nightHours * 10) / 10}
                                                                    {day.hasWarning && <Tooltip title="Аномальная длительность (> 36ч)"><ReportProblemIcon sx={{ ml: 0.5, color: 'error.main', fontSize: '0.9rem' }} /></Tooltip>}
                                                                </Box>
                                                            </TableCell>
                                                        )}
                                                        {cols.hours && <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatKGS(isRegistrator ? (day.dayHoursSum + day.nightHoursSum) : day.hoursSum)}</TableCell>}
                                                        {cols.appointments && <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{day.totalCount}</TableCell>}
                                                        {cols.distributed && <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'info.main' }}>{day.distributedAppointments ?? 0}</TableCell>}
                                                        {cols.createdBy && <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'success.main' }}>{day.dayCreatedByCount ?? 0}</TableCell>}
                                                        {cols.statusWaiting && <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{day.waitingCount}</TableCell>}
                                                        {cols.statusCancelled && <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{day.cancelledCount}</TableCell>}
                                                        {cols.statusDiscount && <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{day.discountedCount}</TableCell>}
                                                        {cols.bonuses && <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatKGS(day.dayBonusSum ?? 0)}</TableCell>}
                                                        {cols.percent && <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatKGS(isRegistrator ? day.hoursSum : isNurse ? (day.hoursSum + day.percentSum) : day.percentSum)}</TableCell>}
                                                        <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'error.main' }}>{formatKGS(day.expensesSum)}</TableCell>
                                                        <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'primary.dark' }}>{formatKGS(day.totalSalary)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </Box>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </TableCell>
            </TableRow>
        </>
    );
};

export default SalaryReportRow;

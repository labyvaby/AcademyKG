import React, { useState } from "react";
import {
    TableRow,
    TableCell,
    Typography,
    Box,
    alpha,
    useTheme,
    Stack,
    Card,
    Collapse,
    Grid2,
    Tooltip,
    IconButton,
    Table,
    TableHead,
    TableBody,
    CircularProgress,
    Chip,
} from "@mui/material";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { useReportCurrency } from "../../../hooks/useReportBranchScope";
import { PayrollRow } from "../../../types/reports";
import { fetchShifts, Shift } from "../../../services/shifts";
import dayjs from "dayjs";
import SpecialistPayslipDialog from "./SpecialistPayslipDialog";

interface SalaryReportRowProps {
    row: PayrollRow;
    isMobile?: boolean;
    month: string; // YYYY-MM
}

// Цветовая палитра
const COLORS = {
    day: '#3B82F6',
    advance: '#F59E0B',
    payout: '#10B981',
    deduction: '#EF4444',
    netSalary: '#0EA5E9',
    paid: '#10B981',
};

function calcShiftHours(shift: Shift): number {
    if (!shift.startTime || !shift.endTime) return 0;
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const [eh, em] = shift.endTime.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return Math.round(mins / 60 * 10) / 10;
}

const DailyBreakdown: React.FC<{ employeeId: string; month: string }> = ({ employeeId, month }) => {
    const theme = useTheme();
    const [shifts, setShifts] = React.useState<Shift[] | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setShifts(null);

        const start = dayjs(month + '-01');
        const end = start.endOf('month');

        // Загружаем смены за месяц
        fetchShifts({ employee: employeeId, date: start.format('YYYY-MM-DD') })
            .then((data) => {
                if (!cancelled) {
                    // Фильтруем по месяцу на случай если API вернул лишнее
                    const filtered = data.filter(s => s.shiftDate?.startsWith(month));
                    setShifts(filtered.sort((a, b) => (a.shiftDate ?? '').localeCompare(b.shiftDate ?? '')));
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) { setShifts([]); setLoading(false); }
            });

        return () => { cancelled = true; };
    }, [employeeId, month]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} thickness={4} />
            </Box>
        );
    }

    if (!shifts || shifts.length === 0) {
        return (
            <Box sx={{ py: 1.5, px: 2 }}>
                <Typography variant="caption" color="text.disabled">Нет данных о сменах за этот месяц</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ px: 1, pb: 1 }}>
            <Table size="small" sx={{ '& td, & th': { fontSize: '0.75rem', py: 0.6, px: 1.5, border: 'none' } }}>
                <TableHead>
                    <TableRow sx={{ '& th': { color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' } }}>
                        <TableCell>Дата</TableCell>
                        <TableCell align="center">Тип</TableCell>
                        <TableCell align="center">Начало</TableCell>
                        <TableCell align="center">Конец</TableCell>
                        <TableCell align="center">Часов</TableCell>
                        <TableCell align="center">Статус</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {shifts.map((shift, idx) => {
                        const hours = calcShiftHours(shift);
                        const hasClockIn = !!shift.clockIn;
                        const hasClockOut = !!shift.clockOut;
                        const isOpen = hasClockIn && !hasClockOut;
                        const isClosed = hasClockIn && hasClockOut;

                        return (
                            <TableRow
                                key={shift.id}
                                sx={{
                                    bgcolor: idx % 2 === 0
                                        ? alpha(theme.palette.action.hover, 0.3)
                                        : 'transparent',
                                    borderRadius: 1,
                                }}
                            >
                                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>
                                    {dayjs(shift.shiftDate).format('DD MMM')}
                                    <Typography component="span" sx={{ ml: 0.5, fontSize: '0.65rem', color: 'text.disabled' }}>
                                        {dayjs(shift.shiftDate).format('dd')}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center">
                                    <WbSunnyOutlinedIcon sx={{ fontSize: '0.9rem', color: COLORS.day, verticalAlign: 'middle' }} />
                                </TableCell>
                                <TableCell align="center" sx={{ color: 'text.secondary' }}>
                                    {shift.startTime || '—'}
                                </TableCell>
                                <TableCell align="center" sx={{ color: 'text.secondary' }}>
                                    {shift.endTime || '—'}
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: COLORS.day }}>
                                    {hours > 0 ? `${hours}ч` : '—'}
                                </TableCell>
                                <TableCell align="center">
                                    {isClosed
                                        ? <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 0.75, bgcolor: alpha(COLORS.paid, 0.12), color: COLORS.paid, fontWeight: 700, fontSize: '0.65rem' }}>Закрыта</Box>
                                        : isOpen
                                            ? <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 0.75, bgcolor: alpha(COLORS.advance, 0.12), color: COLORS.advance, fontWeight: 700, fontSize: '0.65rem' }}>Открыта</Box>
                                            : <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 0.75, bgcolor: alpha(theme.palette.text.disabled, 0.1), color: 'text.disabled', fontWeight: 700, fontSize: '0.65rem' }}>Запланирована</Box>
                                    }
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Box>
    );
};

const SalaryReportRow: React.FC<SalaryReportRowProps> = ({ row, isMobile, month }) => {
    const theme = useTheme();
    const { format: formatKGS } = useReportCurrency();
    const [open, setOpen] = useState(false);
    const [payslipOpen, setPayslipOpen] = useState(false);

    const openPayslip = (e: React.MouseEvent) => {
        e.stopPropagation();
        setPayslipOpen(true);
    };

    const statusColor = row.status?.code === 'green'
        ? COLORS.paid
        : row.status?.code === 'red'
            ? COLORS.deduction
            : COLORS.day;

    const payslipDialog = (
        <SpecialistPayslipDialog
            open={payslipOpen}
            onClose={() => setPayslipOpen(false)}
            employeeId={row.employeeId}
            employeeName={row.fullName}
            month={month}
        />
    );

    if (isMobile) {
        return (
            <>
            <Card
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    transition: 'box-shadow 0.2s',
                    boxShadow: open ? '0 2px 12px rgba(0,0,0,0.07)' : 'none',
                    border: `1px solid`,
                    borderColor: open ? alpha(COLORS.netSalary, 0.4) : 'divider',
                }}
            >
                <Box sx={{ p: 1.5, cursor: 'pointer', userSelect: 'none' }} onClick={() => setOpen(v => !v)}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: statusColor, flexShrink: 0, mt: 0.3 }} />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={700} noWrap>{row.fullName}</Typography>
                                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>{row.roleName}</Typography>
                                    {row.paidOut && (
                                        <Chip label="Выплачено" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: alpha(COLORS.paid, 0.12), color: COLORS.paid, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
                                    )}
                                </Stack>
                            </Box>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Tooltip title="Скачать расчётный лист (PDF)">
                                <IconButton size="small" onClick={openPayslip} sx={{ p: 0.5, color: COLORS.netSalary }}>
                                    <PictureAsPdfOutlinedIcon sx={{ fontSize: '1.05rem' }} />
                                </IconButton>
                            </Tooltip>
                            <Box textAlign="right">
                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem', display: 'block' }}>К выплате</Typography>
                                <Typography fontWeight={800} sx={{ color: COLORS.netSalary, fontSize: '0.95rem', lineHeight: 1.1 }}>
                                    {formatKGS(row.netSalary)}
                                </Typography>
                            </Box>
                            <Box sx={{ color: 'text.disabled', display: 'flex' }}>
                                {open ? <KeyboardArrowUpIcon sx={{ fontSize: '1rem' }} /> : <KeyboardArrowDownIcon sx={{ fontSize: '1rem' }} />}
                            </Box>
                        </Stack>
                    </Stack>

                    <Grid2 container spacing={1} sx={{ mt: 1 }}>
                        <Grid2 size={4}>
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem', display: 'block' }}>Часы</Typography>
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: COLORS.day }}>{row.dayHours}</Typography>
                        </Grid2>
                        <Grid2 size={4}>
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem', display: 'block' }}>Приемы</Typography>
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{row.paidAppointmentsCount}</Typography>
                        </Grid2>
                        <Grid2 size={4}>
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem', display: 'block' }}>Аванс</Typography>
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: COLORS.advance }}>{formatKGS(row.advancesSum)}</Typography>
                        </Grid2>
                    </Grid2>
                </Box>

                <Collapse in={open} timeout="auto" unmountOnExit>
                    <Box sx={{ borderTop: `1px solid`, borderColor: 'divider', px: 1.5, pt: 1.25, pb: 0.5 }}>
                        <Grid2 container spacing={1} sx={{ mb: 1 }}>
                            <Grid2 size={6}>
                                <Typography variant="caption" color="text.disabled">ЗП (%)</Typography>
                                <Typography fontWeight={700} sx={{ fontSize: '0.85rem' }}>{formatKGS(row.percentSum)}</Typography>
                            </Grid2>
                            <Grid2 size={6}>
                                <Typography variant="caption" color="text.disabled">Оклад</Typography>
                                <Typography fontWeight={700} sx={{ fontSize: '0.85rem' }}>{formatKGS(row.fixedSum)}</Typography>
                            </Grid2>
                            <Grid2 size={4}>
                                <Typography variant="caption" color="text.disabled">Выплаты</Typography>
                                <Typography fontWeight={700} sx={{ fontSize: '0.85rem', color: COLORS.payout }}>{formatKGS(row.payoutsSum)}</Typography>
                            </Grid2>
                            <Grid2 size={4}>
                                <Typography variant="caption" color="text.disabled">Удержания</Typography>
                                <Typography fontWeight={700} sx={{ fontSize: '0.85rem', color: COLORS.deduction }}>{formatKGS(row.deductionsSum)}</Typography>
                            </Grid2>
                            <Grid2 size={4}>
                                <Typography variant="caption" color="text.disabled">Списано</Typography>
                                <Typography fontWeight={700} sx={{ fontSize: '0.85rem' }}>{formatKGS(row.expensesSum)}</Typography>
                            </Grid2>
                        </Grid2>
                    </Box>
                    <Box sx={{ borderTop: `1px dashed`, borderColor: alpha(theme.palette.divider, 0.5), pb: 1 }}>
                        <Typography variant="caption" color="text.disabled" sx={{ px: 1.5, pt: 1, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}>
                            Смены за месяц
                        </Typography>
                        <DailyBreakdown employeeId={row.employeeId} month={month} />
                    </Box>
                </Collapse>
            </Card>
            {payslipDialog}
            </>
        );
    }

    // Desktop
    return (
        <>
            <TableRow
                hover
                onClick={() => setOpen(v => !v)}
                sx={{
                    cursor: 'pointer',
                    '&:last-child td': { border: 0 },
                    bgcolor: open ? alpha(COLORS.netSalary, 0.03) : 'transparent',
                    transition: 'background 0.15s',
                }}
            >
                <TableCell sx={{ py: 1.25 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <IconButton size="small" sx={{ p: 0.25, color: open ? COLORS.netSalary : 'text.disabled' }}>
                            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: statusColor, flexShrink: 0 }} />
                        <Box>
                            <Typography variant="body2" fontWeight={700}>{row.fullName}</Typography>
                            <Typography variant="caption" color="text.disabled">{row.roleName}</Typography>
                        </Box>
                        {row.status?.hasWarning && (
                            <Tooltip title="Есть предупреждения по сменам">
                                <ReportProblemIcon sx={{ color: COLORS.advance, fontSize: '0.95rem' }} />
                            </Tooltip>
                        )}
                        {row.paidOut && (
                            <Chip label="Выплачено" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: alpha(COLORS.paid, 0.1), color: COLORS.paid, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
                        )}
                        <Tooltip title="Скачать расчётный лист (PDF)">
                            <IconButton size="small" onClick={openPayslip} sx={{ p: 0.5, color: COLORS.netSalary }}>
                                <PictureAsPdfOutlinedIcon sx={{ fontSize: '1.05rem' }} />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </TableCell>
                <TableCell align="center">
                    <Typography variant="body2" fontWeight={600} sx={{ color: COLORS.day }}>{row.dayHours}</Typography>
                </TableCell>
                <TableCell align="center">{row.paidAppointmentsCount}</TableCell>
                {row.distributedAppointmentsCount !== undefined && (
                    <TableCell align="center" sx={{ color: COLORS.day, fontWeight: 600 }}>{row.distributedAppointmentsCount}</TableCell>
                )}
                <TableCell align="right">{formatKGS(row.percentSum)}</TableCell>
                <TableCell align="right">{formatKGS(row.fixedSum)}</TableCell>
                <TableCell align="right" sx={{ color: COLORS.advance, fontWeight: 600 }}>{formatKGS(row.advancesSum)}</TableCell>
                <TableCell align="right" sx={{ color: COLORS.payout, fontWeight: 600 }}>{formatKGS(row.payoutsSum)}</TableCell>
                <TableCell align="right" sx={{ color: COLORS.deduction, fontWeight: 600 }}>{formatKGS(row.deductionsSum)}</TableCell>
                <TableCell align="right">{formatKGS(row.expensesSum)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, color: COLORS.netSalary }}>{formatKGS(row.netSalary)}</TableCell>
            </TableRow>
            <TableRow sx={{ '& td': { py: 0, border: 0 } }}>
                <TableCell colSpan={11} sx={{ p: 0 }}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ bgcolor: alpha(COLORS.netSalary, 0.02), borderBottom: `1px solid`, borderColor: 'divider' }}>
                            <Typography variant="caption" color="text.disabled" sx={{ px: 3, pt: 1.5, pb: 0.5, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                                Детализация по сменам
                            </Typography>
                            <DailyBreakdown employeeId={row.employeeId} month={month} />
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
            {payslipDialog}
        </>
    );
};

export default SalaryReportRow;

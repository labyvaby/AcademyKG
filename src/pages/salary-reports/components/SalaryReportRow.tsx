import React, { useState } from "react";
import {
    TableRow,
    TableCell,
    Typography,
    IconButton,
    Box,
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
import { formatKGS } from "../../../utility/format";
import { PayrollRow } from "../../../types/reports";

interface SalaryReportRowProps {
    row: PayrollRow;
    isMobile?: boolean;
    columns?: any; // For desktop columns configuration
}

const SalaryReportRow: React.FC<SalaryReportRowProps> = ({ row, isMobile, columns }) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    const handleToggle = () => {
        setOpen(!open);
    };

    const statusColor = row.status?.code === 'green' ? 'success' : row.status?.code === 'red' ? 'error' : 'info';

    if (isMobile) {
        return (
            <Card variant="outlined" sx={{ 
                borderRadius: 1.5, 
                transition: 'all 0.2s', 
                boxShadow: open ? '0 4px 12px rgba(0,0,0,0.08)' : 'none', 
                border: open ? `1px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}` 
            }}>
                <Box sx={{ p: 1.25, cursor: 'pointer' }} onClick={handleToggle}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: `${statusColor}.main`, flexShrink: 0 }} />
                                <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                                    {row.fullName}
                                </Typography>
                                {row.paidOut && (
                                    <Box sx={{ px: 0.75, py: 0.15, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.dark', fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Выплачено</Box>
                                )}
                                <Box sx={{ display: 'inline-block', px: 0.75, py: 0.1, borderRadius: 0.75, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                                    <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                        {row.roleName}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.55rem', lineHeight: 1.2 }}>К выплате</Typography>
                                <Typography fontWeight={800} color="primary.main" sx={{ fontSize: '0.95rem', lineHeight: 1.1 }}>
                                    {formatKGS(row.netSalary)}
                                </Typography>
                            </Box>
                            {open ? <KeyboardArrowUpIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} /> : <KeyboardArrowDownIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />}
                        </Stack>
                    </Stack>

                    <Grid2 container spacing={0.5}>
                        <Grid2 size={4}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>Часы (Д/Н)</Typography>
                            <Typography sx={{ fontSize: '0.78rem' }} fontWeight={700}>{row.dayHours} / {row.nightHours}</Typography>
                        </Grid2>
                        <Grid2 size={4}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>Приемы</Typography>
                            <Typography sx={{ fontSize: '0.78rem' }} fontWeight={700}>{row.paidAppointmentsCount}</Typography>
                        </Grid2>
                        <Grid2 size={4}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>Аванс</Typography>
                            <Typography sx={{ fontSize: '0.78rem' }} fontWeight={700} color="error.main">{formatKGS(row.expensesSum)}</Typography>
                        </Grid2>
                    </Grid2>
                </Box>
                {/* 
                   Note: The new API contract currently doesn't provide daily breakdown. 
                   If it's added in the future, Collapse content can be implemented here.
                */}
            </Card>
        );
    }

    return (
        <TableRow hover sx={{ '&:last-child td': { border: 0 } }}>
            <TableCell sx={{ py: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: `${statusColor}.main`, flexShrink: 0 }} />
                    <Box>
                        <Typography variant="body2" fontWeight={700}>
                            {row.fullName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{row.roleName}</Typography>
                    </Box>
                    {row.status?.hasWarning && (
                        <Tooltip title="Внимание: есть предупреждения по сменам">
                            <ReportProblemIcon sx={{ color: 'error.main', fontSize: '1rem' }} />
                        </Tooltip>
                    )}
                    {row.paidOut && (
                        <Box sx={{ px: 0.75, py: 0.2, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.dark', fontSize: '0.65rem', fontWeight: 700 }}>✓ Выплачено</Box>
                    )}
                </Stack>
            </TableCell>
            <TableCell align="center">{row.dayHours}</TableCell>
            <TableCell align="center">{row.nightHours}</TableCell>
            <TableCell align="center">{row.paidAppointmentsCount}</TableCell>
            {row.distributedAppointmentsCount !== undefined && <TableCell align="center" sx={{ color: 'info.main', fontWeight: 600 }}>{row.distributedAppointmentsCount}</TableCell>}
            <TableCell align="right">{formatKGS(row.percentSum)}</TableCell>
            <TableCell align="right">{formatKGS(row.fixedSum)}</TableCell>
            <TableCell align="right" sx={{ color: 'error.main' }}>{formatKGS(row.expensesSum)}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>{formatKGS(row.netSalary)}</TableCell>
        </TableRow>
    );
};

export default SalaryReportRow;

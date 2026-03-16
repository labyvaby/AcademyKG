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
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { PageHeader, MonthNavigation } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { useActiveMonths } from "../../hooks/useActiveMonths";
import { formatKGS } from "../../utility/format";
import { getPayrollReport } from "../../services/reports";
import { PayrollReportResponse, PayrollGroup } from "../../types/reports";
import dayjs from "dayjs";
import SalaryReportRow from "./components/SalaryReportRow";

const SalaryReportsPage: React.FC = () => {
    usePageTitle("Отчет по ЗП");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
    const { open: notify } = useNotification();
    const { isSuperAdmin, hasRole, loading: permissionsLoading } = usePermissions();

    const canSeeAll = useMemo(() => isSuperAdmin() || hasRole(['accountant', 'admin', 'manager']), [isSuperAdmin, hasRole]);

    // State
    const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<PayrollReportResponse | null>(null);
    const activeMonths = useActiveMonths('AppointmentsAggregated', 'appointment_at');

    const fetchData = useCallback(async () => {
        if (permissionsLoading) return;

        try {
            setLoading(true);
            const month = dayjs(selectedDate).format('YYYY-MM');
            const res = await getPayrollReport(month);
            if (res?.data) {
                setReportData(res.data);
            }
        } catch (e: any) {
            console.error(e);
            notify?.({ type: "error", message: e.message || "Ошибка загрузки данных зарплаты" });
        } finally {
            setLoading(false);
        }
    }, [selectedDate, notify, permissionsLoading]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (permissionsLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
    );

    const { groups = [], totals = {} as any, summary = {} as any } = reportData || {};

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
                minHeight: 0
            })}>
                <Stack spacing={{ xs: 2, md: 3 }} sx={{ display: 'flex', flexDirection: 'column' }}>

                    {/* Summary Indicators */}
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="space-around">
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', display: 'flex' }}>
                                    <ReportProblemIcon />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight={800}>{summary.warningsCount || 0}</Typography>
                                    <Typography variant="caption" color="text.secondary">Предупреждений</Typography>
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.1), color: 'info.main', display: 'flex' }}>
                                    <AccessTimeIcon />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight={800}>{summary.openShiftsCount || 0}</Typography>
                                    <Typography variant="caption" color="text.secondary">Открытых смен</Typography>
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', display: 'flex' }}>
                                    <CheckCircleOutlineIcon />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight={800}>{summary.paidOutCount || 0}</Typography>
                                    <Typography variant="caption" color="text.secondary">Выплачено</Typography>
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                                    <Typography fontWeight={800}>KGS</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight={800}>{formatKGS(summary.totalNetSalary || 0)}</Typography>
                                    <Typography variant="caption" color="text.secondary">Итого к выплате</Typography>
                                </Box>
                            </Stack>
                        </Stack>
                    </Paper>

                    {loading ? (
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
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, px: 1 }}>
                                    <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                                        {group.title}
                                    </Typography>
                                    <Typography variant="caption" fontWeight={700}>
                                        Итого по группе: {formatKGS(group.totals.netSalary)}
                                    </Typography>
                                </Stack>
                                {isMobile ? (
                                    <Stack spacing={1}>
                                        {group.rows.map((row) => (
                                            <SalaryReportRow key={row.employeeId} row={row} isMobile />
                                        ))}
                                    </Stack>
                                ) : (
                                    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: alpha(theme.palette.action.hover, 0.5) }}>
                                                    <TableCell sx={{ fontWeight: 800 }}>Сотрудник</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 800 }}>День (ч)</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 800 }}>Ночь (ч)</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 800 }}>Приемы</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 800, color: 'info.main' }}>Распред.</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800 }}>ЗП (%)</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800 }}>Оклад</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>Аванс</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>К выплате</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {group.rows.map((row) => (
                                                    <SalaryReportRow key={row.employeeId} row={row} />
                                                ))}
                                                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                                                    <TableCell colSpan={7} sx={{ fontWeight: 800 }}>ИТОГО {group.title.toUpperCase()}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>{formatKGS(group.totals.expensesSum)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>{formatKGS(group.totals.netSalary)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </Paper>
                                )}
                            </Box>
                        ))
                    )}

                    {/* Overall Totals */}
                    {!loading && reportData && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.05), border: `2px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="h6" fontWeight={800}>ОБЩИЙ ИТОГ</Typography>
                                <Stack direction="row" spacing={4}>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="text.secondary">Грязная ЗП</Typography>
                                        <Typography variant="h6" fontWeight={700}>{formatKGS(totals.grossEarnings)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="error.main">Авансы</Typography>
                                        <Typography variant="h6" fontWeight={700} color="error.main">{formatKGS(totals.expensesSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="primary.main">К выплате</Typography>
                                        <Typography variant="h5" fontWeight={900} color="primary.main">{formatKGS(totals.netSalary)}</Typography>
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

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
    const { isSuperAdmin, hasRole, loading: permissionsLoading } = usePermissions();
    const { selectedBranch } = useBranchContext();

    const canSeeAll = useMemo(() => isSuperAdmin() || hasRole(['accountant', 'admin', 'manager']), [isSuperAdmin, hasRole]);

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
                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 1.5, flexShrink: 0 }}>
                    <Tooltip title="Экспорт в Excel (CSV)">
                        <span>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<FileDownloadOutlined />}
                                onClick={exportCSV}
                                disabled={!visibleReportData || groups.length === 0}
                                sx={{ borderRadius: 2 }}
                            >
                                Excel
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip title="Печать / Сохранить как PDF">
                        <span>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<PrintOutlined />}
                                onClick={() => window.print()}
                                disabled={!visibleReportData || groups.length === 0}
                                sx={{ borderRadius: 2 }}
                            >
                                PDF
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
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
                                    <Typography variant="h6" fontWeight={800}>{formatKGS(netSalaryTotal)}</Typography>
                                    <Typography variant="caption" color="text.secondary">Итого к выплате</Typography>
                                </Box>
                            </Stack>
                        </Stack>
                    </Paper>

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
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'warning.main' }}>Выплаты</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800 }}>Удерж.</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800 }}>Списано</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>К выплате</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {group.rows.map((row) => (
                                                    <SalaryReportRow key={row.employeeId} row={row} />
                                                ))}
                                                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                                                    <TableCell colSpan={7} sx={{ fontWeight: 800 }}>ИТОГО {group.title.toUpperCase()}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>{formatKGS(group.totals.advancesSum)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'warning.main' }}>{formatKGS(group.totals.payoutsSum)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{formatKGS(group.totals.deductionsSum)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{formatKGS(group.totals.expensesSum)}</TableCell>
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
                    {!effectiveLoading && visibleReportData && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.05), border: `2px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="h6" fontWeight={800}>ОБЩИЙ ИТОГ</Typography>
                                <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="text.secondary">Грязная ЗП</Typography>
                                        <Typography variant="h6" fontWeight={700}>{formatKGS(totals.grossEarnings)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="error.main">Авансы</Typography>
                                        <Typography variant="h6" fontWeight={700} color="error.main">{formatKGS(totals.advancesSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="warning.main">Выплаты</Typography>
                                        <Typography variant="h6" fontWeight={700} color="warning.main">{formatKGS(totals.payoutsSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="text.secondary">Удержания</Typography>
                                        <Typography variant="h6" fontWeight={700}>{formatKGS(totals.deductionsSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="text.secondary">Всего списано</Typography>
                                        <Typography variant="h6" fontWeight={700}>{formatKGS(totals.expensesSum)}</Typography>
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="primary.main">К выплате</Typography>
                                        <Typography variant="h5" fontWeight={900} color="primary.main">{formatKGS(netSalaryTotal)}</Typography>
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

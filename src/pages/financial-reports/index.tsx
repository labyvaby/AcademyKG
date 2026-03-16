import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Box,
    Grid2,
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
    alpha,
    CircularProgress,
    Avatar
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardIcon from '@mui/icons-material/CreditCard';
import WalletIcon from '@mui/icons-material/Wallet';
import BusinessCenterOutlined from '@mui/icons-material/BusinessCenterOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';

import { PageHeader, MonthNavigation } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { useActiveMonths } from "../../hooks/useActiveMonths";
import { formatKGS } from "../../utility/format";
import { getFinancialReport } from "../../services/reports";
import { FinancialReportResponse, DailyFinancialData } from "../../types/reports";
import dayjs from "dayjs";
import 'dayjs/locale/ru';

dayjs.locale('ru');

const ICON_MAP: Record<string, React.ReactNode> = {
    services: <AssessmentOutlined />,
    products: <BusinessCenterOutlined />,
    cash: <WalletIcon />,
    card: <CreditCardIcon />,
    debt: <PaymentsOutlined />,
    discount: <ReceiptLongOutlined />,
};

const FinancialReportsPage: React.FC = () => {
    usePageTitle("Финансовый отчет");
    const theme = useTheme();
    const { open: notify } = useNotification();
    const { isSuperAdmin, hasRole, loading: permissionsLoading } = usePermissions();

    const canSee = useMemo(() => isSuperAdmin() || hasRole(['accountant', 'admin', 'manager']), [isSuperAdmin, hasRole]);

    // State
    const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<FinancialReportResponse | null>(null);
    const activeMonths = useActiveMonths('AppointmentsAggregated', 'appointment_at');

    const fetchData = useCallback(async () => {
        if (permissionsLoading) return;
        if (!canSee) return;

        try {
            setLoading(true);
            const month = dayjs(selectedDate).format('YYYY-MM');
            const res = await getFinancialReport(month);
            
            if (res?.data) {
                setReportData(res.data);
            }
        } catch (e: any) {
            console.error(e);
            notify?.({ 
                type: "error", 
                message: e.message || "Ошибка загрузки финансового отчета" 
            });
        } finally {
            setLoading(false);
        }
    }, [selectedDate, notify, canSee, permissionsLoading]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (permissionsLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
        </Box>
    );

    if (!canSee || (reportData && !reportData.canView)) {
        return <Typography sx={{ p: 3 }}>Доступ ограничен</Typography>;
    }

    const { summaryCards = [], displayDays = [], totals = {} } = reportData || {};

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "auto" }}>
            <PageHeader
                title="Финансовый отчет"
                showTitle={false}
                showSearch={false}
                dateNavigation={<MonthNavigation date={selectedDate} setDate={setSelectedDate} activeMonths={activeMonths} />}
            />

            <Box sx={(theme) => ({ px: theme.appLayout.page.paddingX, pb: theme.appLayout.page.paddingY, flex: 1, display: 'flex', flexDirection: 'column' })}>
                <Stack spacing={{ xs: 1.5, md: 3 }} sx={{ flex: 1, minHeight: 0 }}>
                    
                    {/* Summary Cards */}
                    <Grid2 container spacing={{ xs: 1, md: 2 }}>
                        {summaryCards.length > 0 ? (
                            summaryCards.map((card: any, idx: number) => (
                                <Grid2 size={{ xs: 6, sm: 3 }} key={idx}>
                                    <Card variant="outlined" sx={{ 
                                        borderRadius: 3, 
                                        bgcolor: alpha(theme.palette[card.color as 'primary' | 'success' | 'info' | 'error']?.main || theme.palette.primary.main, 0.05) 
                                    }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Box>
                                                    <Typography variant="overline" color={`${card.color}.main` as any}>{card.title}</Typography>
                                                    <Typography variant="h5" fontWeight={800}>{formatKGS(card.value)}</Typography>
                                                </Box>
                                                <Avatar sx={{ 
                                                    bgcolor: alpha(theme.palette[card.color as 'primary' | 'success' | 'info' | 'error']?.main || theme.palette.primary.main, 0.1), 
                                                    color: `${card.color}.main` 
                                                }}>
                                                    {ICON_MAP[card.key] || <AssessmentOutlined />}
                                                </Avatar>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid2>
                            ))
                        ) : (
                            // Fallback if summaryCards is empty
                            <Grid2 size={12}>
                                <Typography variant="caption" color="text.secondary">Данные для карточек отсутствуют</Typography>
                            </Grid2>
                        )}
                    </Grid2>

                    {/* Table */}
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
                    ) : displayDays.length === 0 ? (
                        <Paper variant="outlined" sx={{ borderRadius: 3, p: 5, textAlign: 'center' }}>
                            <Typography color="text.secondary">Нет активности за выбранный период</Typography>
                        </Paper>
                    ) : (
                        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <TableContainer sx={{ flex: 1 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 800 }}>Дата</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800 }}>Приемы / Прц.</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800 }}>Услуги</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800 }}>Товары</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800 }}>Скидки</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800 }}>Наличные</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800 }}>Безнал</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800 }}>Долг</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {displayDays.map((day: DailyFinancialData) => (
                                            <TableRow key={day.date} hover sx={{
                                                bgcolor: day.hasActivity ? 'inherit' : alpha(theme.palette.action.disabled, 0.02),
                                                opacity: day.hasActivity ? 1 : 0.6
                                            }}>
                                                <TableCell sx={{ fontWeight: 600 }}>
                                                    {dayjs(day.date).format('DD.MM')} ({dayjs(day.date).format('ddd')})
                                                </TableCell>
                                                <TableCell align="center">
                                                    {day.appointmentsCount} / {day.proceduresCount}
                                                </TableCell>
                                                <TableCell align="right">{formatKGS(day.servicesSum)}</TableCell>
                                                <TableCell align="right">{formatKGS(day.productsSum)}</TableCell>
                                                <TableCell align="right" sx={{ color: 'error.main' }}>
                                                    {day.discountSum > 0 ? `-${formatKGS(day.discountSum)}` : '-'}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                                                    {formatKGS(day.cashSum)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'info.main', fontWeight: 600 }}>
                                                    {formatKGS(day.cardSum)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'warning.main' }}>
                                                    {day.debtSum > 0 ? formatKGS(day.debtSum) : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        
                                        {/* Total Row */}
                                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                                            <TableCell sx={{ fontWeight: 800 }}>ИТОГО</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800 }}>
                                                {totals.appointmentsCount} / {totals.proceduresCount}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800 }}>{formatKGS(totals.servicesSum || 0)}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800 }}>{formatKGS(totals.productsSum || 0)}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>
                                                {totals.discountSum ? `-${formatKGS(totals.discountSum)}` : '-'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>{formatKGS(totals.cashSum || 0)}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, color: 'info.main' }}>{formatKGS(totals.cardSum || 0)}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, color: 'warning.main' }}>{formatKGS(totals.debtSum || 0)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </Stack>
            </Box>
        </Box>
    );
};

export default FinancialReportsPage;

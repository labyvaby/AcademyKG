import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Box,
    Grid2,
    Paper,
    Typography,
    Stack,
    Card,
    CardContent,
    alpha,
    CircularProgress,
    Avatar,
    useTheme,
    ToggleButtonGroup,
    ToggleButton,
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import CreditCardIcon from '@mui/icons-material/CreditCard';
import WalletIcon from '@mui/icons-material/Wallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';

import { PageHeader } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { formatDateRu, formatKGS } from "../../utility/format";
import { getCashboxSummary } from "../../services/cashbox";
import { CashboxSummaryData, CashboxMethod } from "../../types/cashbox";
import { useBranchContext } from "../../contexts/branch-context";
import dayjs from "dayjs";

const CashboxPage: React.FC = () => {
    usePageTitle("Касса");
    const theme = useTheme();
    const { open: notify } = useNotification();
    const { selectedBranch } = useBranchContext();

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CashboxSummaryData | null>(null);
    const [method, setMethod] = useState<CashboxMethod | 'all'>('all');
    const [dateRange] = useState({
        from: dayjs().startOf('month').format('YYYY-MM-DD'),
        to: dayjs().format('YYYY-MM-DD')
    });
    const scopeKey = `${selectedBranch?.id ?? "all"}:${dateRange.from}:${dateRange.to}:${method}`;
    const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);

    const fetchData = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            setError(null);
            setLoadedScopeKey(null);
            setData(null);
            const res = await getCashboxSummary({
                dateFrom: dateRange.from,
                dateTo: dateRange.to,
                branch: selectedBranch?.id ?? undefined,
                method: method === 'all' ? undefined : method,
                signal,
            });
            if (signal?.aborted) return;
            setData(res.data);
            setLoadedScopeKey(scopeKey);
        } catch (e: any) {
            if (signal?.aborted) return;
            console.error(e);
            const message = e.message || "Ошибка загрузки данных кассы";
            setError(message);
            setLoadedScopeKey(null);
            notify?.({
                type: "error",
                message
            });
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [dateRange, method, notify, scopeKey, selectedBranch?.id]);

    useEffect(() => {
        const controller = new AbortController();
        void fetchData(controller.signal);
        return () => controller.abort();
    }, [fetchData]);

    const visibleData = loadedScopeKey === scopeKey ? data : null;
    const effectiveLoading = loading || (!error && loadedScopeKey !== scopeKey);

    const handleMethodChange = (
        _event: React.MouseEvent<HTMLElement>,
        newMethod: CashboxMethod | 'all',
    ) => {
        if (newMethod !== null) {
            setMethod(newMethod);
        }
    };

    const renderBigCard = (
        title: string,
        value: string | number,
        subtitle: string,
        color: 'success' | 'info' | 'primary' | 'warning',
        icon: React.ReactNode
    ) => (
        <Card variant="outlined" sx={{
            borderRadius: 5,
            height: '100%',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: `0 20px 40px -12px ${alpha(theme.palette[color].main, 0.25)}`,
            },
            bgcolor: alpha(theme.palette[color].main, 0.03),
            borderColor: alpha(theme.palette[color].main, 0.15),
            borderWidth: 2,
            position: 'relative',
            overflow: 'hidden'
        }}>
            <CardContent sx={{ p: 4 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                            {title}
                        </Typography>
                        <Typography variant="h2" fontWeight={900} color={`${color}.main`}>
                            {formatKGS(value)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {subtitle}
                        </Typography>
                    </Box>
                    <Avatar sx={{
                        bgcolor: alpha(theme.palette[color].main, 0.1),
                        color: `${color}.main`,
                        width: 80,
                        height: 80,
                        fontSize: 40
                    }}>
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
            {/* Subtle background decoration */}
            <Box sx={{
                position: 'absolute',
                right: -20,
                bottom: -20,
                opacity: 0.05,
                transform: 'rotate(-15deg)',
                color: theme.palette[color].main
            }}>
                {React.cloneElement(icon as React.ReactElement, { sx: { fontSize: 180 } })}
            </Box>
        </Card>
    );

    const cards = useMemo(() => {
        if (!visibleData) return [];

        if (method === 'cash') {
            return [
                {
                    title: "Поступления",
                    value: Number(visibleData.appointments.cashSum),
                    subtitle: `${visibleData.counts.appointmentsCount} записей наличными`,
                    color: 'success' as const,
                    icon: <TrendingUpIcon />,
                },
                {
                    title: "Корректировки",
                    value: Number(visibleData.adjustments.cashNetSum),
                    subtitle: `${visibleData.counts.adjustmentsCount} движений по наличным`,
                    color: 'info' as const,
                    icon: <CreditCardIcon />,
                },
                {
                    title: "Расходы",
                    value: Number(visibleData.expenses.cashSum),
                    subtitle: `${visibleData.counts.expensesCount} наличных расходов`,
                    color: 'warning' as const,
                    icon: <TrendingDownIcon />,
                },
                {
                    title: "Чистый остаток",
                    value: Number(visibleData.net.cashSum),
                    subtitle: "Наличные после вычета расходов",
                    color: 'primary' as const,
                    icon: <WalletIcon />,
                },
            ];
        }

        if (method === 'card') {
            return [
                {
                    title: "Поступления",
                    value: Number(visibleData.appointments.cardSum),
                    subtitle: `${visibleData.counts.appointmentsCount} безналичных оплат`,
                    color: 'info' as const,
                    icon: <TrendingUpIcon />,
                },
                {
                    title: "Корректировки",
                    value: Number(visibleData.adjustments.cashlessNetSum),
                    subtitle: `${visibleData.counts.adjustmentsCount} безналичных корректировок`,
                    color: 'success' as const,
                    icon: <WalletIcon />,
                },
                {
                    title: "Расходы",
                    value: Number(visibleData.expenses.cashlessSum),
                    subtitle: `${visibleData.counts.expensesCount} безналичных расходов`,
                    color: 'warning' as const,
                    icon: <TrendingDownIcon />,
                },
                {
                    title: "Чистый остаток",
                    value: Number(visibleData.net.cardSum),
                    subtitle: "Безнал после вычета расходов",
                    color: 'primary' as const,
                    icon: <CreditCardIcon />,
                },
            ];
        }

        return [
            {
                title: "Поступления",
                value: Number(visibleData.appointments.totalSum),
                subtitle: `${visibleData.counts.appointmentsCount} записей с оплатой`,
                color: 'success' as const,
                icon: <TrendingUpIcon />,
            },
            {
                title: "Корректировки",
                value: Number(visibleData.adjustments.totalNetSum),
                subtitle: `${visibleData.counts.adjustmentsCount} финансовых корректировок`,
                color: 'info' as const,
                icon: <CreditCardIcon />,
            },
            {
                title: "Расходы",
                value: Number(visibleData.expenses.totalSum),
                subtitle: `${visibleData.counts.expensesCount} расходов за период`,
                color: 'warning' as const,
                icon: <TrendingDownIcon />,
            },
            {
                title: "Чистый остаток",
                value: Number(visibleData.net.totalSum),
                subtitle: "Поступления минус расходы",
                color: 'primary' as const,
                icon: <AccountBalanceWalletOutlinedIcon />,
            },
        ];
    }, [method, visibleData]);

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "auto", p: { xs: 2, md: 4 } }}>
            <PageHeader
                title="Касса"
                showTitle={true}
                showSearch={false}
            />

            <Stack spacing={4} sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                    Период: {formatDateRu(visibleData?.dateFrom || dateRange.from)} - {formatDateRu(visibleData?.dateTo || dateRange.to)}
                </Typography>

                {/* Minimal Filters */}
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 4, display: 'inline-flex', alignSelf: 'flex-start', bgcolor: alpha(theme.palette.background.paper, 0.8) }}>
                    <ToggleButtonGroup
                        value={method}
                        exclusive
                        onChange={handleMethodChange}
                        size="medium"
                        color="primary"
                        sx={{
                            '& .MuiToggleButton-root': {
                                px: 4,
                                py: 1,
                                borderRadius: 3,
                                border: 'none',
                                fontWeight: 600,
                                '&.Mui-selected': {
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    '&:hover': {
                                        bgcolor: 'primary.dark',
                                    }
                                }
                            }
                        }}
                    >
                        <ToggleButton value="all">Все</ToggleButton>
                        <ToggleButton value="cash">Наличные</ToggleButton>
                        <ToggleButton value="card">Безнал</ToggleButton>
                    </ToggleButtonGroup>
                </Paper>

                {effectiveLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 15 }}>
                        <CircularProgress size={60} thickness={4} />
                    </Box>
                ) : error ? (
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
                            Не удалось загрузить кассовую сводку
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {error}
                        </Typography>
                    </Paper>
                ) : !visibleData ? (
                    <Typography variant="h6" color="text.secondary" textAlign="center">Данные отсутствуют</Typography>
                ) : (
                    <Stack spacing={3}>
                        <Grid2 container spacing={4}>
                            {cards.map((card) => (
                                <Grid2 key={card.title} size={{ xs: 12, md: method === 'all' ? 3 : 3 }}>
                                    {renderBigCard(
                                        card.title,
                                        card.value,
                                        card.subtitle,
                                        card.color,
                                        card.icon
                                    )}
                                </Grid2>
                            ))}
                        </Grid2>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                            <Stack spacing={1.5}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Детализация денежных потоков
                                </Typography>
                                <Grid2 container spacing={2}>
                                    <Grid2 size={{ xs: 12, md: 4 }}>
                                        <Typography variant="caption" color="text.secondary">Оплаты по приёмам</Typography>
                                        <Typography variant="body2">Наличные: {formatKGS(visibleData.appointments.cashSum)}</Typography>
                                        <Typography variant="body2">Карта: {formatKGS(visibleData.appointments.cardSum)}</Typography>
                                        <Typography variant="body2">Баланс: {formatKGS(visibleData.appointments.balanceSum)}</Typography>
                                        <Typography variant="body2">Бонусы: {formatKGS(visibleData.appointments.bonusesSum)}</Typography>
                                    </Grid2>
                                    <Grid2 size={{ xs: 12, md: 4 }}>
                                        <Typography variant="caption" color="text.secondary">Корректировки</Typography>
                                        <Typography variant="body2">Возвраты: {formatKGS(visibleData.adjustments.refundsSum)}</Typography>
                                        <Typography variant="body2">Сторно: {formatKGS(visibleData.adjustments.reversalsSum)}</Typography>
                                        <Typography variant="body2">Прочие: {formatKGS(visibleData.adjustments.adjustmentsSum)}</Typography>
                                    </Grid2>
                                    <Grid2 size={{ xs: 12, md: 4 }}>
                                        <Typography variant="caption" color="text.secondary">Net от сервера</Typography>
                                        <Typography variant="body2">Наличные: {formatKGS(visibleData.net.cashSum)}</Typography>
                                        <Typography variant="body2">Безнал: {formatKGS(visibleData.net.cardSum)}</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Итого: {formatKGS(visibleData.net.totalSum)}</Typography>
                                    </Grid2>
                                </Grid2>
                            </Stack>
                        </Paper>
                    </Stack>
                )}
            </Stack>
        </Box>
    );
};

export default CashboxPage;

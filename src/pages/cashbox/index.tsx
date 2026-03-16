import React, { useState, useEffect, useCallback } from "react";
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

import { PageHeader } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { formatKGS } from "../../utility/format";
import { getCashboxSummary } from "../../services/cashbox";
import { CashboxSummaryData, CashboxMethod } from "../../types/cashbox";
import dayjs from "dayjs";

const CashboxPage: React.FC = () => {
    usePageTitle("Касса");
    const theme = useTheme();
    const { open: notify } = useNotification();

    // State
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<CashboxSummaryData | null>(null);
    const [method, setMethod] = useState<CashboxMethod | 'all'>('all');
    const [dateRange] = useState({
        from: dayjs().startOf('month').format('YYYY-MM-DD'),
        to: dayjs().endOf('month').format('YYYY-MM-DD')
    });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getCashboxSummary({
                dateFrom: dateRange.from,
                dateTo: dateRange.to,
                method: method === 'all' ? undefined : method
            });
            setData(res.data);
        } catch (e: any) {
            console.error(e);
            notify?.({
                type: "error",
                message: e.message || "Ошибка загрузки данных кассы"
            });
        } finally {
            setLoading(false);
        }
    }, [dateRange, method, notify]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "auto", p: { xs: 2, md: 4 } }}>
            <PageHeader
                title="Касса"
                showTitle={true}
                showSearch={false}
            />

            <Stack spacing={4} sx={{ mt: 3 }}>
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

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 15 }}>
                        <CircularProgress size={60} thickness={4} />
                    </Box>
                ) : !data ? (
                    <Typography variant="h6" color="text.secondary" textAlign="center">Данные отсутствуют</Typography>
                ) : (
                    <Grid2 container spacing={4}>
                        {(method === 'all' || method === 'cash') && (
                            <Grid2 size={{ xs: 12, md: method === 'all' ? 6 : 12 }}>
                                {renderBigCard(
                                    "Наличные",
                                    data.net.cashSum,
                                    'success',
                                    <WalletIcon />
                                )}
                            </Grid2>
                        )}

                        {(method === 'all' || method === 'card') && (
                            <Grid2 size={{ xs: 12, md: method === 'all' ? 6 : 12 }}>
                                {renderBigCard(
                                    "Безналичные",
                                    data.net.cardSum,
                                    'info',
                                    <CreditCardIcon />
                                )}
                            </Grid2>
                        )}
                    </Grid2>
                )}
            </Stack>
        </Box>
    );
};

export default CashboxPage;

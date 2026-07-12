import React, { useState, useEffect, useCallback } from "react";
import {
    Box,
    Grid2,
    Card,
    CardContent,
    Typography,
    Stack,
    CircularProgress,
    Avatar,
    Paper,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useNotification } from "@refinedev/core";
import WalletIcon from "@mui/icons-material/Wallet";
import CreditCardIcon from "@mui/icons-material/CreditCard";

import { PageHeader } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useBranchCurrency } from "../../hooks/useBranchCurrency";
import { getCashboxSummary } from "../../services/cashbox";
import { CashboxSummaryData } from "../../types/cashbox";
import { useBranchContext } from "../../contexts/branch-context";

const CashboxPage: React.FC = () => {
    usePageTitle("Касса");
    const { format: formatKGS } = useBranchCurrency();
    const theme = useTheme();
    const { open: notify } = useNotification();
    const { selectedBranch } = useBranchContext();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CashboxSummaryData | null>(null);
    const scopeKey = `${selectedBranch?.id ?? "all"}`;
    const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);

    const fetchData = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            setError(null);
            setLoadedScopeKey(null);
            const res = await getCashboxSummary({
                branch: selectedBranch?.id ?? undefined,
                signal,
            });
            if (signal?.aborted) return;
            setData(res.data);
            setLoadedScopeKey(scopeKey);
        } catch (e: any) {
            if (signal?.aborted) return;
            const message = e.message || "Ошибка загрузки данных кассы";
            setError(message);
            setLoadedScopeKey(null);
            notify?.({ type: "error", message });
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [notify, scopeKey, selectedBranch?.id]);

    useEffect(() => {
        const controller = new AbortController();
        void fetchData(controller.signal);
        return () => controller.abort();
    }, [fetchData]);

    const visibleData = loadedScopeKey === scopeKey ? data : null;
    const effectiveLoading = loading || (!error && loadedScopeKey !== scopeKey);

    const renderCard = (
        title: string,
        value: string | number,
        color: "success" | "info",
        icon: React.ReactNode,
    ) => (
        <Card
            variant="outlined"
            sx={{
                borderRadius: 4,
                height: "100%",
                bgcolor: alpha(theme.palette[color].main, 0.04),
                borderColor: alpha(theme.palette[color].main, 0.14),
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: `0 16px 36px -18px ${alpha(theme.palette[color].main, 0.35)}`,
                },
            }}
        >
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box minWidth={0}>
                        <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 700, mb: 0.75 }}>
                            {title}
                        </Typography>
                        <Typography
                            variant="h3"
                            sx={{
                                fontWeight: 900,
                                color: `${color}.main`,
                                fontSize: { xs: "1.9rem", md: "2.5rem" },
                                lineHeight: 1.1,
                            }}
                        >
                            {formatKGS(value)}
                        </Typography>
                    </Box>
                    <Avatar
                        sx={{
                            width: { xs: 52, md: 68 },
                            height: { xs: 52, md: 68 },
                            bgcolor: alpha(theme.palette[color].main, 0.12),
                            color: `${color}.main`,
                            flexShrink: 0,
                        }}
                    >
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </Card>
    );

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "auto" }}>
            <PageHeader title="Касса" showTitle={false} showSearch={false} />

            <Box
                sx={(theme) => ({
                    px: theme.appLayout.page.paddingX,
                    pb: theme.appLayout.page.paddingY,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                })}
            >
                <Stack spacing={2.5} sx={{ mt: 1 }}>
                    {effectiveLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 10 }}>
                            <CircularProgress size={54} thickness={4} />
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
                                Не удалось загрузить кассу
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {error}
                            </Typography>
                        </Paper>
                    ) : !visibleData ? (
                        <Typography variant="h6" color="text.secondary" textAlign="center">
                            Данные отсутствуют
                        </Typography>
                    ) : (
                        <Grid2 container spacing={2.5}>
                            <Grid2 size={{ xs: 12, md: 6 }}>
                                {renderCard(
                                    "Наличные",
                                    Number(visibleData.net.cashSum),
                                    "success",
                                    <WalletIcon />,
                                )}
                            </Grid2>
                            <Grid2 size={{ xs: 12, md: 6 }}>
                                {renderCard(
                                    "Безнал",
                                    Number(visibleData.net.cardSum),
                                    "info",
                                    <CreditCardIcon />,
                                )}
                            </Grid2>
                        </Grid2>
                    )}
                </Stack>
            </Box>
        </Box>
    );
};

export default CashboxPage;

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Stack,
    CircularProgress,
    Paper,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
    Tooltip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useQueries, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import { PageHeader, ReportBranchSelect } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { useReportBranchScope, useReportCurrency } from "../../hooks/useReportBranchScope";
import { useBranchContext } from "../../contexts/branch-context";
import { getCashboxSummary } from "../../services/cashbox";
import { CASHBOX_DATE_FORMAT, CashboxPeriod, CashboxPreset, periodForPreset } from "./cashboxPeriod";
import { CashboxBreakdown } from "./components/CashboxBreakdown";
import { CashboxBranchesTable, CashboxBranchRow } from "./components/CashboxBranchesTable";

const PRESETS: Exclude<CashboxPreset, "custom">[] = ["today", "yesterday", "week", "month"];

const CashboxPage: React.FC = () => {
    const { t } = useTranslation();
    usePageTitle(t("menu.cashbox"));
    const theme = useTheme();
    const { isSuperAdmin } = usePermissions();
    const { branches, setSelectedBranch } = useBranchContext();
    // Тот же скоуп, что у отчётов: не-суперадмин всегда шлёт явный ?branch=
    // (без него бэк отвечает 400 «Укажите организацию или филиал»).
    const { branchId, branch, ready } = useReportBranchScope();
    const { format } = useReportCurrency();

    const [period, setPeriod] = useState<CashboxPeriod>(() => periodForPreset("today"));
    const allBranchesMode = isSuperAdmin() && !branchId;

    const single = useQuery({
        queryKey: ["cashbox-summary", branchId, period.dateFrom, period.dateTo],
        queryFn: ({ signal }) =>
            getCashboxSummary({ branch: branchId, dateFrom: period.dateFrom, dateTo: period.dateTo, signal }),
        enabled: ready && !!branchId,
    });

    const perBranch = useQueries({
        queries: (allBranchesMode && ready ? branches : []).map((b) => ({
            queryKey: ["cashbox-summary", b.id, period.dateFrom, period.dateTo],
            queryFn: ({ signal }: { signal: AbortSignal }) =>
                getCashboxSummary({
                    branch: b.id,
                    dateFrom: period.dateFrom,
                    dateTo: period.dateTo,
                    signal,
                    skipClientRateLimit: true,
                }),
        })),
    });

    const branchRows: CashboxBranchRow[] = allBranchesMode
        ? branches.map((b, i) => ({
              branch: b,
              data: perBranch[i]?.data?.data,
              loading: perBranch[i]?.isLoading ?? true,
              error: perBranch[i]?.error ? (perBranch[i].error as Error).message : undefined,
          }))
        : [];

    const refresh = () => {
        if (allBranchesMode) perBranch.forEach((q) => void q.refetch());
        else void single.refetch();
    };
    const isFetching = allBranchesMode ? perBranch.some((q) => q.isFetching) : single.isFetching;

    const setCustomDate = (key: "dateFrom" | "dateTo", value: dayjs.Dayjs | null) => {
        if (!value || !value.isValid()) return;
        const next = { ...period, preset: "custom" as const, [key]: value.format(CASHBOX_DATE_FORMAT) };
        // Не даём перевернуть период: двигаем вторую границу за первой.
        if (next.dateFrom > next.dateTo) {
            if (key === "dateFrom") next.dateTo = next.dateFrom;
            else next.dateFrom = next.dateTo;
        }
        setPeriod(next);
    };

    const periodLabel =
        period.dateFrom === period.dateTo
            ? dayjs(period.dateFrom).format("DD.MM.YYYY")
            : `${dayjs(period.dateFrom).format("DD.MM.YYYY")} — ${dayjs(period.dateTo).format("DD.MM.YYYY")}`;

    const renderContent = () => {
        if (!ready) {
            return (
                <Box sx={{ display: "flex", justifyContent: "center", p: 10 }}>
                    <CircularProgress size={54} thickness={4} />
                </Box>
            );
        }
        if (allBranchesMode) {
            return (
                <CashboxBranchesTable
                    rows={branchRows}
                    onSelectBranch={(b) => setSelectedBranch(b)}
                />
            );
        }
        if (!branchId) {
            return (
                <Typography variant="h6" color="text.secondary" textAlign="center">
                    {t("cashbox.noBranch")}
                </Typography>
            );
        }
        if (single.isLoading) {
            return (
                <Box sx={{ display: "flex", justifyContent: "center", p: 10 }}>
                    <CircularProgress size={54} thickness={4} />
                </Box>
            );
        }
        if (single.error || !single.data?.data) {
            return (
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
                        {t("cashbox.loadFailed")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {(single.error as Error | null)?.message || t("cashbox.noData")}
                    </Typography>
                </Paper>
            );
        }
        return <CashboxBreakdown data={single.data.data} format={format} />;
    };

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "auto" }}>
            <PageHeader title={t("menu.cashbox")} showTitle={false} showSearch={false} />

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
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                        <Stack
                            direction={{ xs: "column", lg: "row" }}
                            spacing={1.5}
                            alignItems={{ xs: "stretch", lg: "center" }}
                            useFlexGap
                            flexWrap="wrap"
                        >
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={period.preset === "custom" ? null : period.preset}
                                onChange={(_, v: Exclude<CashboxPreset, "custom"> | null) => {
                                    if (v) setPeriod(periodForPreset(v));
                                }}
                                sx={{ flexWrap: "wrap" }}
                            >
                                {PRESETS.map((p) => (
                                    <ToggleButton key={p} value={p} sx={{ px: 1.75, textTransform: "none" }}>
                                        {t(`cashbox.presets.${p}`)}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>

                            <Stack direction="row" spacing={1.5} sx={{ flex: { lg: "0 1 380px" } }}>
                                <DatePicker
                                    label={t("cashbox.dateFrom")}
                                    value={dayjs(period.dateFrom)}
                                    onChange={(d) => setCustomDate("dateFrom", d)}
                                    format="DD.MM.YYYY"
                                    slotProps={{ textField: { size: "small", sx: { flex: 1, minWidth: 0 } } }}
                                />
                                <DatePicker
                                    label={t("cashbox.dateTo")}
                                    value={dayjs(period.dateTo)}
                                    onChange={(d) => setCustomDate("dateTo", d)}
                                    format="DD.MM.YYYY"
                                    slotProps={{ textField: { size: "small", sx: { flex: 1, minWidth: 0 } } }}
                                />
                            </Stack>

                            <ReportBranchSelect />

                            <Box sx={{ flex: 1, display: { xs: "none", lg: "block" } }} />

                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t("cashbox.periodCaption", {
                                        period: periodLabel,
                                        branch: allBranchesMode
                                            ? t("cashbox.allBranches")
                                            : branch?.brandName || branch?.name || "—",
                                    })}
                                </Typography>
                                <Tooltip title={t("common.refresh")}>
                                    <span>
                                        <IconButton onClick={refresh} disabled={isFetching} size="small">
                                            {isFetching ? <CircularProgress size={18} /> : <RefreshIcon />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Paper>

                    {renderContent()}
                </Stack>
            </Box>
        </Box>
    );
};

export default CashboxPage;

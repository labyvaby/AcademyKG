import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Stack,
    CircularProgress,
    Paper,
    Tab,
    Tabs,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
    Tooltip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import { PageHeader, ReportBranchSelect } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { useReportBranchScope, useReportCurrency } from "../../hooks/useReportBranchScope";
import { useBranchContext } from "../../contexts/branch-context";
import { getCashboxSummary } from "../../services/cashbox";
import { CASHBOX_DATE_FORMAT, CashboxPeriod, CashboxPreset, periodForPreset } from "./cashboxPeriod";
import { CashboxBreakdown } from "./components/CashboxBreakdown";
import { CashboxBranchesTable } from "./components/CashboxBranchesTable";
import { CashboxJournal } from "./components/CashboxJournal";
import { CashboxShifts } from "./components/CashboxShifts";

const PRESETS: Exclude<CashboxPreset, "custom">[] = ["today", "yesterday", "week", "month"];

type CashboxTab = "summary" | "journal" | "shifts";

const CashboxPage: React.FC = () => {
    const { t } = useTranslation();
    usePageTitle(t("menu.cashbox"));
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { isSuperAdmin } = usePermissions();
    const { branches, setSelectedBranch } = useBranchContext();
    // Тот же скоуп, что у отчётов: не-суперадмин всегда шлёт явный ?branch=.
    const { branchId, branch, ready } = useReportBranchScope();
    const { format, suffix, currency } = useReportCurrency();

    const [period, setPeriod] = useState<CashboxPeriod>(() => periodForPreset("today"));
    const [tab, setTab] = useState<CashboxTab>("summary");
    const allBranchesMode = isSuperAdmin() && !branchId;

    // «Все филиалы» одним запросом (ответ бэка A2): сотрудник с ролью superadmin
    // шлёт organization=<своя>; Django-суперюзер (несколько организаций в списке
    // филиалов) — без параметров, бэк сам отдаст все филиалы с разбивкой.
    const organizationId = useMemo(() => {
        const ids = new Set(branches.map((b) => b.organizationId).filter((id): id is string => !!id));
        return ids.size === 1 ? Array.from(ids)[0] : undefined;
    }, [branches]);

    const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
    const branchNameById = (id: string | null) => {
        if (!id) return "—";
        const b = branchById.get(id);
        return b ? b.brandName || b.name : id;
    };
    const branchCurrencyById = (id: string | null) => (id ? branchById.get(id)?.currency : undefined);

    const summary = useQuery({
        queryKey: ["cashbox-summary", branchId ?? `org:${organizationId ?? "all"}`, period.dateFrom, period.dateTo],
        queryFn: ({ signal }) =>
            getCashboxSummary({
                branch: branchId,
                organization: branchId ? undefined : organizationId,
                dateFrom: period.dateFrom,
                dateTo: period.dateTo,
                signal,
            }),
        enabled: ready && (!!branchId || allBranchesMode),
    });

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["cashbox-summary"] });
        void queryClient.invalidateQueries({ queryKey: ["cashbox-entries"] });
        void queryClient.invalidateQueries({ queryKey: ["cashbox-shift-current"] });
        void queryClient.invalidateQueries({ queryKey: ["cashbox-shift-summary"] });
        void queryClient.invalidateQueries({ queryKey: ["cashbox-shifts"] });
        void queryClient.invalidateQueries({ queryKey: ["cashbox-movements"] });
    };
    const isFetching = summary.isFetching;

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

    const spinner = (
        <Box sx={{ display: "flex", justifyContent: "center", p: 10 }}>
            <CircularProgress size={54} thickness={4} />
        </Box>
    );

    const errorBox = (message?: string) => (
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
                {message || t("cashbox.noData")}
            </Typography>
        </Paper>
    );

    const renderSummary = () => {
        if (summary.isLoading) return spinner;
        if (summary.error || !summary.data?.data) return errorBox((summary.error as Error | null)?.message);
        const data = summary.data.data;
        if (allBranchesMode) {
            return (
                <CashboxBranchesTable
                    rows={data.byBranch ?? []}
                    onSelectBranch={(id) => {
                        const b = branchById.get(id);
                        if (b) setSelectedBranch(b);
                    }}
                />
            );
        }
        return <CashboxBreakdown data={data} format={format} />;
    };

    const renderContent = () => {
        if (!ready) return spinner;
        if (!branchId && !allBranchesMode) {
            return (
                <Typography variant="h6" color="text.secondary" textAlign="center">
                    {t("cashbox.noBranch")}
                </Typography>
            );
        }
        switch (tab) {
            case "journal":
                return (
                    <CashboxJournal
                        branchId={branchId}
                        organizationId={organizationId}
                        dateFrom={period.dateFrom}
                        dateTo={period.dateTo}
                        currency={branchId ? currency : undefined}
                        branchNameById={branchNameById}
                        branchCurrencyById={branchCurrencyById}
                    />
                );
            case "shifts":
                if (!branchId) {
                    return (
                        <Typography variant="h6" color="text.secondary" textAlign="center">
                            {t("cashbox.shiftsNeedBranch")}
                        </Typography>
                    );
                }
                return (
                    <CashboxShifts
                        branchId={branchId}
                        dateFrom={period.dateFrom}
                        dateTo={period.dateTo}
                        format={format}
                        suffix={suffix}
                    />
                );
            case "summary":
            default:
                return renderSummary();
        }
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

                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                        <Tabs
                            value={tab}
                            onChange={(_, v: CashboxTab) => setTab(v)}
                            variant="scrollable"
                            allowScrollButtonsMobile
                        >
                            <Tab value="summary" label={t("cashbox.tabs.summary")} sx={{ textTransform: "none", fontWeight: 700 }} />
                            <Tab value="journal" label={t("cashbox.tabs.journal")} sx={{ textTransform: "none", fontWeight: 700 }} />
                            <Tab value="shifts" label={t("cashbox.tabs.shifts")} sx={{ textTransform: "none", fontWeight: 700 }} />
                        </Tabs>
                    </Box>

                    {renderContent()}
                </Stack>
            </Box>
        </Box>
    );
};

export default CashboxPage;

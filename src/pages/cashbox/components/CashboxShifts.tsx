import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    FormControlLabel,
    Grid2,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import LockIcon from "@mui/icons-material/Lock";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import BlockIcon from "@mui/icons-material/Block";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotification } from "@refinedev/core";

import { usePermissions } from "../../../hooks/usePermissions";
import { PERMISSIONS } from "../../../constants/permissions";
import {
    closeCashboxShift,
    createCashboxMovement,
    getCashboxShiftSummary,
    getCurrentCashboxShift,
    listCashboxMovements,
    listCashboxShifts,
    openCashboxShift,
    voidCashboxMovement,
} from "../../../services/cashbox";
import type { CashboxMovement, CashboxMovementType, CashboxShift } from "../../../types/cashbox";
import {
    CloseShiftDialog,
    MovementDialog,
    OpenShiftDialog,
    ShiftSummaryDialog,
    VoidMovementDialog,
    formatDateTime,
} from "./CashboxDialogs";

type Props = {
    branchId: string;
    dateFrom: string;
    dateTo: string;
    format: (v: number | string | null | undefined) => string;
    suffix: string;
};

const n = (v: unknown): number => {
    const x = Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// Вкладка «Смены и наличные»: текущая смена филиала (открыть/закрыть с пересчётом),
// внесение/изъятие/инкассация, история смен за период с Z-отчётом.
export const CashboxShifts: React.FC<Props> = ({ branchId, dateFrom, dateTo, format, suffix }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const { open: notify } = useNotification();
    const { hasPermission } = usePermissions();
    const queryClient = useQueryClient();

    const canOpen = hasPermission(PERMISSIONS.CASHBOX.SHIFT_OPEN);
    const canClose = hasPermission(PERMISSIONS.CASHBOX.SHIFT_CLOSE);
    const canMove = hasPermission(PERMISSIONS.CASHBOX.MOVEMENTS_MANAGE);

    const [openDialog, setOpenDialog] = useState(false);
    const [closeDialog, setCloseDialog] = useState(false);
    const [movementDialog, setMovementDialog] = useState<CashboxMovementType | null>(null);
    const [voidTarget, setVoidTarget] = useState<CashboxMovement | null>(null);
    const [reportShift, setReportShift] = useState<CashboxShift | null>(null);
    const [includeVoided, setIncludeVoided] = useState(false);

    const current = useQuery({
        queryKey: ["cashbox-shift-current", branchId],
        queryFn: ({ signal }) => getCurrentCashboxShift(branchId, signal),
    });
    const shift = current.data ?? null;

    // Ожидаемая наличность «на сейчас» для открытой смены.
    const liveSummary = useQuery({
        queryKey: ["cashbox-shift-summary", shift?.id, "live"],
        queryFn: ({ signal }) => getCashboxShiftSummary(shift!.id, signal),
        enabled: !!shift?.id,
        refetchInterval: 60_000,
    });

    const shifts = useQuery({
        queryKey: ["cashbox-shifts", branchId, dateFrom, dateTo],
        queryFn: ({ signal }) => listCashboxShifts({ branch: branchId, dateFrom, dateTo, pageSize: 100, signal }),
    });

    const movements = useQuery({
        queryKey: ["cashbox-movements", branchId, dateFrom, dateTo, includeVoided],
        queryFn: ({ signal }) =>
            listCashboxMovements({ branch: branchId, dateFrom, dateTo, includeVoided, pageSize: 100, signal }),
    });

    // Смены, движения и сводка живут в одном ledger — после любой записи обновляем всё.
    const invalidateAll = () =>
        Promise.all(
            ["cashbox-shift-current", "cashbox-shift-summary", "cashbox-shifts", "cashbox-movements", "cashbox-summary", "cashbox-entries"].map(
                (k) => queryClient.invalidateQueries({ queryKey: [k] }),
            ),
        );

    const openMutation = useMutation({
        mutationFn: (body: { openingCash?: number; comment?: string }) => openCashboxShift({ branch: branchId, ...body }),
        onSuccess: async () => {
            setOpenDialog(false);
            notify?.({ type: "success", message: t("cashbox.shiftOpened") });
            await invalidateAll();
        },
        onError: (e) => notify?.({ type: "error", message: errorMessage(e, t("cashbox.shiftOpenFailed")) }),
    });

    const closeMutation = useMutation({
        mutationFn: (body: { countedCash: number; comment?: string }) => closeCashboxShift(shift!.id, body),
        onSuccess: async (closed) => {
            setCloseDialog(false);
            const d = closed.discrepancy === null ? 0 : n(closed.discrepancy);
            notify?.({
                type: "success",
                message: t("cashbox.shiftClosedMsg"),
                description:
                    d === 0
                        ? t("cashbox.noDiscrepancy")
                        : `${t("cashbox.discrepancy")}: ${d > 0 ? "+" : "−"} ${format(Math.abs(d))}`,
            });
            await invalidateAll();
        },
        onError: (e) => notify?.({ type: "error", message: errorMessage(e, t("cashbox.shiftCloseFailed")) }),
    });

    const movementMutation = useMutation({
        mutationFn: (body: { type: CashboxMovementType; amount: number; comment?: string; recipient?: string }) =>
            createCashboxMovement({ branch: branchId, ...body }),
        onSuccess: async () => {
            setMovementDialog(null);
            notify?.({ type: "success", message: t("cashbox.movementSaved") });
            await invalidateAll();
        },
        onError: (e) => notify?.({ type: "error", message: errorMessage(e, t("cashbox.movementFailed")) }),
    });

    const voidMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => voidCashboxMovement(id, reason),
        onSuccess: async () => {
            setVoidTarget(null);
            notify?.({ type: "success", message: t("cashbox.movementVoided") });
            await invalidateAll();
        },
        onError: (e) => notify?.({ type: "error", message: errorMessage(e, t("cashbox.movementVoidFailed")) }),
    });

    const expectedNow = liveSummary.data ? n(liveSummary.data.expectedCash) : null;

    const renderCurrentShift = () => {
        if (current.isLoading) {
            return (
                <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                    <CircularProgress size={32} />
                </Box>
            );
        }
        if (current.error) {
            return (
                <Typography color="error.main">{errorMessage(current.error, t("cashbox.loadFailed"))}</Typography>
            );
        }
        if (!shift) {
            return (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
                    <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <LockIcon color="disabled" />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                {t("cashbox.noOpenShift")}
                            </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            {t("cashbox.noOpenShiftNote")}
                        </Typography>
                    </Box>
                    {canOpen && (
                        <Button variant="contained" startIcon={<LockOpenIcon />} onClick={() => setOpenDialog(true)}>
                            {t("cashbox.openShift")}
                        </Button>
                    )}
                </Stack>
            );
        }
        return (
            <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
                    <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip size="small" color="success" label={t("cashbox.shiftOpen")} />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                {t("cashbox.shiftSince", { date: formatDateTime(shift.openedAt) })}
                            </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            {t("cashbox.openedBy")}: {shift.openedBy?.fullName || "—"}
                            {shift.comment ? ` · ${shift.comment}` : ""}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                            variant="outlined"
                            startIcon={<ReceiptLongOutlinedIcon />}
                            onClick={() => setReportShift(shift)}
                        >
                            {t("cashbox.shiftReport")}
                        </Button>
                        {canClose && (
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<LockIcon />}
                                onClick={() => setCloseDialog(true)}
                            >
                                {t("cashbox.closeShift")}
                            </Button>
                        )}
                    </Stack>
                </Stack>
                <Grid2 container spacing={1.5}>
                    <Grid2 size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t("cashbox.openingCash")}
                        </Typography>
                        <Typography sx={{ fontWeight: 800 }}>{format(shift.openingCash)}</Typography>
                    </Grid2>
                    <Grid2 size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t("cashbox.cashIncomeShift")}
                        </Typography>
                        <Typography sx={{ fontWeight: 800, color: "success.main" }}>
                            {liveSummary.data ? `+ ${format(n(liveSummary.data.appointments.cashSum))}` : "—"}
                        </Typography>
                    </Grid2>
                    <Grid2 size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t("cashbox.cashOutShift")}
                        </Typography>
                        <Typography sx={{ fontWeight: 800, color: "error.main" }}>
                            {liveSummary.data
                                ? `− ${format(n(liveSummary.data.expenses.cashSum) - n(liveSummary.data.movements?.netSum))}`
                                : "—"}
                        </Typography>
                    </Grid2>
                    <Grid2 size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t("cashbox.expectedCashNow")}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main", lineHeight: 1.2 }}>
                            {expectedNow !== null ? format(expectedNow) : "—"}
                        </Typography>
                    </Grid2>
                </Grid2>
            </Stack>
        );
    };

    const shiftRows = shifts.data?.results ?? [];
    const movementRows = movements.data?.results ?? [];

    return (
        <Stack spacing={2.5}>
            <Card
                variant="outlined"
                sx={{
                    borderRadius: 4,
                    bgcolor: shift ? alpha(theme.palette.success.main, 0.04) : undefined,
                    borderColor: shift ? alpha(theme.palette.success.main, 0.25) : undefined,
                }}
            >
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>{renderCurrentShift()}</CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.5}
                        alignItems={{ xs: "stretch", md: "center" }}
                        sx={{ mb: 1.5 }}
                    >
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                {t("cashbox.movementsTitle")}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t("cashbox.movementsNote")}
                            </Typography>
                        </Box>
                        {canMove && (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Button size="small" variant="outlined" color="success" startIcon={<AddIcon />} onClick={() => setMovementDialog("cash_in")}>
                                    {t("cashbox.movementTypes.cash_in")}
                                </Button>
                                <Button size="small" variant="outlined" color="warning" startIcon={<RemoveIcon />} onClick={() => setMovementDialog("cash_out")}>
                                    {t("cashbox.movementTypes.cash_out")}
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    startIcon={<LocalShippingOutlinedIcon />}
                                    onClick={() => setMovementDialog("collection")}
                                >
                                    {t("cashbox.movementTypes.collection")}
                                </Button>
                            </Stack>
                        )}
                    </Stack>
                    <FormControlLabel
                        control={<Checkbox size="small" checked={includeVoided} onChange={(e) => setIncludeVoided(e.target.checked)} />}
                        label={<Typography variant="body2">{t("cashbox.showVoided")}</Typography>}
                        sx={{ mb: 1 }}
                    />
                    {movements.isLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : movementRows.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                            {t("cashbox.movementsEmpty")}
                        </Typography>
                    ) : (
                        <TableContainer sx={{ overflowX: "auto" }}>
                            <Table size="small" sx={{ minWidth: 680 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.entryDate")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.movementType")}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.amount")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.recipient")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.comment")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.entryCreatedBy")}</TableCell>
                                        {canMove && <TableCell />}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {movementRows.map((m) => (
                                        <TableRow key={m.id} hover sx={m.isVoided ? { "& td": { color: "text.disabled", textDecoration: "line-through" } } : undefined}>
                                            <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(m.occurredAt)}</TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <span>{t(`cashbox.movementTypes.${m.type}`)}</span>
                                                    {m.isVoided && (
                                                        <Tooltip title={m.voidReason || ""}>
                                                            <Chip size="small" label={t("cashbox.voided")} />
                                                        </Tooltip>
                                                    )}
                                                </Stack>
                                            </TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{ whiteSpace: "nowrap", fontWeight: 700, color: m.isVoided ? undefined : m.direction === "in" ? "success.main" : "error.main" }}
                                            >
                                                {m.direction === "in" ? "+" : "−"} {format(n(m.amount))}
                                            </TableCell>
                                            <TableCell>{m.recipient || "—"}</TableCell>
                                            <TableCell sx={{ maxWidth: 280 }}>{m.comment || "—"}</TableCell>
                                            <TableCell sx={{ whiteSpace: "nowrap" }}>{m.createdBy?.fullName || "—"}</TableCell>
                                            {canMove && (
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                    {!m.isVoided && (
                                                        <Tooltip title={t("cashbox.voidMovement")}>
                                                            <IconButton size="small" onClick={() => setVoidTarget(m)}>
                                                                <BlockIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {t("cashbox.shiftsHistory")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {t("cashbox.shiftsHistoryNote")}
                    </Typography>
                    {shifts.isLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : shiftRows.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                            {t("cashbox.shiftsEmpty")}
                        </Typography>
                    ) : (
                        <TableContainer sx={{ overflowX: "auto" }}>
                            <Table size="small" sx={{ minWidth: 820 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.openedAt")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.closedAt")}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.openedBy")}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.openingCash")}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.expectedCash")}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.countedCash")}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.discrepancy")}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {shiftRows.map((s) => {
                                        const isOpen = s.status === "open";
                                        const d = s.discrepancy === null || s.discrepancy === undefined ? null : n(s.discrepancy);
                                        return (
                                            <TableRow key={s.id} hover>
                                                <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(s.openedAt)}</TableCell>
                                                <TableCell sx={{ whiteSpace: "nowrap" }}>
                                                    {isOpen ? <Chip size="small" color="success" label={t("cashbox.shiftOpen")} /> : formatDateTime(s.closedAt)}
                                                </TableCell>
                                                <TableCell sx={{ whiteSpace: "nowrap" }}>{s.openedBy?.fullName || "—"}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{format(s.openingCash)}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                    {s.expectedCash !== null && s.expectedCash !== undefined ? format(s.expectedCash) : "—"}
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                    {s.countedCash !== null && s.countedCash !== undefined ? format(s.countedCash) : "—"}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        whiteSpace: "nowrap",
                                                        fontWeight: 700,
                                                        color: d === null || d === 0 ? "text.secondary" : d > 0 ? "warning.main" : "error.main",
                                                    }}
                                                >
                                                    {d === null ? "—" : d === 0 ? format(0) : `${d > 0 ? "+" : "−"} ${format(Math.abs(d))}`}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title={t("cashbox.shiftReport")}>
                                                        <IconButton size="small" onClick={() => setReportShift(s)}>
                                                            <ReceiptLongOutlinedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            <OpenShiftDialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                onSubmit={(body) => openMutation.mutateAsync(body).then(() => undefined, () => undefined)}
                suffix={suffix}
                submitting={openMutation.isPending}
            />
            <CloseShiftDialog
                open={closeDialog}
                shift={shift}
                onClose={() => setCloseDialog(false)}
                onSubmit={(body) => closeMutation.mutateAsync(body).then(() => undefined, () => undefined)}
                format={format}
                suffix={suffix}
                submitting={closeMutation.isPending}
            />
            <MovementDialog
                open={movementDialog !== null}
                initialType={movementDialog ?? "cash_in"}
                onClose={() => setMovementDialog(null)}
                onSubmit={(body) => movementMutation.mutateAsync(body).then(() => undefined, () => undefined)}
                suffix={suffix}
                submitting={movementMutation.isPending}
            />
            <VoidMovementDialog
                open={voidTarget !== null}
                onClose={() => setVoidTarget(null)}
                onSubmit={(reason) =>
                    voidMutation.mutateAsync({ id: voidTarget!.id, reason }).then(() => undefined, () => undefined)
                }
                submitting={voidMutation.isPending}
            />
            <ShiftSummaryDialog shift={reportShift} onClose={() => setReportShift(null)} format={format} />
        </Stack>
    );
};

export default CashboxShifts;

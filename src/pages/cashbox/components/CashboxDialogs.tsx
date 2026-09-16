import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid2,
    InputAdornment,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { getCashboxShiftSummary } from "../../../services/cashbox";
import type { CashboxMovementType, CashboxShift } from "../../../types/cashbox";
import { dayjsBranch } from "../../../utility/branchTime";
import { CashboxBreakdown } from "./CashboxBreakdown";

const n = (v: unknown): number => {
    const x = Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
};

const parseAmount = (raw: string): number | null => {
    const v = Number(String(raw).replace(",", ".").replace(/\s/g, ""));
    return Number.isFinite(v) ? v : null;
};

type MoneyFieldProps = {
    label: string;
    value: string;
    onChange: (v: string) => void;
    suffix: string;
    autoFocus?: boolean;
    helperText?: React.ReactNode;
    error?: boolean;
    placeholder?: string;
};

const MoneyField: React.FC<MoneyFieldProps> = ({ label, value, onChange, suffix, autoFocus, helperText, error, placeholder }) => (
    <TextField
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        fullWidth
        inputMode="decimal"
        placeholder={placeholder}
        helperText={helperText}
        error={error}
        InputProps={{ endAdornment: <InputAdornment position="end">{suffix}</InputAdornment> }}
    />
);

export const formatDateTime = (iso: string | null | undefined): string =>
    iso ? dayjsBranch(iso).format("DD.MM.YYYY HH:mm") : "—";

// ---------------------------------------------------------------------------
// Открыть смену
// ---------------------------------------------------------------------------

type OpenShiftDialogProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (body: { openingCash?: number; comment?: string }) => Promise<void>;
    suffix: string;
    submitting: boolean;
};

export const OpenShiftDialog: React.FC<OpenShiftDialogProps> = ({ open, onClose, onSubmit, suffix, submitting }) => {
    const { t } = useTranslation();
    const [openingCash, setOpeningCash] = useState("");
    const [comment, setComment] = useState("");

    useEffect(() => {
        if (open) {
            setOpeningCash("");
            setComment("");
        }
    }, [open]);

    const parsed = openingCash.trim() === "" ? undefined : parseAmount(openingCash);
    const invalid = parsed === null || (parsed !== undefined && parsed < 0);

    return (
        <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 800 }}>{t("cashbox.openShift")}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <MoneyField
                        label={t("cashbox.openingCash")}
                        value={openingCash}
                        onChange={setOpeningCash}
                        suffix={suffix}
                        autoFocus
                        error={invalid}
                        helperText={t("cashbox.openingCashHint")}
                    />
                    <TextField
                        label={t("cashbox.comment")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={submitting}>
                    {t("common.cancel")}
                </Button>
                <Button
                    variant="contained"
                    disabled={submitting || invalid}
                    onClick={() =>
                        void onSubmit({
                            openingCash: parsed ?? undefined,
                            comment: comment.trim() || undefined,
                        })
                    }
                >
                    {submitting ? <CircularProgress size={20} /> : t("cashbox.openShift")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ---------------------------------------------------------------------------
// Закрыть смену (с пересчётом)
// ---------------------------------------------------------------------------

type CloseShiftDialogProps = {
    open: boolean;
    shift: CashboxShift | null;
    onClose: () => void;
    onSubmit: (body: { countedCash: number; comment?: string }) => Promise<void>;
    format: (v: number | string | null | undefined) => string;
    suffix: string;
    submitting: boolean;
};

export const CloseShiftDialog: React.FC<CloseShiftDialogProps> = ({ open, shift, onClose, onSubmit, format, suffix, submitting }) => {
    const { t } = useTranslation();
    const [countedCash, setCountedCash] = useState("");
    const [comment, setComment] = useState("");

    useEffect(() => {
        if (open) {
            setCountedCash("");
            setComment("");
        }
    }, [open]);

    // Ожидаемую наличность бэк считает на текущий момент в summary открытой смены.
    const summary = useQuery({
        queryKey: ["cashbox-shift-summary", shift?.id, "close"],
        queryFn: ({ signal }) => getCashboxShiftSummary(shift!.id, signal),
        enabled: open && !!shift?.id,
        staleTime: 0,
    });
    const expected = summary.data ? n(summary.data.expectedCash) : null;

    const parsed = parseAmount(countedCash);
    const invalid = countedCash.trim() === "" || parsed === null || parsed < 0;
    const discrepancy = expected !== null && parsed !== null && !invalid ? parsed - expected : null;

    return (
        <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 800 }}>{t("cashbox.closeShift")}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            {t("cashbox.expectedCash")}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {summary.isLoading ? <CircularProgress size={18} /> : expected !== null ? format(expected) : "—"}
                        </Typography>
                        {summary.data && (
                            <Typography variant="caption" color="text.secondary">
                                {t("cashbox.expectedCashFormula", {
                                    opening: format(summary.data.openingCash),
                                    cashIn: format(n(summary.data.appointments.cashSum)),
                                    cashOut: format(n(summary.data.expenses.cashSum)),
                                    movements: format(n(summary.data.movements?.netSum)),
                                })}
                            </Typography>
                        )}
                    </Box>
                    {/* Оплата приёма признаётся по времени приёма (appointmentAt), а не оплаты —
                        предоплата за будущий приём в ожидаемую сумму этой смены не попадёт. */}
                    <Alert severity="info" sx={{ py: 0.5 }}>
                        {t("cashbox.prepaymentNote")}
                    </Alert>
                    <MoneyField
                        label={t("cashbox.countedCash")}
                        value={countedCash}
                        onChange={setCountedCash}
                        suffix={suffix}
                        autoFocus
                        error={countedCash.trim() !== "" && invalid}
                    />
                    {discrepancy !== null && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" color="text.secondary">
                                {t("cashbox.discrepancy")}:
                            </Typography>
                            <Chip
                                size="small"
                                color={discrepancy === 0 ? "success" : discrepancy > 0 ? "warning" : "error"}
                                label={
                                    discrepancy === 0
                                        ? t("cashbox.noDiscrepancy")
                                        : `${discrepancy > 0 ? "+" : "−"} ${format(Math.abs(discrepancy))}`
                                }
                            />
                        </Stack>
                    )}
                    <TextField
                        label={t("cashbox.closingComment")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                        helperText={discrepancy !== null && discrepancy !== 0 ? t("cashbox.discrepancyCommentHint") : undefined}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={submitting}>
                    {t("common.cancel")}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    disabled={submitting || invalid}
                    onClick={() => void onSubmit({ countedCash: parsed as number, comment: comment.trim() || undefined })}
                >
                    {submitting ? <CircularProgress size={20} /> : t("cashbox.closeShift")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ---------------------------------------------------------------------------
// Внесение / изъятие / инкассация
// ---------------------------------------------------------------------------

const MOVEMENT_TYPES: CashboxMovementType[] = ["cash_in", "cash_out", "collection"];

type MovementDialogProps = {
    open: boolean;
    initialType: CashboxMovementType;
    onClose: () => void;
    onSubmit: (body: { type: CashboxMovementType; amount: number; comment?: string; recipient?: string }) => Promise<void>;
    suffix: string;
    submitting: boolean;
};

export const MovementDialog: React.FC<MovementDialogProps> = ({ open, initialType, onClose, onSubmit, suffix, submitting }) => {
    const { t } = useTranslation();
    const [type, setType] = useState<CashboxMovementType>(initialType);
    const [amount, setAmount] = useState("");
    const [recipient, setRecipient] = useState("");
    const [comment, setComment] = useState("");

    useEffect(() => {
        if (open) {
            setType(initialType);
            setAmount("");
            setRecipient("");
            setComment("");
        }
    }, [open, initialType]);

    const parsed = parseAmount(amount);
    const amountInvalid = amount.trim() === "" || parsed === null || parsed <= 0;
    const recipientRequired = type === "collection";
    const invalid = amountInvalid || (recipientRequired && recipient.trim() === "");

    return (
        <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 800 }}>{t(`cashbox.movementTypes.${type}`)}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        select
                        label={t("cashbox.movementType")}
                        value={type}
                        onChange={(e) => setType(e.target.value as CashboxMovementType)}
                        fullWidth
                    >
                        {MOVEMENT_TYPES.map((v) => (
                            <MenuItem key={v} value={v}>
                                {t(`cashbox.movementTypes.${v}`)}
                            </MenuItem>
                        ))}
                    </TextField>
                    <MoneyField
                        label={t("cashbox.amount")}
                        value={amount}
                        onChange={setAmount}
                        suffix={suffix}
                        autoFocus
                        error={amount.trim() !== "" && amountInvalid}
                    />
                    <TextField
                        label={t("cashbox.recipient")}
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        fullWidth
                        required={recipientRequired}
                        helperText={recipientRequired ? t("cashbox.recipientRequired") : undefined}
                    />
                    <TextField
                        label={t("cashbox.comment")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={submitting}>
                    {t("common.cancel")}
                </Button>
                <Button
                    variant="contained"
                    disabled={submitting || invalid}
                    onClick={() =>
                        void onSubmit({
                            type,
                            amount: parsed as number,
                            comment: comment.trim() || undefined,
                            recipient: recipient.trim() || undefined,
                        })
                    }
                >
                    {submitting ? <CircularProgress size={20} /> : t("common.save")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ---------------------------------------------------------------------------
// Отмена движения (void) — причина обязательна
// ---------------------------------------------------------------------------

type VoidMovementDialogProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void>;
    submitting: boolean;
};

export const VoidMovementDialog: React.FC<VoidMovementDialogProps> = ({ open, onClose, onSubmit, submitting }) => {
    const { t } = useTranslation();
    const [reason, setReason] = useState("");
    useEffect(() => {
        if (open) setReason("");
    }, [open]);

    return (
        <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 800 }}>{t("cashbox.voidMovement")}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t("cashbox.voidMovementNote")}
                </Typography>
                <TextField
                    label={t("cashbox.voidReason")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    fullWidth
                    autoFocus
                    multiline
                    minRows={2}
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={submitting}>
                    {t("common.cancel")}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    disabled={submitting || reason.trim() === ""}
                    onClick={() => void onSubmit(reason.trim())}
                >
                    {submitting ? <CircularProgress size={20} /> : t("cashbox.voidMovement")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ---------------------------------------------------------------------------
// Z-отчёт смены
// ---------------------------------------------------------------------------

type ShiftSummaryDialogProps = {
    shift: CashboxShift | null;
    onClose: () => void;
    format: (v: number | string | null | undefined) => string;
};

export const ShiftSummaryDialog: React.FC<ShiftSummaryDialogProps> = ({ shift, onClose, format }) => {
    const { t } = useTranslation();
    const summary = useQuery({
        queryKey: ["cashbox-shift-summary", shift?.id],
        queryFn: ({ signal }) => getCashboxShiftSummary(shift!.id, signal),
        enabled: !!shift?.id,
    });

    const data = summary.data;
    const isOpen = shift?.status === "open";
    const discrepancy = data?.discrepancy !== null && data?.discrepancy !== undefined ? n(data.discrepancy) : null;

    const stat = (label: string, value: React.ReactNode, tone?: "success" | "error" | "warning") => (
        <Grid2 size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography sx={{ fontWeight: 800, color: tone ? `${tone}.main` : undefined }}>{value}</Typography>
        </Grid2>
    );

    const header = useMemo(() => {
        if (!shift) return null;
        return (
            <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                        size="small"
                        color={isOpen ? "success" : "default"}
                        label={t(isOpen ? "cashbox.shiftOpen" : "cashbox.shiftClosed")}
                    />
                    <Typography variant="body2" color="text.secondary">
                        {formatDateTime(shift.openedAt)} — {shift.closedAt ? formatDateTime(shift.closedAt) : t("cashbox.now")}
                    </Typography>
                </Stack>
                <Grid2 container spacing={1.5}>
                    {stat(t("cashbox.openedBy"), shift.openedBy?.fullName || "—")}
                    {stat(t("cashbox.openingCash"), format(shift.openingCash))}
                    {stat(
                        t("cashbox.expectedCash"),
                        data ? format(data.expectedCash) : shift.expectedCash !== null ? format(shift.expectedCash) : "—",
                    )}
                    {isOpen
                        ? stat(t("cashbox.countedCash"), "—")
                        : stat(t("cashbox.countedCash"), shift.countedCash !== null ? format(shift.countedCash) : "—")}
                    {!isOpen && stat(t("cashbox.closedBy"), shift.closedBy?.fullName || "—")}
                    {!isOpen &&
                        stat(
                            t("cashbox.discrepancy"),
                            discrepancy === null
                                ? "—"
                                : discrepancy === 0
                                  ? t("cashbox.noDiscrepancy")
                                  : `${discrepancy > 0 ? "+" : "−"} ${format(Math.abs(discrepancy))}`,
                            discrepancy === null || discrepancy === 0 ? "success" : discrepancy > 0 ? "warning" : "error",
                        )}
                </Grid2>
                {(shift.comment || shift.closingComment) && (
                    <Typography variant="body2" color="text.secondary">
                        {shift.comment && (
                            <>
                                {t("cashbox.comment")}: {shift.comment}
                            </>
                        )}
                        {shift.comment && shift.closingComment && <br />}
                        {shift.closingComment && (
                            <>
                                {t("cashbox.closingComment")}: {shift.closingComment}
                            </>
                        )}
                    </Typography>
                )}
            </Stack>
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shift, data, discrepancy, isOpen, t]);

    return (
        <Dialog open={!!shift} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ fontWeight: 800 }}>{t("cashbox.shiftReport")}</DialogTitle>
            <DialogContent>
                <Stack spacing={2.5} sx={{ mt: 0.5 }}>
                    {header}
                    {summary.isLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                            <CircularProgress size={36} />
                        </Box>
                    ) : summary.error ? (
                        <Typography color="error.main">{(summary.error as Error).message || t("cashbox.loadFailed")}</Typography>
                    ) : data ? (
                        <CashboxBreakdown data={data} format={format} compact />
                    ) : null}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose}>{t("common.close")}</Button>
            </DialogActions>
        </Dialog>
    );
};

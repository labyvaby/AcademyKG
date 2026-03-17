/**
 * BalanceTopUpDrawer.tsx
 * Боковая панель: пополнение счёта + история транзакций.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  Box,
  Typography,
  Stack,
  Divider,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  CircularProgress,
  InputAdornment,
  Tab,
  Tabs,
  Chip,
  Avatar,
  Tooltip,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import AddCircleOutlineOutlined from "@mui/icons-material/AddCircleOutlineOutlined";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import { apiFetch } from "../../../utility/apiClient";
import type { TopUpType, PaymentMethod, TopUpPayload } from "../usePatientBalance";

// ─── Типы ────────────────────────────────────────────────────────────────────

type TxItem = {
  id: string;
  txType: "balance" | "bonuses";
  paymentMethod: string | null;
  amount: string;
  note: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientFio: string;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (payload: TopUpPayload) => Promise<boolean>;
};

// ─── Константы ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TopUpType, string> = {
  balance: "Баланс",
  bonuses: "Бонусы",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Безналичные",
};

const TX_TYPE_COLOR: Record<string, "primary" | "warning"> = {
  balance: "primary",
  bonuses: "warning",
};

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function formatAmount(amount: string): string {
  const n = parseFloat(amount);
  if (isNaN(n)) return amount;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("ru-RU")} сом`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ─── Компонент ───────────────────────────────────────────────────────────────

const BalanceTopUpDrawer: React.FC<Props> = ({
  open,
  onClose,
  patientId,
  patientFio,
  submitting,
  submitError,
  onSubmit,
}) => {
  const [tab, setTab] = useState(0); // 0 = пополнение, 1 = история

  // Форма
  const [type, setType] = useState<TopUpType>("balance");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // История
  const [history, setHistory] = useState<TxItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const requiresMethod = type === "balance";

  // ─── Загрузка истории ───────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    if (!patientId) return;
    setHistoryLoading(true);
    try {
      const res: any = await apiFetch(
        `/api/v1/client-balance-transactions/?patient=${patientId}&ordering=-createdAt`
      );
      const results: any[] = res?.data?.results ?? res?.results ?? [];
      setHistory(
        results.map((r) => ({
          id: String(r.id ?? ""),
          txType: r.txType ?? r.tx_type ?? "balance",
          paymentMethod: r.paymentMethod ?? r.payment_method ?? null,
          amount: String(r.amount ?? "0"),
          note: r.note ?? null,
          createdAt: r.createdAt ?? r.created_at ?? "",
          createdBy: r.createdBy
            ? { id: String(r.createdBy.id ?? ""), fullName: String(r.createdBy.fullName ?? r.createdBy.full_name ?? "") }
            : null,
        }))
      );
    } catch {
      // тихо
    } finally {
      setHistoryLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  // ─── Сброс формы ────────────────────────────────────────────────────────

  const resetForm = () => {
    setType("balance");
    setAmount("");
    setMethod("cash");
    setNote("");
    setLocalError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    setTab(0);
    onClose();
  };

  // ─── Отправка ────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setLocalError(null);
    setSuccess(false);

    const parsed = parseFloat(amount.replace(",", "."));
    if (!amount || isNaN(parsed) || parsed === 0) {
      setLocalError("Введите корректную сумму (ненулевую)");
      return;
    }

    const payload: TopUpPayload = {
      type,
      amount: parsed,
      payment_method: requiresMethod ? method : undefined,
      note: note.trim() || undefined,
    };

    const ok = await onSubmit(payload);
    if (ok) {
      setSuccess(true);
      setAmount("");
      setNote("");
      // Перезагрузить историю
      await loadHistory();
      // Через секунду переключить на историю
      setTimeout(() => setTab(1), 800);
    }
  };

  // ─── Рендер ──────────────────────────────────────────────────────────────

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, display: "flex", flexDirection: "column" } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <AccountBalanceWalletOutlined color="primary" />
          <Box>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>Счёт клиента</Typography>
            <Typography variant="caption" color="text.secondary">{patientFio}</Typography>
          </Box>
        </Stack>
        <IconButton onClick={handleClose} size="small"><CloseOutlined /></IconButton>
      </Box>

      <Divider />

      {/* Табы */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab icon={<AddCircleOutlineOutlined fontSize="small" />} iconPosition="start" label="Пополнить" />
        <Tab icon={<HistoryOutlined fontSize="small" />} iconPosition="start" label="История" />
      </Tabs>

      {/* ── Таб 0: Форма пополнения ── */}
      {tab === 0 && (
        <>
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
            <Stack spacing={3}>

              {/* Тип счёта */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Тип счёта</Typography>
                <ToggleButtonGroup value={type} exclusive onChange={(_, v) => v && setType(v)} fullWidth size="small">
                  {(Object.keys(TYPE_LABELS) as TopUpType[]).map((t) => (
                    <ToggleButton key={t} value={t}>{TYPE_LABELS[t]}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>

              {/* Метод оплаты */}
              {requiresMethod && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Способ оплаты</Typography>
                  <ToggleButtonGroup value={method} exclusive onChange={(_, v) => v && setMethod(v)} fullWidth size="small">
                    {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                      <ToggleButton key={m} value={m}>{METHOD_LABELS[m]}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              )}

              {/* Сумма */}
              <TextField
                label="Сумма"
                value={amount}
                onChange={(e) => { setLocalError(null); setSuccess(false); setAmount(e.target.value); }}
                type="number"
                inputProps={{ step: "any" }}
                InputProps={{ endAdornment: <InputAdornment position="end">сом</InputAdornment> }}
                fullWidth
                size="small"
                error={!!localError}
                helperText={localError || "Отрицательное число — списание"}
                disabled={submitting}
              />

              {/* Комментарий */}
              <TextField
                label="Комментарий"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                size="small"
                placeholder="Необязательно"
                disabled={submitting}
              />

              {/* Ошибка / успех */}
              {submitError && (
                <Typography variant="body2" color="error">{submitError}</Typography>
              )}
              {success && (
                <Typography variant="body2" color="success.main">✓ Операция выполнена успешно</Typography>
              )}
            </Stack>
          </Box>

          <Divider />
          <Box sx={{ px: 3, py: 2, flexShrink: 0 }}>
            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              <Button variant="outlined" onClick={handleClose} disabled={submitting}>Отмена</Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting || !amount}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {submitting ? "Сохранение…" : "Применить"}
              </Button>
            </Stack>
          </Box>
        </>
      )}

      {/* ── Таб 1: История ── */}
      {tab === 1 && (
        <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
          {historyLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size={32} />
            </Stack>
          ) : history.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6, opacity: 0.5 }}>
              <HistoryOutlined sx={{ fontSize: 48, mb: 1, color: "text.secondary" }} />
              <Typography variant="body2" color="text.secondary">История пуста</Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {history.map((tx) => {
                const amt = parseFloat(tx.amount);
                const isPositive = amt > 0;
                return (
                  <Box
                    key={tx.id}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1.5,
                      px: 2,
                      py: 1.5,
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                      {/* Левая часть */}
                      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                          <Chip
                            label={TYPE_LABELS[tx.txType] ?? tx.txType}
                            size="small"
                            color={TX_TYPE_COLOR[tx.txType] ?? "default"}
                            variant="outlined"
                          />
                          {tx.paymentMethod && (
                            <Chip
                              label={METHOD_LABELS[tx.paymentMethod as PaymentMethod] ?? tx.paymentMethod}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>

                        {tx.note && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {tx.note}
                          </Typography>
                        )}

                        {tx.createdBy && (
                          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.5 }}>
                            <Tooltip title={tx.createdBy.fullName}>
                              <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: "grey.400" }}>
                                {getInitials(tx.createdBy.fullName)}
                              </Avatar>
                            </Tooltip>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {tx.createdBy.fullName}
                            </Typography>
                          </Stack>
                        )}

                        <Typography variant="caption" color="text.disabled">
                          {formatDate(tx.createdAt)}
                        </Typography>
                      </Stack>

                      {/* Сумма */}
                      <Typography
                        variant="subtitle1"
                        fontWeight={700}
                        color={isPositive ? "success.main" : "error.main"}
                        sx={{ flexShrink: 0 }}
                      >
                        {formatAmount(tx.amount)}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      )}
    </Drawer>
  );
};

export default BalanceTopUpDrawer;

import React, { useState, useEffect } from "react";
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Divider,
    Stack,
    TextField,
    Button,
    CircularProgress,
    Paper,
    Chip,
    alpha,
    Tooltip,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import CardGiftcardOutlined from "@mui/icons-material/CardGiftcardOutlined";
// AccountBalanceWalletOutlined и CreditCardOutlined используются в полях оплаты (Наличные/Безналичные)

import { APPOINTMENT_STATUSES } from "../../../config/appointmentStatuses";
import { Appointment, type AppointmentServiceJson } from "../types";
import { apiFetch } from "../../../utility/apiClient";
import { useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { usePatientBalance } from "../../patient-search/usePatientBalance";

type PaymentSidebarProps = {
    open: boolean;
    onClose: () => void;
    appointment: Appointment | null;
    onSaved: () => void;
    productsCost?: number;
};

export const PaymentSidebar: React.FC<PaymentSidebarProps> = ({
    open,
    onClose,
    appointment,
    onSaved,
    productsCost = 0,
}) => {
    const { open: notify } = useNotification();
    const [loading, setLoading] = useState(false);

    // Form State
    // We'll process "services_json" to get the list of services for this appointment.
    // Ideally, appointment should have them.
    // If not, we might need to rely on 'service_names' or fetch?
    // The 'AppointmentsAggregated' view usually has 'services_json'.

    const [cash, setCash] = useState<number | "">("");
    const [card, setCard] = useState<number | "">("");
    const [discountPercent, setDiscountPercent] = useState<number>(0);
    const [adminComment, setAdminComment] = useState("");
    const balanceUsed = 0; // Нал/Безнал счёт убран, остались только баллы
    const [pointsUsed, setPointsUsed] = useState<number>(0);

    // Load patient balance
    const { balance: patientBalance, reload: reloadBalance } = usePatientBalance(
        open ? (appointment?.patient_id ?? null) : null
    );

    // CSS to hide spin buttons
    const noSpinnersSx = {
        '& input[type=number]': {
            MozAppearance: 'textfield'
        },
        '& input[type=number]::-webkit-outer-spin-button': {
            WebkitAppearance: 'none',
            margin: 0
        },
        '& input[type=number]::-webkit-inner-spin-button': {
            WebkitAppearance: 'none',
            margin: 0
        }
    };

    // Derived calculations (computed even when appointment is null, so hooks stay above early return)
    let basePrice = 0;
    let servicesList: AppointmentServiceJson[] = [];

    if (appointment) {
        // Приоритет 1: total_amount из БД — базовая цена, сохранённая при создании/редактировании.
        // Это самый надёжный источник, не зависящий от текущих цен услуг.
        const storedAmount = Number(appointment.total_amount || 0);
        const storedCost = Number(appointment.total_cost || appointment.estimated_total || 0);
        const storedDiscount = Number(appointment.discount || 0);

        if (storedAmount > 0) {
            basePrice = storedAmount;
        } else if (storedCost > 0) {
            basePrice = storedCost;
        } else {
            // Fallback: если total_amount == 0 (старые данные, где цена со скидкой была сохранена как 0),
            // пересчитываем из services_json как последний вариант.
            try {
                if (typeof appointment.services_json === 'string') {
                    servicesList = JSON.parse(appointment.services_json) as AppointmentServiceJson[];
                } else if (Array.isArray(appointment.services_json)) {
                    servicesList = appointment.services_json as AppointmentServiceJson[];
                }
            } catch (e) {
                console.error("Error parsing services_json", e);
            }
            if (servicesList.length > 0) {
                basePrice = servicesList.reduce((acc, s) => acc + (Number(s.price ?? s.cost ?? 0) * (s.quantity || 1)), 0);
            }
            // Если и services_json пустой — используем скидку как базу (крайний случай)
            if (basePrice <= 0 && storedDiscount > 0) {
                basePrice = storedDiscount;
            }
        }

        basePrice += productsCost;
    }

    // All hooks must be called before any early return
    const lastInitializedId = React.useRef<string | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (open && appointment) {
            // Re-initialize every time the sidebar opens (even for the same appointment id)
            // so re-opened payments reflect the latest saved values
            if (lastInitializedId.current !== appointment.id || lastInitializedId.current === null) {
                setCash(appointment.paid_cash || "");
                setCard(appointment.paid_card || "");
                setPointsUsed(appointment.paid_bonuses || 0);

                // Вычисляем процент скидки из сохранённых данных.
                // basePrice здесь уже восстановлен (total_amount + discount),
                // поэтому деление корректно.
                // Та же логика что и для basePrice выше: приоритет total_amount из БД
                const initBase = (() => {
                    const sa = Number(appointment.total_amount || 0);
                    const sc = Number(appointment.total_cost || appointment.estimated_total || 0);
                    const sd = Number(appointment.discount || 0);
                    if (sa > 0) return sa + productsCost;
                    if (sc > 0) return sc + productsCost;
                    // fallback через services_json
                    let list: AppointmentServiceJson[] = [];
                    try {
                        if (typeof appointment.services_json === 'string') list = JSON.parse(appointment.services_json);
                        else if (Array.isArray(appointment.services_json)) list = appointment.services_json as AppointmentServiceJson[];
                    } catch (_) { /* ignore */ }
                    const fromServices = list.reduce((acc, s) => acc + (Number(s.price ?? s.cost ?? 0) * (s.quantity || 1)), 0);
                    if (fromServices > 0) return fromServices + productsCost;
                    return (sd > 0 ? sd : 0) + productsCost;
                })();

                if (initBase > 0 && appointment.discount > 0) {
                    const percent = Math.round((appointment.discount / initBase) * 100);
                    setDiscountPercent(percent);
                } else {
                    setDiscountPercent(0);
                }

                setAdminComment(appointment.admin_comment || "");
                lastInitializedId.current = appointment.id;
            }
        } else if (!open) {
            lastInitializedId.current = null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, appointment?.id]);

    // Calculate Discount Amount
    const discountAmount = Math.round((basePrice * discountPercent) / 100);

    // Final Price to Pay
    const finalPrice = Math.max(0, basePrice - discountAmount);

    // Total Paid Input
    const cashNum = Number(cash || 0);
    const cardNum = Number(card || 0);
    const totalPaid = cashNum + cardNum + balanceUsed + pointsUsed;

    // Debt = finalPrice - totalPaid
    const debt = Math.max(0, finalPrice - totalPaid);

    if (!appointment) return null;

    const handleSaveFree = async () => {
        if (loading || !appointment) return;
        
        const prevDetails = queryClient.getQueryData<any>(['appointment-details', appointment.id]);
        const updates = {
            status: APPOINTMENT_STATUSES.FREE,
            paid_cash: 0,
            paid_card: 0,
            discount: basePrice,
            debt: 0,
            admin_comment: adminComment,
        };

        // Optimistic update
        if (prevDetails) {
            queryClient.setQueryData(['appointment-details', appointment.id], {
                ...prevDetails,
                item: { ...prevDetails.item, ...updates },
            });
        }
        queryClient.setQueriesData({ queryKey: ["appointments", "daily"] }, (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map((a: any) => a.id === appointment.id ? { ...a, ...updates } : a);
        });

        try {
            setLoading(true);
            await apiFetch(`/api/v1/appointments/${appointment.id}/`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: "free",
                    paidCash: 0,
                    paidCard: 0,
                    discount: basePrice,
                    debt: 0,
                    adminComment: adminComment,
                })
            });

            notify?.({ type: "success", message: "Приём отмечен как бесплатный" });
            onSaved();
            onClose();
        } catch (e: unknown) {
            console.error("Failed to save free appointment:", e);
            if (prevDetails) {
                queryClient.setQueryData(['appointment-details', appointment.id], prevDetails);
            }
            queryClient.invalidateQueries({ queryKey: ["appointments", "daily"] });
            notify?.({ type: "error", message: "Ошибка при сохранении" });
        } finally {
            setLoading(false);
        }
    };

    // Helper: deduct/refund patient bonuses after successful payment save
    const adjustPatientBalanceIfNeeded = async () => {
        if (!appointment?.patient_id || pointsUsed === 0) return;

        const prevPoints = appointment.paid_bonuses || 0;
        const diff = pointsUsed - prevPoints; // > 0 = списываем, < 0 = возвращаем
        if (diff === 0) return;

        await apiFetch(`/api/v1/client-balance-transactions/`, {
            method: "POST",
            body: JSON.stringify({
                patient: appointment.patient_id,
                txType: "bonuses",
                amount: String(-diff), // отрицательное = списание, положительное = возврат
                note: `Оплата приёма #${appointment.id}`,
            }),
        });

        reloadBalance();
    };

    const handleSave = async () => {
        if (loading) return;

        // Optimistic Updates
        const prevDetails = queryClient.getQueryData<any>(['appointment-details', appointment.id]);

        // Статус определяется автоматически по факту оплаты
        const newStatusApi = (() => {
            if (debt <= 0) {
                if (totalPaid <= 0 && discountAmount > 0) return "discounted";
                return "paid";
            }
            if (totalPaid > 0) return "partially_paid";
            return "scheduled"; // по умолчанию — ожидаем
        })();
        const newStatusRu = (() => {
            if (debt <= 0) {
                if (totalPaid <= 0 && discountAmount > 0) return APPOINTMENT_STATUSES.DISCOUNTED;
                return APPOINTMENT_STATUSES.PAID;
            }
            if (totalPaid > 0) return APPOINTMENT_STATUSES.PARTIALLY_PAID;
            return APPOINTMENT_STATUSES.EXPECTED; // по умолчанию — ожидаем
        })();

        const updates = {
            status: newStatusRu, // для локального cache (русский)
            paid_cash: cashNum,
            paid_card: cardNum,
            paid_balance: balanceUsed,
            paid_bonuses: pointsUsed,
            discount: discountAmount,
            debt: debt,
            admin_comment: adminComment,
        };

        // Update details cache
        if (prevDetails) {
            queryClient.setQueryData(['appointment-details', appointment.id], {
                ...prevDetails,
                item: { ...prevDetails.item, ...updates }
            });
        }

        // Update list cache
        queryClient.setQueriesData({ queryKey: ["appointments", "daily"] }, (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map(a => a.id === appointment.id ? { ...a, ...updates } : a);
        });

        try {
            setLoading(true);

            await apiFetch(`/api/v1/appointments/${appointment.id}/`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: newStatusApi,
                    paidCash: cashNum,
                    paidCard: cardNum,
                    paidBalance: balanceUsed,
                    paidBonuses: pointsUsed,
                    discount: discountAmount,
                    debt: debt,
                    adminComment: adminComment,
                })
            });

            await adjustPatientBalanceIfNeeded();


            notify?.({
                type: "success",
                message: "Оплата успешно сохранена",
            });
            onSaved();
            onClose();
        } catch (e: unknown) {
            // Rollback
            if (prevDetails) {
                queryClient.setQueryData(['appointment-details', appointment.id], prevDetails);
            }
            queryClient.invalidateQueries({ queryKey: ["appointments", "daily"] });

            console.error(e);
            const message =
                e && typeof e === "object" && "message" in e
                    ? String((e as { message?: unknown }).message)
                    : String(e);
            notify?.({
                type: "error",
                message: "Ошибка при сохранении оплаты",
                description: message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            transitionDuration={{ enter: 280, exit: 220 }}
            PaperProps={{
                sx: {
                    width: { xs: 320, sm: 400 },
                    zIndex: (theme) => theme.zIndex.drawer + 20,
                    display: "flex",
                    flexDirection: "column",
                    transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1) !important",
                },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5 }}>
                <Typography variant="h6">Оплата приема</Typography>
                <IconButton onClick={onClose}><CloseOutlined /></IconButton>
            </Box>

            <Stack
                spacing={3}
                sx={{
                    p: 3,
                    flex: 1,
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    '&::-webkit-scrollbar': {
                        display: 'none',
                    },
                }}
            >
                {/* Combined Patient and Payment Card */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5,
                        bgcolor: (theme) => alpha(theme.palette.success.main, 0.04), // soft green tint for the whole card
                        border: '1px solid',
                        borderColor: (theme) => alpha(theme.palette.success.main, 0.2),
                        borderRadius: 2,
                    }}
                >
                    <Stack spacing={2}>
                        {/* Patient Info & Balance Section */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Клиент
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                                {appointment.patient_name}
                            </Typography>

                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Баллы клиента
                            </Typography>
                            {/* Баллы */}
                            <Box sx={{
                                borderRadius: 1.5, border: '1px solid',
                                borderColor: pointsUsed > 0 ? 'warning.main' : 'divider',
                                bgcolor: pointsUsed > 0 ? (theme) => alpha(theme.palette.warning.main, 0.08) : 'background.paper',
                                p: 1.5, transition: 'all 0.2s',
                            }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <CardGiftcardOutlined sx={{ fontSize: 20, color: 'warning.main' }} />
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" display="block">Доступно баллов</Typography>
                                            <Typography variant="body1" fontWeight={700} color="warning.main">
                                                {(patientBalance?.bonuses ?? 0).toLocaleString()} сом
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    {((patientBalance?.bonuses ?? 0) > 0 || pointsUsed > 0) && (
                                        <Button size="small" variant={pointsUsed > 0 ? "contained" : "outlined"} color="warning"
                                            sx={{ minWidth: 90, textTransform: 'none' }}
                                            onClick={() => {
                                                if (pointsUsed > 0) { setPointsUsed(0); }
                                                else { setPointsUsed(Math.min(patientBalance?.bonuses ?? 0, Math.max(0, finalPrice - cashNum - cardNum))); }
                                            }}>
                                            {pointsUsed > 0 ? `Убрать (${pointsUsed.toLocaleString()})` : "Применить"}
                                        </Button>
                                    )}
                                </Stack>
                            </Box>
                        </Box>

                        <Divider sx={{ my: 1 }} />

                        {/* Payment Info Section */}
                        <Stack spacing={2}>
                            {/* Стоимость и Скидка */}
                            <Stack direction="row" spacing={2} alignItems="flex-start">
                                <Box flex={1}>
                                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                        Стоимость
                                    </Typography>
                                    <Typography variant="h6" fontWeight={600}>
                                        {basePrice.toLocaleString()} сом
                                    </Typography>
                                </Box>
                                <Box flex={1}>
                                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                        Скидка, %
                                    </Typography>
                                    <TextField
                                        type="number"
                                        size="small"
                                        fullWidth
                                        value={discountPercent}
                                        onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                                        inputProps={{ min: 0, max: 100, style: { textAlign: 'center' } }}
                                        sx={{ ...noSpinnersSx }}
                                    />
                                </Box>
                            </Stack>

                            {/* Наличные и Безналичные компактно */}
                            <Stack direction="row" spacing={2}>
                                <Stack flex={1} spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Наличные
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => {
                                                setCash(Math.max(0, finalPrice - pointsUsed));
                                                setCard(0);
                                            }}
                                            sx={{ minWidth: 'auto', px: 1, fontSize: '0.7rem', textTransform: 'none' }}
                                        >
                                            100%
                                        </Button>
                                    </Stack>
                                    <Stack direction="row" alignItems="center" spacing={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                                        <Box px={1}><AccountBalanceWalletOutlined color="action" fontSize="small" /></Box>
                                        <TextField
                                            variant="standard"
                                            fullWidth
                                            type="number"
                                            value={cash}
                                            onChange={(e) => {
                                                if (e.target.value === "") {
                                                    setCash("");
                                                } else {
                                                    const val = Number(e.target.value);
                                                    // Ограничиваем сумму: не больше итоговой суммы минус другие виды платежа
                                                    const maxAllowed = Math.max(0, finalPrice - cardNum - pointsUsed);
                                                    setCash(Math.min(val, maxAllowed));
                                                }
                                            }}
                                            InputProps={{ disableUnderline: true }}
                                            sx={{ py: 0.5, ...noSpinnersSx }}
                                            placeholder="0"
                                        />
                                    </Stack>
                                </Stack>

                                <Stack flex={1} spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Безналичные
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => {
                                                setCard(Math.max(0, finalPrice - pointsUsed));
                                                setCash(0);
                                            }}
                                            sx={{ minWidth: 'auto', px: 1, fontSize: '0.7rem', textTransform: 'none' }}
                                        >
                                            100%
                                        </Button>
                                    </Stack>
                                    <Stack direction="row" alignItems="center" spacing={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                                        <Box px={1}><CreditCardOutlined color="action" fontSize="small" /></Box>
                                        <TextField
                                            variant="standard"
                                            fullWidth
                                            type="number"
                                            value={card}
                                            onChange={(e) => {
                                                if (e.target.value === "") {
                                                    setCard("");
                                                } else {
                                                    const val = Number(e.target.value);
                                                    // Ограничиваем сумму: не больше итоговой суммы минус другие виды платежа
                                                    const maxAllowed = Math.max(0, finalPrice - cashNum - pointsUsed);
                                                    setCard(Math.min(val, maxAllowed));
                                                }
                                            }}
                                            InputProps={{ disableUnderline: true }}
                                            sx={{ py: 0.5, ...noSpinnersSx }}
                                            placeholder="0"
                                        />
                                    </Stack>
                                </Stack>
                            </Stack>

                            {/* Со счёта клиента — только баллы */}
                            {pointsUsed > 0 && (
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 1.25,
                                        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.06),
                                        border: '1px solid',
                                        borderColor: (theme) => alpha(theme.palette.warning.main, 0.2),
                                        borderRadius: 1,
                                    }}
                                >
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="caption" color="warning.main">Баллами</Typography>
                                        <Typography variant="caption" color="warning.main" fontWeight={600}>− {pointsUsed.toLocaleString()} сом</Typography>
                                    </Stack>
                                </Paper>
                            )}

                            <Divider sx={{ my: 1 }} />

                            {/* Итого к оплате */}
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                                    Итого к оплате
                                </Typography>
                                <Typography variant="h5" fontWeight={700} color="success.main">
                                    {finalPrice.toLocaleString()} сом
                                </Typography>
                            </Stack>

                            {/* Статус и Долг */}
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" color="text.secondary">
                                    Статус
                                </Typography>
                                <Chip
                                    label={debt <= 0 ? "Оплачено" : totalPaid > 0 ? "Частично оплачено" : "Не оплачено"}
                                    size="small"
                                    color={debt <= 0 ? "success" : totalPaid > 0 ? "warning" : "default"}
                                    sx={{ fontWeight: 600 }}
                                />
                            </Stack>

                            {debt > 0 && (
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 1.5,
                                        bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                                        border: '1px solid',
                                        borderColor: (theme) => alpha(theme.palette.error.main, 0.3),
                                        borderRadius: 1,
                                    }}
                                >
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" color="error.main" fontWeight={600}>
                                            Долг
                                        </Typography>
                                        <Typography variant="h6" color="error.main" fontWeight={700}>
                                            {debt.toLocaleString()} сом
                                        </Typography>
                                    </Stack>
                                </Paper>
                            )}
                        </Stack>
                    </Stack>
                </Paper>
                <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Комментарий администратора
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        placeholder="Добавьте комментарий (необязательно)"
                    />
                </Stack>

            </Stack>

            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack spacing={1}>
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading}
                        onClick={handleSave}
                    >
                        {loading ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            (appointment.paid_cash || 0) > 0 || (appointment.paid_card || 0) > 0
                                ? "Обновить оплату"
                                : "Подтвердить оплату"
                        )}
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
};

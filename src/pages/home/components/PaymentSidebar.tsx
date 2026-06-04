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
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
// AccountBalanceWalletOutlined и CreditCardOutlined используются в полях оплаты (Наличные/Безналичные)

import { APPOINTMENT_STATUSES } from "../../../config/appointmentStatuses";
import { Appointment, type AppointmentServiceJson } from "../types";
import { apiFetch } from "../../../utility/apiClient";
import { useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { usePatientBalance } from "../../patient-search/usePatientBalance";
import { printReceipt, type ReceiptData } from "../../../components/ui/PaymentReceipt";
import { useBranchContext } from "../../../contexts/branch-context";

type PaymentSidebarProps = {
    open: boolean;
    onClose: () => void;
    appointment: Appointment | null;
    onSaved: () => void;
    productsCost?: number;
    /** Bulk/period mode: список id приёмов периода. Если задан и не пуст — sidebar работает как групповая оплата. */
    bulkAppointmentIds?: string[];
    /** Общая сумма за все приёмы периода. Используется как basePrice в bulk-режиме. */
    bulkTotalAmount?: number;
    /** Кол-во приёмов для отображения в заголовке bulk-режима. */
    bulkCount?: number;
};

// Распределяет сумму между N приёмами по копейкам с учётом остатка.
function distributeAmount(total: number, count: number): number[] {
    if (count <= 0) return [];
    const totalCents = Math.round(total * 100);
    const baseCents = Math.floor(totalCents / count);
    const remainderCents = totalCents - baseCents * count;
    const shares: number[] = [];
    for (let i = 0; i < count; i++) {
        const c = baseCents + (i < remainderCents ? 1 : 0);
        shares.push(c / 100);
    }
    return shares;
}

export const PaymentSidebar: React.FC<PaymentSidebarProps> = ({
    open,
    onClose,
    appointment,
    onSaved,
    productsCost = 0,
    bulkAppointmentIds,
    bulkTotalAmount,
    bulkCount,
}) => {
    const isBulkMode = Boolean(bulkAppointmentIds && bulkAppointmentIds.length > 0);
    const { open: notify } = useNotification();
    const { selectedBranch } = useBranchContext();

    // Автоматическая скидка для ребёнка сотрудника: подгружаем клиента и читаем процент.
    const [employeeChildPercent, setEmployeeChildPercent] = useState<number | null>(null);
    useEffect(() => {
        if (!open || !appointment?.patient_id) {
            setEmployeeChildPercent(null);
            return;
        }
        let cancelled = false;
        apiFetch(`/api/v1/clients/${appointment.patient_id}/`)
            .then((r: any) => {
                if (cancelled) return;
                const data = r?.data ?? r;
                const isChild = Boolean(data?.isEmployeeChild ?? data?.is_employee_child);
                const pct = data?.employeeChildDiscountPercent ?? data?.employee_child_discount_percent;
                if (isChild && pct !== null && pct !== undefined && Number(pct) > 0) {
                    setEmployeeChildPercent(Number(pct));
                } else {
                    setEmployeeChildPercent(null);
                }
            })
            .catch(() => {
                if (!cancelled) setEmployeeChildPercent(null);
            });
        return () => { cancelled = true; };
    }, [open, appointment?.patient_id]);
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
    const [balanceUsed, setBalanceUsed] = useState<number>(0);
    const [pointsUsed, setPointsUsed] = useState<number>(0);
    const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);

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

    if (isBulkMode && typeof bulkTotalAmount === "number") {
        basePrice = bulkTotalAmount;
    } else if (appointment) {
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

    const createBalanceTransaction = async (txType: "balance" | "bonuses", amount: number, note: string) => {
        if (!appointment?.patient_id || amount === 0) return;
        await apiFetch(`/api/v1/client-balance-transactions/`, {
            method: "POST",
            body: JSON.stringify({
                patient: appointment.patient_id,
                txType,
                amount: String(amount),
                note,
            }),
        });
    };

    useEffect(() => {
        if (open && isBulkMode) {
            // Bulk-режим: всегда сбрасываем поля к "пусто" при открытии.
            const bulkKey = `bulk:${(bulkAppointmentIds ?? []).join(",")}`;
            if (lastInitializedId.current !== bulkKey) {
                setCash("");
                setCard("");
                setBalanceUsed(0);
                setPointsUsed(0);
                setDiscountPercent(0);
                setAdminComment("");
                lastInitializedId.current = bulkKey;
            }
            return;
        }
        if (open && appointment) {
            // Re-initialize every time the sidebar opens (even for the same appointment id)
            // so re-opened payments reflect the latest saved values
            if (lastInitializedId.current !== appointment.id || lastInitializedId.current === null) {
                setCash(appointment.paid_cash || "");
                setCard(appointment.paid_card || "");
                setBalanceUsed(appointment.paid_balance || 0);
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
            setLastReceiptData(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, appointment?.id]);

    // Если клиент — ребёнок сотрудника, форсим процент скидки на значение из карточки клиента.
    useEffect(() => {
        if (open && employeeChildPercent !== null) {
            setDiscountPercent(employeeChildPercent);
        }
    }, [open, employeeChildPercent]);

    // Calculate Discount Amount
    const discountAmount = Math.round((basePrice * discountPercent) / 100);

    // Final Price to Pay
    const finalPrice = Math.max(0, basePrice - discountAmount);

    // Total Paid Input
    const cashNum = Number(cash || 0);
    const cardNum = Number(card || 0);
    const totalPaid = cashNum + cardNum + balanceUsed + pointsUsed;

    // Local preview only. Canonical debt/status comes from backend after save.
    const previewDebt = Math.max(0, finalPrice - totalPaid);

    if (!appointment && !isBulkMode) return null;

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

    const handleSaveBulk = async () => {
        if (loading) return;
        const ids = bulkAppointmentIds ?? [];
        if (ids.length === 0) {
            notify?.({ type: "error", message: "Не указаны приёмы для оплаты" });
            return;
        }
        if (ids.some((id) => !id)) {
            notify?.({ type: "error", message: "Не удалось определить созданные приёмы для оплаты" });
            return;
        }
        const cashShares = distributeAmount(cashNum, ids.length);
        const cardShares = distributeAmount(cardNum, ids.length);
        const discountShares = distributeAmount(discountAmount, ids.length);
        try {
            setLoading(true);
            // Promise.all останавливается при первой ошибке — частично "оплаченные" приёмы остаются с обновлёнными
            // полями, но ошибка отображается пользователю; рассинхрон возможен в случае сетевых сбоев.
            await Promise.all(
                ids.map((id, idx) =>
                    apiFetch(`/api/v1/appointments/${id}/`, {
                        method: "PATCH",
                        body: JSON.stringify({
                            paidCash: cashShares[idx] ?? 0,
                            paidCard: cardShares[idx] ?? 0,
                            paidBalance: 0,
                            paidBonuses: 0,
                            discount: discountShares[idx] ?? 0,
                            adminComment: adminComment,
                        }),
                    })
                )
            );
            notify?.({ type: "success", message: `Оплата за ${ids.length} приёмов сохранена` });
            queryClient.invalidateQueries({ queryKey: ["appointments", "daily"] });
            onSaved();
            onClose();
        } catch (e: unknown) {
            const message = e && typeof e === "object" && "message" in e ? String((e as { message?: unknown }).message) : String(e);
            notify?.({ type: "error", message: "Ошибка при сохранении оплаты за период", description: message });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (isBulkMode) return handleSaveBulk();
        if (loading) return;
        if (!appointment) return;

        // Capture prev values BEFORE any optimistic updates
        const prevBalance = appointment.paid_balance || 0;
        const prevPoints = appointment.paid_bonuses || 0;
        const previousPaymentPayload = {
            paidCash: Number(appointment.paid_cash || 0),
            paidCard: Number(appointment.paid_card || 0),
            paidBalance: Number(appointment.paid_balance || 0),
            paidBonuses: Number(appointment.paid_bonuses || 0),
            discount: Number(appointment.discount || 0),
            adminComment: appointment.admin_comment || "",
        };
        const nextPaymentPayload = {
            paidCash: cashNum,
            paidCard: cardNum,
            paidBalance: balanceUsed,
            paidBonuses: pointsUsed,
            discount: discountAmount,
            adminComment: adminComment,
        };

        // Optimistic Updates
        const prevDetails = queryClient.getQueryData<any>(['appointment-details', appointment.id]);

        const updates = {
            paid_cash: cashNum,
            paid_card: cardNum,
            paid_balance: balanceUsed,
            paid_bonuses: pointsUsed,
            discount: discountAmount,
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
        let appointmentSaved = false;
        const appliedAdjustments: Array<{ txType: "balance" | "bonuses"; amount: number }> = [];

        try {
            setLoading(true);

            await apiFetch(`/api/v1/appointments/${appointment.id}/`, {
                method: "PATCH",
                body: JSON.stringify(nextPaymentPayload)
            });
            appointmentSaved = true;

            const diffPoints = pointsUsed - prevPoints;
            const diffBalance = balanceUsed - prevBalance;
            const paymentNote = `Оплата приёма #${appointment.id}`;

            if (diffPoints !== 0) {
                const amount = -diffPoints;
                await createBalanceTransaction("bonuses", amount, paymentNote);
                appliedAdjustments.push({ txType: "bonuses", amount });
            }

            if (diffBalance !== 0) {
                const amount = -diffBalance;
                await createBalanceTransaction("balance", amount, paymentNote);
                appliedAdjustments.push({ txType: "balance", amount });
            }

            reloadBalance();

            // Сохраняем данные для печати чека и сразу отправляем на печать.
            // Кнопка «Печать чека» остаётся для повторной печати.
            if (appointment) {
                const receiptData: ReceiptData = {
                    appointment,
                    cashPaid: cashNum,
                    cardPaid: cardNum,
                    balancePaid: balanceUsed,
                    bonusesPaid: pointsUsed,
                    discountPercent,
                    discountAmount,
                    basePrice,
                    finalPrice,
                    bulkCount: bulkCount,
                    cashierName: appointment.updated_by_name ?? appointment.created_by_name ?? null,
                    branchName: selectedBranch?.name ?? null,
                };
                setLastReceiptData(receiptData);
                printReceipt(receiptData);
            }

            notify?.({
                type: "success",
                message: "Оплата успешно сохранена",
            });
            onSaved();
            // Не закрываем сразу — даём напечатать чек. Пользователь закроет вручную.
        } catch (e: unknown) {
            let rollbackFailed = false;
            const rollbackErrors: string[] = [];

            if (appointmentSaved && appointment?.id) {
                const rollbackTasks: Promise<unknown>[] = [];

                // Если PATCH приёма прошёл, компенсируем уже созданные движения по балансу
                // и возвращаем платёжные поля приёма в исходное состояние.
                rollbackTasks.push(
                    apiFetch(`/api/v1/appointments/${appointment.id}/`, {
                        method: "PATCH",
                        body: JSON.stringify(previousPaymentPayload),
                    }),
                );

                appliedAdjustments.forEach((adjustment) => {
                    rollbackTasks.push(
                        createBalanceTransaction(
                            adjustment.txType,
                            -adjustment.amount,
                            `Rollback оплаты приёма #${appointment.id}`,
                        ),
                    );
                });

                const rollbackResults = await Promise.allSettled(rollbackTasks);
                rollbackResults.forEach((result) => {
                    if (result.status === "rejected") {
                        rollbackFailed = true;
                        rollbackErrors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
                    }
                });
            }

            // Rollback
            if (prevDetails) {
                queryClient.setQueryData(['appointment-details', appointment.id], prevDetails);
            }
            queryClient.invalidateQueries({ queryKey: ["appointments", "daily"] });
            reloadBalance();

            console.error(e);
            const message =
                e && typeof e === "object" && "message" in e
                    ? String((e as { message?: unknown }).message)
                    : String(e);
            notify?.({
                type: "error",
                message: "Ошибка при сохранении оплаты",
                description: rollbackFailed
                    ? `${message}. Откат выполнен не полностью: ${rollbackErrors.join("; ")}`
                    : message,
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
                <Typography variant="h6">{isBulkMode ? "Оплата за период" : "Оплата приема"}</Typography>
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
                                {isBulkMode ? "Приёмы периода" : "Клиент"}
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                                {isBulkMode
                                    ? `${bulkCount ?? (bulkAppointmentIds?.length ?? 0)} ${(bulkCount ?? (bulkAppointmentIds?.length ?? 0)) === 1 ? "приём" : "приёмов"}${appointment?.patient_name ? ` — ${appointment.patient_name}` : ""}`
                                    : appointment?.patient_name}
                            </Typography>

                            {!isBulkMode && (
                                <Stack spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="caption" color="text.secondary">
                                            Со счёта / баллов
                                        </Typography>
                                        <Typography variant="caption" color="success.main" fontWeight={600}>
                                            доступно: {((patientBalance?.balance ?? 0) + (patientBalance?.bonuses ?? 0)).toLocaleString()} сом
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" alignItems="center" spacing={0} sx={{ border: '1px solid', borderColor: (balanceUsed + pointsUsed) > 0 ? 'success.main' : 'divider', borderRadius: 1, bgcolor: 'background.paper', transition: 'border-color 0.2s' }}>
                                        <Box px={1}><AccountBalanceWalletOutlined sx={{ fontSize: 18, color: (balanceUsed + pointsUsed) > 0 ? 'success.main' : 'action.active' }} /></Box>
                                        <TextField
                                            variant="standard"
                                            fullWidth
                                            type="number"
                                            value={(balanceUsed + pointsUsed) === 0 ? "" : balanceUsed + pointsUsed}
                                            onChange={(e) => {
                                                if (e.target.value === "") {
                                                    setBalanceUsed(0);
                                                    setPointsUsed(0);
                                                } else {
                                                    const val = Number(e.target.value);
                                                    const maxAvailable = (patientBalance?.balance ?? 0) + (patientBalance?.bonuses ?? 0);
                                                    const maxAllowed = Math.max(0, finalPrice - cashNum - cardNum);
                                                    const clamped = Math.min(val, maxAvailable, maxAllowed);
                                                    // Сначала используем баланс, потом баллы
                                                    const fromBalance = Math.min(clamped, patientBalance?.balance ?? 0);
                                                    const fromBonuses = clamped - fromBalance;
                                                    setBalanceUsed(fromBalance);
                                                    setPointsUsed(fromBonuses);
                                                }
                                            }}
                                            InputProps={{ disableUnderline: true }}
                                            sx={{ py: 0.5, ...noSpinnersSx }}
                                            placeholder="0"
                                        />
                                    </Stack>
                                </Stack>
                            )}
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
                                        disabled={employeeChildPercent !== null}
                                        helperText={employeeChildPercent !== null ? "Авто: ребёнок сотрудника" : undefined}
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
                                                setCash(Math.max(0, finalPrice - balanceUsed - pointsUsed));
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
                                                    const maxAllowed = Math.max(0, finalPrice - cardNum - balanceUsed - pointsUsed);
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
                                                setCard(Math.max(0, finalPrice - balanceUsed - pointsUsed));
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
                                                    const maxAllowed = Math.max(0, finalPrice - cashNum - balanceUsed - pointsUsed);
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

                            {(balanceUsed + pointsUsed) > 0 && (
                                <Paper elevation={0} sx={{ p: 1.25, bgcolor: (theme) => alpha(theme.palette.success.main, 0.06), border: '1px solid', borderColor: (theme) => alpha(theme.palette.success.main, 0.2), borderRadius: 1 }}>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="caption" color="success.main">Со счёта / баллов</Typography>
                                        <Typography variant="caption" color="success.main" fontWeight={600}>− {(balanceUsed + pointsUsed).toLocaleString()} сом</Typography>
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

                            {/* Предварительный расчет */}
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" color="text.secondary">
                                    Предпросмотр
                                </Typography>
                                <Chip
                                    label={previewDebt <= 0 ? "Сумма закрыта" : totalPaid > 0 ? "Частичное покрытие" : "Без оплаты"}
                                    size="small"
                                    color={previewDebt <= 0 ? "success" : totalPaid > 0 ? "warning" : "default"}
                                    sx={{ fontWeight: 600 }}
                                />
                            </Stack>

                            <Typography variant="caption" color="text.secondary">
                                Фактические статус и долг вернет сервер после сохранения оплаты.
                            </Typography>

                            {previewDebt > 0 && (
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
                                            Предварительный остаток
                                        </Typography>
                                        <Typography variant="h6" color="error.main" fontWeight={700}>
                                            {previewDebt.toLocaleString()} сом
                                        </Typography>
                                    </Stack>
                                </Paper>
                            )}
                        </Stack>
                    </Stack>
                </Paper>
                <Stack spacing={0.5}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Комментарий администратора
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        placeholder="Необязательное поле"
                    />
                </Stack>

            </Stack>

            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack spacing={1}>
                    {lastReceiptData && (
                        <Button
                            fullWidth
                            variant="outlined"
                            size="large"
                            startIcon={<PrintOutlinedIcon />}
                            onClick={() => printReceipt(lastReceiptData)}
                        >
                            Печать чека
                        </Button>
                    )}
                    <Button
                        fullWidth
                        variant={lastReceiptData ? "text" : "contained"}
                        size="large"
                        disabled={loading}
                        onClick={handleSave}
                    >
                        {loading ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : lastReceiptData ? (
                            "Перепровести оплату"
                        ) : isBulkMode ? (
                            "Подтвердить оплату"
                        ) : (
                            (appointment?.paid_cash || 0) > 0 ||
                            (appointment?.paid_card || 0) > 0 ||
                            (appointment?.paid_balance || 0) > 0 ||
                            (appointment?.paid_bonuses || 0) > 0
                                ? "Обновить оплату"
                                : "Подтвердить оплату"
                        )}
                    </Button>
                    {lastReceiptData && (
                        <Button
                            fullWidth
                            variant="contained"
                            color="success"
                            size="large"
                            onClick={onClose}
                        >
                            Закрыть
                        </Button>
                    )}
                </Stack>
            </Box>
        </Drawer>
    );
};

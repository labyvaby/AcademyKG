import React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import { useNotification } from "@refinedev/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import AddPatientDrawer, { type AddPatientInitialValues } from "../../components/patients/AddPatientDrawer";
import { PERMISSIONS } from "../../constants/permissions";
import { NEW_BOOKINGS_COUNT_KEY } from "../../hooks/useNewBookingsCount";
import { usePermissions } from "../../hooks/usePermissions";
import { apiFetch } from "../../utility/apiClient";
import { formatMoney } from "../../utility/currency";
import { calculateAgeWithMonths } from "../../utility/format";
import {
  attachBooking,
  claimBooking,
  confirmBooking,
  getBooking,
  rejectBooking,
  resolveBookingPrepayment,
  type BookingDetail,
  type PrepaymentDecision,
  type SlotConflict,
} from "../../services/bookings";
import {
  BOOKING_STATUS_COLOR,
  formatBookingStart,
  formatDateTime,
  formatPhone,
  isClosedStatus,
  isOverdue,
  paymentCountdown,
  PREPAYMENT_STATUS_COLOR,
} from "./meta";

type PatientChoice = { id: string; fullName: string; hint?: string };

type ClientSearchItem = { id: string; fullName?: string; full_name?: string; phone?: string | null; birthDate?: string | null };

type AppointmentLite = {
  id: string;
  appointmentAt: string;
  status: string;
  services?: Array<{
    sellableItem?: { displayName?: string; name?: string } | null;
    performer?: { fullName?: string; full_name?: string } | null;
  }>;
};

// Приёмы, которые уже не состоятся: не дубль и не цель для привязки.
const DEAD_APPOINTMENT_STATUSES = new Set(["cancelled", "no_show", "not_came"]);
/** Окно поиска вероятного дубля: приёмы клиента в ±3 дня от заявки (как в mamadoc). */
const DUPLICATE_WINDOW_DAYS = 3;

const isPaidUnresolved = (booking: BookingDetail) =>
  booking.prepayment?.status === "paid" && !booking.prepayment.resolution;

/** Дата "YYYY-MM-DD" в часовом поясе филиала, сдвинутая на days дней. */
function branchDay(iso: string, timezone: string, days = 0): string {
  const shifted = new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "Asia/Bishkek" }).format(shifted);
}

async function fetchClientAppointments(patientId: string, dateFrom: string, dateTo: string): Promise<AppointmentLite[]> {
  // _noBranch: дубль может быть в любом доступном филиале, а не только в выбранном в шапке.
  const res: any = await apiFetch(
    `/api/v1/appointments/?_noBranch=1&patient=${encodeURIComponent(patientId)}&dateFrom=${dateFrom}&dateTo=${dateTo}&ordering=appointment_at&pageSize=50`,
  );
  const list: AppointmentLite[] = res?.data?.results ?? res?.results ?? [];
  return list.filter((a) => !DEAD_APPOINTMENT_STATUSES.has(a.status));
}

function appointmentLabel(a: AppointmentLite, timezone: string, lang: string): string {
  const parts = [formatBookingStart(a.appointmentAt, timezone, lang)];
  const row = a.services?.[0];
  const service = row?.sellableItem?.displayName ?? row?.sellableItem?.name;
  const performer = row?.performer?.fullName ?? row?.performer?.full_name;
  if (service) parts.push(service);
  if (performer) parts.push(performer);
  return parts.join(" · ");
}

/** Тикающее «сейчас» для обратного отсчёта оплаты. */
function useNow(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function useInvalidateBookings(bookingId: string) {
  const queryClient = useQueryClient();
  return React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    queryClient.invalidateQueries({ queryKey: NEW_BOOKINGS_COUNT_KEY });
  }, [queryClient, bookingId]);
}

export const BookingDrawer: React.FC<{ bookingId: string | null; onClose: () => void }> = ({ bookingId, onClose }) => {
  const { t, i18n } = useTranslation();
  const query = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => getBooking(bookingId as string),
    enabled: Boolean(bookingId),
    // Ждём оплату — подтягиваем статус, чтобы заявка «ожила» без перезагрузки.
    refetchInterval: (q) => (q.state.data?.status === "awaiting_payment" ? 15_000 : false),
  });

  return (
    <Drawer
      anchor="right"
      open={Boolean(bookingId)}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 } } }}
    >
      <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
          {query.data ? t("bookings.drawer.title", { code: query.data.code }) : t("bookings.drawer.loading")}
        </Typography>
        <IconButton onClick={onClose} aria-label={t("common.close", { defaultValue: "Закрыть" })}>
          <CloseOutlined />
        </IconButton>
      </Stack>
      <Box sx={{ p: 2, overflowY: "auto", flex: 1 }}>
        {query.isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        )}
        {query.isError && <Alert severity="error">{(query.error as Error).message}</Alert>}
        {query.data && <BookingDetails booking={query.data} lang={i18n.language} onDone={onClose} />}
      </Box>
    </Drawer>
  );
};

const BookingDetails: React.FC<{ booking: BookingDetail; lang: string; onDone: () => void }> = ({ booking, lang, onDone }) => {
  const { t } = useTranslation();
  const overdue = isOverdue(booking.status, booking.startAt);
  const priceChanged = booking.status === "new" && Number(booking.currentPrice) !== Number(booking.price);

  let actions: React.ReactNode;
  if (booking.status === "awaiting_payment") {
    actions = (
      <Stack spacing={2}>
        <SlotConflicts booking={booking} lang={lang} />
        <Alert severity="info">{t("bookings.drawer.awaitingPayment")}</Alert>
      </Stack>
    );
  } else if (booking.status === "new") {
    actions = <ProcessBooking booking={booking} onDone={onDone} />;
  } else if (booking.prepaymentNeedsAttention) {
    actions = <ResolvePrepayment booking={booking} lang={lang} onDone={onDone} />;
  } else {
    actions = <ProcessedInfo booking={booking} lang={lang} />;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
        <Chip
          label={overdue ? t("bookings.status.overdue") : t(`bookings.status.${booking.status}`)}
          color={overdue ? "error" : BOOKING_STATUS_COLOR[booking.status]}
          variant={isClosedStatus(booking.status) ? "outlined" : "filled"}
        />
        <Typography variant="body2" color="text.secondary">
          {t("bookings.drawer.created", { date: formatDateTime(booking.createdAt, lang) })}
        </Typography>
      </Stack>
      {booking.status === "new" && <ClaimControl booking={booking} lang={lang} />}

      <Box>
        <Typography variant="h6" fontWeight={800}>
          {formatBookingStart(booking.startAt, booking.branch.timezone, lang)}
        </Typography>
        <Typography color="text.secondary">
          {booking.service.name} · {t("book.minutes", { count: booking.durationMinutes })} ·{" "}
          {formatMoney(booking.price, booking.currency)}
        </Typography>
        <Typography color="text.secondary">
          {booking.performer.fullName} · {booking.branch.name}
        </Typography>
      </Box>
      {overdue && <Alert severity="warning">{t("bookings.drawer.overdue")}</Alert>}
      {priceChanged && (
        <Alert severity="info">
          {t("bookings.drawer.priceChanged", {
            shown: formatMoney(booking.price, booking.currency),
            current: formatMoney(booking.currentPrice, booking.currency),
          })}
        </Alert>
      )}

      <Divider />
      <Stack spacing={1}>
        <InfoRow label={t("bookings.drawer.client")}>
          {booking.clientName}
          {booking.clientBirthDate && (
            <Typography component="span" variant="body2" color="text.secondary">
              {" "}
              · {calculateAgeWithMonths(booking.clientBirthDate)}
            </Typography>
          )}
        </InfoRow>
        {booking.contactName && <InfoRow label={t("bookings.drawer.contact")}>{booking.contactName}</InfoRow>}
        <InfoRow label={t("bookings.drawer.phone")}>
          <Link href={`tel:${booking.contactPhone}`} underline="hover" fontWeight={700}>
            {formatPhone(booking.contactPhone)}
          </Link>
        </InfoRow>
        {booking.comment && <InfoRow label={t("bookings.drawer.comment")}>{booking.comment}</InfoRow>}
      </Stack>
      {booking.prepayment && <PrepaymentInfo booking={booking} lang={lang} />}
      <Divider />

      {actions}
    </Stack>
  );
};

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Stack direction="row" spacing={2}>
    <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography variant="body2" component="div" sx={{ minWidth: 0, wordBreak: "break-word" }}>
      {children}
    </Typography>
  </Stack>
);

// ── «Взято в работу» ────────────────────────────────────────────────────────

const ClaimControl: React.FC<{ booking: BookingDetail; lang: string }> = ({ booking, lang }) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const invalidate = useInvalidateBookings(booking.id);
  const canClaim = hasPermission(PERMISSIONS.BOOKINGS_UPDATE);
  const mutation = useMutation({
    mutationFn: (claim: boolean) => claimBooking(booking.id, claim),
    onSuccess: invalidate,
  });

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, borderRadius: 1, bgcolor: "action.hover" }}>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {booking.claimedBy
          ? t("bookings.claim.by", { who: booking.claimedBy.fullName, date: formatDateTime(booking.claimedAt, lang) })
          : t("bookings.claim.nobody")}
      </Typography>
      {canClaim && (
        <>
          <Button size="small" variant="outlined" disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>
            {booking.claimedBy ? t("bookings.claim.takeOver") : t("bookings.claim.take")}
          </Button>
          {booking.claimedBy && (
            <Button size="small" disabled={mutation.isPending} onClick={() => mutation.mutate(false)}>
              {t("bookings.claim.release")}
            </Button>
          )}
        </>
      )}
    </Stack>
  );
};

// ── Предоплата ──────────────────────────────────────────────────────────────

const PrepaymentInfo: React.FC<{ booking: BookingDetail; lang: string }> = ({ booking, lang }) => {
  const { t } = useTranslation();
  const prepayment = booking.prepayment!;
  const now = useNow(prepayment.status === "pending");
  const [copied, setCopied] = React.useState(false);
  const countdown = paymentCountdown(prepayment.expiresAt, now);
  const amount = formatMoney(prepayment.paidAmount ?? prepayment.amount, booking.currency);

  const copyLink = async () => {
    if (!prepayment.payUrl) return;
    try {
      await navigator.clipboard.writeText(prepayment.payUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("bookings.prepayment.copyPrompt"), prepayment.payUrl);
    }
  };

  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider" }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2" fontWeight={800}>
          {t("bookings.prepayment.title")}
        </Typography>
        <Chip
          size="small"
          color={PREPAYMENT_STATUS_COLOR[prepayment.status]}
          label={t(`bookings.prepayment.status.${prepayment.status}`)}
        />
      </Stack>
      <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5 }}>
        {amount}
      </Typography>
      {prepayment.status === "paid" && prepayment.paidAmount && prepayment.paidAmount !== prepayment.amount && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {t("bookings.prepayment.amountMismatch", {
            expected: formatMoney(prepayment.amount, booking.currency),
            paid: formatMoney(prepayment.paidAmount, booking.currency),
          })}
        </Alert>
      )}
      {prepayment.status === "pending" && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {countdown ? t("bookings.prepayment.left", { time: countdown }) : t("bookings.prepayment.lapsing")}
          </Typography>
          {prepayment.payUrl && countdown && (
            <Tooltip title={copied ? t("bookings.linkCopied") : t("bookings.prepayment.copyHint")}>
              <Button size="small" startIcon={<ContentCopyOutlined />} onClick={copyLink}>
                {t("bookings.prepayment.copyLink")}
              </Button>
            </Tooltip>
          )}
        </Stack>
      )}
      {prepayment.paidAt && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("bookings.prepayment.paidAt", { date: formatDateTime(prepayment.paidAt, lang) })}
          {prepayment.providerTxnId ? ` · ${prepayment.providerTxnId}` : ""}
        </Typography>
      )}
      {prepayment.resolution && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {t(`bookings.prepayment.resolution.${prepayment.resolution}`, { client: prepayment.patient?.fullName ?? "—" })}
          {prepayment.resolutionComment ? ` — ${prepayment.resolutionComment}` : ""}
          {prepayment.resolvedBy && (
            <Typography component="span" variant="caption" color="text.secondary">
              {" "}
              ({prepayment.resolvedBy.fullName}, {formatDateTime(prepayment.resolvedAt, lang)})
            </Typography>
          )}
        </Typography>
      )}
    </Box>
  );
};

/** Решение по деньгам: вернули гостю или на баланс клиента (клиента выбирают отдельно). */
const MoneyDecisionFields: React.FC<{
  value: "refunded" | "balance";
  onChange: (value: "refunded" | "balance") => void;
  comment: string;
  onCommentChange: (value: string) => void;
  clientName: string | null;
}> = ({ value, onChange, comment, onCommentChange, clientName }) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <RadioGroup value={value} onChange={(e) => onChange(e.target.value as "refunded" | "balance")}>
        <FormControlLabel
          value="balance"
          control={<Radio />}
          label={
            <Box>
              <Typography variant="body2" fontWeight={700}>
                {t("bookings.money.balance")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {clientName ? t("bookings.money.balanceTo", { client: clientName }) : t("bookings.money.balanceNeedClient")}
              </Typography>
            </Box>
          }
        />
        <FormControlLabel
          value="refunded"
          control={<Radio />}
          label={
            <Box>
              <Typography variant="body2" fontWeight={700}>
                {t("bookings.money.refunded")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("bookings.money.refundedHint")}
              </Typography>
            </Box>
          }
        />
      </RadioGroup>
      <TextField
        label={t("bookings.money.comment")}
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        size="small"
        fullWidth
        inputProps={{ maxLength: 1000 }}
      />
    </Stack>
  );
};

// ── Выбор карты клиента ─────────────────────────────────────────────────────

const ClientPicker: React.FC<{
  booking: BookingDetail;
  selected: PatientChoice | null;
  onSelect: (value: PatientChoice | null) => void;
}> = ({ booking, selected, onSelect }) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const canCreateClient = hasPermission(PERMISSIONS.CLIENTS_CREATE);
  const [addOpen, setAddOpen] = React.useState(false);

  const suggestions: PatientChoice[] = React.useMemo(
    () =>
      booking.suggestedPatients.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        hint: [p.birthDate ? calculateAgeWithMonths(p.birthDate) : null, p.phone ? formatPhone(p.phone) : null, p.branch?.name]
          .filter(Boolean)
          .join(" · "),
      })),
    [booking.suggestedPatients],
  );
  const selectedIsSuggestion = selected ? suggestions.some((s) => s.id === selected.id) : false;

  // Одна похожая карта — почти всегда нужный клиент: подставляем сразу (выбор можно сменить).
  const autoPicked = React.useRef(false);
  React.useEffect(() => {
    if (autoPicked.current || selected || suggestions.length !== 1) return;
    autoPicked.current = true;
    onSelect(suggestions[0]);
  }, [suggestions, selected, onSelect]);

  const newClientDefaults = React.useMemo<AddPatientInitialValues>(
    () => ({
      fullName: booking.clientName,
      birthDate: booking.clientBirthDate,
      responsiblePersons: [{ fullName: booking.contactName || booking.clientName, phone: booking.contactPhone }],
      branchId: booking.branch.id,
    }),
    [booking],
  );

  return (
    <Stack spacing={1.5}>
      {suggestions.length > 0 ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {t("bookings.drawer.suggestions")}
          </Typography>
          <RadioGroup
            value={selectedIsSuggestion ? selected?.id : ""}
            onChange={(e) => onSelect(suggestions.find((s) => s.id === e.target.value) ?? null)}
          >
            {suggestions.map((s) => (
              <FormControlLabel
                key={s.id}
                value={s.id}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={700}>
                      {s.fullName}
                    </Typography>
                    {s.hint && (
                      <Typography variant="caption" color="text.secondary">
                        {s.hint}
                      </Typography>
                    )}
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t("bookings.drawer.noSuggestions")}
        </Typography>
      )}

      <ClientSearch value={selectedIsSuggestion ? null : selected} onChange={onSelect} />

      <Tooltip title={canCreateClient ? "" : t("bookings.drawer.needPermission", { permission: t("bookings.perm.clientsCreate") })}>
        <span>
          <Button variant="text" startIcon={<PersonAddAltOutlined />} onClick={() => setAddOpen(true)} disabled={!canCreateClient}>
            {t("bookings.drawer.newClient")}
          </Button>
        </span>
      </Tooltip>

      <AddPatientDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        initialValues={newClientDefaults}
        onCreated={(p) => {
          onSelect({ id: String(p.id), fullName: p.fio });
          setAddOpen(false);
        }}
      />
    </Stack>
  );
};

/** Приёмы выбранного клиента рядом с датой заявки — вероятный дубль (гость уже записан). */
const DuplicateWarning: React.FC<{ booking: BookingDetail; patientId: string; lang: string }> = ({ booking, patientId, lang }) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const tz = booking.branch.timezone;
  const query = useQuery({
    queryKey: ["booking-duplicates", booking.id, patientId],
    queryFn: () =>
      fetchClientAppointments(
        patientId,
        branchDay(booking.startAt, tz, -DUPLICATE_WINDOW_DAYS),
        branchDay(booking.startAt, tz, DUPLICATE_WINDOW_DAYS),
      ),
    // Без права на приёмы бэк ответит 403 — просто не предупреждаем.
    enabled: hasPermission(PERMISSIONS.APPOINTMENTS_READ),
    retry: false,
  });
  const rows = query.data ?? [];
  if (rows.length === 0) return null;
  return (
    <Alert severity="warning">
      <Typography variant="body2" fontWeight={700}>
        {t("bookings.drawer.duplicateTitle")}
      </Typography>
      {rows.slice(0, 3).map((a) => (
        <Typography key={a.id} variant="body2">
          {appointmentLabel(a, tz, lang)}
        </Typography>
      ))}
      <Typography variant="caption" color="text.secondary">
        {t("bookings.drawer.duplicateHint")}
      </Typography>
    </Alert>
  );
};

// ── Новая заявка: подтвердить / отклонить / закрыть приёмом ─────────────────

const ProcessBooking: React.FC<{ booking: BookingDetail; onDone: () => void }> = ({ booking, onDone }) => {
  const { t, i18n } = useTranslation();
  const { hasPermission } = usePermissions();
  const { open: notify } = useNotification();
  const invalidate = useInvalidateBookings(booking.id);

  const canConfirm = hasPermission(PERMISSIONS.BOOKINGS_UPDATE) && hasPermission(PERMISSIONS.APPOINTMENTS_CREATE);
  const canReject = hasPermission(PERMISSIONS.BOOKINGS_UPDATE);
  const canAttach = hasPermission(PERMISSIONS.BOOKINGS_UPDATE) && hasPermission(PERMISSIONS.APPOINTMENTS_UPDATE);
  const paid = isPaidUnresolved(booking);

  const [selected, setSelected] = React.useState<PatientChoice | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [decision, setDecision] = React.useState<"refunded" | "balance">("balance");
  const [decisionComment, setDecisionComment] = React.useState("");
  const [attachConflict, setAttachConflict] = React.useState<SlotConflict | null>(null);

  const confirm = useMutation({
    mutationFn: (patientId: string) => confirmBooking(booking.id, patientId),
    onSuccess: () => {
      invalidate();
      notify?.({ type: "success", message: paid ? t("bookings.drawer.confirmedPaidToast") : t("bookings.drawer.confirmedToast") });
      onDone();
    },
  });
  const reject = useMutation({
    mutationFn: () => {
      let money: PrepaymentDecision | undefined;
      if (paid) {
        money = decision === "balance"
          ? { resolution: "balance", patient: selected?.id, comment: decisionComment.trim() }
          : { resolution: "refunded", comment: decisionComment.trim() };
      }
      return rejectBooking(booking.id, reason.trim(), money);
    },
    onSuccess: () => {
      invalidate();
      setRejectOpen(false);
      notify?.({ type: "success", message: t("bookings.drawer.rejectedToast") });
      onDone();
    },
  });
  const rejectBlocked = paid && decision === "balance" && !selected;

  return (
    <Stack spacing={2}>
      <SlotConflicts
        booking={booking}
        lang={i18n.language}
        onAttach={canAttach ? setAttachConflict : undefined}
        onReject={
          canReject
            ? () => {
                setReason((current) => current || t("bookings.conflicts.rejectReason"));
                setRejectOpen(true);
              }
            : undefined
        }
      />

      <Typography variant="subtitle1" fontWeight={800}>
        {t("bookings.drawer.pickClient")}
      </Typography>

      <ClientPicker booking={booking} selected={selected} onSelect={setSelected} />
      {selected && <DuplicateWarning booking={booking} patientId={selected.id} lang={i18n.language} />}

      {paid && (
        <Alert severity="success">
          {t("bookings.drawer.paidHint", { amount: formatMoney(booking.prepayment!.paidAmount ?? booking.prepayment!.amount, booking.currency) })}
        </Alert>
      )}
      {confirm.isError && <Alert severity="error">{(confirm.error as Error).message}</Alert>}
      {!canConfirm && (
        <Alert severity="info">{t("bookings.drawer.needPermission", { permission: t("bookings.perm.confirm") })}</Alert>
      )}

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="large"
          sx={{ flex: 1 }}
          disabled={!canConfirm || !selected || confirm.isPending}
          onClick={() => selected && confirm.mutate(selected.id)}
        >
          {confirm.isPending ? <CircularProgress size={22} color="inherit" /> : t("bookings.drawer.confirm")}
        </Button>
        <Button variant="outlined" color="error" size="large" disabled={!canReject || reject.isPending} onClick={() => setRejectOpen(true)}>
          {t("bookings.drawer.reject")}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t("bookings.drawer.confirmHint")}
      </Typography>
      {canAttach && (
        <Button variant="text" onClick={() => setAttachOpen(true)} sx={{ alignSelf: "flex-start" }}>
          {t("bookings.attach.open")}
        </Button>
      )}

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("bookings.drawer.rejectTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("bookings.drawer.rejectText")}
          </Typography>
          <TextField
            label={t("bookings.drawer.rejectReason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: 1000 }}
            autoFocus
          />
          {paid && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
                {t("bookings.money.title", {
                  amount: formatMoney(booking.prepayment!.paidAmount ?? booking.prepayment!.amount, booking.currency),
                })}
              </Typography>
              <MoneyDecisionFields
                value={decision}
                onChange={setDecision}
                comment={decisionComment}
                onCommentChange={setDecisionComment}
                clientName={selected?.fullName ?? null}
              />
            </Box>
          )}
          {reject.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(reject.error as Error).message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>{t("bookings.drawer.cancel")}</Button>
          <Button color="error" variant="contained" onClick={() => reject.mutate()} disabled={reject.isPending || rejectBlocked}>
            {t("bookings.drawer.reject")}
          </Button>
        </DialogActions>
      </Dialog>

      <AttachDialog open={attachOpen} onClose={() => setAttachOpen(false)} booking={booking} patient={selected} onDone={onDone} />
      <AttachConflictDialog booking={booking} conflict={attachConflict} onClose={() => setAttachConflict(null)} onDone={onDone} />
    </Stack>
  );
};

// ── Время заявки уже занято приёмом ─────────────────────────────────────────

/** Приёмы специалиста на время заявки (записали вручную) — мягкое предупреждение, не запрет. */
const SlotConflicts: React.FC<{
  booking: BookingDetail;
  lang: string;
  onAttach?: (conflict: SlotConflict) => void;
  onReject?: () => void;
}> = ({ booking, lang, onAttach, onReject }) => {
  const { t } = useTranslation();
  const conflicts = booking.slotConflicts ?? [];
  if (conflicts.length === 0) return null;
  const actionable = booking.status === "new";
  return (
    <Alert severity="warning">
      <Typography variant="body2" fontWeight={700}>
        {t("bookings.conflicts.title")}
      </Typography>
      <Stack spacing={1} sx={{ mt: 0.5 }}>
        {conflicts.map((c) => (
          <Box key={c.id}>
            <Typography variant="body2">
              {formatBookingStart(c.appointmentAt, booking.branch.timezone, lang)} ·{" "}
              {t("book.minutes", { count: c.durationMinutes })} · {c.patient?.fullName ?? t("bookings.conflicts.hiddenClient")}
              {c.branch && c.branch.id !== booking.branch.id ? ` · ${c.branch.name}` : ""}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              {c.sameClient && <Chip size="small" color="success" variant="outlined" label={t("bookings.conflicts.sameClient")} />}
              {actionable && onAttach && c.accessible && (
                <Button size="small" variant="outlined" color="inherit" onClick={() => onAttach(c)}>
                  {t("bookings.conflicts.attach")}
                </Button>
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
        {actionable ? t("bookings.conflicts.hint") : t("bookings.conflicts.hintAwaiting")}
      </Typography>
      {actionable && onReject && (
        <Button size="small" color="error" onClick={onReject} sx={{ mt: 0.5, ml: -0.5 }}>
          {t("bookings.conflicts.reject")}
        </Button>
      )}
    </Alert>
  );
};

/** Закрыть заявку приёмом, который уже стоит на её время. */
const AttachConflictDialog: React.FC<{
  booking: BookingDetail;
  conflict: SlotConflict | null;
  onClose: () => void;
  onDone: () => void;
}> = ({ booking, conflict, onClose, onDone }) => {
  const { t, i18n } = useTranslation();
  const { open: notify } = useNotification();
  const invalidate = useInvalidateBookings(booking.id);
  // Последний выбранный приём: текст не пропадает, пока диалог закрывается.
  const [shown, setShown] = React.useState<SlotConflict | null>(conflict);
  React.useEffect(() => {
    if (conflict) setShown(conflict);
  }, [conflict]);
  const attach = useMutation({
    mutationFn: (appointmentId: string) => attachBooking(booking.id, appointmentId),
    onSuccess: () => {
      invalidate();
      onClose();
      notify?.({ type: "success", message: t("bookings.attach.done") });
      onDone();
    },
  });
  const close = () => {
    attach.reset();
    onClose();
  };

  return (
    <Dialog open={Boolean(conflict)} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>{t("bookings.attach.title")}</DialogTitle>
      <DialogContent>
        {shown && (
          <Typography variant="body1" fontWeight={700} sx={{ mb: 1 }}>
            {formatBookingStart(shown.appointmentAt, booking.branch.timezone, i18n.language)} · {shown.patient?.fullName}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {isPaidUnresolved(booking) ? t("bookings.conflicts.attachTextPaid") : t("bookings.conflicts.attachText")}
        </Typography>
        {shown && !shown.sameClient && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t("bookings.conflicts.otherClient")}
          </Alert>
        )}
        {attach.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(attach.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{t("bookings.drawer.cancel")}</Button>
        <Button variant="contained" disabled={!conflict || attach.isPending} onClick={() => conflict && attach.mutate(conflict.id)}>
          {t("bookings.attach.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Закрыть заявку приёмом, созданным вручную (другое время/специалист) — предоплата уйдёт в этот приём. */
const AttachDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  booking: BookingDetail;
  patient: PatientChoice | null;
  onDone: () => void;
}> = ({ open, onClose, booking, patient, onDone }) => {
  const { t, i18n } = useTranslation();
  const { open: notify } = useNotification();
  const invalidate = useInvalidateBookings(booking.id);
  const [appointmentId, setAppointmentId] = React.useState("");
  const tz = booking.branch.timezone;

  const appointments = useQuery({
    queryKey: ["booking-attach-appointments", booking.id, patient?.id],
    queryFn: () =>
      fetchClientAppointments(patient!.id, branchDay(new Date().toISOString(), tz, -7), branchDay(booking.startAt, tz, 60)),
    enabled: open && Boolean(patient),
  });
  const attach = useMutation({
    mutationFn: () => attachBooking(booking.id, appointmentId),
    onSuccess: () => {
      invalidate();
      onClose();
      notify?.({ type: "success", message: t("bookings.attach.done") });
      onDone();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("bookings.attach.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isPaidUnresolved(booking) ? t("bookings.attach.textPaid") : t("bookings.attach.text")}
        </Typography>
        {!patient ? (
          <Alert severity="info">{t("bookings.attach.pickClientFirst")}</Alert>
        ) : appointments.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (appointments.data ?? []).length === 0 ? (
          <Alert severity="info">{t("bookings.attach.noAppointments", { client: patient.fullName })}</Alert>
        ) : (
          <RadioGroup value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
            {(appointments.data ?? []).map((a) => (
              <FormControlLabel key={a.id} value={a.id} control={<Radio />} label={appointmentLabel(a, tz, i18n.language)} />
            ))}
          </RadioGroup>
        )}
        {appointments.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(appointments.error as Error).message}
          </Alert>
        )}
        {attach.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(attach.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("bookings.drawer.cancel")}</Button>
        <Button variant="contained" disabled={!appointmentId || attach.isPending} onClick={() => attach.mutate()}>
          {t("bookings.attach.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Оплачено, а заявка закрыта без приёма ───────────────────────────────────

const ResolvePrepayment: React.FC<{ booking: BookingDetail; lang: string; onDone: () => void }> = ({ booking, lang, onDone }) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const { open: notify } = useNotification();
  const invalidate = useInvalidateBookings(booking.id);
  const canResolve = hasPermission(PERMISSIONS.BOOKINGS_UPDATE);
  const canAttach = canResolve && hasPermission(PERMISSIONS.APPOINTMENTS_UPDATE);

  const [selected, setSelected] = React.useState<PatientChoice | null>(null);
  const [decision, setDecision] = React.useState<"refunded" | "balance">("balance");
  const [comment, setComment] = React.useState("");
  const [attachOpen, setAttachOpen] = React.useState(false);

  const resolve = useMutation({
    mutationFn: () =>
      resolveBookingPrepayment(
        booking.id,
        decision === "balance"
          ? { resolution: "balance", patient: selected?.id, comment: comment.trim() }
          : { resolution: "refunded", comment: comment.trim() },
      ),
    onSuccess: () => {
      invalidate();
      notify?.({ type: "success", message: t("bookings.money.savedToast") });
      onDone();
    },
  });
  const amount = formatMoney(booking.prepayment!.paidAmount ?? booking.prepayment!.amount, booking.currency);

  return (
    <Stack spacing={2}>
      <ProcessedInfo booking={booking} lang={lang} />
      <Alert severity="error">{t("bookings.money.attention", { amount })}</Alert>
      <Typography variant="subtitle1" fontWeight={800}>
        {t("bookings.money.title", { amount })}
      </Typography>
      <MoneyDecisionFields
        value={decision}
        onChange={setDecision}
        comment={comment}
        onCommentChange={setComment}
        clientName={selected?.fullName ?? null}
      />
      {/* Карта клиента нужна и для зачисления на баланс, и для привязки к приёму. */}
      <ClientPicker booking={booking} selected={selected} onSelect={setSelected} />
      {resolve.isError && <Alert severity="error">{(resolve.error as Error).message}</Alert>}
      <Button
        variant="contained"
        size="large"
        disabled={!canResolve || resolve.isPending || (decision === "balance" && !selected)}
        onClick={() => resolve.mutate()}
      >
        {resolve.isPending ? <CircularProgress size={22} color="inherit" /> : t("bookings.money.save")}
      </Button>
      {canAttach && (
        <>
          <Button variant="text" onClick={() => setAttachOpen(true)} sx={{ alignSelf: "flex-start" }} disabled={!selected}>
            {t("bookings.attach.open")}
          </Button>
          {!selected && (
            <Typography variant="caption" color="text.secondary">
              {t("bookings.attach.pickClientFirst")}
            </Typography>
          )}
        </>
      )}
      <AttachDialog open={attachOpen} onClose={() => setAttachOpen(false)} booking={booking} patient={selected} onDone={onDone} />
    </Stack>
  );
};

const ProcessedInfo: React.FC<{ booking: BookingDetail; lang: string }> = ({ booking, lang }) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      {booking.status === "confirmed" && (
        <Alert severity="success">{t("bookings.drawer.confirmedInfo", { client: booking.patient?.fullName ?? "—" })}</Alert>
      )}
      {booking.status === "rejected" && (
        <Alert severity="info">
          {booking.rejectionReason
            ? t("bookings.drawer.rejectedWithReason", { reason: booking.rejectionReason })
            : t("bookings.drawer.rejectedInfo")}
        </Alert>
      )}
      {booking.status === "expired" && <Alert severity="info">{t("bookings.drawer.expiredInfo")}</Alert>}
      {booking.processedAt && (
        <Typography variant="caption" color="text.secondary">
          {t("bookings.drawer.processedBy", {
            who: booking.processedBy?.fullName || "—",
            date: formatDateTime(booking.processedAt, lang),
          })}
        </Typography>
      )}
    </Stack>
  );
};

const ClientSearch: React.FC<{ value: PatientChoice | null; onChange: (value: PatientChoice | null) => void }> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = React.useState("");
  const [options, setOptions] = React.useState<PatientChoice[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const q = input.trim();
    if (q.length < 2) {
      setOptions(value ? [value] : []);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res: any = await apiFetch(`/api/v1/clients/?search=${encodeURIComponent(q)}&pageSize=20`);
        const list: ClientSearchItem[] = res?.data?.results ?? res?.results ?? [];
        if (!cancelled) {
          setOptions(
            list.map((c) => ({
              id: String(c.id),
              fullName: c.fullName ?? c.full_name ?? String(c.id),
              hint: [c.phone ? formatPhone(c.phone) : null, c.birthDate].filter(Boolean).join(" · "),
            })),
          );
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [input, value]);

  return (
    <Autocomplete<PatientChoice>
      value={value}
      onChange={(_, v) => onChange(v)}
      inputValue={input}
      onInputChange={(_, v) => setInput(v)}
      options={options}
      filterOptions={(x) => x}
      getOptionLabel={(o) => o.fullName}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      loading={loading}
      noOptionsText={input.trim().length < 2 ? t("bookings.drawer.searchMin") : t("bookings.drawer.searchEmpty")}
      renderOption={({ key: _key, ...props }, option) => (
        // key по id клиента, а не по подписи: однофамильцы иначе «залипают» в списке.
        <li {...props} key={option.id}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {option.fullName}
            </Typography>
            {option.hint && (
              <Typography variant="caption" color="text.secondary">
                {option.hint}
              </Typography>
            )}
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("bookings.drawer.searchClient")}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={18} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

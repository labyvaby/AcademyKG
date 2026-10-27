import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { PhoneCountryCodeSelect } from "../../components/ui";
import { formatMoney } from "../../utility/currency";
import { formatPhone } from "../bookings/meta";
import { composePhone, DEFAULT_PHONE_COUNTRY_CODE, getPhoneLocalMaxLength } from "../../utility/phone";
import {
  createPublicBooking,
  getPublicCalendar,
  getPublicInfo,
  getPublicServices,
  getPublicSpecialists,
  PublicBookingError,
  type PublicBranch,
  type PublicInfo,
  type PublicService,
  type PublicSpecialist,
} from "../../services/publicBooking";
import { BookingTerms, BookShell, formatDay, rememberCode, SpecialistAvatar, StepMessage, submitErrorKey, useLoad, useRelativeDay } from "./shared";

// Публичная онлайн-запись: филиал → услуга → специалист → день и время → контакты.
// Выбор живёт в query (?branch=&service=&specialist=&date=&time=): «назад» браузера
// и обновление страницы ведут себя как ожидает гость. Заявка ждёт подтверждения
// администратора — приём создаётся в CRM.

const BookPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const branchId = params.get("branch") ?? "";
  const serviceId = params.get("service") ?? "";
  const specialistId = params.get("specialist") ?? "";
  const date = params.get("date") ?? "";
  const time = params.get("time") ?? "";

  const info = useLoad((signal) => getPublicInfo(signal), []);
  const branches = info.data?.branches ?? [];
  // Один филиал — шаг выбора филиала пропускаем.
  const effectiveBranchId = branchId || (branches.length === 1 ? branches[0].id : "");
  const branch = branches.find((b) => b.id === effectiveBranchId) ?? null;

  const services = useLoad(
    effectiveBranchId ? (signal) => getPublicServices(effectiveBranchId, signal) : null,
    [effectiveBranchId],
  );
  const service = services.data?.find((s) => s.id === serviceId) ?? null;

  const specialists = useLoad(
    effectiveBranchId && serviceId ? (signal) => getPublicSpecialists(effectiveBranchId, serviceId, signal) : null,
    [effectiveBranchId, serviceId],
  );
  const specialist = specialists.data?.find((s) => s.id === specialistId) ?? null;

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      setParams(next);
    },
    [params, setParams],
  );
  // «Назад» снимает последний выбор, а не history.back(): гость мог прийти по прямой
  // ссылке на шаг, и back() увёл бы его с сайта.
  const back = () => {
    if (date || time) update({ date: null, time: null });
    else if (specialistId) update({ specialist: null });
    else if (serviceId) update({ service: null });
    else update({ branch: null });
  };

  if (info.loading) return <BookShell><Loading /></BookShell>;
  if (info.error || branches.length === 0) {
    return (
      <BookShell>
        <StepMessage
          title={info.error ? t("book.errors.loadTitle") : t("book.unavailableTitle")}
          text={info.error ? info.error.message : t("book.unavailableText")}
          action={info.error ? <Button onClick={info.reload}>{t("book.retry")}</Button> : undefined}
        />
      </BookShell>
    );
  }

  // ── 1. Филиал ─────────────────────────────────────────────────────────────
  if (!branch) {
    return (
      <BookShell title={t("book.steps.branch")} subtitle={t("book.steps.branchHint")}>
        <Stack spacing={1.5}>
          {branches.map((b) => (
            <OptionCard key={b.id} onClick={() => update({ branch: b.id })}>
              <Typography fontWeight={700}>{b.brandName || b.name}</Typography>
              {b.address && <IconLine icon={<PlaceOutlined fontSize="small" />} text={b.address} />}
            </OptionCard>
          ))}
        </Stack>
      </BookShell>
    );
  }

  const branchLine = branches.length > 1 ? branch.brandName || branch.name : undefined;

  // ── 2. Услуга ─────────────────────────────────────────────────────────────
  if (!service) {
    return (
      <BookShell
        title={t("book.steps.service")}
        subtitle={branchLine}
        onBack={branches.length > 1 ? back : undefined}
      >
        <StepList
          state={services}
          emptyTitle={t("book.empty.services")}
          render={(list: PublicService[]) =>
            list.map((s) => (
              <OptionCard key={s.id} onClick={() => update({ service: s.id, specialist: null, date: null, time: null })}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700}>{s.name}</Typography>
                    <IconLine
                      icon={<AccessTimeOutlined fontSize="small" />}
                      text={t("book.minutes", { count: s.durationMinutes })}
                    />
                    {s.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {s.description}
                      </Typography>
                    )}
                  </Box>
                  <Typography fontWeight={800} sx={{ whiteSpace: "nowrap" }}>
                    {formatMoney(s.price, branch.currency)}
                  </Typography>
                </Stack>
              </OptionCard>
            ))
          }
        />
      </BookShell>
    );
  }

  // ── 3. Специалист ─────────────────────────────────────────────────────────
  if (!specialist) {
    return (
      <BookShell title={t("book.steps.specialist")} subtitle={service.name} onBack={back}>
        <StepList
          state={specialists}
          emptyTitle={t("book.empty.specialists")}
          render={(list: PublicSpecialist[]) =>
            list.map((s) => (
              <SpecialistCard
                key={s.id}
                specialist={s}
                branch={branch}
                onPick={() => update({ specialist: s.id, date: null, time: null })}
                onPickTime={(day, hhmm) => update({ specialist: s.id, date: day, time: hhmm })}
              />
            ))
          }
        />
      </BookShell>
    );
  }

  // ── 4. День и время ───────────────────────────────────────────────────────
  if (!date || !time) {
    return (
      <BookShell title={t("book.steps.time")} subtitle={`${specialist.fullName} · ${service.name}`} onBack={back}>
        <TimeStep
          branch={branch}
          service={service}
          specialist={specialist}
          initialDate={date}
          onPick={(day, hhmm) => update({ date: day, time: hhmm })}
        />
      </BookShell>
    );
  }

  // ── 5. Контакты ───────────────────────────────────────────────────────────
  return (
    <BookShell title={t("book.steps.contacts")} onBack={back}>
      <ContactsStep
        branch={branch}
        service={service}
        specialist={specialist}
        terms={info.data?.terms}
        date={date}
        time={time}
        onSlotLost={() => update({ time: null })}
        onDone={(code, payUrl) => {
          rememberCode(code);
          if (payUrl) {
            // Страница банка; обратно банк вернёт на /book/payment/result?code=…
            window.location.assign(payUrl);
            return;
          }
          navigate(`/book/status/${code}?new=1`, { replace: true });
        }}
      />
    </BookShell>
  );
};

// ── Шаги и карточки ─────────────────────────────────────────────────────────

const Loading: React.FC = () => (
  <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
    <CircularProgress />
  </Box>
);

const OptionCard: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <Card variant="outlined">
    <CardActionArea onClick={onClick} sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      <ChevronRightOutlined color="action" />
    </CardActionArea>
  </Card>
);

const IconLine: React.FC<{ icon: React.ReactNode; text: React.ReactNode }> = ({ icon, text }) => (
  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: "text.secondary", mt: 0.5 }}>
    {icon}
    <Typography variant="body2">{text}</Typography>
  </Stack>
);

function StepList<T>({
  state,
  emptyTitle,
  render,
}: {
  state: { data: T[] | null; loading: boolean; error: Error | null; reload: () => void };
  emptyTitle: string;
  render: (list: T[]) => React.ReactNode;
}) {
  const { t } = useTranslation();
  if (state.loading && !state.data) return <Loading />;
  if (state.error) {
    return (
      <StepMessage
        title={t("book.errors.loadTitle")}
        text={state.error.message}
        action={<Button onClick={state.reload}>{t("book.retry")}</Button>}
      />
    );
  }
  if (!state.data || state.data.length === 0) {
    return <StepMessage title={emptyTitle} text={t("book.empty.callUs")} />;
  }
  return <Stack spacing={1.5}>{render(state.data)}</Stack>;
}

const SpecialistCard: React.FC<{
  specialist: PublicSpecialist;
  branch: PublicBranch;
  onPick: () => void;
  onPickTime: (date: string, time: string) => void;
}> = ({ specialist, branch, onPick, onPickTime }) => {
  const { t } = useTranslation();
  const relativeDay = useRelativeDay();
  const nearest = specialist.nearest;
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onPick} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <SpecialistAvatar name={specialist.fullName} photoUrl={specialist.photoUrl} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={700}>{specialist.fullName}</Typography>
            {specialist.specializations.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {specialist.specializations.join(", ")}
              </Typography>
            )}
            <Typography variant="body2" sx={{ mt: 0.5 }} color={nearest ? "success.main" : "text.secondary"}>
              {nearest
                ? t("book.nearest", { day: relativeDay(nearest.date, branch.timezone) })
                : t("book.noSlotsSoon")}
            </Typography>
            {specialist.prepayment && (
              <IconLine
                icon={<CreditCardOutlined fontSize="small" />}
                text={t("book.prepayment.badge", { amount: formatMoney(specialist.prepayment.amount, branch.currency) })}
              />
            )}
          </Box>
          <ChevronRightOutlined color="action" />
        </Stack>
      </CardActionArea>
      {nearest && nearest.times.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2, flexWrap: "wrap", rowGap: 1 }}>
          {nearest.times.map((hhmm) => (
            <Chip
              key={hhmm}
              label={hhmm}
              variant="outlined"
              color="primary"
              onClick={() => onPickTime(nearest.date, hhmm)}
              sx={{ fontWeight: 600 }}
            />
          ))}
          <Chip label={t("book.otherTime")} variant="outlined" onClick={onPick} />
        </Stack>
      )}
    </Card>
  );
};

const TimeStep: React.FC<{
  branch: PublicBranch;
  service: PublicService;
  specialist: PublicSpecialist;
  initialDate: string;
  onPick: (date: string, time: string) => void;
}> = ({ branch, service, specialist, initialDate, onPick }) => {
  const { t, i18n } = useTranslation();
  const calendar = useLoad(
    (signal) => getPublicCalendar(branch.id, specialist.id, service.id, signal),
    [branch.id, specialist.id, service.id],
  );
  const days = calendar.data?.days ?? [];
  const firstWithSlots = days.find((d) => d.times.length > 0)?.date ?? "";
  const [selected, setSelected] = React.useState(initialDate);
  const activeDate = days.some((d) => d.date === selected && d.times.length > 0) ? selected : firstWithSlots;
  const activeDay = days.find((d) => d.date === activeDate);

  if (calendar.loading && !calendar.data) return <Loading />;
  if (calendar.error) {
    return (
      <StepMessage
        title={t("book.errors.loadTitle")}
        text={calendar.error.message}
        action={<Button onClick={calendar.reload}>{t("book.retry")}</Button>}
      />
    );
  }
  if (!firstWithSlots) return <StepMessage title={t("book.empty.slots")} text={t("book.empty.callUs")} />;

  return (
    <Box>
      <Box
        sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1, mx: -2, px: 2, scrollSnapType: "x proximity" }}
        role="listbox"
        aria-label={t("book.pickDay")}
      >
        {days.map((d) => {
          const isActive = d.date === activeDate;
          const disabled = d.times.length === 0;
          return (
            <Button
              key={d.date}
              variant={isActive ? "contained" : "outlined"}
              disabled={disabled}
              onClick={() => setSelected(d.date)}
              aria-selected={isActive}
              sx={{ flexDirection: "column", minWidth: 64, py: 1, flexShrink: 0, scrollSnapAlign: "start", lineHeight: 1.2 }}
            >
              <Typography variant="caption">
                {formatDay(d.date, i18n.language, { weekday: "short" })}
              </Typography>
              <Typography variant="subtitle1" fontWeight={800}>
                {formatDay(d.date, i18n.language, { day: "numeric" })}
              </Typography>
              <Typography variant="caption">{formatDay(d.date, i18n.language, { month: "short" })}</Typography>
            </Button>
          );
        })}
      </Box>

      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
        {formatDay(activeDate, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 1 }}>
        {activeDay?.times.map((hhmm) => (
          <Button key={hhmm} variant="outlined" onClick={() => onPick(activeDate, hhmm)} sx={{ fontWeight: 700 }}>
            {hhmm}
          </Button>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
        {t("book.timezoneNote", { duration: t("book.minutes", { count: service.durationMinutes }) })}
      </Typography>
    </Box>
  );
};

const ContactsStep: React.FC<{
  branch: PublicBranch;
  service: PublicService;
  specialist: PublicSpecialist;
  terms?: PublicInfo["terms"];
  date: string;
  time: string;
  onSlotLost: () => void;
  /** payUrl — страница банка, если запись требует предоплату. */
  onDone: (code: string, payUrl: string | null) => void;
}> = ({ branch, service, specialist, terms, date, time, onSlotLost, onDone }) => {
  const { t, i18n } = useTranslation();
  const [clientName, setClientName] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [phoneCode, setPhoneCode] = React.useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [phoneLocal, setPhoneLocal] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [slotLost, setSlotLost] = React.useState(false);
  const clearError = (field: string) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (clientName.trim().length < 2) errors.clientName = t("book.form.required");
    const phone = composePhone(phoneCode, phoneLocal);
    if (!phone || phoneLocal.length < getPhoneLocalMaxLength(phoneCode)) errors.contactPhone = t("book.form.phoneInvalid");
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !phone) return;

    setBusy(true);
    setError(null);
    try {
      const booking = await createPublicBooking({
        branch: branch.id,
        service: service.id,
        specialist: specialist.id,
        date,
        time,
        clientName: clientName.trim(),
        clientBirthDate: birthDate || null,
        contactName: contactName.trim(),
        contactPhone: phone,
        comment: comment.trim(),
      });
      onDone(booking.code, booking.payment?.payUrl ?? null);
    } catch (err) {
      const e = err as PublicBookingError;
      if (e.code === "slot_taken" || e.code === "slot_unavailable") {
        setSlotLost(true);
      } else {
        // Поля формы бэк называет по-человечески; общую ошибку — нашим текстом по коду,
        // а не текстом бэка: он написан для разработчика.
        const fields = e.fieldErrors ?? {};
        setFieldErrors(e.code === "too_many_bookings" ? {} : fields);
        const key = submitErrorKey(e);
        setError(key ? t(key, { phone: branch.phone ? formatPhone(branch.phone) : "" }) : e.message);
      }
    } finally {
      setBusy(false);
    }
  };
  const prepayment = specialist.prepayment;
  // Согласие в блоке «Важно» называет ровно ту кнопку, которую нажмёт гость.
  const submitLabel = prepayment
    ? t("book.prepayment.submitWithAmount", { amount: formatMoney(prepayment.amount, branch.currency) })
    : t("book.form.submit");

  if (slotLost) {
    return (
      <StepMessage
        title={t("book.errors.slotTakenTitle")}
        text={t("book.errors.slotTakenText")}
        action={
          <Button variant="contained" onClick={onSlotLost}>
            {t("book.pickOtherTime")}
          </Button>
        }
      />
    );
  }

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Card variant="outlined" sx={{ p: 2, mb: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <SpecialistAvatar name={specialist.fullName} photoUrl={specialist.photoUrl} size={44} />
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={700}>
              {formatDay(date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}, {time}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {specialist.fullName}
            </Typography>
          </Box>
        </Stack>
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Typography variant="body2">
            {service.name} · {t("book.minutes", { count: service.durationMinutes })}
          </Typography>
          <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
            {formatMoney(service.price, branch.currency)}
          </Typography>
        </Stack>
        {prepayment && (
          <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">{t("book.prepayment.line")}</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
              {formatMoney(prepayment.amount, branch.currency)}
            </Typography>
          </Stack>
        )}
        {branch.address && <IconLine icon={<PlaceOutlined fontSize="small" />} text={branch.address} />}
      </Card>

      <Stack spacing={2}>
        <TextField
          label={t("book.form.clientName")}
          helperText={fieldErrors.clientName || t("book.form.clientNameHint")}
          error={Boolean(fieldErrors.clientName)}
          value={clientName}
          onChange={(e) => {
            setClientName(e.target.value);
            clearError("clientName");
          }}
          required
          fullWidth
          autoComplete="off"
          inputProps={{ maxLength: 255 }}
        />
        <TextField
          label={t("book.form.birthDate")}
          type="date"
          value={birthDate}
          onChange={(e) => {
            setBirthDate(e.target.value);
            clearError("clientBirthDate");
          }}
          error={Boolean(fieldErrors.clientBirthDate)}
          helperText={fieldErrors.clientBirthDate || t("book.form.optional")}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label={t("book.form.contactName")}
          helperText={t("book.form.contactNameHint")}
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          fullWidth
          autoComplete="name"
          inputProps={{ maxLength: 255 }}
        />
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <PhoneCountryCodeSelect value={phoneCode} onChange={setPhoneCode} size="medium" />
          <TextField
            label={t("book.form.phone")}
            value={phoneLocal}
            onChange={(e) => {
              setPhoneLocal(e.target.value.replace(/\D/g, "").slice(0, getPhoneLocalMaxLength(phoneCode)));
              clearError("contactPhone");
            }}
            error={Boolean(fieldErrors.contactPhone)}
            helperText={fieldErrors.contactPhone || t("book.form.phoneHint")}
            required
            fullWidth
            type="tel"
            autoComplete="tel-national"
            inputProps={{ inputMode: "numeric" }}
          />
        </Stack>
        <TextField
          label={t("book.form.comment")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          inputProps={{ maxLength: 1000 }}
        />
        <BookingTerms
          action={submitLabel}
          prepayment={prepayment ? formatMoney(prepayment.amount, branch.currency) : null}
          branchPhone={branch.phone}
          termsUrl={terms?.termsUrl}
          privacyUrl={terms?.privacyUrl}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ py: 1.5, fontWeight: 700 }}>
          {busy ? <CircularProgress size={24} color="inherit" /> : submitLabel}
        </Button>
        {prepayment && (
          <Typography variant="caption" color="text.secondary" textAlign="center">
            {t("book.prepayment.hint")}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default BookPage;

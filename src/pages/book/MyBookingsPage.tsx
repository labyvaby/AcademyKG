import React from "react";
import { Alert, Box, Button, Chip, CircularProgress, InputAdornment, Link, Stack, TextField, Typography } from "@mui/material";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import { Link as RouterLink } from "react-router";
import { useTranslation } from "react-i18next";

import {
  getGuestMe,
  guestLogout,
  PublicBookingError,
  requestGuestCode,
  verifyGuestCode,
  type GuestVisit,
  type PublicBooking,
  type PublicBookingStatus,
} from "../../services/publicBooking";
import { formatPhone } from "../bookings/meta";
import { useGuestSession } from "./guestSession";
import { BookShell, formatDay, Loading, Panel, StepMessage, useLoad } from "./shared";
import { BORDER, MUTED, PILL_RADIUS, TILE_RADIUS } from "./theme";

// /book/me — «Мои записи»: вход по SMS-коду, затем предстоящие визиты детей и заявки с
// этого номера. Записаться можно и без входа. SMS уходят только на кыргызские номера —
// на витрине узбекского филиала кнопки входа нет (см. BookShell).

const GUEST_PHONE_CODE = "+996";
const LOCAL_LENGTH = 9;

const STATUS_COLOR: Record<PublicBookingStatus, "warning" | "success" | "error" | "default" | "info"> = {
  awaiting_payment: "info",
  pending: "warning",
  confirmed: "success",
  rejected: "error",
  cancelled: "default",
  expired: "default",
};

/** Ключ нашего текста по коду ошибки входа; null — общий текст. */
function authErrorKey(error: PublicBookingError): string {
  if (error.status === 429) return "book.errors.tooManyAttempts";
  switch (error.code) {
    case "network":
      return "book.errors.network";
    case "sms_unavailable":
    case "code_cooldown":
    case "too_many_codes":
    case "code_invalid":
    case "code_expired":
    case "too_many_attempts":
      return `book.me.errors.${error.code}`;
    default:
      return "book.me.errors.generic";
  }
}

const MyBookingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useGuestSession();
  return (
    <BookShell narrow title={t("book.me.title")}>
      {session ? <MyBookings token={session.token} phone={session.phone} /> : <LoginForm />}
    </BookShell>
  );
};

const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const { signIn } = useGuestSession();
  const [local, setLocal] = React.useState("");
  const [code, setCode] = React.useState("");
  const [step, setStep] = React.useState<"phone" | "code">("phone");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resendAt, setResendAt] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const phone = `${GUEST_PHONE_CODE}${local}`;

  React.useEffect(() => {
    if (step !== "code") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await requestGuestCode(phone);
      setResendAt(Date.now() + res.resendInSeconds * 1000);
      setNow(Date.now());
      setStep("code");
    } catch (err) {
      setError(t(authErrorKey(err as PublicBookingError)));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await verifyGuestCode(phone, code);
      signIn(res.token, res.phone);
    } catch (err) {
      setError(t(authErrorKey(err as PublicBookingError)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("book.me.loginHint")}
      </Typography>
      <Stack
        component="form"
        spacing={2}
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          if (step === "phone") void sendCode();
          else void verify();
        }}
      >
        <TextField
          label={t("book.form.phone")}
          value={local}
          onChange={(e) => setLocal(e.target.value.replace(/\D/g, "").slice(0, LOCAL_LENGTH))}
          disabled={step === "code" || busy}
          type="tel"
          autoComplete="tel-national"
          inputProps={{ inputMode: "numeric" }}
          InputProps={{ startAdornment: <InputAdornment position="start">{GUEST_PHONE_CODE}</InputAdornment> }}
          helperText={t("book.me.phoneHint")}
        />
        {step === "code" && (
          <TextField
            label={t("book.me.code")}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
            autoComplete="one-time-code"
            inputProps={{ inputMode: "numeric", style: { letterSpacing: 6, fontWeight: 700 } }}
            helperText={t("book.me.codeSent", { phone: formatPhone(phone) })}
          />
        )}
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={busy || local.length !== LOCAL_LENGTH || (step === "code" && code.length < 4)}
          sx={{ borderRadius: PILL_RADIUS, fontWeight: 700 }}
        >
          {busy ? <CircularProgress size={22} color="inherit" /> : step === "phone" ? t("book.me.getCode") : t("book.me.signIn")}
        </Button>
        {step === "code" && (
          <Stack direction="row" justifyContent="space-between">
            <Button
              size="small"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              {t("book.me.changePhone")}
            </Button>
            <Button size="small" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
              {resendIn > 0 ? t("book.me.resendIn", { seconds: resendIn }) : t("book.me.resend")}
            </Button>
          </Stack>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2.5 }}>
        <Link component={RouterLink} to="/book/status" underline="hover">
          {t("book.me.byCode")}
        </Link>
      </Typography>
    </Panel>
  );
};

const MyBookings: React.FC<{ token: string; phone: string }> = ({ token, phone }) => {
  const { t } = useTranslation();
  const { signOut } = useGuestSession();
  const me = useLoad((signal) => getGuestMe(token, signal), [token]);

  // Сессия истекла или её закрыли с другого устройства — назад ко входу.
  React.useEffect(() => {
    if ((me.error as PublicBookingError | null)?.status === 401) signOut();
  }, [me.error, signOut]);

  const logout = async () => {
    try {
      await guestLogout(token);
    } catch {
      /* сессию на сервере закроет срок; в браузере выходим в любом случае */
    }
    signOut();
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography color="text.secondary">{formatPhone(phone)}</Typography>
        <Button size="small" startIcon={<LogoutOutlined />} onClick={() => void logout()}>
          {t("book.me.signOut")}
        </Button>
      </Stack>

      {me.loading && !me.data ? (
        <Loading />
      ) : me.error || !me.data ? (
        <StepMessage
          title={t("book.errors.loadTitle")}
          text={t("book.errors.loadText")}
          action={<Button onClick={me.reload}>{t("book.retry")}</Button>}
        />
      ) : me.data.visits.length === 0 && me.data.bookings.length === 0 ? (
        <StepMessage
          title={t("book.me.empty")}
          text={t("book.me.emptyHint")}
          action={
            <Button variant="contained" component={RouterLink} to="/book">
              {t("book.form.submit")}
            </Button>
          }
        />
      ) : (
        <>
          {me.data.visits.length > 0 && (
            <Box>
              <Typography fontWeight={700} sx={{ mb: 1 }}>
                {t("book.me.visits")}
              </Typography>
              <Stack spacing={1}>
                {me.data.visits.map((visit) => (
                  <VisitCard key={visit.id} visit={visit} />
                ))}
              </Stack>
            </Box>
          )}
          {me.data.bookings.length > 0 && (
            <Box>
              <Typography fontWeight={700} sx={{ mb: 1 }}>
                {t("book.me.requests")}
              </Typography>
              <Stack spacing={1}>
                {me.data.bookings.map((booking) => (
                  <BookingCard key={booking.code} booking={booking} />
                ))}
              </Stack>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" textAlign="center">
            {t("book.me.changeByPhone")}
          </Typography>
        </>
      )}
    </Stack>
  );
};

const When: React.FC<{ date: string; time: string }> = ({ date, time }) => {
  const { i18n } = useTranslation();
  return (
    <Typography fontWeight={700}>
      {formatDay(date, i18n.language, { weekday: "short", day: "numeric", month: "long" })}, {time}
    </Typography>
  );
};

const VisitCard: React.FC<{ visit: GuestVisit }> = ({ visit }) => (
  <Box sx={{ p: 1.75, bgcolor: "background.paper", border: 1, borderColor: BORDER, borderRadius: TILE_RADIUS }}>
    <When date={visit.date} time={visit.time} />
    <Typography variant="body2" sx={{ mt: 0.25 }}>
      {visit.clientName}
      {visit.services.length > 0 && ` · ${visit.services.join(", ")}`}
    </Typography>
    {visit.specialists.length > 0 && (
      <Typography variant="body2" sx={{ color: MUTED }}>
        {visit.specialists.join(", ")}
      </Typography>
    )}
    <BranchLine name={visit.branch.name} address={visit.branch.address} phone={visit.branch.phone} />
  </Box>
);

const BookingCard: React.FC<{ booking: PublicBooking }> = ({ booking }) => {
  const { t } = useTranslation();
  return (
    <Box
      component={RouterLink}
      to={`/book/status/${booking.code}`}
      sx={{
        display: "block",
        p: 1.75,
        bgcolor: "background.paper",
        border: 1,
        borderColor: BORDER,
        borderRadius: TILE_RADIUS,
        color: "inherit",
        textDecoration: "none",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <When date={booking.date} time={booking.time} />
        <Chip size="small" label={t(`book.status.labels.${booking.status}`)} color={STATUS_COLOR[booking.status]} />
      </Stack>
      <Typography variant="body2" sx={{ mt: 0.25 }}>
        {booking.clientName} · {booking.service.name}
      </Typography>
      <Typography variant="body2" sx={{ color: MUTED }}>
        {booking.specialist.fullName} · {t("book.status.codeLabel")} {booking.code}
      </Typography>
      <BranchLine name={booking.branch.name} address={booking.branch.address} />
    </Box>
  );
};

const BranchLine: React.FC<{ name: string; address: string; phone?: string }> = ({ name, address, phone }) => (
  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75, color: "text.secondary", flexWrap: "wrap" }}>
    <PlaceOutlined sx={{ fontSize: 16 }} />
    <Typography variant="caption">
      {name}
      {address ? `, ${address}` : ""}
    </Typography>
    {phone && (
      <Typography variant="caption" component="a" href={`tel:${phone}`} sx={{ color: "primary.main", ml: 1 }}>
        {formatPhone(phone)}
      </Typography>
    )}
  </Stack>
);

export default MyBookingsPage;

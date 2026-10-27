import React from "react";
import { Alert, Box, Button, Card, Chip, CircularProgress, Divider, IconButton, Link, Stack, TextField, Tooltip, Typography } from "@mui/material";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import { Navigate, Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { formatMoney } from "../../utility/currency";
import { getPublicBooking, type PublicBooking, type PublicBookingStatus } from "../../services/publicBooking";
import { formatPhone } from "../bookings/meta";
import { BookShell, formatDay, readLastCodes, StepMessage, useLoad } from "./shared";

// Статус заявки по коду (/book/status/:code) и форма «проверить заявку» (/book/status).
// ?new=1 — гость только что отправил заявку: показываем подтверждение отправки.
// ?payment=1 — гость вернулся со страницы банка: ждём подтверждения оплаты (вебхук),
// опрашивая статус. «Я оплатил» на странице банка ничего не доказывает.

const STATUS_COLOR: Record<PublicBookingStatus, "warning" | "success" | "error" | "default" | "info"> = {
  awaiting_payment: "info",
  pending: "warning",
  confirmed: "success",
  rejected: "error",
  cancelled: "default",
  expired: "default",
};
const STATUS_ALERT: Record<PublicBookingStatus, "info" | "success" | "error" | "warning"> = {
  awaiting_payment: "warning",
  pending: "info",
  confirmed: "success",
  rejected: "error",
  cancelled: "info",
  expired: "error",
};
/** Как часто и сколько ждём вебхук банка после возврата гостя. */
const PAYMENT_POLL_MS = 3000;
const PAYMENT_POLL_LIMIT_MS = 3 * 60 * 1000;

/** /book/payment/result?code=… — сюда банк возвращает гостя; дальше — обычная страница статуса. */
export const PaymentResultRedirect: React.FC = () => {
  const [params] = useSearchParams();
  const code = (params.get("code") || "").trim().toUpperCase();
  return <Navigate to={code ? `/book/status/${code}?payment=1` : "/book/status"} replace />;
};

const BookingStatusPage: React.FC = () => {
  const { code = "" } = useParams();
  if (!code) return <CheckStatusForm />;
  return <BookingStatus code={code} />;
};

const CheckStatusForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [value, setValue] = React.useState("");
  const lastCodes = React.useMemo(readLastCodes, []);

  return (
    <BookShell title={t("book.status.checkTitle")} subtitle={t("book.status.checkHint")}>
      <Stack
        component="form"
        spacing={2}
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          const normalized = value.trim().toUpperCase();
          if (normalized) navigate(`/book/status/${normalized}`);
        }}
      >
        <TextField
          label={t("book.status.codeLabel")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputProps={{ maxLength: 12, style: { textTransform: "uppercase", letterSpacing: 2 } }}
          autoFocus
        />
        <Button type="submit" variant="contained" size="large" disabled={!value.trim()}>
          {t("book.status.check")}
        </Button>
        {lastCodes.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("book.status.recent")}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap", rowGap: 1 }}>
              {lastCodes.map((c) => (
                <Chip key={c} label={c} component={RouterLink} to={`/book/status/${c}`} clickable variant="outlined" />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </BookShell>
  );
};

const BookingStatus: React.FC<{ code: string }> = ({ code }) => {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const justCreated = params.get("new") === "1";
  const backFromBank = params.get("payment") === "1";
  const booking = useLoad((signal) => getPublicBooking(code, signal), [code]);
  const [copied, setCopied] = React.useState(false);
  const now = useNow(booking.data?.status === "awaiting_payment");

  // Ждём вебхук: опрашиваем, пока предоплата не оплачена и не снята (не дольше нескольких минут).
  const waitingForBank = booking.data?.status === "awaiting_payment" && booking.data.payment?.status === "pending";
  const pollStarted = React.useRef(Date.now());
  const { reload } = booking;
  React.useEffect(() => {
    if (!waitingForBank || Date.now() - pollStarted.current > PAYMENT_POLL_LIMIT_MS) return;
    const id = window.setTimeout(reload, PAYMENT_POLL_MS);
    return () => window.clearTimeout(id);
  }, [waitingForBank, booking.data, reload]);

  if (booking.loading && !booking.data) {
    return (
      <BookShell>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </BookShell>
    );
  }
  if (booking.error || !booking.data) {
    return (
      <BookShell title={t("book.status.notFoundTitle")}>
        <StepMessage
          title={booking.error?.message ?? t("book.status.notFoundTitle")}
          text={t("book.status.notFoundText")}
          action={
            <Button component={RouterLink} to="/book/status">
              {t("book.status.checkOther")}
            </Button>
          }
        />
      </BookShell>
    );
  }

  const b = booking.data;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.code);
      setCopied(true);
    } catch {
      /* без clipboard API код всё равно виден */
    }
  };

  const paidNow = backFromBank && b.payment?.status === "paid";
  return (
    <BookShell>
      {(justCreated || paidNow) && (
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <CheckCircleOutlined color="success" sx={{ fontSize: 56 }} />
          <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>
            {paidNow ? t("book.status.paidTitle") : t("book.status.sentTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {paidNow ? t("book.status.paidText") : t("book.status.sentText")}
          </Typography>
        </Box>
      )}
      {backFromBank && waitingForBank && (
        <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 2 }}>
          {t("book.status.waitingBank")}
        </Alert>
      )}

      <Card variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("book.status.codeLabel")}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: 2 }}>
                {b.code}
              </Typography>
              <Tooltip title={copied ? t("book.status.copied") : t("book.status.copy")}>
                <IconButton size="small" onClick={copy} aria-label={t("book.status.copy")}>
                  <ContentCopyOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
          <Chip label={t(`book.status.labels.${b.status}`)} color={STATUS_COLOR[b.status]} sx={{ fontWeight: 700 }} />
        </Stack>

        <Alert severity={STATUS_ALERT[b.status]} sx={{ mt: 2 }}>
          {t(`book.status.explain.${b.status}`)}
        </Alert>
        {b.payment && <PaymentBlock booking={b} now={now} />}

        <Divider sx={{ my: 2 }} />
        <Stack spacing={1}>
          <Row label={t("book.status.when")}>
            {formatDay(b.date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}, {b.time}
          </Row>
          <Row label={t("book.status.service")}>
            {b.service.name} · {t("book.minutes", { count: b.durationMinutes })}
          </Row>
          <Row label={t("book.status.specialist")}>{b.specialist.fullName}</Row>
          <Row label={t("book.status.client")}>{b.clientName}</Row>
          <Row label={t("book.status.price")}>{formatMoney(b.price, b.currency)}</Row>
        </Stack>
        {(b.branch.address || b.branch.name) && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 2, color: "text.secondary" }}>
            <PlaceOutlined fontSize="small" />
            <Typography variant="body2">
              {b.branch.name}
              {b.branch.address ? `, ${b.branch.address}` : ""}
            </Typography>
          </Stack>
        )}
        {b.branch.phone && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1, color: "text.secondary" }}>
            <PhoneOutlined fontSize="small" />
            <Typography variant="body2">
              {t("book.status.changeByPhone")}{" "}
              <Link href={`tel:${b.branch.phone}`} underline="hover" fontWeight={700}>
                {formatPhone(b.branch.phone)}
              </Link>
            </Typography>
          </Stack>
        )}
      </Card>

      {justCreated && (
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
          {t("book.status.saveCode")}
        </Typography>
      )}
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={booking.reload}>
          {t("book.status.refresh")}
        </Button>
        <Button variant="text" component={RouterLink} to="/book">
          {t("book.status.bookAgain")}
        </Button>
      </Stack>
    </BookShell>
  );
};

/** Тикающее «сейчас» — для обратного отсчёта оплаты без лишних запросов. */
function useNow(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const PaymentBlock: React.FC<{ booking: PublicBooking; now: number }> = ({ booking, now }) => {
  const { t } = useTranslation();
  const payment = booking.payment!;
  const amount = formatMoney(payment.amount, booking.currency);
  const left = new Date(payment.expiresAt).getTime() - now;
  const payable = booking.status === "awaiting_payment" && payment.payUrl && left > 0;

  if (payment.status === "paid") {
    return (
      <Alert severity="success" icon={<CreditCardOutlined />} sx={{ mt: 1.5 }}>
        {t("book.status.payment.paid", { amount })}
      </Alert>
    );
  }
  if (!payable) return null;
  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: 1, borderColor: "warning.main" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Box>
          <Typography fontWeight={800}>{t("book.status.payment.due", { amount })}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("book.status.payment.left", { time: formatCountdown(left) })}
          </Typography>
        </Box>
        <Button variant="contained" href={payment.payUrl!} startIcon={<CreditCardOutlined />} sx={{ whiteSpace: "nowrap" }}>
          {t("book.status.payment.pay")}
        </Button>
      </Stack>
    </Box>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Stack direction="row" spacing={2} justifyContent="space-between">
    <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={600} textAlign="right">
      {children}
    </Typography>
  </Stack>
);

export default BookingStatusPage;

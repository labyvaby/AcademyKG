import React from "react";
import { Alert, Box, Button, Card, Chip, CircularProgress, Divider, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { formatMoney } from "../../utility/currency";
import { getPublicBooking, type PublicBookingStatus } from "../../services/publicBooking";
import { BookShell, formatDay, StepMessage, useLoad } from "./shared";

// Статус заявки по коду (/book/status/:code) и форма «проверить заявку» (/book/status).
// ?new=1 — гость только что отправил заявку: показываем подтверждение отправки.

const STATUS_COLOR: Record<PublicBookingStatus, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  confirmed: "success",
  rejected: "error",
  cancelled: "default",
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
  const lastCodes = React.useMemo<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("academy.book.lastCodes") || "[]");
    } catch {
      return [];
    }
  }, []);

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
  const booking = useLoad((signal) => getPublicBooking(code, signal), [code]);
  const [copied, setCopied] = React.useState(false);

  if (booking.loading) {
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

  return (
    <BookShell>
      {justCreated && (
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <CheckCircleOutlined color="success" sx={{ fontSize: 56 }} />
          <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>
            {t("book.status.sentTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {t("book.status.sentText")}
          </Typography>
        </Box>
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

        <Alert severity={b.status === "rejected" ? "error" : b.status === "confirmed" ? "success" : "info"} sx={{ mt: 2 }}>
          {t(`book.status.explain.${b.status}`)}
        </Alert>

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

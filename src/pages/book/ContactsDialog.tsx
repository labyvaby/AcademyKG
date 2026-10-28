import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { PhoneCountryCodeSelect } from "../../components/ui";
import { formatPrice } from "./money";
import { composePhone, DEFAULT_PHONE_COUNTRY_CODE, getPhoneLocalMaxLength, PHONE_COUNTRY_CODES } from "../../utility/phone";
import { formatPhone } from "../bookings/meta";
import {
  createPublicBooking,
  PublicBookingError,
  type PublicBranch,
  type PublicService,
  type PublicSpecialistDetail,
} from "../../services/publicBooking";
import { BookingTerms, formatDay, rememberCode, submitErrorKey } from "./shared";
import { BORDER, MUTED, PILL_RADIUS, RADIUS } from "./theme";

// Контакты и отправка заявки. Окно держится только после отправки: если его заняли,
// пока гость заполнял форму, модалка закрывается и страница предлагает другое время.

export const ContactsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  branch: PublicBranch;
  service: PublicService;
  specialist: PublicSpecialistDetail;
  date: string;
  time: string;
  onSlotLost: () => void;
}> = ({ open, onClose, branch, service, specialist, date, time, onSlotLost }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const defaultCode = PHONE_COUNTRY_CODES.includes(branch.phoneCode) ? branch.phoneCode : DEFAULT_PHONE_COUNTRY_CODE;

  const [clientName, setClientName] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [phoneCode, setPhoneCode] = React.useState(defaultCode);
  const [phoneLocal, setPhoneLocal] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const clearError = (field: string) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const prepayment = specialist.prepayment;
  // Согласие в блоке «Важно» называет ровно ту кнопку, которую нажмёт гость.
  const submitLabel = prepayment
    ? t("book.prepayment.submitWithAmount", { amount: formatPrice(prepayment.amount, branch.currency) })
    : t("book.form.submit");

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
      rememberCode(booking.code);
      const payUrl = booking.payment?.payUrl;
      if (payUrl) {
        // Страница банка; обратно банк вернёт на /book/payment/result?code=…
        window.location.assign(payUrl);
        return;
      }
      navigate(`/book/status/${booking.code}?new=1`, { replace: true });
    } catch (err) {
      const e = err as PublicBookingError;
      if (e.code === "slot_taken" || e.code === "slot_unavailable") {
        onSlotLost();
        return;
      }
      // Поля формы бэк называет по-человечески; общую ошибку — нашим текстом по коду.
      setFieldErrors(e.code === "too_many_bookings" ? {} : e.fieldErrors ?? {});
      const key = submitErrorKey(e);
      setError(key ? t(key, { phone: branch.phone ? formatPhone(branch.phone) : "" }) : t("book.errors.serverError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : RADIUS } }}
    >
      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box>
            <Typography fontWeight={800} fontSize={18}>
              {t("book.steps.contacts")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatDay(date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}, {time} · {specialist.fullName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={busy} aria-label={t("book.close")} sx={{ mt: -0.5, mr: -1 }}>
            <CloseOutlined />
          </IconButton>
        </Stack>

        <Box sx={{ p: 1.5, mb: 2.5, borderRadius: "12px", border: 1, borderColor: BORDER }}>
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Typography variant="body2">
              {service.name} · {t("book.minutes", { count: service.durationMinutes })}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
              {formatPrice(service.price, branch.currency)}
            </Typography>
          </Stack>
          {prepayment && (
            <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 0.75 }}>
              <Typography variant="body2" sx={{ color: MUTED }}>
                {t("book.prepayment.line")}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
                {formatPrice(prepayment.amount, branch.currency)}
              </Typography>
            </Stack>
          )}
        </Box>

        <Stack component="form" spacing={2} onSubmit={submit} noValidate>
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
            autoFocus={!fullScreen}
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
            <PhoneCountryCodeSelect
              value={phoneCode}
              onChange={(code) => {
                setPhoneCode(code);
                setPhoneLocal((v) => v.slice(0, getPhoneLocalMaxLength(code)));
              }}
              size="medium"
            />
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
            prepayment={prepayment ? formatPrice(prepayment.amount, branch.currency) : null}
            branchPhone={branch.phone}
            termsUrl={branch.terms.termsUrl}
            privacyUrl={branch.terms.privacyUrl}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={busy}
            sx={{ py: 1.5, fontWeight: 700, borderRadius: PILL_RADIUS }}
          >
            {busy ? <CircularProgress size={24} color="inherit" /> : submitLabel}
          </Button>
          {prepayment && (
            <Typography variant="caption" color="text.secondary" textAlign="center">
              {t("book.prepayment.hint")}
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

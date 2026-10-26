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
import { confirmBooking, getBooking, rejectBooking, type BookingDetail } from "../../services/bookings";
import { BOOKING_STATUS_COLOR, formatBookingStart, formatDateTime, formatPhone } from "./meta";

type PatientChoice = { id: string; fullName: string; hint?: string };

type ClientSearchItem = { id: string; fullName?: string; full_name?: string; phone?: string | null; birthDate?: string | null };

export const BookingDrawer: React.FC<{ bookingId: string | null; onClose: () => void }> = ({ bookingId, onClose }) => {
  const { t, i18n } = useTranslation();
  const query = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => getBooking(bookingId as string),
    enabled: Boolean(bookingId),
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
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          label={t(`bookings.status.${booking.status}`)}
          color={BOOKING_STATUS_COLOR[booking.status]}
          variant={booking.status === "rejected" ? "outlined" : "filled"}
        />
        <Typography variant="body2" color="text.secondary">
          {t("bookings.drawer.created", { date: formatDateTime(booking.createdAt, lang) })}
        </Typography>
      </Stack>

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
      <Divider />

      {booking.status === "new" ? (
        <ProcessBooking booking={booking} onDone={onDone} />
      ) : (
        <ProcessedInfo booking={booking} lang={lang} />
      )}
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

const ProcessedInfo: React.FC<{ booking: BookingDetail; lang: string }> = ({ booking, lang }) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      {booking.status === "confirmed" && (
        <Alert severity="success">
          {t("bookings.drawer.confirmedInfo", { client: booking.patient?.fullName ?? "—" })}
        </Alert>
      )}
      {booking.status === "rejected" && (
        <Alert severity="info">
          {booking.rejectionReason
            ? t("bookings.drawer.rejectedWithReason", { reason: booking.rejectionReason })
            : t("bookings.drawer.rejectedInfo")}
        </Alert>
      )}
      <Typography variant="caption" color="text.secondary">
        {t("bookings.drawer.processedBy", {
          who: booking.processedBy?.fullName || "—",
          date: formatDateTime(booking.processedAt, lang),
        })}
      </Typography>
    </Stack>
  );
};

const ProcessBooking: React.FC<{ booking: BookingDetail; onDone: () => void }> = ({ booking, onDone }) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();

  const canConfirm = hasPermission(PERMISSIONS.BOOKINGS_UPDATE) && hasPermission(PERMISSIONS.APPOINTMENTS_CREATE);
  const canReject = hasPermission(PERMISSIONS.BOOKINGS_UPDATE);
  const canCreateClient = hasPermission(PERMISSIONS.CLIENTS_CREATE);

  const [selected, setSelected] = React.useState<PatientChoice | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["booking", booking.id] });
    queryClient.invalidateQueries({ queryKey: NEW_BOOKINGS_COUNT_KEY });
  };

  const confirm = useMutation({
    mutationFn: (patientId: string) => confirmBooking(booking.id, patientId),
    onSuccess: () => {
      invalidate();
      notify?.({ type: "success", message: t("bookings.drawer.confirmedToast") });
      onDone();
    },
  });
  const reject = useMutation({
    mutationFn: () => rejectBooking(booking.id, reason.trim()),
    onSuccess: () => {
      invalidate();
      setRejectOpen(false);
      notify?.({ type: "success", message: t("bookings.drawer.rejectedToast") });
      onDone();
    },
  });

  const newClientDefaults = React.useMemo<AddPatientInitialValues>(
    () => ({
      fullName: booking.clientName,
      birthDate: booking.clientBirthDate,
      responsiblePersons: [{ fullName: booking.contactName || booking.clientName, phone: booking.contactPhone }],
      branchId: booking.branch.id,
    }),
    [booking],
  );

  const suggestions: PatientChoice[] = booking.suggestedPatients.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    hint: [p.birthDate ? calculateAgeWithMonths(p.birthDate) : null, p.branch?.name].filter(Boolean).join(" · "),
  }));
  const selectedIsSuggestion = selected ? suggestions.some((s) => s.id === selected.id) : false;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight={800}>
        {t("bookings.drawer.pickClient")}
      </Typography>

      {suggestions.length > 0 ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {t("bookings.drawer.suggestions")}
          </Typography>
          <RadioGroup
            value={selectedIsSuggestion ? selected?.id : ""}
            onChange={(e) => setSelected(suggestions.find((s) => s.id === e.target.value) ?? null)}
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

      <ClientSearch value={selectedIsSuggestion ? null : selected} onChange={setSelected} />

      <Tooltip title={canCreateClient ? "" : t("bookings.drawer.needPermission", { permission: t("bookings.perm.clientsCreate") })}>
        <span>
          <Button
            variant="text"
            startIcon={<PersonAddAltOutlined />}
            onClick={() => setAddOpen(true)}
            disabled={!canCreateClient}
          >
            {t("bookings.drawer.newClient")}
          </Button>
        </span>
      </Tooltip>

      {confirm.isError && <Alert severity="error">{(confirm.error as Error).message}</Alert>}
      {!canConfirm && (
        <Alert severity="info">
          {t("bookings.drawer.needPermission", { permission: t("bookings.perm.confirm") })}
        </Alert>
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
        <Button
          variant="outlined"
          color="error"
          size="large"
          disabled={!canReject || reject.isPending}
          onClick={() => setRejectOpen(true)}
        >
          {t("bookings.drawer.reject")}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t("bookings.drawer.confirmHint")}
      </Typography>

      <AddPatientDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        initialValues={newClientDefaults}
        onCreated={(p) => {
          setSelected({ id: String(p.id), fullName: p.fio });
          setAddOpen(false);
        }}
      />

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
          {reject.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(reject.error as Error).message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>{t("bookings.drawer.cancel")}</Button>
          <Button color="error" variant="contained" onClick={() => reject.mutate()} disabled={reject.isPending}>
            {t("bookings.drawer.reject")}
          </Button>
        </DialogActions>
      </Dialog>
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

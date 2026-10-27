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
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import { useNotification } from "@refinedev/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { PERMISSIONS } from "../../constants/permissions";
import { useBranchContext } from "../../contexts/branch-context";
import { usePermissions } from "../../hooks/usePermissions";
import { apiFetch } from "../../utility/apiClient";
import {
  createBookingSettings,
  getBookingPaymentSettings,
  listBookingSettings,
  updateBookingPaymentSettings,
  updateBookingSettings,
  type BookingPaymentSettingsInput,
  type BookingSettings,
  type BookingSettingsInput,
} from "../../services/bookings";

// Настройки онлайн-записи по филиалам: что видно на витрине /book.
// Бэк проверяет: услуги — своего филиала и не групповые, специалисты — работают в филиале.

const STEP_OPTIONS = [10, 15, 20, 30, 45, 60];
const LEAD_OPTIONS = [0, 30, 60, 120, 180, 360, 1440];
const HORIZON_OPTIONS = [7, 14, 21, 30, 60];

type Option = { id: string; name: string };
type FormState = Required<BookingSettingsInput>;

const DEFAULTS: FormState = {
  isEnabled: false,
  slotStepMinutes: 15,
  minLeadMinutes: 60,
  horizonDays: 14,
  services: [],
  employees: [],
  contactPhone: "",
  prepayments: [],
};

const toForm = (s?: BookingSettings): FormState =>
  s
    ? {
        isEnabled: s.isEnabled,
        slotStepMinutes: s.slotStepMinutes,
        minLeadMinutes: s.minLeadMinutes,
        horizonDays: s.horizonDays,
        services: s.services,
        employees: s.employees,
        contactPhone: s.contactPhone ?? "",
        // "700.00" → "700": так сумма читается и правится как в поле ввода.
        prepayments: (s.prepayments ?? []).map((p) => ({ employee: p.employee, amount: String(Number(p.amount)) })),
      }
    : DEFAULTS;

/** Что уходит на бэк: только выбранные на витрине специалисты и суммы больше нуля. */
const toInput = (form: FormState): BookingSettingsInput => ({
  ...form,
  contactPhone: form.contactPhone.replace(/[\s()-]/g, ""),
  prepayments: form.prepayments.filter((p) => form.employees.includes(p.employee) && Number(p.amount) > 0),
});

const pickResults = (res: any): any[] => res?.data?.results ?? res?.results ?? res?.data ?? [];

export const BookingSettingsDrawer: React.FC<{ open: boolean; onClose: () => void; publicLink: string }> = ({
  open,
  onClose,
  publicLink,
}) => {
  const { t } = useTranslation();
  const { branches, selectedBranch } = useBranchContext();
  const { hasPermission } = usePermissions();
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({ queryKey: ["booking-settings"], queryFn: listBookingSettings, enabled: open });

  const [branchId, setBranchId] = React.useState("");
  React.useEffect(() => {
    if (!open || branchId || branches.length === 0 || !settingsQuery.data) return;
    // Филиал из шапки → первый уже настроенный → первый в списке (а не служебный
    // «System Unassigned Branch», который видит Django-суперпользователь).
    const configured = settingsQuery.data.find((s) => branches.some((b) => b.id === s.branch))?.branch;
    setBranchId(selectedBranch?.id || configured || branches[0].id);
  }, [open, branchId, branches, selectedBranch, settingsQuery.data]);
  const current = settingsQuery.data?.find((s) => s.branch === branchId);

  const servicesQuery = useQuery({
    queryKey: ["booking-settings-services", branchId],
    enabled: open && Boolean(branchId),
    queryFn: async (): Promise<Option[]> => {
      const res = await apiFetch(`/api/v1/services/?_noBranch=1&branch=${branchId}&ordering=name&pageSize=500`);
      return pickResults(res)
        .filter((s) => (s.isActive ?? true) !== false && !(s.isGroup ?? s.is_group))
        // id услуги = id SellableItem (Service.pk); бэк ждёт именно его.
        .map((s) => ({ id: String(s.sellableItem ?? s.sellable_item ?? s.id), name: String(s.name ?? "") }));
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["booking-settings-employees"],
    enabled: open,
    queryFn: async () => pickResults(await apiFetch("/api/v1/employees/?_noBranch=1&status=active&ordering=fullName&pageSize=500")),
  });
  const employees: Option[] = React.useMemo(
    () =>
      (employeesQuery.data ?? [])
        // Только сотрудники с этим основным филиалом (как проверяет бэк): приём по заявке
        // создаётся с проверкой исполнителя по основному филиалу — иначе регистратор
        // филиала не сможет подтвердить заявку.
        .filter((e: any) => String(e.primaryBranch?.id ?? e.branch?.id ?? e.branch ?? "") === branchId)
        .map((e: any) => ({ id: String(e.id), name: String(e.fullName ?? e.full_name ?? "") })),
    [employeesQuery.data, branchId],
  );

  const [form, setForm] = React.useState<FormState>(DEFAULTS);
  React.useEffect(() => setForm(toForm(current)), [current, branchId]);

  const save = useMutation({
    mutationFn: () =>
      current ? updateBookingSettings(current.id, toInput(form)) : createBookingSettings(branchId, toInput(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      notify?.({ type: "success", message: t("bookings.settings.saved") });
    },
  });

  const canEdit = current
    ? hasPermission(PERMISSIONS.BOOKING_SETTINGS_UPDATE)
    : hasPermission(PERMISSIONS.BOOKING_SETTINGS_CREATE);
  const services = servicesQuery.data ?? [];
  const byId = (list: Option[], ids: string[]) => list.filter((o) => ids.includes(o.id));
  const loading = settingsQuery.isLoading || servicesQuery.isLoading || employeesQuery.isLoading;

  const paymentQuery = useQuery({ queryKey: ["booking-payment-settings"], queryFn: getBookingPaymentSettings, enabled: open });
  const prepaymentAmount = (employeeId: string) => form.prepayments.find((p) => p.employee === employeeId)?.amount ?? "";
  const setPrepaymentAmount = (employeeId: string, amount: string) =>
    setForm((f) => ({
      ...f,
      prepayments: [
        ...f.prepayments.filter((p) => p.employee !== employeeId),
        ...(amount ? [{ employee: employeeId, amount }] : []),
      ],
    }));
  const hasPrepayments = form.prepayments.some((p) => form.employees.includes(p.employee) && Number(p.amount) > 0);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
          {t("bookings.settings.title")}
        </Typography>
        <IconButton onClick={onClose} aria-label={t("common.close", { defaultValue: "Закрыть" })}>
          <CloseOutlined />
        </IconButton>
      </Stack>

      <Stack spacing={2.5} sx={{ p: 2, overflowY: "auto", flex: 1 }}>
        <TextField select label={t("bookings.settings.branch")} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.brandName || b.name}
            </MenuItem>
          ))}
        </TextField>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
                  disabled={!canEdit}
                />
              }
              label={
                <Box>
                  <Typography fontWeight={700}>{t("bookings.settings.enabled")}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {publicLink}
                  </Typography>
                </Box>
              }
            />

            <Autocomplete
              multiple
              options={services}
              value={byId(services, form.services)}
              onChange={(_, v) => setForm((f) => ({ ...f, services: v.map((o) => o.id) }))}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disabled={!canEdit}
              renderTags={(value, getTagProps) =>
                value.map((o, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return <Chip key={key} label={o.name} size="small" {...tagProps} />;
                })
              }
              renderInput={(params) => (
                <TextField {...params} label={t("bookings.settings.services")} helperText={t("bookings.settings.servicesHint")} />
              )}
            />

            <Autocomplete
              multiple
              options={employees}
              value={byId(employees, form.employees)}
              onChange={(_, v) => setForm((f) => ({ ...f, employees: v.map((o) => o.id) }))}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disabled={!canEdit}
              renderTags={(value, getTagProps) =>
                value.map((o, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return <Chip key={key} label={o.name} size="small" {...tagProps} />;
                })
              }
              renderInput={(params) => (
                <TextField {...params} label={t("bookings.settings.employees")} helperText={t("bookings.settings.employeesHint")} />
              )}
            />

            {form.employees.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>
                  {t("bookings.settings.prepaymentTitle")}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                  {t("bookings.settings.prepaymentHint")}
                </Typography>
                <Stack spacing={1}>
                  {byId(employees, form.employees).map((employee) => (
                    <Stack key={employee.id} direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {employee.name}
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        placeholder={t("bookings.settings.prepaymentNone")}
                        value={prepaymentAmount(employee.id)}
                        onChange={(e) => setPrepaymentAmount(employee.id, e.target.value.replace(/[^\d.]/g, ""))}
                        disabled={!canEdit}
                        inputProps={{ min: 0, step: 50, "aria-label": t("bookings.settings.prepaymentAmount", { name: employee.name }) }}
                        sx={{ width: 140 }}
                      />
                    </Stack>
                  ))}
                </Stack>
                {hasPrepayments && paymentQuery.data && !paymentQuery.data.paymentsReady && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {t("bookings.settings.prepaymentNotReady")}
                  </Alert>
                )}
              </Box>
            )}

            <TextField
              label={t("bookings.settings.contactPhone")}
              helperText={t("bookings.settings.contactPhoneHint")}
              placeholder="+996312000111"
              value={form.contactPhone}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              disabled={!canEdit}
              inputProps={{ inputMode: "tel", maxLength: 20 }}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <NumberSelect
                label={t("bookings.settings.step")}
                value={form.slotStepMinutes}
                options={STEP_OPTIONS}
                format={(v) => t("book.minutes", { count: v })}
                onChange={(v) => setForm((f) => ({ ...f, slotStepMinutes: v }))}
                disabled={!canEdit}
              />
              <NumberSelect
                label={t("bookings.settings.lead")}
                value={form.minLeadMinutes}
                options={LEAD_OPTIONS}
                format={(v) =>
                  v === 0
                    ? t("bookings.settings.leadNone")
                    : v % 60 === 0
                      ? t("bookings.settings.hours", { count: v / 60 })
                      : t("book.minutes", { count: v })
                }
                onChange={(v) => setForm((f) => ({ ...f, minLeadMinutes: v }))}
                disabled={!canEdit}
              />
              <NumberSelect
                label={t("bookings.settings.horizon")}
                value={form.horizonDays}
                options={HORIZON_OPTIONS}
                format={(v) => t("bookings.settings.days", { count: v })}
                onChange={(v) => setForm((f) => ({ ...f, horizonDays: v }))}
                disabled={!canEdit}
              />
            </Stack>

            <Alert severity="info">{t("bookings.settings.howItWorks")}</Alert>
            {save.isError && <Alert severity="error">{(save.error as Error).message}</Alert>}
            {!canEdit && (
              <Alert severity="warning">
                {t("bookings.drawer.needPermission", { permission: t("bookings.perm.settings") })}
              </Alert>
            )}
          </>
        )}

        <Divider />
        <PaymentSettingsSection />
      </Stack>

      <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!canEdit || !branchId || save.isPending || loading}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <CircularProgress size={22} color="inherit" /> : t("bookings.settings.save")}
        </Button>
      </Box>
    </Drawer>
  );
};

const NumberSelect: React.FC<{
  label: string;
  value: number;
  options: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}> = ({ label, value, options, format, onChange, disabled }) => {
  const list = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      fullWidth
    >
      {list.map((v) => (
        <MenuItem key={v} value={v}>
          {format(v)}
        </MenuItem>
      ))}
    </TextField>
  );
};

/**
 * Онлайн-оплата организации (Bakai Paylink): один мерчант на организацию. Менять может
 * только администратор организации; остальные видят, включена ли оплата.
 */
const PaymentSettingsSection: React.FC = () => {
  const { t } = useTranslation();
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["booking-payment-settings"], queryFn: getBookingPaymentSettings });
  const data = query.data;

  const [enabled, setEnabled] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [termsUrl, setTermsUrl] = React.useState("");
  const [privacyUrl, setPrivacyUrl] = React.useState("");
  const [rotateOpen, setRotateOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!data) return;
    setEnabled(data.paymentsEnabled);
    setTermsUrl(data.termsUrl);
    setPrivacyUrl(data.privacyUrl);
    setToken("");
  }, [data]);

  const save = useMutation({
    mutationFn: (input: BookingPaymentSettingsInput) => updateBookingPaymentSettings(input),
    onSuccess: (next) => {
      queryClient.setQueryData(["booking-payment-settings"], next);
      setRotateOpen(false);
      notify?.({ type: "success", message: t("bookings.payments.saved") });
    },
  });

  if (query.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (query.isError || !data) {
    return <Alert severity="error">{(query.error as Error | null)?.message ?? t("bookings.payments.loadError")}</Alert>;
  }

  const status = data.paymentsReady
    ? t("bookings.payments.statusReady")
    : data.paymentsEnabled
      ? t("bookings.payments.statusNotReady")
      : t("bookings.payments.statusOff");

  const copyWebhook = async () => {
    if (!data.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(data.webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("bookings.payments.webhookUrl"), data.webhookUrl);
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle1" fontWeight={800}>
          {t("bookings.payments.title")}
        </Typography>
        <Typography variant="body2" color={data.paymentsReady ? "success.main" : "text.secondary"}>
          {status}
        </Typography>
      </Box>
      {!data.bankConfigured && <Alert severity="warning">{t("bookings.payments.bankNotConfigured")}</Alert>}
      {data.lastBankError && (
        <Alert severity="error">
          {t("bookings.payments.lastError", { error: data.lastBankError })}
        </Alert>
      )}

      {!data.canManage ? (
        <Alert severity="info">{t("bookings.payments.onlyOrgAdmin")}</Alert>
      ) : (
        <>
          <TextField
            label={t("bookings.payments.token")}
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={data.bakaiTokenSet ? data.bakaiTokenMasked : ""}
            helperText={data.bakaiTokenSet ? t("bookings.payments.tokenSet") : t("bookings.payments.tokenHint")}
          />
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={t("bookings.payments.enabled", { minutes: data.prepaymentTtlMinutes })}
          />
          <TextField
            label={t("bookings.payments.webhookUrl")}
            value={data.webhookUrl ?? ""}
            helperText={t("bookings.payments.webhookHint")}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <IconButton onClick={copyWebhook} aria-label={t("bookings.payments.copyWebhook")} edge="end">
                  <ContentCopyOutlined fontSize="small" />
                </IconButton>
              ),
            }}
          />
          {copied && (
            <Typography variant="caption" color="success.main">
              {t("bookings.linkCopied")}
            </Typography>
          )}
          <TextField
            label={t("bookings.payments.termsUrl")}
            value={termsUrl}
            onChange={(e) => setTermsUrl(e.target.value)}
            placeholder="https://"
            inputProps={{ inputMode: "url" }}
          />
          <TextField
            label={t("bookings.payments.privacyUrl")}
            value={privacyUrl}
            onChange={(e) => setPrivacyUrl(e.target.value)}
            placeholder="https://"
            inputProps={{ inputMode: "url" }}
          />
          {save.isError && <Alert severity="error">{(save.error as Error).message}</Alert>}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  paymentsEnabled: enabled,
                  termsUrl: termsUrl.trim(),
                  privacyUrl: privacyUrl.trim(),
                  // Пустое поле — токен не меняем (иначе пустая строка стёрла бы сохранённый).
                  ...(token.trim() ? { bakaiToken: token.trim() } : {}),
                })
              }
            >
              {save.isPending ? <CircularProgress size={22} color="inherit" /> : t("bookings.payments.save")}
            </Button>
            <Button color="warning" onClick={() => setRotateOpen(true)} disabled={save.isPending}>
              {t("bookings.payments.rotate")}
            </Button>
          </Stack>

          <Dialog open={rotateOpen} onClose={() => setRotateOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>{t("bookings.payments.rotateTitle")}</DialogTitle>
            <DialogContent>
              <Typography variant="body2">{t("bookings.payments.rotateText")}</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRotateOpen(false)}>{t("bookings.drawer.cancel")}</Button>
              <Button color="warning" variant="contained" onClick={() => save.mutate({ rotateWebhookSecret: true })}>
                {t("bookings.payments.rotate")}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Stack>
  );
};

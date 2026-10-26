import React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import { useNotification } from "@refinedev/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { PERMISSIONS } from "../../constants/permissions";
import { useBranchContext } from "../../contexts/branch-context";
import { usePermissions } from "../../hooks/usePermissions";
import { apiFetch } from "../../utility/apiClient";
import {
  createBookingSettings,
  listBookingSettings,
  updateBookingSettings,
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
      }
    : DEFAULTS;

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
        .filter((e: any) => {
          // Работает в филиале: основной филиал или доступ через allowedBranches (как проверяет бэк).
          const primary = String(e.primaryBranch?.id ?? e.branch?.id ?? e.branch ?? "");
          const allowed: string[] = (e.allowedBranches ?? []).map((b: any) => String(b?.id ?? b));
          return primary === branchId || allowed.includes(branchId);
        })
        .map((e: any) => ({ id: String(e.id), name: String(e.fullName ?? e.full_name ?? "") })),
    [employeesQuery.data, branchId],
  );

  const [form, setForm] = React.useState<FormState>(DEFAULTS);
  React.useEffect(() => setForm(toForm(current)), [current, branchId]);

  const save = useMutation({
    mutationFn: () => (current ? updateBookingSettings(current.id, form) : createBookingSettings(branchId, form)),
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

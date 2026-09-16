import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Stack,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Avatar,
  Drawer,
  TextField,
  Autocomplete,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import RadioButtonUncheckedOutlined from "@mui/icons-material/RadioButtonUncheckedOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import LoginOutlined from "@mui/icons-material/LoginOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import FilterListOutlined from "@mui/icons-material/FilterListOutlined";
import WifiOutlined from "@mui/icons-material/WifiOutlined";
import WifiOffOutlined from "@mui/icons-material/WifiOffOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import RouterOutlined from "@mui/icons-material/RouterOutlined";
import dayjs, { Dayjs } from "dayjs";
import { AppBottomSheet } from "../../components/ui/AppBottomSheet";
import { CustomTimePicker } from "../../components/ui/CustomTimePicker";
import { CustomDatePicker } from "../../components/ui/CustomDatePicker";
import { PageHeader } from "../../components/ui/PageHeader";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";
import {
  fetchShifts,
  createShift,
  updateShift,
  deleteShift,
  selfClockIn,
  selfClockOut,
  type Shift,
} from "../../services/shifts";
import { apiFetch } from "../../utility/apiClient";
import { useBranchContext } from "../../contexts/branch-context";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
type Employee = {
  id: string;
  fullName: string;
  specialization?: string;
};

type SkudSetting = {
  id: string;
  branch: string;
  branchName?: string;
  allowedIp: string;
  allowedSsid: string;
  enabled: boolean;
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const todayStr = () => dayjs().format("YYYY-MM-DD");

function formatTime(t?: string | null): string {
  if (!t) return "—";
  if (t.includes("T")) return dayjs(t).format("HH:mm");
  return t.slice(0, 5);
}

function shiftDuration(start: string | null | undefined, end: string | null | undefined, hourUnit: string, minuteUnit: string): string {
  if (!start || !end) return "";
  const s = start.includes("T") ? dayjs(start) : dayjs(`2000-01-01T${start}`);
  const e = end.includes("T") ? dayjs(end) : dayjs(`2000-01-01T${end}`);
  const diff = e.diff(s, "minute");
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}${hourUnit} ${m}${minuteUnit}` : `${h}${hourUnit}`;
}

function isIpAllowed(ip: string, allowedPattern: string): boolean {
  if (!allowedPattern?.trim()) return true;
  const trimmed = allowedPattern.trim();
  if (trimmed === ip) return true;
  if (trimmed.includes("/")) {
    try {
      const [base, bits] = trimmed.split("/");
      const n = parseInt(bits, 10);
      const mask = ~(0xffffffff >>> n) >>> 0;
      const ipInt = ipToInt(ip);
      const baseInt = ipToInt(base);
      return (ipInt & mask) === (baseInt & mask);
    } catch { return false; }
  }
  return false;
}

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) | parseInt(oct, 10), 0) >>> 0;
}

// ──────────────────────────────────────────────────────────────
// Shift Card
// ──────────────────────────────────────────────────────────────
type ShiftCardProps = {
  shift: Shift;
  canEdit: boolean;
  onEdit: (s: Shift) => void;
  onDelete: (s: Shift) => void;
};

const ShiftCard: React.FC<ShiftCardProps> = ({ shift, canEdit, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isActive = !!shift.clockIn && !shift.clockOut;
  const isDone = !!shift.clockIn && !!shift.clockOut;

  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: isActive ? "success.light" : "divider",
        borderRadius: 2,
        bgcolor: isActive ? (t) => alpha(t.palette.success.light, 0.06) : "background.paper",
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Avatar
            sx={{
              width: isMobile ? 36 : 42,
              height: isMobile ? 36 : 42,
              bgcolor: isActive ? "success.main" : isDone ? "primary.main" : (t) => alpha(t.palette.text.secondary, 0.12),
              color: isActive || isDone ? "white" : "text.secondary",
              flexShrink: 0,
              fontSize: isMobile ? 14 : 16,
              fontWeight: 600,
            }}
          >
            {shift.employee?.fullName?.charAt(0)?.toUpperCase() ?? <PersonOutlined fontSize="small" />}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.5}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>
                {shift.employee?.fullName ?? t("common.employee")}
              </Typography>
              <Chip
                size="small"
                label={isActive ? t("skud.onShift") : isDone ? t("skud.completed") : t("skud.notStarted")}
                color={isActive ? "success" : isDone ? "default" : "warning"}
                icon={isActive || isDone
                  ? <CheckCircleOutlined sx={{ fontSize: 14 }} />
                  : <RadioButtonUncheckedOutlined sx={{ fontSize: 14 }} />
                }
                sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
              />
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
              <LoginOutlined sx={{ fontSize: 14, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary">
                {t("skud.planned")}: {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
              </Typography>
            </Stack>

            {shift.clockIn && (
              <Stack direction="row" spacing={0.5} alignItems="center" mt={0.25}>
                <AccessTimeOutlined sx={{ fontSize: 14, color: isActive ? "success.main" : "text.secondary" }} />
                <Typography variant="caption" color={isActive ? "success.main" : "text.secondary"} fontWeight={500}>
                  {t("skud.marked")}: {formatTime(shift.clockIn)}
                  {shift.clockOut && ` – ${formatTime(shift.clockOut)}`}
                  {shift.clockOut && (
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      ({shiftDuration(shift.clockIn, shift.clockOut, t("skud.hourUnit"), t("skud.minuteUnit"))})
                    </span>
                  )}
                </Typography>
              </Stack>
            )}
          </Box>

          {canEdit && (
            <Stack direction="row" spacing={0.5} flexShrink={0}>
              <Tooltip title={t("common.edit")}>
                <IconButton size="small" onClick={() => onEdit(shift)} color="primary">
                  <EditOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("common.delete")}>
                <IconButton size="small" onClick={() => onDelete(shift)} color="error">
                  <DeleteOutlineOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

// ──────────────────────────────────────────────────────────────
// Shift Form
// ──────────────────────────────────────────────────────────────
type ShiftFormProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: { employee: string; shiftDate: string; startTime: string; endTime: string; isNightShift: boolean }) => Promise<void>;
  employees: Employee[];
  initial?: Shift | null;
  loading?: boolean;
};

const ShiftFormContent: React.FC<Omit<ShiftFormProps, "open">> = ({
  employees, initial, loading, onClose, onSave,
}) => {
  const { t } = useTranslation();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shiftDate, setShiftDate] = useState<Dayjs>(dayjs());
  const [startTime, setStartTime] = useState<Dayjs>(dayjs("2000-01-01T09:00"));
  const [endTime, setEndTime] = useState<Dayjs>(dayjs("2000-01-01T18:00"));
  const [isNightShift, setIsNightShift] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (initial) {
      setEmployee(employees.find((e) => e.id === initial.employee?.id) ?? null);
      setShiftDate(dayjs(initial.shiftDate || todayStr()));
      setStartTime(dayjs(`2000-01-01T${initial.startTime || "09:00"}`));
      setEndTime(dayjs(`2000-01-01T${initial.endTime || "18:00"}`));
      setIsNightShift(initial.isNightShift ?? false);
    } else {
      setEmployee(null);
      setShiftDate(dayjs());
      setStartTime(dayjs("2000-01-01T09:00"));
      setEndTime(dayjs("2000-01-01T18:00"));
      setIsNightShift(false);
    }
    setTouched(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const handleSave = async () => {
    setTouched(true);
    if (!employee) return;
    await onSave({
      employee: employee.id,
      shiftDate: shiftDate.format("YYYY-MM-DD"),
      startTime: startTime.format("HH:mm:ss"),
      endTime: endTime.format("HH:mm:ss"),
      isNightShift,
    });
  };

  const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Typography variant="body2" color="text.secondary" mb={0.5}>{children}</Typography>
  );

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" fontWeight={700}>
        {initial ? t("skud.editShift") : t("skud.createShift")}
      </Typography>

      <Box>
        <Label>{t("schedule.employeeRequired")}</Label>
        <Autocomplete
          options={employees}
          value={employee}
          onChange={(_, v) => setEmployee(v)}
          getOptionLabel={(o) => `${o.fullName}${o.specialization ? ` — ${o.specialization}` : ""}`}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={t("schedule.selectEmployee")}
              error={touched && !employee}
              helperText={touched && !employee ? t("common.requiredField") : ""}
            />
          )}
        />
      </Box>

      <Box>
        <Label>{t("reports.date")}</Label>
        <CustomDatePicker
          value={shiftDate}
          onChange={(v) => v && setShiftDate(v)}
          slotProps={{ textField: { size: "small", fullWidth: true } }}
        />
      </Box>

      <Stack direction="row" spacing={1.5}>
        <Box flex={1} minWidth={0}>
          <Label>{t("schedule.startLabel")}</Label>
          <CustomTimePicker
            value={startTime}
            onChange={(v) => v && setStartTime(v)}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />
        </Box>
        <Box flex={1} minWidth={0}>
          <Label>{t("schedule.endLabel")}</Label>
          <CustomTimePicker
            value={endTime}
            onChange={(v) => v && setEndTime(v)}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />
        </Box>
      </Stack>

      <FormControlLabel
        control={
          <Switch
            checked={isNightShift}
            onChange={(e) => setIsNightShift(e.target.checked)}
          />
        }
        label={<Typography variant="body2">{t("skud.nightShift")}</Typography>}
      />

      <Stack direction="row" spacing={1.5} justifyContent="flex-end" pt={0.5}>
        <Button onClick={onClose} color="inherit">{t("common.cancel")}</Button>
        <Button variant="contained" disableElevation onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={18} color="inherit" /> : t("common.save")}
        </Button>
      </Stack>
    </Stack>
  );
};

const ShiftFormDrawer: React.FC<ShiftFormProps> = ({ open, onClose, ...rest }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const content = <ShiftFormContent onClose={onClose} {...rest} />;

  if (isMobile) {
    return <AppBottomSheet open={open} onClose={onClose}>{content}</AppBottomSheet>;
  }
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 400 } }}>
      {content}
    </Drawer>
  );
};

// ──────────────────────────────────────────────────────────────
// Network Settings Panel
// ──────────────────────────────────────────────────────────────
type NetworkSettingsProps = {
  branches: { id: string; name: string }[];
};

// Форма создания/редактирования настройки СКУД для конкретного филиала
type SkudSettingFormProps = {
  branchId: string;
  branchName: string;
  existing: SkudSetting | null;
  currentIp: string;
  onSave: (branchId: string, values: { allowedIp: string; allowedSsid: string; enabled: boolean }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

const SkudSettingForm: React.FC<SkudSettingFormProps> = ({
  existing, currentIp, onSave, onCancel, saving, branchId,
}) => {
  const { t } = useTranslation();
  const [allowedIp, setAllowedIp] = useState(existing?.allowedIp ?? "");
  const [allowedSsid, setAllowedSsid] = useState(existing?.allowedSsid ?? "");
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);

  const handleSubmit = () => {
    void onSave(branchId, { allowedIp, allowedSsid, enabled });
  };

  return (
    <Stack spacing={2} pt={0.5}>
      <FormControlLabel
        control={
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} color="success" />
        }
        label={<Typography variant="body2">{t("skud.enableNetworkCheck")}</Typography>}
      />

      <Box>
        <Typography variant="body2" color="text.secondary" mb={0.5}>
          {t("skud.allowedIpOrCidr")}
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            placeholder={t("skud.ipExamplePlaceholder")}
            value={allowedIp}
            onChange={(e) => setAllowedIp(e.target.value)}
          />
          {currentIp && (
            <Tooltip title={t("skud.insertMyIp", { ip: currentIp })}>
              <Button
                variant="outlined"
                size="small"
                sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                onClick={() => setAllowedIp(currentIp)}
              >
                {t("skud.myIp")}
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary" mb={0.5}>
          {t("skud.wifiSsidOptional")}
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder={t("skud.ssidExamplePlaceholder")}
          value={allowedSsid}
          onChange={(e) => setAllowedSsid(e.target.value)}
        />
      </Box>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button size="small" color="inherit" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          disableElevation
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlined />}
          disabled={saving}
          onClick={handleSubmit}
        >
          {t("common.save")}
        </Button>
      </Stack>
    </Stack>
  );
};

const NetworkSettingsPanel: React.FC<NetworkSettingsProps> = ({ branches }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SkudSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentIp, setCurrentIp] = useState<string>("");
  const [panelError, setPanelError] = useState<string | null>(null);
  // branchId → "create" | "edit" | null
  const [editingBranch, setEditingBranch] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await apiFetch("/api/v1/skud-settings/");
      const list = res?.data?.results ?? res?.results ?? [];
      setSettings(Array.isArray(list) ? list.map((s: any) => ({
        id: String(s.id),
        branch: String(s.branch),
        branchName: s.branchName ?? "",
        allowedIp: s.allowedIp ?? "",
        allowedSsid: s.allowedSsid ?? "",
        enabled: s.enabled ?? false,
      })) : []);
    } catch {
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => setCurrentIp(d.ip ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const handleSave = async (
    branchId: string,
    values: { allowedIp: string; allowedSsid: string; enabled: boolean },
  ) => {
    const existing = settings.find((s) => s.branch === branchId) ?? null;
    const key = existing ? existing.id : "new_" + branchId;
    setSaving(key);
    setPanelError(null);
    try {
      if (existing) {
        await apiFetch(`/api/v1/skud-settings/${existing.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            allowed_ip: values.allowedIp,
            allowed_ssid: values.allowedSsid,
            enabled: values.enabled,
          }),
        });
      } else {
        await apiFetch("/api/v1/skud-settings/", {
          method: "POST",
          body: JSON.stringify({
            branch: branchId,
            allowed_ip: values.allowedIp,
            allowed_ssid: values.allowedSsid,
            enabled: values.enabled,
          }),
        });
      }
      setEditingBranch(null);
      await loadSettings();
    } catch (e: any) {
      setPanelError(e?.message || t("skud.saveSettingsError"));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <Stack alignItems="center" py={4}><CircularProgress size={28} /></Stack>;
  }

  const settingByBranch = new Map(settings.map((s) => [s.branch, s]));

  return (
    <Stack spacing={2}>
      {panelError && (
        <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setPanelError(null)}>
          {panelError}
        </Alert>
      )}

      {currentIp && (
        <Alert
          severity="info"
          icon={<RouterOutlined />}
          sx={{ borderRadius: 2, "& .MuiAlert-message": { display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" } }}
        >
          <span>{t("skud.yourCurrentIp")}:</span>
          <Typography variant="body2" fontWeight={700} component="span">{currentIp}</Typography>
          <Typography variant="caption" color="text.secondary" component="span">
            {t("skud.canCopyToAllowedIp")}
          </Typography>
        </Alert>
      )}

      {branches.length === 0 && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          {t("skud.noBranchesAvailable")}
        </Alert>
      )}

      {branches.map((branch) => {
        const s = settingByBranch.get(branch.id) ?? null;
        const isEditing = editingBranch === branch.id;
        const isSavingThis = saving === (s ? s.id : "new_" + branch.id);

        return (
          <Card key={branch.id} elevation={0} sx={{ border: "1px solid", borderColor: isEditing ? "primary.main" : "divider", borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
              <Stack spacing={2}>
                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <WifiOutlined color={s?.enabled ? "success" : "disabled"} />
                    <Typography variant="subtitle1" fontWeight={600}>{branch.name}</Typography>
                  </Stack>
                  {s && !isEditing && (
                    <Chip
                      size="small"
                      label={s.enabled ? t("skud.checkEnabled") : t("skud.checkDisabled")}
                      color={s.enabled ? "success" : "default"}
                      sx={{ height: 22, fontSize: 11 }}
                    />
                  )}
                </Stack>

                {/* No settings yet */}
                {!s && !isEditing && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" mb={1.5}>
                      {t("skud.settingsNotCreated")}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddOutlined />}
                      onClick={() => { setPanelError(null); setEditingBranch(branch.id); }}
                    >
                      {t("skud.createSettings")}
                    </Button>
                  </Box>
                )}

                {/* Settings exist, view mode */}
                {s && !isEditing && (
                  <>
                    <Divider />
                    <Stack spacing={0.75}>
                      {s.allowedIp ? (
                        <Typography variant="body2" color="text.secondary">
                          IP/CIDR: <Typography component="span" variant="body2" fontWeight={600} color="text.primary">{s.allowedIp}</Typography>
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">{t("skud.ipNotRestricted")}</Typography>
                      )}
                      {s.allowedSsid && (
                        <Typography variant="body2" color="text.secondary">
                          SSID: <Typography component="span" variant="body2" fontWeight={600} color="text.primary">{s.allowedSsid}</Typography>
                        </Typography>
                      )}
                    </Stack>
                    <Stack direction="row" justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditOutlined />}
                        onClick={() => { setPanelError(null); setEditingBranch(branch.id); }}
                      >
                        {t("skud.editSettings")}
                      </Button>
                    </Stack>
                  </>
                )}

                {/* Edit / Create form */}
                {isEditing && (
                  <>
                    <Divider />
                    <SkudSettingForm
                      branchId={branch.id}
                      branchName={branch.name}
                      existing={s}
                      currentIp={currentIp}
                      saving={isSavingThis}
                      onSave={handleSave}
                      onCancel={() => setEditingBranch(null)}
                    />
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
};

// ──────────────────────────────────────────────────────────────
// Check-In Banner
// ──────────────────────────────────────────────────────────────
type BannerProps = {
  shift: Shift | null;
  onCheckIn: () => void;
  onCheckOut: () => void;
  loading: boolean;
  blocked: boolean;
  blockedReason?: string;
};

const CheckInBanner: React.FC<BannerProps> = ({
  shift, onCheckIn, onCheckOut, loading, blocked, blockedReason,
}) => {
  const { t } = useTranslation();
  const isActive = !!shift?.clockIn && !shift?.clockOut;
  const isDone = !!shift?.clockIn && !!shift?.clockOut;

  if (isDone) return null;

  return (
    <Box
      sx={(t) => ({
        background: isActive
          ? `linear-gradient(135deg, ${alpha(t.palette.success.main, 0.12)} 0%, ${alpha(t.palette.success.light, 0.08)} 100%)`
          : `linear-gradient(135deg, ${alpha(t.palette.warning.main, 0.12)} 0%, ${alpha(t.palette.warning.light, 0.08)} 100%)`,
        border: "1px solid",
        borderColor: isActive ? "success.light" : "warning.light",
        borderRadius: 2,
        p: { xs: 2, sm: 2.5 },
        mb: 2,
      })}
    >
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            width: 40, height: 40, borderRadius: "50%",
            bgcolor: isActive ? "success.main" : "warning.main",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <AccessTimeOutlined sx={{ color: "white", fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {isActive ? t("skud.youAreOnShift") : t("skud.youHaveNotStartedDay")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isActive
                ? `${t("skud.start")}: ${formatTime(shift?.clockIn)}`
                : blocked
                ? blockedReason ?? t("skud.checkInUnavailableFromNetwork")
                : t("skud.pleaseCheckInToStartDay")}
            </Typography>
          </Box>
        </Stack>

        <Tooltip title={blocked && !isActive ? (blockedReason ?? "") : ""} arrow>
          <span>
            <Button
              variant="contained"
              color={isActive ? "error" : "success"}
              startIcon={isActive ? <LogoutOutlined /> : <LoginOutlined />}
              onClick={isActive ? onCheckOut : onCheckIn}
              disabled={loading || (!isActive && blocked)}
              sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {loading
                ? <CircularProgress size={18} color="inherit" />
                : isActive ? t("skud.endShift") : t("skud.checkIn")}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {!isActive && blocked && (
        <Alert severity="warning" icon={<WifiOffOutlined />} sx={{ mt: 1.5, borderRadius: 1.5 }}>
          {blockedReason}
        </Alert>
      )}
    </Box>
  );
};

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────
const SkudPage: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission, employeeId, isSuperAdmin } = usePermissions();
  const { branches, selectedBranch } = useBranchContext();

  const canCreate       = hasPermission(PERMISSIONS.WORK_SHIFTS_CREATE) || isSuperAdmin();
  const canEdit         = hasPermission(PERMISSIONS.WORK_SHIFTS_UPDATE) || isSuperAdmin();
  const canDelete       = hasPermission(PERMISSIONS.WORK_SHIFTS_DELETE) || isSuperAdmin();
  // isManager — может управлять чужими сменами (создавать/редактировать/удалять)
  const isManager       = canCreate || canEdit || isSuperAdmin();
  // canSelfClockIn — обычный сотрудник, может только отметиться сам
  const canSelfClockIn  = hasPermission(PERMISSIONS.WORK_SHIFTS_SELF_CLOCK_IN);
  // Административный СКУД (вкладка «Настройки сети», CRUD настроек, разрешённые
  // Wi-Fi/IP/SSID) — только для superadmin. skud_settings.* по умолчанию не
  // выдаётся обычным ролям (см. role_permission_defaults на бэкенде), а endpoint
  // /api/v1/skud-settings/ дополнительно требует skud_settings.read.
  const canViewSkudSettings = isSuperAdmin();
  const canSettings     = canViewSkudSettings;

  const [activeTab, setActiveTab] = useState<"shifts" | "settings">("shifts");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [filterEmployee, setFilterEmployee] = useState<Employee | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [deleteShift_, setDeleteShift] = useState<Shift | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const [currentIp, setCurrentIp] = useState<string>("");
  const [skudSettings, setSkudSettings] = useState<SkudSetting[]>([]);
  const [networkChecked, setNetworkChecked] = useState(false);

  // Смена текущего пользователя на сегодня
  const myShift = shifts.find(
    (s) => s.employee?.id === employeeId && s.shiftDate === todayStr()
  ) ?? null;

  // Проверка IP
  const currentBranchId = selectedBranch?.id ?? "";
  const branchSetting = skudSettings.find((s) => s.branch === currentBranchId);
  const checkBlocked = !!(
    networkChecked &&
    branchSetting?.enabled &&
    branchSetting.allowedIp &&
    currentIp &&
    !isIpAllowed(currentIp, branchSetting.allowedIp)
  );
  const blockedReason = checkBlocked
    ? t("skud.ipNotInAllowedNetwork", { ip: currentIp, allowedIp: branchSetting?.allowedIp })
    : undefined;

  // ── Загрузка данных ──────────────────────────────────────

  const loadShifts = useCallback(async () => {
    setLoadingShifts(true);
    try {
      // Обычный сотрудник не передаёт employee — бэкенд сам фильтрует по request.user
      const params: Parameters<typeof fetchShifts>[0] = { date: todayStr() };
      if (isManager && filterEmployee) params.employee = filterEmployee.id;
      const data = await fetchShifts(params);
      setShifts(data);
    } finally {
      setLoadingShifts(false);
    }
  }, [isManager, filterEmployee]);

  const loadEmployees = useCallback(async () => {
    if (!isManager) return;
    try {
      const res: any = await apiFetch("/api/v1/employees/?pageSize=200");
      const list = res?.data?.results ?? res?.results ?? [];
      setEmployees(list.map((e: any) => ({
        id: String(e.id),
        fullName: e.fullName ?? e.full_name ?? "",
        specialization: e.specialization ?? e.position ?? "",
      })));
    } catch { /* ignore */ }
  }, [isManager]);

  const loadSkudSettings = useCallback(async () => {
    if (!canViewSkudSettings) return;
    try {
      const res: any = await apiFetch("/api/v1/skud-settings/");
      const list = res?.data?.results ?? res?.results ?? [];
      setSkudSettings(Array.isArray(list) ? list.map((s: any) => ({
        id: String(s.id),
        branch: String(s.branch),
        branchName: s.branchName ?? "",
        allowedIp: s.allowedIp ?? "",
        allowedSsid: s.allowedSsid ?? "",
        enabled: s.enabled ?? false,
      })) : []);
    } catch { setSkudSettings([]); }
  }, [canViewSkudSettings]);

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => { setCurrentIp(d.ip ?? ""); setNetworkChecked(true); })
      .catch(() => setNetworkChecked(true));
  }, []);

  // currentBranchId в зависимостях — при переключении филиала перезагружаем
  // данные СКУД, чтобы на экране не оставались смены/настройки чужого филиала.
  useEffect(() => {
    void loadShifts();
    void loadEmployees();
    void loadSkudSettings();
  }, [loadShifts, loadEmployees, loadSkudSettings, currentBranchId]);

  // ── Отметка ──────────────────────────────────────────────

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    setCheckInError(null);
    try {
      await selfClockIn({
        shiftDate: todayStr(),
        startTime: dayjs().format("HH:mm:ss"),
        endTime: dayjs().add(8, "hour").format("HH:mm:ss"),
        isNightShift: false,
      });
      await loadShifts();
    } catch (e: any) {
      const msg = e?.message ?? t("skud.checkInError");
      setCheckInError(msg);
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckInLoading(true);
    setCheckInError(null);
    try {
      await selfClockOut();
      await loadShifts();
    } catch (e: any) {
      const msg = e?.message ?? t("skud.checkOutError");
      setCheckInError(msg);
    } finally {
      setCheckInLoading(false);
    }
  };

  // ── Shift CRUD ───────────────────────────────────────────

  const handleSaveShift = async (data: { employee: string; shiftDate: string; startTime: string; endTime: string; isNightShift: boolean }) => {
    setSaveLoading(true);
    try {
      if (editShift) {
        await updateShift(editShift.id, {
          shiftDate: data.shiftDate,
          startTime: data.startTime,
          endTime: data.endTime,
          isNightShift: data.isNightShift,
        });
      } else {
        await createShift(data);
      }
      setAddOpen(false);
      setEditShift(null);
      await loadShifts();
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteShift_) return;
    await deleteShift(deleteShift_.id);
    setDeleteShift(null);
    await loadShifts();
  };

  const visibleShifts = isManager && filterEmployee
    ? shifts.filter((s) => s.employee?.id === filterEmployee.id)
    : shifts;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflowX: "hidden", overflowY: "auto" }} data-scrollable="true">
      <PageHeader
        title={t("menu.skud")}
        onAdd={
          isManager && activeTab === "shifts"
            ? () => setAddOpen(true)
            : canSelfClockIn && !myShift?.clockIn
            ? handleCheckIn
            : canSelfClockIn && !!myShift?.clockIn && !myShift?.clockOut
            ? handleCheckOut
            : undefined
        }
        addButtonText={
          canSelfClockIn && !isManager
            ? myShift?.clockIn && !myShift?.clockOut
              ? t("skud.endShift")
              : t("skud.checkIn")
            : t("schedule.addShift")
        }
        addButtonIcon={
          canSelfClockIn && !isManager
            ? myShift?.clockIn && !myShift?.clockOut
              ? <LogoutOutlined />
              : <LoginOutlined />
            : <AddOutlined />
        }
        actions={
          isManager && activeTab === "shifts" && employees.length > 0 ? (
            <Autocomplete
              options={employees}
              value={filterEmployee}
              onChange={(_, v) => setFilterEmployee(v)}
              getOptionLabel={(o) => o.fullName}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              size="small"
              sx={{ width: { xs: "100%", sm: 220 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t("skud.filterByEmployee")}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <FilterListOutlined sx={{ fontSize: 18, ml: 0.5, mr: 0.5, color: "text.secondary" }} />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          ) : undefined
        }
      />

      {canSettings && (
        <Box sx={{ px: { xs: 1, sm: 2 }, mb: 1.5 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0", background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)" },
              "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.9rem", minHeight: 44 },
            }}
          >
            <Tab label={t("skud.shiftsTab")} value="shifts" icon={<AccessTimeOutlined sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label={t("skud.networkSettingsTab")} value="settings" icon={<SettingsOutlined sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
          <Divider />
        </Box>
      )}

      <Box sx={{ px: { xs: 1, sm: 2 }, flex: 1 }}>
        {activeTab === "shifts" ? (
          <>
            {/* Статус смены для сотрудника */}
            {canSelfClockIn && !isManager && (() => {
              const isActive = !!myShift?.clockIn && !myShift?.clockOut;
              const isDone = !!myShift?.clockIn && !!myShift?.clockOut;
              return (
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  <Chip
                    icon={isActive ? <CheckCircleOutlined /> : isDone ? <CheckCircleOutlined /> : <RadioButtonUncheckedOutlined />}
                    label={
                      isActive
                        ? t("skud.onShiftSince", { time: formatTime(myShift?.clockIn) })
                        : isDone
                        ? t("skud.shiftCompletedRange", { from: formatTime(myShift?.clockIn), to: formatTime(myShift?.clockOut) })
                        : t("skud.shiftNotStarted")
                    }
                    color={isActive ? "success" : isDone ? "default" : "warning"}
                    variant={isDone ? "outlined" : "filled"}
                    sx={{ alignSelf: "flex-start", fontWeight: 600 }}
                  />
                  {checkBlocked && !isActive && (
                    <Alert severity="warning" icon={<WifiOffOutlined />} sx={{ borderRadius: 2 }}>
                      {blockedReason}
                    </Alert>
                  )}
                </Stack>
              );
            })()}

            {checkInError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setCheckInError(null)}>
                {checkInError}
              </Alert>
            )}

            <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
              {dayjs().format("dddd, DD MMMM YYYY")}
            </Typography>

            {loadingShifts ? (
              <Stack alignItems="center" py={6}><CircularProgress /></Stack>
            ) : visibleShifts.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {isManager
                  ? t("skud.noShiftsToday")
                  : t("skud.noPlannedShiftToday")}
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                {visibleShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    canEdit={canEdit || canDelete}
                    onEdit={(s) => setEditShift(s)}
                    onDelete={(s) => setDeleteShift(s)}
                  />
                ))}
              </Stack>
            )}
          </>
        ) : (
          <NetworkSettingsPanel branches={branches} />
        )}
      </Box>

      <ShiftFormDrawer
        open={addOpen || !!editShift}
        onClose={() => { setAddOpen(false); setEditShift(null); }}
        onSave={handleSaveShift}
        employees={employees}
        initial={editShift}
        loading={saveLoading}
      />

      <ConfirmDialog
        open={!!deleteShift_}
        title={t("skud.deleteShiftTitle")}
        message={t("skud.deleteShiftMessage", { name: deleteShift_?.employee?.fullName ?? "" })}
        confirmText={t("common.delete")}
        variant="error"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteShift(null)}
      />
    </Box>
  );
};

export default SkudPage;

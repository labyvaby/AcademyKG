import React from "react";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  InputAdornment,
  FormControlLabel,
  Switch,
  Chip,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import AttachFileOutlined from "@mui/icons-material/AttachFileOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { useNotification } from "@refinedev/core";
import PatientPhotoUploader from "./PatientPhotoUploader";
import { apiFetch, getBranchFilter } from "../../utility/apiClient";
import { PhoneCountryCodeSelect, CustomDatePicker } from "../ui";
import dayjs from "dayjs";
import {
  composePhone,
  parsePhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneLocalMaxLength,
  type PhoneCountryCode,
} from "../../utility/phone";
import { useHasRole } from "../../hooks/usePermissions";

const API_BASE = "https://academy.operator.kg";

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

export type CreatedPatient = {
  id: string;
  fio: string;
  phone?: string | null;
  birth_date?: string | null;
  photo?: string | null;
  inn?: string | null;
  is_blacklisted?: boolean | null;
  blacklist_reason?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: CreatedPatient) => void;
  initialPhone?: string;
};

const AddPatientDrawer: React.FC<Props> = ({ open, onClose, onCreated, initialPhone }) => {
  const { open: notify } = useNotification();
  const [fio, setFio] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneCountryCode, setPhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [birth, setBirth] = React.useState("");
  const [inn, setInn] = React.useState("");
  const [parent1Name, setParent1Name] = React.useState("");
  const [parent1Phone, setParent1Phone] = React.useState("");
  const [parent1PhoneCountryCode, setParent1PhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [parent2Name, setParent2Name] = React.useState("");
  const [parent2Phone, setParent2Phone] = React.useState("");
  const [parent2PhoneCountryCode, setParent2PhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [showParent2, setShowParent2] = React.useState(false);
  const [isBlacklisted, setIsBlacklisted] = React.useState(false);
  const [blacklistReason, setBlacklistReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);

  const canManageBlacklist = useHasRole(['superadmin', 'admin', 'receptionist']);
  const [docFiles, setDocFiles] = React.useState<File[]>([]);

  React.useEffect(() => {
    if (!open) {
      setFio("");
      setPhone("");
      setPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
      setBirth("");
      setInn("");
      setParent1Name("");
      setParent1Phone("");
      setParent1PhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
      setParent2Name("");
      setParent2Phone("");
      setParent2PhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
      setShowParent2(false);
      setIsBlacklisted(false);
      setBlacklistReason("");
      setBusy(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setDocFiles([]);
    } else if (initialPhone) {
      const parsed = parsePhone(initialPhone);
      setPhone(parsed.local);
      setPhoneCountryCode(parsed.countryCode);
    }
  }, [open, initialPhone]);

  const handleSubmit = async () => {
    const fioTrim = fio.trim();
    if (!fioTrim) {
      notify?.({ type: "error", message: "Введите ФИО клиента" });
      return;
    }
    if (isBlacklisted && !blacklistReason.trim()) {
      notify?.({ type: "error", message: "Укажите причину добавления в черный список" });
      return;
    }

    try {
      setBusy(true);
      const fullPhone = composePhone(phoneCountryCode, phone);

      const fd = new FormData();
      fd.append("fullName", fioTrim);
      if (fullPhone) fd.append("phone", fullPhone);
      if (birth) fd.append("birthDate", birth.slice(0, 10));
      if (inn.trim()) fd.append("inn", inn.trim());
      if (parent1Name.trim()) fd.append("parent1Name", parent1Name.trim());
      const fullParent1Phone = composePhone(parent1PhoneCountryCode, parent1Phone);
      if (fullParent1Phone) fd.append("parent1Phone", fullParent1Phone);
      if (parent2Name.trim()) fd.append("parent2Name", parent2Name.trim());
      const fullParent2Phone = composePhone(parent2PhoneCountryCode, parent2Phone);
      if (fullParent2Phone) fd.append("parent2Phone", fullParent2Phone);
      fd.append("isBlacklisted", String(isBlacklisted));
      if (isBlacklisted && blacklistReason.trim()) {
        fd.append("blacklistReason", blacklistReason.trim());
      }
      if (photoFile) fd.append("photoUrl", photoFile);
      const branchId = getBranchFilter();
      if (branchId) fd.append("branch", branchId);

      const res: any = await apiFetch("/api/v1/clients/", {
        method: "POST",
        body: fd,
      });

      const data = res?.data ?? res;
      const created: CreatedPatient = {
        id: String(data.id ?? ""),
        fio: fioTrim,
        phone: fullPhone || null,
        birth_date: birth ? birth.slice(0, 10) : null,
        photo: resolvePhotoUrl(data.photoUrl),
        inn: inn.trim() || null,
        is_blacklisted: isBlacklisted,
        blacklist_reason: isBlacklisted ? blacklistReason.trim() : null,
      };

      // Загружаем документы если есть
      if (docFiles.length > 0) {
        await Promise.allSettled(
          docFiles.map((f) => {
            const dfd = new FormData();
            dfd.append("patient", created.id);
            dfd.append("title", f.name);
            dfd.append("file", f);
            return apiFetch("/api/v1/client-documents/", { method: "POST", body: dfd });
          })
        );
      }

      onCreated?.(created);
      notify?.({ type: "success", message: "Клиент добавлен" });
      onClose();
    } catch (e) {
      console.error(e);
      notify?.({ type: "error", message: "Не удалось добавить клиента" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: 320, sm: 480, md: 520 },
          maxWidth: "100vw",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box sx={{ width: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1 }}>
          <Typography variant="h6">Добавить клиента</Typography>
          <IconButton onClick={busy ? undefined : onClose} aria-label="Закрыть">
            <CloseOutlined />
          </IconButton>
        </Box>
        <Divider />
        <Box
          sx={{
            p: 2,
            flex: 1,
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Stack spacing={3}>
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Фото клиента
              </Typography>
              <PatientPhotoUploader
                photoFile={photoFile}
                photoPreview={photoPreview}
                onPickPhoto={(f) => {
                  setPhotoFile(f);
                  if (photoPreview) URL.revokeObjectURL(photoPreview);
                  setPhotoPreview(f ? URL.createObjectURL(f) : null);
                }}
              />
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                ФИО Клиента
              </Typography>
              <TextField
                value={fio}
                onChange={(e) => setFio(e.target.value)}
                fullWidth
                autoFocus
                placeholder="Введите ФИО клиента"
              />
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Телефон
              </Typography>
              <TextField
                value={phone}
                onChange={(e) => {
                  const maxLen = getPhoneLocalMaxLength(phoneCountryCode);
                  setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, maxLen));
                }}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 1, ml: "-14px" }}>
                      <PhoneCountryCodeSelect
                        value={phoneCountryCode}
                        onChange={(code) => setPhoneCountryCode(code)}
                      />
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  inputMode: "tel",
                  pattern: "[0-9]*",
                  maxLength: getPhoneLocalMaxLength(phoneCountryCode),
                }}
                placeholder={getPhoneLocalMaxLength(phoneCountryCode) === 10 ? "XXX XXX XXXX" : "XXX XXX XXX"}
              />
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Дата рождения
              </Typography>
              <CustomDatePicker
                value={birth ? dayjs(birth) : null}
                onChange={(val) => setBirth(val ? val.format("YYYY-MM-DD") : "")}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    InputLabelProps: { shrink: true },
                    placeholder: "дд.мм.гггг",
                  },
                }}
              />
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                ИНН
              </Typography>
              <TextField
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/[^\d]/g, "").slice(0, 14))}
                fullWidth
                placeholder="14 цифр"
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 14 }}
              />
            </Stack>

            {/* Ответственные лица */}
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1.5 }}>
                Ответственное лицо 1
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  value={parent1Name}
                  onChange={(e) => setParent1Name(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="ФИО ответственного лица"
                />
                <TextField
                  value={parent1Phone}
                  onChange={(e) => {
                    const maxLen = getPhoneLocalMaxLength(parent1PhoneCountryCode);
                    setParent1Phone(e.target.value.replace(/[^\d]/g, "").slice(0, maxLen));
                  }}
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 1, ml: "-14px" }}>
                        <PhoneCountryCodeSelect value={parent1PhoneCountryCode} onChange={(code) => setParent1PhoneCountryCode(code)} />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ inputMode: "tel", pattern: "[0-9]*", maxLength: getPhoneLocalMaxLength(parent1PhoneCountryCode) }}
                  placeholder={getPhoneLocalMaxLength(parent1PhoneCountryCode) === 10 ? "XXX XXX XXXX" : "XXX XXX XXX"}
                />
              </Stack>
            </Box>

            {showParent2 ? (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Ответственное лицо 2
                  </Typography>
                  <IconButton size="small" color="error" onClick={() => { setShowParent2(false); setParent2Name(""); setParent2Phone(""); setParent2PhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE); }}>
                    <CloseOutlined fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack spacing={1.5}>
                  <TextField
                    value={parent2Name}
                    onChange={(e) => setParent2Name(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="ФИО ответственного лица"
                  />
                  <TextField
                    value={parent2Phone}
                    onChange={(e) => {
                      const maxLen = getPhoneLocalMaxLength(parent2PhoneCountryCode);
                      setParent2Phone(e.target.value.replace(/[^\d]/g, "").slice(0, maxLen));
                    }}
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" sx={{ mr: 1, ml: "-14px" }}>
                          <PhoneCountryCodeSelect value={parent2PhoneCountryCode} onChange={(code) => setParent2PhoneCountryCode(code)} />
                        </InputAdornment>
                      ),
                    }}
                    inputProps={{ inputMode: "tel", pattern: "[0-9]*", maxLength: getPhoneLocalMaxLength(parent2PhoneCountryCode) }}
                    placeholder={getPhoneLocalMaxLength(parent2PhoneCountryCode) === 10 ? "XXX XXX XXXX" : "XXX XXX XXX"}
                  />
                </Stack>
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<AddOutlined />}
                onClick={() => setShowParent2(true)}
                size="small"
                sx={{ alignSelf: "flex-start" }}
              >
                + Ответственное лицо
              </Button>
            )}

            {canManageBlacklist && (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isBlacklisted}
                      onChange={(e) => setIsBlacklisted(e.target.checked)}
                      color="error"
                    />
                  }
                  label={
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: isBlacklisted ? "error.main" : "text.primary" }}
                    >
                      В черном списке
                    </Typography>
                  }
                />
                {isBlacklisted && (
                  <TextField
                    label="Причина"
                    multiline
                    minRows={2}
                    fullWidth
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                    placeholder="Опишите причину добавления в ЧС..."
                    error={!blacklistReason.trim()}
                    helperText={!blacklistReason.trim() ? "Обязательное поле" : ""}
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            )}

            {/* Документы */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Документы клиента
              </Typography>
              <Button
                variant="outlined"
                component="label"
                startIcon={<AttachFileOutlined />}
                fullWidth
              >
                Прикрепить файлы
                <input
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setDocFiles((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </Button>
              {docFiles.length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                  {docFiles.map((f, i) => (
                    <Chip
                      key={i}
                      label={f.name}
                      size="small"
                      onDelete={() => setDocFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={busy}>
              Отмена
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={busy || !fio.trim()}>
              {busy ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={18} />
                  <span>Сохранение…</span>
                </Stack>
              ) : (
                "Сохранить"
              )}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
};

export default AddPatientDrawer;

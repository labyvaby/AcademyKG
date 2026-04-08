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
  MenuItem,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import AttachFileOutlined from "@mui/icons-material/AttachFileOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { useNotification } from "@refinedev/core";
import PatientPhotoUploader from "./PatientPhotoUploader";
import { apiFetch, getBranchFilter, resolveApiUrl } from "../../utility/apiClient";
import { PhoneCountryCodeSelect, CustomDatePicker } from "../ui";
import dayjs from "dayjs";
import {
  composePhone,
  parsePhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneLocalMaxLength,
  type PhoneCountryCode,
} from "../../utility/phone";
import { useHasRole, usePermissions } from "../../hooks/usePermissions";

type BranchRow = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

function resolvePhotoUrl(url: string | null | undefined): string | null {
  return resolveApiUrl(url);
}

const normalizePhoneValue = (value: string | null | undefined): string =>
  String(value ?? "").replace(/[^\d+]/g, "");

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

type PatientFieldKey = "fio" | "phone" | "birth" | "inn" | "blacklistReason" | "parent1Name" | "parent1Phone";
type FieldErrors = Partial<Record<PatientFieldKey, string>>;

const mapApiErrorToField = (rawMsg: string): { field?: PatientFieldKey; message: string } => {
  const msg = rawMsg.toLowerCase();
  if (msg.includes("full_name") || msg.includes("fullname") || msg.includes("name") || msg.includes("fio")) {
    return { field: "fio", message: "Проверьте ФИО: используйте корректное имя на кириллице." };
  }
  if (msg.includes("phone") || msg.includes("номер")) {
    return { field: "phone", message: "Проверьте номер телефона: формат неверный или номер уже занят." };
  }
  if (msg.includes("birth") || msg.includes("date")) {
    return { field: "birth", message: "Проверьте дату рождения." };
  }
  if (msg.includes("inn")) {
    return { field: "inn", message: "Проверьте ИНН." };
  }
  if (msg.includes("blacklist")) {
    return { field: "blacklistReason", message: "Укажите причину добавления в черный список." };
  }
  return { message: "Не удалось сохранить клиента. Проверьте заполненные поля." };
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
  const { employee } = usePermissions();
  const [docFiles, setDocFiles] = React.useState<File[]>([]);
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [organizations, setOrganizations] = React.useState<OrganizationRow[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  React.useEffect(() => {
    if (!open) return;
    apiFetch("/api/v1/branches/?pageSize=200&ordering=name")
      .then((r: any) => {
        const list: any[] = r?.data?.results ?? r?.results ?? r?.data ?? [];
        const mappedBranches = list.map((b: any) => ({
          id: String(b.id ?? ""),
          name: String(b.name ?? ""),
          organizationId: String(b.organization?.id ?? b.organizationId ?? b.organization ?? ""),
          organizationName: String(b.organization?.name ?? b.organizationName ?? ""),
        }));
        setBranches(mappedBranches);
        const orgMap = new Map<string, OrganizationRow>();
        mappedBranches.forEach((branch) => {
          if (branch.organizationId && !orgMap.has(branch.organizationId)) {
            orgMap.set(branch.organizationId, {
              id: branch.organizationId,
              name: branch.organizationName || `Организация ${branch.organizationId}`,
            });
          }
        });
        setOrganizations(Array.from(orgMap.values()));
      })
      .catch(() => {});
  }, [open]);

  React.useEffect(() => {
    if (!open || branches.length === 0) return;
    const employeeBranchId = String(
      employee?.branch?.id ?? employee?.branch ?? employee?.branchId ?? ""
    );
    const preferredBranchId =
      getBranchFilter() ||
      employeeBranchId ||
      branches[0]?.id ||
      "";
    const preferredBranch =
      branches.find((branch) => branch.id === preferredBranchId) ??
      branches[0];
    if (!preferredBranch) return;
    setSelectedBranchId((current) => current || preferredBranch.id);
    setSelectedOrganizationId((current) => current || preferredBranch.organizationId);
  }, [open, branches, employee]);

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
      setSelectedOrganizationId("");
      setSelectedBranchId("");
      setFieldErrors({});
    } else if (initialPhone) {
      const parsed = parsePhone(initialPhone);
      setPhone(parsed.local);
      setPhoneCountryCode(parsed.countryCode);
    }
  }, [open, initialPhone]);

  const availableBranches = React.useMemo(
    () => branches.filter((branch) => branch.organizationId === selectedOrganizationId),
    [branches, selectedOrganizationId],
  );

  const handleSubmit = async () => {
    const fioTrim = fio.trim();
    setFieldErrors({});
    if (!fioTrim) {
      const message = "Введите ФИО клиента";
      setFieldErrors({ fio: message });
      notify?.({ type: "error", message });
      return;
    }
    if (/[A-Za-z]/.test(fioTrim)) {
      setFieldErrors({ fio: "ФИО клиента должно быть на кириллице" });
      notify?.({
        type: "error",
        message: "ФИО клиента должно быть на кириллице",
        description: "Используйте русский/кыргызский алфавит. Латиница в этом поле не допускается.",
      });
      return;
    }
    if (isBlacklisted && !blacklistReason.trim()) {
      setFieldErrors({ blacklistReason: "Укажите причину добавления в черный список" });
      notify?.({ type: "error", message: "Укажите причину добавления в черный список" });
      return;
    }
    const parent1NameTrim = parent1Name.trim();
    const fullParent1Phone = composePhone(parent1PhoneCountryCode, parent1Phone);
    if (!parent1NameTrim) {
      setFieldErrors({ parent1Name: "Введите ФИО ответственного лица" });
      notify?.({ type: "error", message: "Введите ФИО ответственного лица" });
      return;
    }
    if (!fullParent1Phone) {
      setFieldErrors({ parent1Phone: "Введите телефон ответственного лица" });
      notify?.({ type: "error", message: "Введите телефон ответственного лица" });
      return;
    }
    try {
      setBusy(true);

      const responsiblePersons: { fullName: string; phone: string }[] = [
        { fullName: parent1NameTrim, phone: fullParent1Phone },
      ];
      if (showParent2) {
        const parent2NameTrim = parent2Name.trim();
        const fullParent2Phone = composePhone(parent2PhoneCountryCode, parent2Phone);
        if (parent2NameTrim && fullParent2Phone) {
          responsiblePersons.push({ fullName: parent2NameTrim, phone: fullParent2Phone });
        }
      }

      const fullPhone = composePhone(phoneCountryCode, phone);

      const body: Record<string, any> = {
        fullName: fioTrim,
        responsiblePersons,
      };
      if (fullPhone) body.phone = fullPhone;
      if (birth) body.birthDate = birth.slice(0, 10);
      if (inn.trim()) body.inn = inn.trim();
      body.isBlacklisted = isBlacklisted;
      if (isBlacklisted && blacklistReason.trim()) body.blacklistReason = blacklistReason.trim();
      if (selectedBranchId) body.branch = selectedBranchId;
      if (selectedOrganizationId) body.organization = selectedOrganizationId;

      const res: any = await apiFetch("/api/v1/clients/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = res?.data ?? res;
      const createdId = String(data?.id ?? data?.client?.id ?? data?.patient?.id ?? "").trim();
      if (!createdId) throw new Error("Backend не вернул id созданного клиента");

      if (photoFile) {
        const pfd = new FormData();
        pfd.append("photoUrl", photoFile);
        await apiFetch(`/api/v1/clients/${createdId}/`, { method: "PATCH", body: pfd }).catch(() => {});
      }

      const created: CreatedPatient = {
        id: createdId,
        fio: fioTrim,
        phone: body.phone ?? null,
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
      const rawMsg = e instanceof Error ? e.message : String(e);
      const mapped = mapApiErrorToField(rawMsg);
      if (mapped.field) {
        setFieldErrors({ [mapped.field]: mapped.message });
      }
      notify?.({
        type: "error",
        message: mapped.message,
        description: rawMsg && rawMsg !== "[object Object]" ? rawMsg : undefined,
      });
      return;
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
                ФИО Клиента *
              </Typography>
              <TextField
                value={fio}
                onChange={(e) => {
                  setFio(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, fio: undefined }));
                }}
                fullWidth
                autoFocus
                placeholder="Введите ФИО клиента"
                error={Boolean(fieldErrors.fio)}
                helperText={fieldErrors.fio || ""}
              />
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Дата рождения
              </Typography>
              <CustomDatePicker
                value={birth ? dayjs(birth) : null}
                onChange={(val) => {
                  setBirth(val ? val.format("YYYY-MM-DD") : "");
                  setFieldErrors((prev) => ({ ...prev, birth: undefined }));
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    InputLabelProps: { shrink: true },
                    placeholder: "дд.мм.гггг",
                    error: Boolean(fieldErrors.birth),
                    helperText: fieldErrors.birth || "",
                  },
                }}
              />
            </Stack>

            {/* Ответственные лица */}
            <Box sx={{ border: "1px solid", borderColor: fieldErrors.parent1Name || fieldErrors.parent1Phone ? "error.main" : "divider", borderRadius: 1, p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1.5 }}>
                Ответственное лицо за ребенка *
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  value={parent1Name}
                  onChange={(e) => {
                    setParent1Name(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, parent1Name: undefined }));
                  }}
                  fullWidth
                  size="small"
                  placeholder="ФИО ответственного лица *"
                  error={Boolean(fieldErrors.parent1Name)}
                  helperText={fieldErrors.parent1Name || ""}
                />
                <TextField
                  value={parent1Phone}
                  onChange={(e) => {
                    const maxLen = getPhoneLocalMaxLength(parent1PhoneCountryCode);
                    setParent1Phone(e.target.value.replace(/[^\d]/g, "").slice(0, maxLen));
                    setFieldErrors((prev) => ({ ...prev, parent1Phone: undefined }));
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
                  placeholder={`${getPhoneLocalMaxLength(parent1PhoneCountryCode) === 10 ? "XXX XXX XXXX" : "XXX XXX XXX"} *`}
                  error={Boolean(fieldErrors.parent1Phone)}
                  helperText={fieldErrors.parent1Phone || ""}
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

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                ИНН
              </Typography>
              <TextField
                value={inn}
                onChange={(e) => {
                  setInn(e.target.value.replace(/[^\d]/g, "").slice(0, 14));
                  setFieldErrors((prev) => ({ ...prev, inn: undefined }));
                }}
                fullWidth
                placeholder="14 цифр"
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 14 }}
                error={Boolean(fieldErrors.inn)}
                helperText={fieldErrors.inn || ""}
              />
            </Stack>

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
                    onChange={(e) => {
                      setBlacklistReason(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, blacklistReason: undefined }));
                    }}
                    placeholder="Опишите причину добавления в ЧС..."
                    error={Boolean(fieldErrors.blacklistReason) || !blacklistReason.trim()}
                    helperText={fieldErrors.blacklistReason || (!blacklistReason.trim() ? "Обязательное поле" : "")}
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
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={busy || !fio.trim()}
            >
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



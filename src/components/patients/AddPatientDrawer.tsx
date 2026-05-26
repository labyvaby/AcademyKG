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
import AppAutocomplete from "../ui/AppAutocomplete";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import AttachFileOutlined from "@mui/icons-material/AttachFileOutlined";
import { useNotification } from "@refinedev/core";
import PatientPhotoUploader from "./PatientPhotoUploader";
import ResponsiblePersonsSection, {
  createResponsiblePersonValue,
  ensureResponsiblePersonValues,
  type ResponsiblePersonFieldErrors,
  type ResponsiblePersonPayload,
  type ResponsiblePersonValue,
} from "./ResponsiblePersonsSection";
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
import { isValidPersonName, validateBirthDate, birthDateErrorMessage } from "../../utility/validation";

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

export type CreatedPatient = {
  id: string;
  fio: string;
  phone?: string | null;
  birth_date?: string | null;
  photo?: string | null;
  inn?: string | null;
  is_blacklisted?: boolean | null;
  blacklist_reason?: string | null;
  responsiblePersons?: ResponsiblePersonPayload[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: CreatedPatient) => void;
  initialPhone?: string;
};

type PatientFieldKey = "fio" | "phone" | "birth" | "inn" | "blacklistReason";
type FieldErrors = Partial<Record<PatientFieldKey, string>>;

const mapApiErrorToField = (rawMsg: string): { field?: PatientFieldKey; message: string } => {
  const msg = rawMsg.toLowerCase();
  if (msg.includes("responsible") || msg.includes("responsible_persons")) {
    return { message: "Проверьте ответственных лиц: проверьте телефон или ФИО." };
  }
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
  const [showInn, setShowInn] = React.useState(false);
  const [responsiblePersons, setResponsiblePersons] = React.useState<ResponsiblePersonValue[]>(() =>
    ensureResponsiblePersonValues(),
  );
  const [isBlacklisted, setIsBlacklisted] = React.useState(false);
  const [blacklistReason, setBlacklistReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);

  // Ребёнок сотрудника + автоматическая скидка при оплате
  const [isEmployeeChild, setIsEmployeeChild] = React.useState(false);
  const [employeeParentId, setEmployeeParentId] = React.useState<string>("");
  const [employeeChildDiscountPercent, setEmployeeChildDiscountPercent] = React.useState<string>("");
  const [employeesList, setEmployeesList] = React.useState<{ id: string; fullName: string }[]>([]);
  React.useEffect(() => {
    if (!open || employeesList.length > 0) return;
    apiFetch("/api/v1/employees/?status=active&pageSize=500&ordering=fullName")
      .then((r: any) => {
        const list: any[] = r?.data?.results ?? r?.results ?? r?.data ?? [];
        setEmployeesList(list.map((e: any) => ({
          id: String(e.id ?? ""),
          fullName: String(e.fullName ?? e.full_name ?? e.id ?? ""),
        })).filter((e) => e.id));
      })
      .catch(() => {});
  }, [open, employeesList.length]);

  const canManageBlacklist = useHasRole(['superadmin', 'admin', 'receptionist']);
  const { employee } = usePermissions();
  const [docFiles, setDocFiles] = React.useState<File[]>([]);
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [organizations, setOrganizations] = React.useState<OrganizationRow[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [responsiblePersonErrors, setResponsiblePersonErrors] = React.useState<ResponsiblePersonFieldErrors[]>([]);

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
      setResponsiblePersons(ensureResponsiblePersonValues());
      setIsBlacklisted(false);
      setBlacklistReason("");
      setBusy(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setDocFiles([]);
      setSelectedOrganizationId("");
      setSelectedBranchId("");
      setFieldErrors({});
      setResponsiblePersonErrors([]);
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

  const updateResponsiblePerson = React.useCallback(
    (index: number, patch: Partial<Omit<ResponsiblePersonValue, "id">>) => {
      setResponsiblePersons((current) =>
        current.map((person, personIndex) =>
          personIndex === index ? { ...person, ...patch } : person,
        ),
      );
      setResponsiblePersonErrors((current) =>
        current.map((error, errorIndex) =>
          errorIndex === index
            ? {
                ...error,
                ...(patch.fullName !== undefined ? { fullName: undefined } : {}),
                ...(patch.phone !== undefined || patch.phoneCountryCode !== undefined
                  ? { phone: undefined }
                  : {}),
              }
            : error,
        ),
      );
    },
    [],
  );

  const addResponsiblePerson = React.useCallback(() => {
    setResponsiblePersons((current) => [...current, createResponsiblePersonValue()]);
    setResponsiblePersonErrors((current) => [...current, {}]);
  }, []);

  const removeResponsiblePerson = React.useCallback((index: number) => {
    setResponsiblePersons((current) =>
      current.length > 1 ? current.filter((_, currentIndex) => currentIndex !== index) : current,
    );
    setResponsiblePersonErrors((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  }, []);

  const buildResponsiblePersonsPayload = React.useCallback(() => {
    const errors = responsiblePersons.map((person, index) => {
      const fullName = person.fullName.trim();
      const fullPhone = composePhone(person.phoneCountryCode, person.phone);
      const isEmpty = !fullName && !fullPhone;
      const shouldValidate = index === 0 || !isEmpty;

      if (!shouldValidate) return {};

      let fullNameError: string | undefined;
      if (!fullName) fullNameError = "Введите ФИО ответственного лица";
      else if (!isValidPersonName(fullName)) fullNameError = "Введите корректное ФИО";

      return {
        fullName: fullNameError,
        phone: fullPhone ? undefined : "Введите телефон ответственного лица",
      };
    });

    const hasErrors = errors.some((error) => error.fullName || error.phone);
    setResponsiblePersonErrors(errors);

    if (hasErrors) return null;

    return responsiblePersons.reduce<ResponsiblePersonPayload[]>((acc, person, index) => {
      const fullName = person.fullName.trim();
      const fullPhone = composePhone(person.phoneCountryCode, person.phone);
      const isEmpty = !fullName && !fullPhone;

      if (index > 0 && isEmpty) return acc;
      if (fullName && fullPhone) {
        acc.push({ fullName, phone: fullPhone });
      }
      return acc;
    }, []);
  }, [notify, responsiblePersons]);

  const handleSubmit = async () => {
    const fioTrim = fio.trim();
    const newFieldErrors: Partial<Record<PatientFieldKey, string>> = {};

    if (!fioTrim) {
      newFieldErrors.fio = "Введите ФИО клиента";
    } else if (!isValidPersonName(fioTrim)) {
      newFieldErrors.fio = "Введите корректное ФИО";
    }
    const birthValidation = validateBirthDate(birth ? birth.slice(0, 10) : "");
    if (!birthValidation.ok) {
      newFieldErrors.birth = birthDateErrorMessage(birthValidation.reason);
    }
    if (isBlacklisted && !blacklistReason.trim()) {
      newFieldErrors.blacklistReason = "Укажите причину добавления в черный список";
    }

    setFieldErrors(newFieldErrors);

    const responsiblePersonsPayload = buildResponsiblePersonsPayload();

    if (Object.keys(newFieldErrors).length > 0 || !responsiblePersonsPayload) return;

    try {
      setBusy(true);

      const fullPhone = composePhone(phoneCountryCode, phone);

      const body: Record<string, any> = {
        fullName: fioTrim,
        responsiblePersons: responsiblePersonsPayload,
      };
      if (fullPhone) body.phone = fullPhone;
      if (birth) body.birthDate = birth.slice(0, 10);
      if (inn.trim()) body.inn = inn.trim();
      body.isBlacklisted = isBlacklisted;
      if (isBlacklisted && blacklistReason.trim()) body.blacklistReason = blacklistReason.trim();

      // Ребёнок сотрудника + автоматическая скидка
      if (isEmployeeChild) {
        if (!employeeParentId) {
          notify?.({ type: "error", message: "Выберите сотрудника-родителя" });
          setBusy(false);
          return;
        }
        const parsed = Number(employeeChildDiscountPercent);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
          notify?.({ type: "error", message: "Процент скидки должен быть от 0 до 100" });
          setBusy(false);
          return;
        }
        body.isEmployeeChild = true;
        body.employeeParent = employeeParentId;
        body.employeeChildDiscountPercent = Math.round(parsed);
      }
      if (selectedBranchId) body.branch = selectedBranchId;
      if (selectedOrganizationId) body.organization = selectedOrganizationId;

      const res: any = await apiFetch("/api/v1/clients/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = res?.data ?? res;
      let createdId = String(data?.id ?? data?.client?.id ?? data?.patient?.id ?? "").trim();

      // Временный фикс: бэкенд не возвращает id при создании — ищем по телефону или ФИО
      if (!createdId) {
        const searchTerm = fullPhone || fioTrim;
        const searchRes: any = await apiFetch(
          `/api/v1/clients/?search=${encodeURIComponent(searchTerm)}&pageSize=5&ordering=-createdAt`
        );
        const results: any[] = searchRes?.data?.results ?? searchRes?.results ?? [];
        const match = results.find((r: any) => {
          const nameMatch = String(r.fullName ?? "").trim().toLowerCase() === fioTrim.toLowerCase();
          const phoneMatch = fullPhone ? (r.phone ?? "") === fullPhone : false;
          return nameMatch || phoneMatch;
        });
        createdId = String(match?.id ?? results[0]?.id ?? "").trim();
      }

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
        responsiblePersons: responsiblePersonsPayload,
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
                onRemovePhoto={() => {
                  setPhotoFile(null);
                  if (photoPreview) URL.revokeObjectURL(photoPreview);
                  setPhotoPreview(null);
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
                helperText={fieldErrors.fio || undefined}
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
                    size: "small",
                    placeholder: "дд.мм.гггг",
                    error: Boolean(fieldErrors.birth),
                    helperText: fieldErrors.birth || undefined,
                  },
                }}
              />
            </Stack>

            <Stack spacing={1.5}>
              <ResponsiblePersonsSection
                persons={responsiblePersons}
                errors={responsiblePersonErrors}
                onChange={updateResponsiblePerson}
                onAdd={addResponsiblePerson}
                onRemove={removeResponsiblePerson}
                disabled={busy}
                title="Ответственные лица *"
              />

              {showInn ? (
                <Stack spacing={0.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      ИНН
                    </Typography>
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      onClick={() => { setShowInn(false); setInn(""); setFieldErrors((prev) => ({ ...prev, inn: undefined })); }}
                    >
                      Убрать
                    </Button>
                  </Stack>
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
                    helperText={fieldErrors.inn || undefined}
                    autoFocus
                  />
                </Stack>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddOutlined />}
                  fullWidth
                  onClick={() => setShowInn(true)}
                >
                  Добавить ИНН клиента
                </Button>
              )}
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
                    helperText={fieldErrors.blacklistReason || (!blacklistReason.trim() ? "Обязательное поле" : undefined)}
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            )}

            {/* Ребёнок сотрудника */}
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isEmployeeChild}
                    onChange={(e) => setIsEmployeeChild(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 600, color: isEmployeeChild ? "success.main" : "text.primary" }}>
                    Ребёнок сотрудника
                  </Typography>
                }
              />
              {isEmployeeChild && (
                <Stack spacing={2} sx={{ mt: 1.5 }}>
                  <AppAutocomplete
                    options={employeesList}
                    getOptionLabel={(o) => o.fullName}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    value={employeesList.find((e) => e.id === employeeParentId) ?? null}
                    onChange={(_, v) => setEmployeeParentId(v?.id ?? "")}
                    noOptionsText="Нет сотрудников"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Сотрудник-родитель"
                        placeholder="Выберите сотрудника"
                        fullWidth
                        error={!employeeParentId}
                        helperText={!employeeParentId ? "Выберите сотрудника" : " "}
                      />
                    )}
                  />
                  {(() => {
                    const num = Number(employeeChildDiscountPercent);
                    const hasValue = employeeChildDiscountPercent !== "";
                    const outOfRange = hasValue && (Number.isNaN(num) || num < 0 || num > 100);
                    return (
                      <TextField
                        label="Скидка, %"
                        type="number"
                        inputProps={{ min: 0, max: 100, step: 1, inputMode: "numeric" }}
                        fullWidth
                        value={employeeChildDiscountPercent}
                        onChange={(e) => setEmployeeChildDiscountPercent(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        error={outOfRange}
                        helperText={outOfRange
                          ? "Введите значение от 0 до 100"
                          : "От 0 до 100. Применяется автоматически в сайдбаре оплаты."}
                        sx={{ '& .MuiInputBase-root': { minHeight: 56 } }}
                      />
                    );
                  })()}
                </Stack>
              )}
            </Box>

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
          <Stack direction="row" gap={1}>
            <Button fullWidth onClick={onClose} disabled={busy}>
              Отмена
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSubmit}
              disabled={busy}
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

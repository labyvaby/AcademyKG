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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from "@mui/material";
import AppAutocomplete from "../ui/AppAutocomplete";
import MuiAlert from "@mui/material/Alert";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import AttachFileOutlined from "@mui/icons-material/AttachFileOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import ZoomInOutlined from "@mui/icons-material/ZoomInOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import { useNotification } from "@refinedev/core";
import PatientPhotoUploader from "./PatientPhotoUploader";
import ResponsiblePersonsSection, {
  createResponsiblePersonValue,
  ensureResponsiblePersonValues,
  type ResponsiblePersonFieldErrors,
  type ResponsiblePersonPayload,
  type ResponsiblePersonValue,
} from "./ResponsiblePersonsSection";
import { apiFetch, resolveApiUrl } from "../../utility/apiClient";
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
import { getBranchFilter } from "../../utility/apiClient";
import { isValidPersonName, validateBirthDate, birthDateErrorMessage } from "../../utility/validation";

function resolvePhotoUrl(url: string | null | undefined): string | null {
  return resolveApiUrl(url);
}

function resolveFileUrl(url: string | null | undefined): string {
  return resolveApiUrl(url) ?? "";
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
}

type ExistingDoc = { id: string | number; title: string; file: string };

export type UpdatedPatient = {
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
  patientId: string | null;
  initialPhoto?: string | null;
  onClose: () => void;
  onUpdated?: (p: UpdatedPatient) => void;
};

const EditPatientDrawer: React.FC<Props> = ({
  open,
  onClose,
  patientId,
  initialPhoto,
  onUpdated,
}) => {
  const { open: notify } = useNotification();
  const [fio, setFio] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneCountryCode, setPhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [birth, setBirth] = React.useState("");
  const [inn, setInn] = React.useState("");
  const [showInn, setShowInn] = React.useState(false);
  const [diagnosis, setDiagnosis] = React.useState("");
  const [responsiblePersons, setResponsiblePersons] = React.useState<ResponsiblePersonValue[]>(() =>
    ensureResponsiblePersonValues(),
  );
  const [responsiblePersonErrors, setResponsiblePersonErrors] = React.useState<ResponsiblePersonFieldErrors[]>([]);
  const [isBlacklisted, setIsBlacklisted] = React.useState(false);
  const [blacklistReason, setBlacklistReason] = React.useState("");

  // Ребёнок сотрудника + автоматическая скидка при оплате
  const [isEmployeeChild, setIsEmployeeChild] = React.useState(false);
  const [employeeParentId, setEmployeeParentId] = React.useState<string>("");
  const [employeeChildDiscountPercent, setEmployeeChildDiscountPercent] = React.useState<string>("");
  const [employeesList, setEmployeesList] = React.useState<{ id: string; fullName: string }[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const canManageBlacklist = useHasRole(["superadmin", "admin", "receptionist", "registrator"]);
  const { employee } = usePermissions();
  const [branches, setBranches] = React.useState<{ id: string; name: string; organizationId: string; organizationName: string }[]>([]);
  const [organizations, setOrganizations] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("");

  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = React.useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = React.useState(false);

  // Документы
  const [existingDocs, setExistingDocs] = React.useState<ExistingDoc[]>([]);
  const [newDocFiles, setNewDocFiles] = React.useState<File[]>([]);
  const [deletingDocId, setDeletingDocId] = React.useState<string | number | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = React.useState<string | number | null>(null);
  const [previewDoc, setPreviewDoc] = React.useState<ExistingDoc | null>(null);
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  const showSnack = (message: string, severity: "success" | "error" = "success") =>
    setSnack({ open: true, message, severity });

  React.useEffect(() => {
    if (!open || employeesList.length > 0) return;
    apiFetch("/api/v1/employees/?status=active&pageSize=500&ordering=fullName")
      .then((r: any) => {
        const list: any[] = r?.data?.results ?? r?.results ?? r?.data ?? [];
        setEmployeesList(
          list.map((e: any) => ({
            id: String(e.id ?? ""),
            fullName: String(e.fullName ?? e.full_name ?? e.id ?? ""),
          })).filter((e) => e.id),
        );
      })
      .catch(() => {});
  }, [open, employeesList.length]);

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
        const orgMap = new Map<string, { id: string; name: string }>();
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

  // Load current client data from REST API on open
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open || !patientId) return;
      setBusy(true);
      try {
        const res: any = await apiFetch(`/api/v1/clients/${patientId}/`);
        if (cancelled) return;

        const data = res?.data ?? res;
        const fioVal = String(data?.fullName ?? "");
        const phoneRaw = String(data?.phone ?? "");
        const birthRaw = String(data?.birthDate ?? "");
        const photoRaw = resolvePhotoUrl(data?.photoUrl) ?? initialPhoto ?? null;
        const innRaw = String(data?.inn ?? "");
        // Читаем ответственных лиц из нового поля responsiblePersons (массив),
        // с фолбэком на старые поля parent1Name/parent1Phone для совместимости
        const legacyResponsiblePersons = [
          (data?.parent1Name ?? data?.parentName ?? data?.parent1Phone ?? data?.parentPhone)
            ? {
                fullName: String(data?.parent1Name ?? data?.parentName ?? ""),
                phone: String(data?.parent1Phone ?? data?.parentPhone ?? ""),
              }
            : null,
          (data?.parent2Name ?? data?.parent2Phone)
            ? {
                fullName: String(data?.parent2Name ?? ""),
                phone: String(data?.parent2Phone ?? ""),
              }
            : null,
        ].filter(Boolean);
        const loadedResponsiblePersons = ensureResponsiblePersonValues(
          Array.isArray(data?.responsiblePersons) && data.responsiblePersons.length > 0
            ? data.responsiblePersons
            : legacyResponsiblePersons,
        );
        const blacklistRaw = Boolean(data?.isBlacklisted ?? false);
        const reasonRaw = String(data?.blacklistReason ?? "");
        const isEmpChild = Boolean(data?.isEmployeeChild ?? false);
        const empParent = data?.employeeParent ?? null;
        const empParentId = typeof empParent === "string" ? empParent : String(empParent?.id ?? "");
        const empDiscount = data?.employeeChildDiscountPercent;

        setFio(fioVal);
        const parsed = parsePhone(phoneRaw);
        setPhoneCountryCode(parsed.countryCode);
        const maxLen = getPhoneLocalMaxLength(parsed.countryCode);
        setPhone(parsed.local.replace(/[^\d]/g, "").slice(0, maxLen));
        setBirth(birthRaw ? birthRaw.slice(0, 10) : "");
        setInn(innRaw);
        if (innRaw) setShowInn(true);
        setDiagnosis(String(data?.diagnosis ?? ""));
        setResponsiblePersons(loadedResponsiblePersons);
        setResponsiblePersonErrors([]);
        setIsBlacklisted(blacklistRaw);
        setBlacklistReason(reasonRaw);
        setIsEmployeeChild(isEmpChild);
        setEmployeeParentId(empParentId);
        setEmployeeChildDiscountPercent(
          empDiscount === null || empDiscount === undefined ? "" : String(empDiscount),
        );
        setExistingPhoto(photoRaw);
        setPhotoPreview(photoRaw);
        setPhotoFile(null);
        setRemovePhoto(false);
        setTouched(false);
        setNewDocFiles([]);
        const currentBranchId = String(data?.branch?.id ?? data?.branchId ?? data?.branch ?? "");
        const currentOrganizationId = String(
          data?.organization?.id ??
          data?.organizationId ??
          data?.organization ??
          data?.branch?.organization?.id ??
          ""
        );
        setSelectedBranchId(currentBranchId);
        setSelectedOrganizationId(currentOrganizationId);

        // Документы из клиента
        const docs: ExistingDoc[] = Array.isArray(data?.documents)
          ? data.documents.map((d: any) => ({
              id: String(d.id ?? ""),
              title: String(d.title ?? d.fileName ?? ""),
              file: resolveFileUrl(d.file ?? d.fileUrl ?? d.url ?? ""),
            }))
          : [];
        setExistingDocs(docs);
      } catch (e) {
        console.error(e);
        notify?.({ type: "error", message: "Не удалось загрузить данные клиента" });
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [open, patientId, initialPhoto, notify]);

  React.useEffect(() => {
    if (!open || branches.length === 0) return;
    const employeeBranchId = String(
      employee?.branch?.id ?? employee?.branch ?? employee?.branchId ?? ""
    );
    const preferredBranchId =
      selectedBranchId ||
      getBranchFilter() ||
      employeeBranchId ||
      branches[0]?.id ||
      "";
    const preferredBranch =
      branches.find((branch) => branch.id === preferredBranchId) ??
      branches[0];
    if (!preferredBranch) return;
    setSelectedBranchId(preferredBranchId);
    setSelectedOrganizationId((current) => current || preferredBranch.organizationId);
  }, [open, branches, employee, selectedBranchId]);

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

    if (hasErrors) {
      notify?.({
        type: "error",
        message: "Проверьте блок ответственных лиц",
        description: "Минимум одно ответственное лицо должно быть заполнено полностью.",
      });
      return null;
    }

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
    setTouched(true);
    const fioTrim = fio.trim();
    if (!fioTrim) {
      notify?.({ type: "error", message: "Введите ФИО клиента" });
      return;
    }
    if (!isValidPersonName(fioTrim)) {
      notify?.({ type: "error", message: "Введите корректное ФИО" });
      return;
    }
    const birthValidation = validateBirthDate(birth ? birth.slice(0, 10) : "");
    if (!birthValidation.ok) {
      notify?.({ type: "error", message: birthDateErrorMessage(birthValidation.reason) });
      return;
    }
    if (isBlacklisted && !blacklistReason.trim()) {
      notify?.({ type: "error", message: "Укажите причину добавления в черный список" });
      return;
    }
    if (!patientId) return;

    const responsiblePersonsPayload = buildResponsiblePersonsPayload();
    if (!responsiblePersonsPayload) return;

    try {
      setBusy(true);
      const fullPhone = composePhone(phoneCountryCode, phone);

      // Валидация полей "ребёнок сотрудника" на фронте — backend дублирует это сам.
      let employeeChildPercentNum: number | null = null;
      if (isEmployeeChild) {
        if (!employeeParentId) {
          notify?.({ type: "error", message: "Выберите сотрудника-родителя" });
          return;
        }
        const parsed = Number(employeeChildDiscountPercent);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
          notify?.({ type: "error", message: "Процент скидки должен быть от 0 до 100" });
          return;
        }
        employeeChildPercentNum = Math.round(parsed);
      }

      const body: Record<string, any> = {
        fullName: fioTrim,
        inn: inn.trim(),
        diagnosis: diagnosis.trim(),
        isBlacklisted,
        blacklistReason: isBlacklisted ? blacklistReason.trim() : "",
        responsiblePersons: responsiblePersonsPayload,
        isEmployeeChild,
        employeeParent: isEmployeeChild ? employeeParentId : null,
        employeeChildDiscountPercent: isEmployeeChild ? employeeChildPercentNum : null,
      };
      if (birth) body.birthDate = birth.slice(0, 10);
      if (fullPhone) body.phone = fullPhone;
      if (selectedBranchId) body.branch = selectedBranchId;
      if (selectedOrganizationId) body.organization = selectedOrganizationId;

      const res: any = await apiFetch(`/api/v1/clients/${patientId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Обновляем фото отдельно (multipart), если изменилось
      if (photoFile || removePhoto) {
        const pfd = new FormData();
        pfd.append("photoUrl", photoFile ?? "");
        await apiFetch(`/api/v1/clients/${patientId}/`, { method: "PATCH", body: pfd }).catch(() => {});
      }

      // Загрузить новые документы
      if (newDocFiles.length > 0) {
        await Promise.allSettled(
          newDocFiles.map((f) => {
            const dfd = new FormData();
            dfd.append("patient", patientId);
            dfd.append("title", f.name);
            dfd.append("file", f);
            return apiFetch("/api/v1/client-documents/", { method: "POST", body: dfd });
          })
        );
      }

      const data = res?.data ?? res;
      const updated: UpdatedPatient = {
        id: String(data.id ?? patientId),
        fio: fioTrim,
        phone: fullPhone || null,
        birth_date: birth ? birth.slice(0, 10) : null,
        photo: resolvePhotoUrl(data.photoUrl),
        inn: inn.trim() || null,
        is_blacklisted: isBlacklisted,
        blacklist_reason: isBlacklisted ? blacklistReason.trim() : null,
        responsiblePersons: responsiblePersonsPayload,
      };

      onUpdated?.(updated);
      notify?.({ type: "success", message: "Изменения сохранены" });
      onClose();
    } catch (e) {
      console.error(e);
      const rawMsg = e instanceof Error ? e.message : String(e);
      const normalizedMsg = rawMsg.toLowerCase();
      const message = normalizedMsg.includes("responsible")
        ? "Проверьте ответственных лиц: ФИО и телефон обязательны."
        : rawMsg && rawMsg !== "[object Object]"
          ? rawMsg
          : "Не удалось сохранить изменения";
      notify?.({ type: "error", message });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeleteDoc = async () => {
    if (confirmDeleteDocId == null) return;
    const id = confirmDeleteDocId;
    setConfirmDeleteDocId(null);
    setDeletingDocId(id);
    try {
      await apiFetch(`/api/v1/client-documents/${id}/`, { method: "DELETE" });
      setExistingDocs((prev) => prev.filter((d) => d.id !== id));
      showSnack("Документ успешно удалён");
    } catch {
      showSnack("Ой, что-то пошло не так", "error");
    } finally {
      setDeletingDocId(null);
    }
  };

  const primaryResponsiblePerson = responsiblePersons[0];
  const canSubmit =
    Boolean(fio.trim()) &&
    Boolean(primaryResponsiblePerson?.fullName.trim()) &&
    Boolean(primaryResponsiblePerson?.phone.trim());

  return (
    <>
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
            <Typography variant="h6">Редактировать клиента</Typography>
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
              {/* Фото */}
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Фото клиента
                </Typography>
                <PatientPhotoUploader
                  photoFile={photoFile}
                  photoPreview={photoPreview}
                  onPickPhoto={(f) => {
                    setRemovePhoto(false);
                    setPhotoFile(f);
                    if (photoPreview) URL.revokeObjectURL(photoPreview);
                    setPhotoPreview(f ? URL.createObjectURL(f) : existingPhoto);
                  }}
                  onRemovePhoto={() => {
                    setRemovePhoto(true);
                    setPhotoFile(null);
                    if (photoPreview) URL.revokeObjectURL(photoPreview);
                    setPhotoPreview(null);
                  }}
                />
              </Stack>

              {/* ФИО */}
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  ФИО Клиента *
                </Typography>
                <TextField
                  value={fio}
                  onChange={(e) => setFio(e.target.value)}
                  fullWidth
                  autoFocus
                  placeholder="Введите ФИО клиента"
                  error={touched && !fio.trim()}
                  helperText={touched && !fio.trim() ? "Обязательное поле" : undefined}
                />
              </Stack>

              {/* Дата рождения */}
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
                      size: "small",
                      placeholder: "дд.мм.гггг",
                    },
                  }}
                />
              </Stack>

              {/* Диагноз (необязательно) */}
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Диагноз
                </Typography>
                <TextField
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  fullWidth
                  size="small"
                  multiline
                  minRows={1}
                  placeholder="Диагноз ребёнка (необязательно)"
                  disabled={busy}
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

                {/* ИНН */}
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
                        onClick={() => { setShowInn(false); setInn(""); }}
                      >
                        Убрать
                      </Button>
                    </Stack>
                    <TextField
                      value={inn}
                      onChange={(e) => setInn(e.target.value.replace(/[^\d]/g, "").slice(0, 14))}
                      fullWidth
                      placeholder="14 цифр"
                      inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 14 }}
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

              {/* Чёрный список */}
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
                      helperText={!blacklistReason.trim() ? "Обязательное поле" : undefined}
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
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: isEmployeeChild ? "success.main" : "text.primary" }}
                    >
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
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Документы клиента
                </Typography>

                {/* Существующие — изображения миниатюрами */}
                {existingDocs.some((d) => isImageUrl(d.file)) && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {existingDocs.filter((d) => isImageUrl(d.file)).map((doc) => (
                      <Box
                        key={doc.id}
                        sx={{
                          position: "relative",
                          width: 72,
                          height: 72,
                          borderRadius: 1,
                          overflow: "hidden",
                          border: "1px solid",
                          borderColor: "divider",
                          cursor: "pointer",
                          "&:hover .doc-ov": { opacity: 1 },
                        }}
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <Box
                          component="img"
                          src={doc.file}
                          alt={doc.title}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <Box
                          className="doc-ov"
                          sx={{
                            position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.4)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            opacity: 0, transition: "opacity 0.15s",
                          }}
                        >
                          <ZoomInOutlined sx={{ color: "white", fontSize: 24 }} />
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteDocId(doc.id); }}
                          disabled={deletingDocId === doc.id}
                          sx={{
                            position: "absolute", top: 2, right: 2,
                            bgcolor: "rgba(0,0,0,0.5)", color: "white", p: 0.25,
                            "&:hover": { bgcolor: "error.main" },
                          }}
                        >
                          {deletingDocId === doc.id ? <CircularProgress size={12} color="inherit" /> : <CloseOutlined sx={{ fontSize: 14 }} />}
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Существующие — не-изображения */}
                {existingDocs.filter((d) => !isImageUrl(d.file)).map((doc) => (
                  <Stack
                    key={doc.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ px: 1, py: 0.5, borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                  >
                    <Box
                      component="a"
                      href={doc.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", flex: 1, minWidth: 0, color: "text.primary" }}
                    >
                      <InsertDriveFileOutlined fontSize="small" color="action" sx={{ flexShrink: 0 }} />
                      <Typography variant="body2" noWrap>{doc.title}</Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setConfirmDeleteDocId(doc.id)}
                      disabled={deletingDocId === doc.id}
                    >
                      {deletingDocId === doc.id ? <CircularProgress size={16} /> : <DeleteOutlineOutlined fontSize="small" />}
                    </IconButton>
                  </Stack>
                ))}

                {/* Добавить новые */}
                <Button variant="outlined" component="label" startIcon={<AttachFileOutlined />} fullWidth>
                  Прикрепить файлы
                  <input
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      setNewDocFiles((prev) => [...prev, ...files]);
                      e.target.value = "";
                    }}
                  />
                </Button>

                {newDocFiles.length > 0 && (
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {newDocFiles.map((f, i) => (
                      <Chip
                        key={i}
                        label={f.name}
                        size="small"
                        onDelete={() => setNewDocFiles((prev) => prev.filter((_, idx) => idx !== i))}
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
                disabled={busy || !canSubmit}
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

      {/* Подтверждение удаления документа */}
      <Dialog open={confirmDeleteDocId != null} onClose={() => setConfirmDeleteDocId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить документ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Вы уверены? Это действие нельзя отменить.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteDocId(null)}>Отмена</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDeleteDoc}>Удалить</Button>
        </DialogActions>
      </Dialog>

      {/* Превью документа */}
      <Dialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        maxWidth={false}
        PaperProps={{ sx: { width: "80vw", maxWidth: "80vw", height: "80vh", maxHeight: "80vh", m: 0 } }}
      >
        <Box sx={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1, flexShrink: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>{previewDoc?.title}</Typography>
            <IconButton onClick={() => setPreviewDoc(null)} size="small">
              <CloseOutlined />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "grey.100" }}>
            {previewDoc && isImageUrl(previewDoc.file) ? (
              <Box component="img" src={previewDoc.file} alt={previewDoc.title} sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <Box component="iframe" src={previewDoc?.file} sx={{ width: "100%", height: "100%", border: "none" }} title={previewDoc?.title} />
            )}
          </Box>
        </Box>
      </Dialog>

      {/* Уведомление */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <MuiAlert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" elevation={6}>
          {snack.message}
        </MuiAlert>
      </Snackbar>
    </>
  );
};

export default EditPatientDrawer;

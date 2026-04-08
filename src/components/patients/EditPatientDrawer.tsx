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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import AddOutlined from "@mui/icons-material/AddOutlined";
import AttachFileOutlined from "@mui/icons-material/AttachFileOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import ZoomInOutlined from "@mui/icons-material/ZoomInOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import { useNotification } from "@refinedev/core";
import PatientPhotoUploader from "./PatientPhotoUploader";
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

function resolvePhotoUrl(url: string | null | undefined): string | null {
  return resolveApiUrl(url);
}

const normalizePhoneValue = (value: string | null | undefined): string =>
  String(value ?? "").replace(/[^\d+]/g, "");

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
        const responsiblePersons: any[] = Array.isArray(data?.responsiblePersons)
          ? data.responsiblePersons
          : [];
        const p1 = responsiblePersons[0];
        const p2 = responsiblePersons[1];
        const parentNameRaw = String(p1?.fullName ?? data?.parent1Name ?? data?.parentName ?? "");
        const parentPhoneRaw = String(p1?.phone ?? data?.parent1Phone ?? data?.parentPhone ?? "");
        const parent2NameRaw = String(p2?.fullName ?? data?.parent2Name ?? "");
        const parent2PhoneRaw = String(p2?.phone ?? data?.parent2Phone ?? "");
        const blacklistRaw = Boolean(data?.isBlacklisted ?? false);
        const reasonRaw = String(data?.blacklistReason ?? "");

        setFio(fioVal);
        const parsed = parsePhone(phoneRaw);
        setPhoneCountryCode(parsed.countryCode);
        const maxLen = getPhoneLocalMaxLength(parsed.countryCode);
        setPhone(parsed.local.replace(/[^\d]/g, "").slice(0, maxLen));
        setBirth(birthRaw ? birthRaw.slice(0, 10) : "");
        setInn(innRaw);
        setParent1Name(parentNameRaw);
        const parsedParent1 = parsePhone(parentPhoneRaw);
        setParent1PhoneCountryCode(parsedParent1.countryCode);
        setParent1Phone(parsedParent1.local.replace(/[^\d]/g, "").slice(0, getPhoneLocalMaxLength(parsedParent1.countryCode)));
        setParent2Name(parent2NameRaw);
        const parsedParent2 = parsePhone(parent2PhoneRaw);
        setParent2PhoneCountryCode(parsedParent2.countryCode);
        setParent2Phone(parsedParent2.local.replace(/[^\d]/g, "").slice(0, getPhoneLocalMaxLength(parsedParent2.countryCode)));
        setShowParent2(!!(parent2NameRaw || parent2PhoneRaw));
        setIsBlacklisted(blacklistRaw);
        setBlacklistReason(reasonRaw);
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

  const handleSubmit = async () => {
    setTouched(true);
    const fioTrim = fio.trim();
    if (!fioTrim) {
      notify?.({ type: "error", message: "Введите ФИО клиента" });
      return;
    }
    if (isBlacklisted && !blacklistReason.trim()) {
      notify?.({ type: "error", message: "Укажите причину добавления в черный список" });
      return;
    }
    if (!patientId) return;

    try {
      setBusy(true);
      const fullPhone = composePhone(phoneCountryCode, phone);
      if (fullPhone) {
        try {
          const lookup: any = await apiFetch(`/api/v1/clients/?search=${encodeURIComponent(fullPhone)}&pageSize=30`);
          const candidates: any[] = lookup?.data?.results ?? lookup?.results ?? [];
          const duplicate = candidates.find((c: any) =>
            String(c?.id ?? "") !== String(patientId) &&
            normalizePhoneValue(c?.phone) === normalizePhoneValue(fullPhone)
          );
          if (duplicate) {
            notify?.({
              type: "error",
              message: "Клиент с таким номером уже существует",
              description: `Номер ${fullPhone} уже привязан к другому клиенту.`,
            });
            setBusy(false);
            return;
          }
        } catch {
          // Если проверка дубликата не прошла — продолжаем сохранение
        }
      }

      // Собираем responsiblePersons только если есть хотя бы одно заполненное лицо
      const parent1NameTrim = parent1Name.trim();
      const fullParent1Phone = composePhone(parent1PhoneCountryCode, parent1Phone);
      const responsiblePersons: { fullName: string; phone: string }[] = [];
      if (parent1NameTrim && fullParent1Phone) {
        responsiblePersons.push({ fullName: parent1NameTrim, phone: fullParent1Phone });
        if (showParent2) {
          const parent2NameTrim = parent2Name.trim();
          const fullParent2Phone = composePhone(parent2PhoneCountryCode, parent2Phone);
          if (parent2NameTrim && fullParent2Phone) {
            responsiblePersons.push({ fullName: parent2NameTrim, phone: fullParent2Phone });
          }
        }
      }

      const body: Record<string, any> = {
        fullName: fioTrim,
        inn: inn.trim(),
        isBlacklisted,
        blacklistReason: isBlacklisted ? blacklistReason.trim() : "",
      };
      if (birth) body.birthDate = birth.slice(0, 10);
      if (fullPhone) body.phone = fullPhone;
      if (selectedBranchId) body.branch = selectedBranchId;
      if (selectedOrganizationId) body.organization = selectedOrganizationId;
      // Передаём responsiblePersons только если есть что передавать (пустой нельзя)
      if (responsiblePersons.length > 0) body.responsiblePersons = responsiblePersons;

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
      };

      onUpdated?.(updated);
      notify?.({ type: "success", message: "Изменения сохранены" });
      onClose();
    } catch (e) {
      console.error(e);
      notify?.({ type: "error", message: "Не удалось сохранить изменения" });
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
                />
                {(existingPhoto || photoPreview) && !photoFile && (
                  <Button
                    variant="text"
                    color="error"
                    size="small"
                    startIcon={<DeleteOutline />}
                    onClick={() => {
                      setRemovePhoto(true);
                      setPhotoFile(null);
                      if (photoPreview) URL.revokeObjectURL(photoPreview);
                      setPhotoPreview(null);
                    }}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Удалить фото
                  </Button>
                )}
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
                  helperText={touched && !fio.trim() ? "Обязательное поле" : ""}
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
                      InputLabelProps: { shrink: true },
                      placeholder: "дд.мм.гггг",
                    },
                  }}
                />
              </Stack>

              {/* Ответственные лица */}
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1.5 }}>
                  Ответственное лицо за ребенка
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

              {/* ИНН */}
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
                      helperText={!blacklistReason.trim() ? "Обязательное поле" : ""}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              )}

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
            <Stack direction="row" gap={1} justifyContent="flex-end">
              <Button onClick={onClose} disabled={busy}>
                Отмена
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={busy || !fio.trim() || !selectedOrganizationId || !selectedBranchId}
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

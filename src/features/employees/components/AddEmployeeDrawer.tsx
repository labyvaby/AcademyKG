import React from "react";
import { Stack, TextField, InputAdornment, Checkbox, Typography, MenuItem } from "@mui/material";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import AppAutocomplete from "../../../components/ui/AppAutocomplete";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import DrawerBase from "./DrawerBase";
import type { EmployesRow, ServiceRow } from "../types";
import { employeeFormUtils, fetchRoles } from "../hooks/useEmployeesPage";
import { apiFetch, getBranchFilter } from "../../../utility/apiClient";
import ServicePhotoUploader from "../../../components/services/ServicePhotoUploader";
import PassportPhotoUploader from "./PassportPhotoUploader";
import { useNotification } from "@refinedev/core";
import { PhoneCountryCodeSelect, CustomDatePicker } from "../../../components/ui";
import dayjs from "dayjs";
import {
  composePhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneLocalMaxLength,
  type PhoneCountryCode,
} from "../../../utility/phone";
import { usePermissions } from "../../../hooks/usePermissions";
import { PERMISSIONS } from "../../../constants/permissions";

export type AddEmployeeDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (rec: EmployesRow) => void;
};

type RoleRow = { id: string; name: string; display_name: string };
type BranchRow = { id: string; name: string; organizationId: string };

// Роли загружаются из API через fetchRoles() — fallback пустой, т.к. id должны быть UUID
const FALLBACK_ROLES: RoleRow[] = [];

const AddEmployeeDrawer: React.FC<AddEmployeeDrawerProps> = ({ open, onClose, onCreated }) => {
  const { open: notify } = useNotification();
  const { hasPermission } = usePermissions();

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneCountryCode, setPhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [phoneError, setPhoneError] = React.useState(false);
  const [roleId, setRoleId] = React.useState("");
  const [roles, setRoles] = React.useState<RoleRow[]>([]);
  const [birthDate, setBirthDate] = React.useState("");
  const [status, setStatus] = React.useState("active");
  const [busy, setBusy] = React.useState(false);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [telegramId, setTelegramId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailErrorMsg, setEmailErrorMsg] = React.useState("");
  const [bankAccountNumber, setBankAccountNumber] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [passportPhotos, setPassportPhotos] = React.useState<string[]>([]);
  const [passportFiles, setPassportFiles] = React.useState<File[]>([]);
  const [services, setServices] = React.useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);
  const [selectedServices, setSelectedServices] = React.useState<ServiceRow[]>([]);
  const [specializations, setSpecializations] = React.useState<{ id: string; name: string }[]>([]);
  const [specializationId, setSpecializationId] = React.useState("");
  const [inn, setInn] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [organizationId, setOrganizationId] = React.useState("");
  const [branches, setBranches] = React.useState<BranchRow[]>([]);

  const selectedRole = roles.find(r => r.id === roleId);
  const isTrainerRole = selectedRole?.name === "specialist";
  const canManageRoles = hasPermission(PERMISSIONS.APP_SETTINGS_UPDATE);

  React.useEffect(() => {
    if (!open) {
      setFullName(""); setPhone(""); setPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
      setRoleId(""); setSpecializationId(""); setPhotoPreview(null);
      setPhotoFile(null);
      setBirthDate(""); setStatus("active"); setBankAccountNumber(""); setInn("");
      setTelegramId(""); setEmail(""); setEmailErrorMsg("");
      setSelectedServices([]);
      setNickname(""); setPassportPhotos([]); setPassportFiles([]); setBusy(false);
      setBranchId(""); setOrganizationId("");
    }
  }, [open]);

  React.useEffect(() => {
    let cancelled = false;
    if (!open) return;
    (async () => {
      try {
        setServicesLoading(true);
        const [srvItems, specs, apiRoles, branchesRes] = await Promise.all([
          employeeFormUtils.fetchServices(),
          employeeFormUtils.fetchSpecializations(),
          fetchRoles(),
          apiFetch("/api/v1/branches/").then((r: any) => r?.data?.results ?? r?.results ?? []).catch(() => []),
        ]);
        if (!cancelled) {
          setServices(Array.from(new Map(srvItems.map(s => [s.id, s])).values()));
          setSpecializations(specs);
          setRoles(apiRoles.length > 0 ? apiRoles : FALLBACK_ROLES);
          const mappedBranches = branchesRes.map((b: any) => ({
            id: String(b.id ?? b.uuid ?? ""),
            name: b.name ?? b.displayName ?? "",
            organizationId: String(b.organization?.id ?? b.organizationId ?? b.organization ?? ""),
          }));
          setBranches(mappedBranches);
          // Подставляем текущий выбранный филиал по умолчанию
          const activeBranchId = getBranchFilter();
          if (activeBranchId && mappedBranches.some((b) => b.id === activeBranchId)) {
            setBranchId(activeBranchId);
            setOrganizationId(mappedBranches.find((b) => b.id === activeBranchId)?.organizationId ?? "");
          }
        }
      } catch {
        if (!cancelled) setRoles(FALLBACK_ROLES);
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const validateEmail = (val: string) => {
    if (!val.trim()) return "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Некорректный формат email";
    return "";
  };

  const handleSubmit = async () => {
    const fullNameTrim = fullName.trim();
    const maxLen = getPhoneLocalMaxLength(phoneCountryCode);
    if (!fullNameTrim) { notify?.({ type: "error", message: "Введите ФИО сотрудника" }); return; }
    if (phone.trim().length > 0 && phone.trim().length !== maxLen) { setPhoneError(true); return; }
    if (emailErrorMsg) return;
    if (!roleId) { notify?.({ type: "error", message: "Выберите роль сотрудника" }); return; }
    if (!branchId) { notify?.({ type: "error", message: "Выберите филиал сотрудника" }); return; }
    if (!organizationId) { notify?.({ type: "error", message: "Для выбранного филиала не найдена организация" }); return; }
    if ((selectedRole?.name === 'specialist') && !specializationId) {
      notify?.({ type: "error", message: "Выберите специализацию" }); return;
    }

    try {
      setBusy(true);
      const fullPhone = composePhone(phoneCountryCode, phone);

      const payload: Record<string, unknown> = {
        fullName: fullNameTrim,
        role: roleId || undefined,
        status,
        organization: organizationId,
        branch: branchId,
      };

      if (fullPhone) payload.userPhoneNumber = fullPhone;
      if (email.trim()) payload.userEmail = email.trim();
      if (birthDate) payload.birthDate = birthDate;
      if (telegramId.trim()) payload.telegramId = telegramId.trim();
      if (bankAccountNumber.trim()) payload.bankAccountNumber = bankAccountNumber.trim();
      if (inn.trim()) payload.inn = inn.trim();
      if (nickname.trim()) payload.nickname = nickname.trim();
      if (photoFile) payload.photoUrl = photoFile;

      if (isTrainerRole && specializationId) {
        payload.specializationIds = [specializationId];
      }

      if (isTrainerRole && selectedServices.length > 0) {
        payload.serviceIds = selectedServices.map(s => s.id);
      }

      const created: any = await employeeFormUtils.createEmployeeApi(payload);
      const createdId = created?.id ?? created?.data?.id;

      // Загружаем документы если есть
      if (createdId && passportFiles.length > 0) {
        await Promise.allSettled(passportFiles.map(file => {
          const fd = new FormData();
          fd.append("employee", String(createdId));
          fd.append("title", file.name);
          fd.append("file", file);
          return apiFetch("/api/v1/employee-documents/", { method: "POST", body: fd });
        }));
      }

      notify?.({ type: "success", message: "Сотрудник создан" });
      onCreated({} as unknown as EmployesRow);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось создать сотрудника";
      notify?.({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase open={open} title="Новый сотрудник" onClose={onClose} busy={busy}
      onSubmit={handleSubmit} submitLabel="Создать"
      submitDisabled={(phone.trim().length > 0 && phoneError) || !!emailErrorMsg}
    >
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Фото</Typography>
          <ServicePhotoUploader photoFile={null} photoPreview={photoPreview} inputId="emp-add-photo-input"
            onPickPhoto={f => {
              setPhotoFile(f);
              if (!f) { setPhotoPreview(null); return; }
              const r = new FileReader();
              r.onload = () => setPhotoPreview(String(r.result || ""));
              r.readAsDataURL(f);
            }}
          />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>ФИО *</Typography>
          <TextField value={fullName} onChange={e => setFullName(e.target.value)} required fullWidth placeholder="Введите ФИО" />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Псевдоним</Typography>
          <TextField value={nickname} onChange={e => setNickname(e.target.value)} fullWidth placeholder="Введите псевдоним" />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Телефон</Typography>
          <TextField
            value={phone} placeholder="XXX XXX XXX"
            onChange={e => {
              const maxLen = getPhoneLocalMaxLength(phoneCountryCode);
              const v = e.target.value.replace(/[^\d]/g, "").slice(0, maxLen);
              setPhone(v); setPhoneError(v.length > 0 && v.length !== maxLen);
            }}
            error={phone.trim().length > 0 && phoneError}
            helperText={phone.trim().length > 0 && phoneError ? `Введите ${getPhoneLocalMaxLength(phoneCountryCode)} цифр` : ""}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ mr: 0, ml: '-14px' }}>
                  <PhoneCountryCodeSelect value={phoneCountryCode} onChange={setPhoneCountryCode} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Роль *</Typography>
          <TextField select value={roleId}
            onChange={e => {
              setRoleId(e.target.value);
              const r = roles.find(x => x.id === e.target.value);
              if (r?.name !== "specialist") {
                setSpecializationId("");
                setSelectedServices([]);
              }
            }}
            fullWidth required
            helperText={canManageRoles ? "" : "Роль назначается в рамках ваших прав доступа"}
          >
            {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.display_name || r.name}</MenuItem>)}
          </TextField>
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Филиал *</Typography>
          <TextField
            select
            value={branchId}
            onChange={e => {
              const nextBranchId = e.target.value;
              setBranchId(nextBranchId);
              setOrganizationId(branches.find((b) => b.id === nextBranchId)?.organizationId ?? "");
            }}
            fullWidth
            required
          >
            {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
        </Stack>

        {isTrainerRole && (
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Специализация *</Typography>
            <TextField select value={specializationId} onChange={e => setSpecializationId(e.target.value)} fullWidth required>
              {specializations.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Stack>
        )}

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Дата рождения</Typography>
          <CustomDatePicker value={birthDate ? dayjs(birthDate) : null}
            onChange={val => setBirthDate(val ? val.format('YYYY-MM-DD') : '')}
            slotProps={{ textField: { fullWidth: true, placeholder: "дд.мм.гггг" } }}
          />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Статус</Typography>
          <TextField select value={status} onChange={e => setStatus(e.target.value)} fullWidth>
            <MenuItem value="active">Работает</MenuItem>
            <MenuItem value="inactive">Не работает</MenuItem>
          </TextField>
        </Stack>

        {isTrainerRole && (
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Услуги</Typography>
            <AppAutocomplete multiple limitTags={2} loading={servicesLoading} options={services}
              value={selectedServices} disableCloseOnSelect
              getOptionLabel={o => typeof o.price === 'number' ? `${o.name} (${o.price} с)` : o.name || ''}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_, v) => setSelectedServices(v)}
              renderOption={(props, option, { selected }) => {
                const { key, ...optionProps } = props;
                return (
                  <li key={key} {...optionProps}>
                    <Checkbox icon={<CheckBoxOutlineBlankIcon fontSize="small" />} checkedIcon={<CheckBoxIcon fontSize="small" />} style={{ marginRight: 8 }} checked={selected} />
                    {option.name} {typeof option.price === 'number' ? `(${option.price} с)` : ""}
                  </li>
                );
              }}
              renderInput={params => <TextField {...params} placeholder="Выберите услуги" />}
            />
          </Stack>
        )}

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Telegram ID</Typography>
          <TextField value={telegramId} onChange={e => setTelegramId(e.target.value.replace(/[^0-9]/g, ''))} fullWidth placeholder="Только цифры" inputProps={{ inputMode: "numeric" }} />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Email</Typography>
          <TextField value={email} onChange={e => { setEmail(e.target.value); setEmailErrorMsg(validateEmail(e.target.value)); }}
            fullWidth placeholder="example@mail.com" type="email" error={!!emailErrorMsg} helperText={emailErrorMsg} />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Расчетный счет</Typography>
          <TextField value={bankAccountNumber}
            onChange={e => setBankAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 16))}
            fullWidth placeholder="0000 0000 0000 0000"
            InputProps={{ startAdornment: <InputAdornment position="start"><CreditCardOutlined fontSize="small" /></InputAdornment> }}
            helperText={`${bankAccountNumber.length}/16`}
          />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>ИНН</Typography>
          <TextField value={inn}
            onChange={e => setInn(e.target.value.replace(/[^0-9]/g, '').slice(0, 14))}
            fullWidth placeholder="Введите ИНН"
            inputProps={{ inputMode: "numeric" }}
            helperText={`${inn.length}/14`}
          />
        </Stack>

        <PassportPhotoUploader photos={passportPhotos}
          onAddPhoto={file => {
            setPassportFiles(prev => [...prev, file]);
            const reader = new FileReader();
            reader.onload = () => setPassportPhotos(prev => [...prev, String(reader.result)]);
            reader.readAsDataURL(file);
          }}
          onRemovePhoto={url => {
            const idx = passportPhotos.indexOf(url);
            if (idx !== -1) {
              setPassportPhotos(prev => prev.filter((_, i) => i !== idx));
              setPassportFiles(prev => prev.filter((_, i) => i !== idx));
            }
          }}
          inputId="emp-add-passport-input"
        />
      </Stack>
    </DrawerBase>
  );
};

export default AddEmployeeDrawer;

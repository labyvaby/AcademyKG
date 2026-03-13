import React from "react";
import { Stack, TextField, InputAdornment, Checkbox, Typography, MenuItem, IconButton } from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import Autocomplete from "@mui/material/Autocomplete";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import DrawerBase from "./DrawerBase";
import type { EmployesRow, ServiceRow } from "../types";
import { employeeFormUtils, fetchRoles } from "../hooks/useEmployeesPage";
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

export type AddEmployeeDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (rec: EmployesRow) => void;
};

type RoleRow = { id: string; name: string; display_name: string };

// Стандартные роли — загружаются из API, иначе fallback
const FALLBACK_ROLES: RoleRow[] = [
  { id: "superadmin", name: "superadmin", display_name: "Супер-Администратор" },
  { id: "admin", name: "admin", display_name: "Управляющий" },
  { id: "doctor", name: "doctor", display_name: "Сотрудник" },
  { id: "nurse", name: "nurse", display_name: "Медсестра" },
  { id: "receptionist", name: "receptionist", display_name: "Регистратор" },
  { id: "accountant", name: "accountant", display_name: "Бухгалтер" },
];

const AddEmployeeDrawer: React.FC<AddEmployeeDrawerProps> = ({ open, onClose, onCreated }) => {
  const { open: notify } = useNotification();

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
  const [telegramId, setTelegramId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailErrorMsg, setEmailErrorMsg] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [bankAccountNumber, setBankAccountNumber] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [passportPhotos, setPassportPhotos] = React.useState<string[]>([]);
  const [passportFiles, setPassportFiles] = React.useState<File[]>([]);
  const [services, setServices] = React.useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);
  const [selectedServices, setSelectedServices] = React.useState<ServiceRow[]>([]);
  const [specializations, setSpecializations] = React.useState<{ id: string; name: string }[]>([]);
  const [specializationId, setSpecializationId] = React.useState("");

  const selectedRole = roles.find(r => r.id === roleId);

  React.useEffect(() => {
    if (!open) {
      setFullName(""); setPhone(""); setPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
      setRoleId(""); setSpecializationId(""); setPhotoPreview(null);
      setBirthDate(""); setStatus("active"); setBankAccountNumber("");
      setTelegramId(""); setEmail(""); setEmailErrorMsg("");
      setPassword(""); setShowPassword(false); setSelectedServices([]);
      setNickname(""); setPassportPhotos([]); setPassportFiles([]); setBusy(false);
    }
  }, [open]);

  React.useEffect(() => {
    let cancelled = false;
    if (!open) return;
    (async () => {
      try {
        setServicesLoading(true);
        const [srvItems, specs, apiRoles] = await Promise.all([
          employeeFormUtils.fetchServices(),
          employeeFormUtils.fetchSpecializations(),
          fetchRoles(),
        ]);
        if (!cancelled) {
          setServices(Array.from(new Map(srvItems.map(s => [s.id, s])).values()));
          setSpecializations(specs);
          setRoles(apiRoles.length > 0 ? apiRoles : FALLBACK_ROLES);
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
    const maxLen = getPhoneLocalMaxLength(phoneCountryCode);
    if (phone.trim().length > 0 && phone.trim().length !== maxLen) { setPhoneError(true); return; }
    if (emailErrorMsg) return;
    if (!roleId) { notify?.({ type: "error", message: "Выберите роль сотрудника" }); return; }
    if (selectedRole?.name === 'doctor' && !specializationId) {
      notify?.({ type: "error", message: "Выберите специализацию" }); return;
    }

    try {
      setBusy(true);
      const fullPhone = composePhone(phoneCountryCode, phone);

      // 1. Создать auth-пользователя
      let authUserId: string | null = null;
      if (fullPhone || email.trim()) {
        try {
          const authData = await employeeFormUtils.adminCreateUser({
            phoneNumber: fullPhone ?? undefined,
            password: password.trim() || "AcademyKG123!",
            fullName: fullName.trim(),
          });
          authUserId = (authData as any)?.id ?? (authData as any)?.user_id ?? null;
        } catch (e) {
          throw new Error(employeeFormUtils.translateAuthError(e));
        }
      }

      // 2. Создать сотрудника через REST API
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        phone: fullPhone ?? undefined,
        role: roleId || undefined,
        status,
        birthDate: birthDate || undefined,
        telegramId: telegramId || undefined,
        bankAccountNumber: bankAccountNumber.trim() || undefined,
        email: email.trim() || undefined,
        nickname: nickname.trim() || undefined,
        authUser: authUserId ?? undefined,
        specializationIds: specializationId ? [specializationId] : [],
      };

      const created = await employeeFormUtils.createEmployeeApi(payload);
      if (!created?.id) throw new Error("Не удалось создать сотрудника");

      notify?.({ type: "success", message: "Сотрудник создан" });
      onCreated(created as unknown as EmployesRow);
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
            onChange={e => { setRoleId(e.target.value); const r = roles.find(x => x.id === e.target.value); if (r?.name !== 'doctor') setSpecializationId(""); }}
            fullWidth required
          >
            {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.display_name || r.name}</MenuItem>)}
          </TextField>
        </Stack>

        {selectedRole?.name === 'doctor' && (
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

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Услуги</Typography>
          <Autocomplete multiple limitTags={2} loading={servicesLoading} options={services}
            value={selectedServices} disableCloseOnSelect
            getOptionLabel={o => typeof o.price === 'number' ? `${o.name} (${o.price} с)` : o.name || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_, v) => setSelectedServices(v)}
            renderOption={(props, option, { selected }) => (
              <li {...props}>
                <Checkbox icon={<CheckBoxOutlineBlankIcon fontSize="small" />} checkedIcon={<CheckBoxIcon fontSize="small" />} style={{ marginRight: 8 }} checked={selected} />
                {option.name} {typeof option.price === 'number' ? `(${option.price} с)` : ""}
              </li>
            )}
            renderInput={params => <TextField {...params} placeholder="Выберите услуги" />}
          />
        </Stack>

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
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Пароль для входа</Typography>
          <TextField value={password} onChange={e => setPassword(e.target.value)} fullWidth placeholder="Минимум 8 символов"
            type={showPassword ? "text" : "password"}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
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

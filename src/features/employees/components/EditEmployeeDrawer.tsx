import React from "react";
import { Stack, TextField, InputAdornment, Checkbox, Typography, MenuItem, Box, Divider } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { apiFetch } from "../../../utility/apiClient";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import DrawerBase from "./DrawerBase";
import type { EmployesRow, ServiceRow } from "../types";
import { employeeFormUtils, fetchRoles } from "../hooks/useEmployeesPage";
import { mapAnyToEmployee } from "../api";
import ServicePhotoUploader from "../../../components/services/ServicePhotoUploader";
import PassportPhotoUploader from "./PassportPhotoUploader";
import { useNotification } from "@refinedev/core";
import { PhoneCountryCodeSelect, CustomDatePicker } from "../../../components/ui";
import dayjs from "dayjs";
import {
  composePhone,
  parsePhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneLocalMaxLength,
  type PhoneCountryCode,
} from "../../../utility/phone";
import SalarySettings from "./SalarySettings";
import { usePermissions } from "../../../hooks/usePermissions";

export type EditEmployeeDrawerProps = {
  record: EmployesRow | null;
  onClose: () => void;
  onUpdated: (rec: EmployesRow) => void;
};

type RoleRow = { id: string; name: string; display_name: string };

// Роли загружаются из API — fallback пустой, т.к. id должны быть UUID
const FALLBACK_ROLES: RoleRow[] = [];

const EditEmployeeDrawer: React.FC<EditEmployeeDrawerProps> = ({ record, onClose, onUpdated }) => {
  const open = Boolean(record);
  const { open: notify } = useNotification();
  const { hasRole } = usePermissions();

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneCountryCode, setPhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [phoneError, setPhoneError] = React.useState(false);
  const [roleId, setRoleId] = React.useState("");
  const [roles, setRoles] = React.useState<RoleRow[]>([]);
  const [birthDate, setBirthDate] = React.useState("");
  const [status, setStatus] = React.useState("active");
  const [telegramId, setTelegramId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailErrorMsg, setEmailErrorMsg] = React.useState("");
  const [bankAccountNumber, setBankAccountNumber] = React.useState("");
  const [inn, setInn] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [passportPhotos, setPassportPhotos] = React.useState<string[]>([]);
  const [passportFiles, setPassportFiles] = React.useState<File[]>([]);
  const [removedPassportUrls, setRemovedPassportUrls] = React.useState<string[]>([]);
  const [specializationId, setSpecializationId] = React.useState("");
  const [salaryRules, setSalaryRules] = React.useState<any>(null);
  const [services, setServices] = React.useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);
  const [selectedServices, setSelectedServices] = React.useState<ServiceRow[]>([]);
  const [specializations, setSpecializations] = React.useState<{ id: string; name: string }[]>([]);

  const selectedRole = roles.find(r => r.id === roleId);

  const normalizeDateInput = (input: unknown): string => {
    if (!input || typeof input !== "string") return "";
    const s = input.trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
    }
    return "";
  };

  React.useEffect(() => {
    if (!record) {
      setFullName(""); setPhone(""); setPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
      setPhoneError(false); setRoleId(""); setSpecializationId(""); setBirthDate("");
      setNickname(""); setEmail(""); setEmailErrorMsg(""); setBusy(false); setInn("");
      setPhotoPreview(null); setServices([]); setSelectedServices([]);
      setPassportPhotos([]); setPassportFiles([]); setRemovedPassportUrls([]);
      return;
    }

    setFullName(record.full_name || "");
    setRoleId((record.role_id && typeof record.role_id === 'string') ? record.role_id : "");
    setStatus(record.status || "active");
    setNickname(record.nickname || "");
    setSalaryRules(record.salary_rules || null);
    setPhotoPreview(record.photo_url ? String(record.photo_url) : null);
    setPassportPhotos(Array.isArray(record.passport_photos) ? record.passport_photos : []);
    setPassportFiles([]); setRemovedPassportUrls([]);
    setBirthDate(normalizeDateInput(record.birth_date || ""));

    let cancelled = false;
    (async () => {
      try {
        setServicesLoading(true);
        const [allSrv, specs, apiRoles, empDetailRaw] = await Promise.all([
          employeeFormUtils.fetchServices(),
          employeeFormUtils.fetchSpecializations(),
          fetchRoles(),
          apiFetch(`/api/v1/employees/${record.id}/`),
        ]);
        if (cancelled) return;

        const d = (empDetailRaw as any)?.data ?? empDetailRaw as any;

        // Телефон и email из detail (userPhoneNumber / userEmail)
        const rawPhone = d?.userPhoneNumber ?? d?.phoneNumber ?? record.phone ?? "";
        const parsedPhone = parsePhone(rawPhone);
        setPhoneCountryCode(parsedPhone.countryCode);
        setPhone(employeeFormUtils.sanitizeKGLocal(parsedPhone.local));
        setEmail(d?.userEmail ?? d?.email ?? record.email ?? "");
        setTelegramId(d?.telegramId ?? record.telegram_id ?? "");
        setBankAccountNumber(d?.bankAccountNumber ?? record.bank_account_number ?? "");
        setInn(d?.inn ?? (record as any).inn ?? "");
        if (d?.photoUrl) setPhotoPreview(d.photoUrl);
        if (d?.birthDate) setBirthDate(normalizeDateInput(d.birthDate));

        const allSrvUniq = Array.from(new Map((allSrv || []).map(s => [String(s.id), s])).values());
        setServices(allSrvUniq);
        setSpecializations(specs);
        setRoles(apiRoles.length > 0 ? apiRoles : FALLBACK_ROLES);

        // Специализации
        const specList: any[] = Array.isArray(d?.specializations) ? d.specializations : [];
        if (specList.length > 0) setSpecializationId(String(specList[0]?.id ?? specList[0]));

        // Услуги из detail
        const empServices: any[] = Array.isArray(d?.services) ? d.services : [];
        if (empServices.length > 0) {
          const empServiceIds = empServices.map((s: any) =>
            typeof s === 'string' ? s : String(s.sellableItem ?? s.sellable_item ?? s.id)
          );
          setSelectedServices(allSrvUniq.filter(s => empServiceIds.includes(String(s.id))));
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setServicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  React.useEffect(() => {
    if (!email.trim()) { setEmailErrorMsg(""); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setEmailErrorMsg("Некорректный формат email");
    else setEmailErrorMsg("");
  }, [email]);

  const handleSubmit = async () => {
    if (!record) return;
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

      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        userPhoneNumber: fullPhone ?? undefined,
        role: roleId || undefined,
        status,
        birthDate: birthDate || undefined,
        telegramId: telegramId || undefined,
        bankAccountNumber: bankAccountNumber.trim() || undefined,
        inn: inn.trim() || undefined,
        userEmail: email.trim() || undefined,
        nickname: nickname.trim() || undefined,
        specializationIds: specializationId ? [specializationId] : [],
      };

      // TODO: serviceIds вызывает 500 на сервере — временно отключено
      // payload.serviceIds = selectedServices.map(s => s.id);

      await employeeFormUtils.updateEmployeeApi(String(record.id), payload);

      // Загружаем новые документы если есть
      if (passportFiles.length > 0) {
        await Promise.allSettled(passportFiles.map(file => {
          const fd = new FormData();
          fd.append("employee", String(record.id));
          fd.append("title", file.name);
          fd.append("file", file);
          return apiFetch("/api/v1/employee-documents/", { method: "POST", body: fd });
        }));
      }

      // PATCH возвращает 204, грузим актуальные данные отдельным GET
      let updatedRecord: EmployesRow = record;
      try {
        const detailRaw: any = await apiFetch(`/api/v1/employees/${record.id}/`);
        const d = detailRaw?.data ?? detailRaw;
        if (d?.id) {
          updatedRecord = {
            ...record,
            full_name: d.fullName ?? record.full_name,
            phone: d.userPhoneNumber ?? d.phone ?? record.phone,
            email: d.userEmail ?? d.email ?? record.email,
            status: d.status ?? record.status,
            nickname: d.nickname ?? record.nickname,
            birth_date: d.birthDate ?? record.birth_date,
            telegram_id: d.telegramId ?? record.telegram_id,
            bank_account_number: d.bankAccountNumber ?? record.bank_account_number,
            photo_url: d.photoUrl ?? record.photo_url,
          } as unknown as EmployesRow;
        }
      } catch { /* используем старые данные */ }

      notify?.({ type: "success", message: "Изменения сохранены" });
      onUpdated(updatedRecord);
      onClose();
    } catch (e: unknown) {
      console.error("[EditEmployee] error:", e);
      const msg = e instanceof Error ? e.message : String(e) || "Не удалось сохранить изменения";
      notify?.({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase open={open} title="Редактирование" onClose={onClose} busy={busy}
      onSubmit={handleSubmit} submitLabel="Сохранить"
      submitDisabled={(phone.trim().length > 0 && phoneError) || !!emailErrorMsg}
    >
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Фото</Typography>
          <ServicePhotoUploader photoFile={null} photoPreview={photoPreview} inputId="emp-edit-photo-input"
            onPickPhoto={f => {
              if (!f) { setPhotoPreview(null); return; }
              const r = new FileReader();
              r.onload = () => setPhotoPreview(String(r.result || ""));
              r.readAsDataURL(f);
            }}
          />
        </Stack>

        {hasRole(['superadmin', 'accountant']) && (
          <>
            <Box sx={{ bgcolor: "action.hover", p: 2, borderRadius: 2, mx: -2, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
              <SalarySettings
                employeeId={record?.id ? String(record.id) : undefined}
                initialValue={salaryRules}
                onChange={val => setSalaryRules(val)}
              />
            </Box>
            <Divider />
          </>
        )}

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>ФИО *</Typography>
          <TextField value={fullName} onChange={e => setFullName(e.target.value)} required fullWidth />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Псевдоним</Typography>
          <TextField value={nickname} onChange={e => setNickname(e.target.value)} fullWidth />
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
                <InputAdornment position="start" sx={{ mr: 1, ml: '-14px' }}>
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
          <TextField value={telegramId} onChange={e => setTelegramId(e.target.value.replace(/[^0-9]/g, ''))} fullWidth inputProps={{ inputMode: "numeric" }} />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Email</Typography>
          <TextField value={email} onChange={e => setEmail(e.target.value)} fullWidth type="email" error={!!emailErrorMsg} helperText={emailErrorMsg} />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Расчетный счет</Typography>
          <TextField value={bankAccountNumber}
            onChange={e => setBankAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 16))}
            fullWidth
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
            setPassportPhotos(prev => prev.filter(u => u !== url));
            if (!url.startsWith('data:')) setRemovedPassportUrls(prev => [...prev, url]);
          }}
          inputId="emp-edit-passport-input"
        />
      </Stack>
    </DrawerBase>
  );
};

export default EditEmployeeDrawer;

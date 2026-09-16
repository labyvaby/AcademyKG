import React from "react";
import { useTranslation } from "react-i18next";
import { Stack, TextField, InputAdornment, Checkbox, Typography, MenuItem, Box, Divider } from "@mui/material";
import AppAutocomplete from "../../../components/ui/AppAutocomplete";
import { apiFetch } from "../../../utility/apiClient";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
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
  parsePhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneLocalMaxLength,
  type PhoneCountryCode,
} from "../../../utility/phone";
import SalarySettings from "./SalarySettings";
import { usePermissions } from "../../../hooks/usePermissions";
import { PERMISSIONS } from "../../../constants/permissions";
import { isApiError } from "../../../utility/apiClient";
import { useBranchCurrency } from "../../../hooks/useBranchCurrency";

export type EditEmployeeDrawerProps = {
  record: EmployesRow | null;
  onClose: () => void;
  onUpdated: (rec: EmployesRow) => void;
};

type RoleRow = { id: string; name: string; display_name: string };
type BranchRow = { id: string; name: string; organizationId: string };

// Роли загружаются из API — fallback пустой, т.к. id должны быть UUID
const FALLBACK_ROLES: RoleRow[] = [];

const EditEmployeeDrawer: React.FC<EditEmployeeDrawerProps> = ({ record, onClose, onUpdated }) => {
  const { t } = useTranslation();
  const open = Boolean(record);
  const { open: notify } = useNotification();
  const { hasRole, hasPermission } = usePermissions();
  const { suffix: currencySuffix } = useBranchCurrency();

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneCountryCode, setPhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [phoneError, setPhoneError] = React.useState(false);
  const [phoneApiError, setPhoneApiError] = React.useState("");
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
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [passportPhotos, setPassportPhotos] = React.useState<string[]>([]);
  const [passportFiles, setPassportFiles] = React.useState<File[]>([]);
  const [, setRemovedPassportUrls] = React.useState<string[]>([]);
  const [specializationId, setSpecializationId] = React.useState("");
  const [salaryRules, setSalaryRules] = React.useState<any>(null);
  const [services, setServices] = React.useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);
  const [selectedServices, setSelectedServices] = React.useState<ServiceRow[]>([]);
  const [specializations, setSpecializations] = React.useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = React.useState("");
  const [organizationId, setOrganizationId] = React.useState("");
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [allowedBranches, setAllowedBranches] = React.useState<BranchRow[]>([]);

  const selectedRole = roles.find(r => r.id === roleId);
  const isTrainerRole = selectedRole?.name === "specialist";
  // Sensitive-поля (role/branch/status/organization/authUser) бэк гейтит правом
  // employees.manage_sensitive (по умолчанию у superadmin/manager; выдаётся из «Ролей и прав»).
  const canManageSensitive = hasPermission(PERMISSIONS.EMPLOYEES_MANAGE_SENSITIVE);

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
      setPhotoFile(null);
      setPassportPhotos([]); setPassportFiles([]); setRemovedPassportUrls([]);
      setBranchId(""); setOrganizationId(""); setPhoneApiError(""); setAllowedBranches([]);
      return;
    }

    setFullName(record.full_name || "");
    setRoleId((record.role_id && typeof record.role_id === 'string') ? record.role_id : "");
    setStatus(record.status || "active");
    setNickname(record.nickname || "");
    setSalaryRules(null); // loaded from detail response below
    setPhotoPreview(record.photo_url ? String(record.photo_url) : null);
    setPhotoFile(null);
    setPassportPhotos(Array.isArray(record.passport_photos) ? record.passport_photos : []);
    setPassportFiles([]); setRemovedPassportUrls([]);
    setBirthDate(normalizeDateInput(record.birth_date || ""));

    let cancelled = false;
    (async () => {
      try {
        setServicesLoading(true);

        // Этап 1: грузим детали сотрудника и справочники параллельно
        const [specs, apiRoles, empDetailRaw, branchesRes] = await Promise.all([
          employeeFormUtils.fetchSpecializations(),
          fetchRoles(),
          apiFetch(`/api/v1/employees/${record.id}/`),
          apiFetch("/api/v1/branches/").then((r: any) => r?.data?.results ?? r?.results ?? []).catch(() => []),
        ]);
        if (cancelled) return;

        const d = (empDetailRaw as any)?.data ?? empDetailRaw as any;

        // Этап 2: грузим услуги филиала сотрудника (теперь знаем его branchId)
        const empBranchId = d?.branch?.id ?? d?.branchId ?? null;
        const allSrv = await employeeFormUtils.fetchServices(empBranchId ? String(empBranchId) : undefined);
        if (cancelled) return;

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

        // Load salary rules from detail response (camelCase from backend → snake_case for UI)
        if (d?.salaryRules) {
          const sr = d.salaryRules;
          setSalaryRules({
            fixed_salary: {
              enabled: sr.fixedSalary?.enabled ?? false,
              monthly_rate: Number(sr.fixedSalary?.monthlyRate ?? 0),
              day_hourly_rate: Number(sr.fixedSalary?.dayHourlyRate ?? 0),
              appointment_rate: Number(sr.fixedSalary?.appointmentRate ?? 0),
            },
            dynamic_rules: Array.isArray(sr.dynamicRules)
              ? sr.dynamicRules.map((r: any) => ({
                  id: Math.random().toString(36).substr(2, 9),
                  services: Array.isArray(r.services) ? r.services : [],
                  percent: Number(r.percent ?? 0),
                  fixed_amount: Number(r.fixedAmount ?? 0),
                }))
              : [],
          });
        }

        const allSrvUniq = Array.from(new Map((allSrv || []).map(s => [String(s.id), s])).values());
        setSpecializations(specs);
        setRoles(apiRoles.length > 0 ? apiRoles : FALLBACK_ROLES);
        setBranches(branchesRes.map((b: any) => ({
          id: String(b.id ?? b.uuid ?? ""),
          name: b.name ?? b.displayName ?? "",
          organizationId: String(b.organization?.id ?? b.organizationId ?? b.organization ?? ""),
        })));
        // Подставляем текущий филиал сотрудника
        const currentBranchId = d?.branch?.id ?? d?.branchId ?? "";
        if (currentBranchId) setBranchId(String(currentBranchId));
        setOrganizationId(String(d?.organization?.id ?? d?.organizationId ?? d?.organization ?? ""));

        // Доступные филиалы
        const mappedBranches: BranchRow[] = branchesRes.map((b: any) => ({
          id: String(b.id ?? b.uuid ?? ""),
          name: b.name ?? b.displayName ?? "",
          organizationId: String(b.organization?.id ?? b.organizationId ?? b.organization ?? ""),
        }));
        const branchById = new Map(mappedBranches.map(b => [b.id, b]));
        const rawAllowed: any[] = Array.isArray(d?.allowedBranches) ? d.allowedBranches : [];
        setAllowedBranches(
          rawAllowed
            .map((b: any) => branchById.get(String(b?.id ?? b)))
            .filter((b): b is BranchRow => Boolean(b))
        );

        // Специализации
        const specList: any[] = Array.isArray(d?.specializations) ? d.specializations : [];
        if (specList.length > 0) setSpecializationId(String(specList[0]?.id ?? specList[0]));

        // Услуги из detail
        const empServices: any[] = Array.isArray(d?.services) ? d.services : [];

        // Нормализуем id услуги из разных форматов ответа бэкенда:
        // строка-uuid, { id }, { sellableItem }, { sellable_item }
        const empServiceIds = empServices.map((s: any) =>
          typeof s === 'string' ? s : String(s?.sellableItem ?? s?.sellable_item ?? s?.id ?? "")
        ).filter(Boolean);

        const allSrvMap = new Map(allSrvUniq.map(s => [String(s.id), s]));

        // detailServices: только те у которых есть имя (бэк иногда возвращает объект с name)
        const detailServices = empServices
          .map((s: any): ServiceRow | null => {
            const id = String(s?.sellableItem ?? s?.sellable_item ?? s?.id ?? "");
            if (!id) return null;
            // Предпочитаем данные из allSrvUniq — там гарантировано есть name
            if (allSrvMap.has(id)) return allSrvMap.get(id)!;
            const name = s?.name ?? s?.displayName ?? "";
            if (!name) return null;
            return { id, name, price: s?.priceSom ?? s?.price ?? undefined };
          })
          .filter((s): s is ServiceRow => s !== null);

        const mergedServices = Array.from(
          new Map(
            [...allSrvUniq, ...detailServices].map((service) => [String(service.id), service])
          ).values()
        );
        setServices(mergedServices);
        if (empServiceIds.length > 0) {
          const mergedMap = new Map(mergedServices.map(s => [String(s.id), s]));
          setSelectedServices(empServiceIds.map(id => mergedMap.get(id)).filter((s): s is ServiceRow => Boolean(s)));
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setServicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
     
  }, [record]);

  React.useEffect(() => {
    if (!email.trim()) { setEmailErrorMsg(""); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setEmailErrorMsg(t("employees.invalidEmailFormat"));
    else setEmailErrorMsg("");
  }, [email, t]);

  const handleSubmit = async () => {
    if (!record) return;
    const fullNameTrim = fullName.trim();
    if (!fullNameTrim) { notify?.({ type: "error", message: t("employees.enterFullName") }); return; }
    const maxLen = getPhoneLocalMaxLength(phoneCountryCode);
    if (phone.trim().length > 0 && phone.trim().length !== maxLen) { setPhoneError(true); return; }
    if (emailErrorMsg) return;
    if (!branchId) { notify?.({ type: "error", message: t("employees.selectBranch") }); return; }
    if (!roleId) { notify?.({ type: "error", message: t("employees.selectRole") }); return; }
    if (!organizationId) { notify?.({ type: "error", message: t("employees.organizationNotFound") }); return; }
    if (isTrainerRole && !specializationId) {
      notify?.({ type: "error", message: t("employees.selectSpecialization") }); return;
    }

    try {
      setBusy(true);
      const fullPhone = composePhone(phoneCountryCode, phone);

      // Непривилегированные пользователи (specialist, receptionist) не должны
      // отправлять sensitive-поля: role, status, organization, branch, authUser.
      // Эти поля отправляем только если есть право на управление настройками.
      const payload: Record<string, unknown> = {
        fullName: fullNameTrim || undefined,
      };

      if (canManageSensitive) {
        payload.status = status;
        payload.organization = organizationId;
        payload.branch = branchId;
        payload.role = roleId || undefined;
      }

      if (fullPhone) payload.userPhoneNumber = fullPhone;
      if (email.trim()) payload.userEmail = email.trim();
      if (birthDate) payload.birthDate = birthDate;
      if (telegramId.trim()) payload.telegramId = telegramId.trim();
      if (bankAccountNumber.trim()) payload.bankAccountNumber = bankAccountNumber.trim();
      if (inn.trim()) payload.inn = inn.trim();
      if (nickname.trim()) payload.nickname = nickname.trim();
      if (photoFile) payload.photoUrl = photoFile;

      // Специализации и услуги привязываются только тренерам.
      if (isTrainerRole && specializationId) {
        payload.specializationIds = [specializationId];
      } else if (canManageSensitive) {
        payload.specializationIds = [];
      }

      // Для нетренерских ролей связи по услугам должны быть очищены.
      payload.serviceIds = isTrainerRole ? selectedServices.map(s => s.id) : [];

      // Зарплатные правила — конвертируем snake_case UI → camelCase API
      if (salaryRules !== null) {
        payload.salaryRules = {
          fixedSalary: {
            enabled: salaryRules.fixed_salary?.enabled ?? false,
            monthlyRate: String(salaryRules.fixed_salary?.monthly_rate ?? 0),
            dayHourlyRate: String(salaryRules.fixed_salary?.day_hourly_rate ?? 0),
            appointmentRate: String(salaryRules.fixed_salary?.appointment_rate ?? 0),
          },
          dynamicRules: Array.isArray(salaryRules.dynamic_rules)
            ? salaryRules.dynamic_rules.map((r: any) => ({
                services: Array.isArray(r.services) ? r.services : [],
                percent: String(r.percent ?? 0),
                fixedAmount: String(r.fixed_amount ?? 0),
              }))
            : [],
        };
      }

      await employeeFormUtils.updateEmployeeApi(String(record.id), payload);

      // Обновляем доступные филиалы отдельным PATCH.
      // Эндпоинт переназначает branch → бэк требует employees.manage_sensitive;
      // без права PATCH вернёт 403 и завалит весь сейв, поэтому гейтим.
      if (canManageSensitive) {
        await apiFetch(`/api/v1/employees/${record.id}/allowed-branches/`, {
          method: "PATCH",
          body: JSON.stringify({
            allowedBranches: allowedBranches.map(b => b.id),
          }),
        });
      }

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
            updated_at: d.updatedAt ?? d.updated_at ?? new Date().toISOString(),
          } as unknown as EmployesRow;
        }
      } catch { /* используем старые данные */ }

      notify?.({ type: "success", message: t("employees.changesSaved") });
      onUpdated(updatedRecord);
      onClose();
    } catch (e: unknown) {
      console.error("[EditEmployee] error:", e);
      if (isApiError(e) && e.fieldErrors) {
        const phoneField = e.fieldErrors["userPhoneNumber"] ?? e.fieldErrors["user_phone_number"];
        if (phoneField) {
          setPhoneApiError(phoneField);
          return;
        }
        const firstField = Object.values(e.fieldErrors)[0];
        if (firstField) {
          notify?.({ type: "error", message: firstField });
          return;
        }
      }
      const msg = e instanceof Error ? employeeFormUtils.translateAuthError(e) : String(e) || t("employees.saveChangesError");
      notify?.({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase open={open} title={t("employees.editTitle")} onClose={onClose} busy={busy}
      onSubmit={handleSubmit} submitLabel={t("common.save")}
      submitDisabled={(phone.trim().length > 0 && phoneError) || !!emailErrorMsg}
    >
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.photo")}</Typography>
          <ServicePhotoUploader photoFile={null} photoPreview={photoPreview} inputId="emp-edit-photo-input"
            onPickPhoto={f => {
              setPhotoFile(f);
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
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.fullNameRequired")}</Typography>
          <TextField value={fullName} onChange={e => setFullName(e.target.value)} required fullWidth />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.nickname")}</Typography>
          <TextField value={nickname} onChange={e => setNickname(e.target.value)} fullWidth />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.phone")}</Typography>
          <TextField
            value={phone} placeholder="XXX XXX XXX"
            onChange={e => {
              const maxLen = getPhoneLocalMaxLength(phoneCountryCode);
              const v = e.target.value.replace(/[^\d]/g, "").slice(0, maxLen);
              setPhone(v); setPhoneError(v.length > 0 && v.length !== maxLen);
              if (phoneApiError) setPhoneApiError("");
            }}
            error={(phone.trim().length > 0 && phoneError) || !!phoneApiError}
            helperText={
              phoneApiError
                ? phoneApiError
                : phone.trim().length > 0 && phoneError
                  ? t("employees.enterDigitsCount", { count: getPhoneLocalMaxLength(phoneCountryCode) })
                  : ""
            }
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
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.roleRequired")}</Typography>
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
            disabled={!canManageSensitive}
            helperText={canManageSensitive ? "" : t("employees.roleChangeAdminOnly")}
          >
            {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.display_name || r.name}</MenuItem>)}
          </TextField>
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.branchRequired")}</Typography>
          <TextField
            select
            value={branchId}
            onChange={e => {
              const nextBranchId = e.target.value;
              setBranchId(nextBranchId);
              const branch = branches.find((b) => b.id === nextBranchId);
              setOrganizationId(branch?.organizationId ?? organizationId);
            }}
            fullWidth
            required
          >
            {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.allowedBranches")}</Typography>
          <AppAutocomplete
            multiple
            options={branches.filter(b => b.id !== branchId)}
            value={allowedBranches}
            getOptionLabel={b => b.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_, v) => setAllowedBranches(v as BranchRow[])}
            renderOption={(props, option, { selected }) => {
              const { key, ...optionProps } = props;
              return (
                <li key={key} {...optionProps}>
                  <Checkbox icon={<CheckBoxOutlineBlankIcon fontSize="small" />} checkedIcon={<CheckBoxIcon fontSize="small" />} style={{ marginRight: 8 }} checked={selected} />
                  {option.name}
                </li>
              );
            }}
            renderInput={params => <TextField {...params} placeholder={t("employees.selectAdditionalBranches")} />}
          />
          <Typography variant="caption" color="text.disabled">
            {t("employees.allowedBranchesHint")}
          </Typography>
        </Stack>

        {isTrainerRole && (
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.specializationRequired")}</Typography>
            <TextField select value={specializationId} onChange={e => setSpecializationId(e.target.value)} fullWidth required>
              {specializations.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Stack>
        )}

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.birthDate")}</Typography>
          <CustomDatePicker value={birthDate ? dayjs(birthDate) : null}
            onChange={val => setBirthDate(val ? val.format('YYYY-MM-DD') : '')}
            slotProps={{ textField: { fullWidth: true, placeholder: t("common.dateFormatPlaceholder") } }}
          />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.status")}</Typography>
          <TextField select value={status} onChange={e => setStatus(e.target.value)} fullWidth>
            <MenuItem value="active">{t("employees.statusWorking")}</MenuItem>
            <MenuItem value="inactive">{t("employees.statusNotWorking")}</MenuItem>
          </TextField>
        </Stack>

        {isTrainerRole && (
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.services")}</Typography>
            <AppAutocomplete multiple limitTags={2} loading={servicesLoading} options={services}
              value={selectedServices} disableCloseOnSelect
              getOptionLabel={o => typeof o.price === 'number' ? `${o.name} (${o.price} ${currencySuffix})` : o.name || ''}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_, v) => setSelectedServices(v)}
              renderOption={(props, option, { selected }) => {
                const { key, ...optionProps } = props;
                return (
                  <li key={key} {...optionProps}>
                    <Checkbox icon={<CheckBoxOutlineBlankIcon fontSize="small" />} checkedIcon={<CheckBoxIcon fontSize="small" />} style={{ marginRight: 8 }} checked={selected} />
                    {option.name} {typeof option.price === 'number' ? `(${option.price} ${currencySuffix})` : ""}
                  </li>
                );
              }}
              renderInput={params => <TextField {...params} placeholder={t("employees.selectServices")} />}
            />
          </Stack>
        )}

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Telegram ID</Typography>
          <TextField value={telegramId} onChange={e => setTelegramId(e.target.value.replace(/[^0-9]/g, ''))} fullWidth inputProps={{ inputMode: "numeric" }} />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Email</Typography>
          <TextField value={email} onChange={e => setEmail(e.target.value)} fullWidth type="email" error={!!emailErrorMsg} helperText={emailErrorMsg} />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.accountNumber")}</Typography>
          <TextField value={bankAccountNumber}
            onChange={e => setBankAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 16))}
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><CreditCardOutlined fontSize="small" /></InputAdornment> }}
            helperText={`${bankAccountNumber.length}/16`}
          />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("employees.inn")}</Typography>
          <TextField value={inn}
            onChange={e => setInn(e.target.value.replace(/[^0-9]/g, '').slice(0, 14))}
            fullWidth placeholder={t("employees.enterInn")}
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

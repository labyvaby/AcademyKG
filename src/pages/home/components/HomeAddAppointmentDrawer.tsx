import React from "react";
import { CustomDatePicker } from "../../../components/ui";
import { useNotification } from "@refinedev/core";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
// DeleteOutlined removed — single service row, no delete needed
import dayjs from "dayjs";
import "dayjs/locale/ru";

import { CustomDateTimePicker } from "../../../components/ui";
import { useDictionaries } from "../../../hooks/useDictionaries";
import AddPatientDrawer from "../../../components/patients/AddPatientDrawer";
import AddServiceDrawer from "../../../components/services/AddServiceDrawer";
import { apiFetch, getBranchFilter } from "../../../utility/apiClient";
import { roundDateTimeLocalToStep } from "../../../utility/time";
import { type ServiceRow } from "../../../services/services";
import type { EmployeesRow } from "../../expenses/types";
import type { PatientOption, ServiceRowEntry } from "../types";
import { usePermissions } from "../../../hooks/usePermissions";
import { PERMISSIONS } from "../../../constants/permissions";
import { isOwnOnlySpecialist } from "../../../utils/permissionHelpers";

import { createGroup } from "../../../features/group-appointments/api/group-appointments.api";
import { clientScheduleApi } from "../../../features/client-schedule/api/client-schedule.api";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";

export const noSpinnersSx = {
  "& input[type=number]": {
    MozAppearance: "textfield",
  },
  "& input[type=number]::-webkit-outer-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
  "& input[type=number]::-webkit-inner-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
};

type HomeAddAppointmentDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Колбэк вызывается после успешного сохранения приёма */
  onCreated?: () => void;
  /** ID клиента для предзаполнения */
  initialPatientId?: string | null;
  /** Дата и время для предзаполнения (например, из слота расписания) */
  initialDate?: string | null;
  /** ID сотрудника для предзаполнения (из слота расписания) */
  initialDoctorId?: string | null;
  /** Текущая выбранная дата в календаре (админка) */
  selectedDate?: string | null;
};

function resolvePatientPhone(r: any): string {
  const direct = r.phone ?? r.contactPhone ?? r["Телефон"] ?? "";
  if (direct) return direct;
  const persons = r.responsiblePersons ?? r.responsible_persons;
  if (Array.isArray(persons) && persons.length > 0) {
    return persons[0]?.phone ?? "";
  }
  return "";
}

const patientFilter = createFilterOptions<PatientOption>({
  matchFrom: "start",
  stringify: (option: PatientOption) => {
    const fio = option?.["ФИО клиента"] ?? option?.fio ?? "";
    const phone = option?.["Телефон"] ?? option?.phone ?? "";
    return [fio, phone].filter(Boolean).join(" ");
  },
  ignoreAccents: true,
  ignoreCase: true,
  trim: true,
});

// ... (existing filters)



export const HomeAddAppointmentDrawer: React.FC<
  HomeAddAppointmentDrawerProps
> = ({ open, onClose, onCreated, initialPatientId, initialDate, initialDoctorId, selectedDate }) => {
  const { open: notify } = useNotification();

  const [visitDateTime, setVisitDateTime] = React.useState<string>("");

  const [patientsOpts, setPatientsOpts] = React.useState<PatientOption[]>([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [doctorsOpts, setDoctorsOpts] = React.useState<EmployeesRow[]>([]);
  const [allDoctorsOpts, setAllDoctorsOpts] = React.useState<EmployeesRow[]>([]);
  const [doctorsLoading, setDoctorsLoading] = React.useState(false);
  const [servicesOpts, setServicesOpts] = React.useState<ServiceRow[]>([]);
  const [allServicesOpts, setAllServicesOpts] = React.useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);
  // Per-employee services cache: employeeId -> ServiceRow[]
  const [employeeServicesCache, setEmployeeServicesCache] = React.useState<Record<string, ServiceRow[]>>({});
  // Обратный маппинг: serviceId -> Set<employeeId> (строится в фоне)
  const serviceToEmployeesRef = React.useRef<Record<string, Set<string>>>({});

  const { hasPermission, employeeId } = usePermissions();
  const isWorkplaceNurse = isOwnOnlySpecialist(hasPermission);
  const canReception = hasPermission(PERMISSIONS.RECEPTION_READ);

  const [selectedPatient, setSelectedPatient] =
    React.useState<PatientOption | null>(null);
  const [serviceRows, setServiceRows] = React.useState<ServiceRowEntry[]>([
    { serviceId: "", doctorId: "", quantity: 1 },
  ]);


  const [adminComment, setAdminComment] = React.useState("");

  const [isBooking, setIsBooking] = React.useState(false);

  // Режим: "single" — обычный приём, "group" — групповой
  const [appointmentMode, setAppointmentMode] = React.useState<"single" | "group">("single");
  // Подрежим: "once" — разовый, "period" — на период (несколько дат)
  const [scheduleMode, setScheduleMode] = React.useState<"once" | "period">("once");
  // Состояние для режима "На период"
  const [periodWeekdays, setPeriodWeekdays] = React.useState<string[]>([]);
  const [periodStartDate, setPeriodStartDate] = React.useState(dayjs().format("YYYY-MM-DD"));
  const [periodEndDate, setPeriodEndDate] = React.useState("");

  const WEEKDAYS = [
    { label: "ПН", value: "monday", dayOfWeek: 1 },
    { label: "ВТ", value: "tuesday", dayOfWeek: 2 },
    { label: "СР", value: "wednesday", dayOfWeek: 3 },
    { label: "ЧТ", value: "thursday", dayOfWeek: 4 },
    { label: "ПТ", value: "friday", dayOfWeek: 5 },
    { label: "СБ", value: "saturday", dayOfWeek: 6 },
    { label: "ВС", value: "sunday", dayOfWeek: 0 },
  ];

  const periodDates = React.useMemo(() => {
    if (periodWeekdays.length === 0 || !periodStartDate || !periodEndDate) return [];
    const dates: string[] = [];
    let cur = dayjs(periodStartDate);
    const end = dayjs(periodEndDate);
    while ((cur.isBefore(end) || cur.isSame(end, "day")) && dates.length < 60) {
      const isSelected = periodWeekdays.some(
        (wd) => WEEKDAYS.find((w) => w.value === wd)?.dayOfWeek === cur.day()
      );
      if (isSelected) dates.push(cur.format("YYYY-MM-DD"));
      cur = cur.add(1, "day");
    }
    return dates;
  }, [periodWeekdays, periodStartDate, periodEndDate]);
  const [groupParticipants, setGroupParticipants] = React.useState<PatientOption[]>([]);
  const [groupPatientInput, setGroupPatientInput] = React.useState<PatientOption | null>(null);
  const [groupPatientSearch, setGroupPatientSearch] = React.useState("");
  const [groupPatientResults, setGroupPatientResults] = React.useState<PatientOption[]>([]);
  const [groupPatientLoading, setGroupPatientLoading] = React.useState(false);

  const [discount, setDiscount] = React.useState<number | "">("");
  const [cash, setCash] = React.useState<number | "">("");
  const [cashless, setCashless] = React.useState<number | "">("");

  // Вычисляем итоговую сумму для валидации оплаты

  const discountAmount = typeof discount === "number" ? discount : 0;
  // Итоговая сумма считается на лету при рендере и отдельно в payload,
  // поэтому отдельный стейт под неё не держим.

  const [isSaving, setIsSaving] = React.useState(false);
  const isSavingRef = React.useRef(false);
  const dayAppointmentsCacheRef = React.useRef<Record<string, any[]>>({});
  const [touched, setTouched] = React.useState(false);

  const [isPatientDrawerOpen, setIsPatientDrawerOpen] = React.useState(false);
  const [isServiceDrawerOpen, setIsServiceDrawerOpen] = React.useState(false);

  // СЕРВЕРНЫЙ ПОИСК ПАЦИЕНТОВ
  const [patientSearchInput, setPatientSearchInput] = React.useState("");
  const [patientsSearchResults, setPatientsSearchResults] = React.useState<PatientOption[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = React.useState(false);

  const fetchPatientsServerSide = React.useCallback(async (query: string) => {
    setIsSearchingPatients(true);
    try {
      const cleanQ = query.trim();
      const url = cleanQ
        ? `/api/v1/clients/?search=${encodeURIComponent(cleanQ)}&pageSize=50`
        : `/api/v1/clients/?pageSize=50&ordering=fullName`;
      const res: any = await apiFetch(url);
      const data: any[] = res?.data?.results ?? res?.results ?? [];

      const mapped = data.map((r: any) => {
        const fio = r.fullName ?? r.full_name ?? r["ФИО клиента"] ?? "";
        const phone = resolvePatientPhone(r);
        return {
          id: String(r.id ?? ""),
          fio,
          phone,
          "ФИО клиента": fio,
          "Телефон": phone,
          label: `${fio} — ${phone}`
        };
      }).filter((p: any) => p.id);
      setPatientsSearchResults(mapped as PatientOption[]);
    } catch (err) {
      console.error("Error searching patients:", err);
    } finally {
      setIsSearchingPatients(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatientsServerSide(patientSearchInput || "");
    }, 400);

    return () => clearTimeout(timer);
  }, [patientSearchInput, fetchPatientsServerSide]);

  // Поиск для группового режима
  const fetchGroupPatients = React.useCallback(async (query: string) => {
    setGroupPatientLoading(true);
    try {
      const url = query
        ? `/api/v1/clients/?search=${encodeURIComponent(query)}&pageSize=30`
        : `/api/v1/clients/?pageSize=30&ordering=fullName`;
      const res: any = await apiFetch(url);
      const data: any[] = res?.data?.results ?? res?.results ?? [];
      setGroupPatientResults(data.map((r: any) => {
        const fio = r.fullName ?? r.full_name ?? "";
        const phone = resolvePatientPhone(r);
        return { id: String(r.id ?? ""), fio, phone, "ФИО клиента": fio, "Телефон": phone, label: `${fio} — ${phone}` };
      }).filter((p: any) => p.id));
    } catch { setGroupPatientResults([]); }
    finally { setGroupPatientLoading(false); }
  }, []);

  React.useEffect(() => {
    if (appointmentMode !== "group") return;
    const t = setTimeout(() => fetchGroupPatients(groupPatientSearch), groupPatientSearch ? 350 : 0);
    return () => clearTimeout(t);
  }, [groupPatientSearch, appointmentMode, fetchGroupPatients]);

  // При открытии дровера — грузим первых клиентов
  React.useEffect(() => {
    if (open) fetchPatientsServerSide("");
  }, [open, fetchPatientsServerSide]);


  // При открытии, если дата/время ещё не заданы — заполняем переданным initialDate или текущим временем
  React.useEffect(() => {
    if (!open) {
      dayAppointmentsCacheRef.current = {};
      setAppointmentMode("single");
      setScheduleMode("once");
      setPeriodWeekdays([]);
      setPeriodStartDate(dayjs().format("YYYY-MM-DD"));
      setPeriodEndDate("");
      setGroupParticipants([]);
      setGroupPatientInput(null);
      setGroupPatientSearch("");
      setGroupPatientResults([]);
      return;
    }

    // Если передан initialDate, используем его (предполагаем, что он точный ISO string, готовый к употреблению)
    if (initialDate) {
      setVisitDateTime(initialDate);
      return;
    }

    // Иначе, если ничего нет, ставим текущее время на выбранную дату
    if (!visitDateTime || (open && !initialDate)) {
      const t = new Date();
      // Если передана выбранная дата из календаря (YYYY-MM-DD), используем её. Иначе текущую.
      let baseDate = selectedDate;
      if (!baseDate) {
        const yyyy = t.getFullYear();
        const mm = String(t.getMonth() + 1).padStart(2, "0");
        const dd = String(t.getDate()).padStart(2, "0");
        baseDate = `${yyyy}-${mm}-${dd}`;
      }

      const hh = String(t.getHours()).padStart(2, "0");
      const mi = String(t.getMinutes()).padStart(2, "0");
      const nowStr = `${baseDate}T${hh}:${mi}`;
      const roundedNow = roundDateTimeLocalToStep(nowStr, 15);
      setVisitDateTime(roundedNow);
    }
  }, [open, initialDate, selectedDate]);

  // Если зашла медсестра — фиксируем её как исполнителя
  React.useEffect(() => {
    if (open && isWorkplaceNurse && employeeId) {
      setServiceRows((prev) =>
        prev.map((row) => ({
          ...row,
          doctorId: row.doctorId || employeeId,
        }))
      );
    }
  }, [open, isWorkplaceNurse, employeeId]);

  // Если передан initialDoctorId — заполняем первую строку услуг
  React.useEffect(() => {
    if (open && initialDoctorId) {
      setServiceRows((prev) => {
        // Если уже есть данные, возможно не стоит перезаписывать, но для "только что открытого" - стоит.
        // Мы считаем, что если есть initialDoctorId, значит мы кликнули на конкретный слот сотрудника.
        return prev.map((row, idx) => (idx === 0 ? { ...row, doctorId: initialDoctorId } : row));
      });
    }
  }, [open, initialDoctorId]);

  // Use cached dictionaries (patients only)
  const {
    patients: dictPatients,
    loading: dictLoading,
  } = useDictionaries(open);

  React.useEffect(() => {
    if (dictPatients.length > 0) setPatientsOpts(dictPatients);
    setPatientsLoading(dictLoading);
  }, [dictPatients, dictLoading]);

  // Load employees by date from employees-by-date endpoint
  const currentDateStr = React.useMemo(() => {
    if (!visitDateTime) return "";
    return dayjs(visitDateTime).format("YYYY-MM-DD");
  }, [visitDateTime]);

  const prevDateRef = React.useRef("");
  React.useEffect(() => {
    if (!open || !currentDateStr) return;
    if (currentDateStr === prevDateRef.current) return;
    prevDateRef.current = currentDateStr;
    // Clear employee/service selections when date changes
    setServiceRows(prev => prev.map(r => ({ ...r, doctorId: "", serviceId: "" })));
    setEmployeeServicesCache({});
    setServicesOpts(allServicesOpts); // Восстанавливаем все услуги при смене даты

    let cancelled = false;
    setDoctorsLoading(true);
    const mapEmps = (results: any[]): EmployeesRow[] =>
      results.map((e: any) => ({
        id: String(e.id ?? ""),
        full_name: e.fullName ?? e.full_name ?? "",
        specialization: e.specialization?.name ?? e.specializationName ?? "",
        role: e.role?.name ?? e.roleName ?? "",
        status: e.status ?? "active",
        serviceIds: e.serviceIds ?? [],
      } as unknown as EmployeesRow));

    apiFetch(`/api/v1/employees/?status=active&pageSize=200`)
      .then((res: any) => {
        if (cancelled) return;
        const results: any[] = res?.data?.results ?? res?.results ?? [];
        const emps = mapEmps(results).filter(e => e.role === "Специалист (тренер)");
        setDoctorsOpts(emps);
        setAllDoctorsOpts(emps);
        buildServiceToEmployeesMap(emps);
      })
      .catch(() => {
        if (!cancelled) { setDoctorsOpts([]); setAllDoctorsOpts([]); }
      })
      .finally(() => { if (!cancelled) setDoctorsLoading(false); });
    return () => { cancelled = true; };
  }, [open, currentDateStr]);

  // Загружаем все услуги при первом открытии (для выбора услуги без тренера)
  React.useEffect(() => {
    if (!open || allServicesOpts.length > 0) return;
    setServicesLoading(true);
    apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&pageSize=200`)
      .then((res: any) => {
        const results: any[] = res?.data?.results ?? res?.results ?? [];
        const mapped = results.map((item: any) => ({
          id: item.id,
          name: item.displayName ?? item.service?.name ?? item.name ?? "",
          price: item.displayPrice ? parseFloat(item.displayPrice) : (item.service?.price ? parseFloat(item.service.price) : undefined),
          is_active: item.isActive ?? true,
          employee_ids: item.employeeIds ?? item.employee_ids ?? [],
        } as ServiceRow)).filter((s: ServiceRow) => s.id && s.name);
        setAllServicesOpts(mapped);
        // Показываем все услуги пока тренер не выбран
        if (!serviceRows[0]?.doctorId) setServicesOpts(mapped);
      })
      .catch(() => {})
      .finally(() => setServicesLoading(false));
  }, [open]);

  // Строим обратный маппинг serviceId → Set<employeeId> для всех тренеров в фоне
  const buildServiceToEmployeesMap = React.useCallback(async (emps: EmployeesRow[]) => {
    const map: Record<string, Set<string>> = {};
    await Promise.all(emps.map(async (emp) => {
      try {
        const res: any = await apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&employee=${emp.id}&pageSize=200`);
        const results: any[] = res?.data?.results ?? res?.results ?? [];
        results.forEach((item: any) => {
          if (!item.id) return;
          if (!map[item.id]) map[item.id] = new Set();
          map[item.id].add(emp.id);
        });
        // Также кэшируем услуги сотрудника
        setEmployeeServicesCache(prev => ({
          ...prev,
          [emp.id]: results.map((item: any) => ({
            id: item.id,
            name: item.displayName ?? item.service?.name ?? item.name ?? "",
            price: item.displayPrice ? parseFloat(item.displayPrice) : undefined,
            is_active: item.isActive ?? true,
          } as ServiceRow)).filter((s: ServiceRow) => s.id && s.name),
        }));
      } catch { /* ignore */ }
    }));
    serviceToEmployeesRef.current = map;
  }, []);

  // Load services per employee when employee changes in a service row
  const loadServicesForEmployee = React.useCallback(async (employeeId: string): Promise<ServiceRow[]> => {
    if (!employeeId) return [];
    try {
      const res: any = await apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&employee=${employeeId}&pageSize=200`);
      const results: any[] = res?.data?.results ?? res?.results ?? [];
      return results.map((item: any) => ({
        id: item.id,
        name: item.displayName ?? item.service?.name ?? item.name ?? "",
        price: item.displayPrice ? parseFloat(item.displayPrice) : (item.service?.price ? parseFloat(item.service.price) : undefined),
        is_active: item.isActive ?? true,
      } as ServiceRow)).filter((s: ServiceRow) => s.id && s.name);
    } catch {
      return [];
    }
  }, []);

  // Установка начального клиента, если передан initialPatientId
  // Установка начального клиента, если передан initialPatientId
  React.useEffect(() => {
    if (!open || !initialPatientId) return;

    // 1. Попытка найти в уже загруженном списке
    const found = patientsOpts.find((p) => p.id === initialPatientId);
    if (found) {
      setSelectedPatient(found);
      return;
    }

    // 2. Если не нашли, ищем в "результатах поиска" (может мы уже искали)
    const foundInSearch = patientsSearchResults.find(p => p.id === initialPatientId);
    if (foundInSearch) {
      setSelectedPatient(foundInSearch);
      return;
    }

    // 3. Если нигде нет — грузим из базы
    apiFetch(`/api/v1/clients/${initialPatientId}/`).then((res: any) => {
      const data = res?.data ?? res;
      if (data?.id) {
        const fio = data.fullName ?? data.full_name ?? data["ФИО клиента"] ?? "";
        const phone = data.contactPhone ?? data.phone ?? data["Телефон"] ?? "";
        const newOpt: PatientOption = {
          id: String(data.id),
          fio,
          phone,
          "ФИО клиента": fio,
          "Телефон": phone,
          label: `${fio} — ${phone}`
        };
        setPatientsOpts(prev => [...prev, newOpt]);
        setSelectedPatient(newOpt);
      }
    }).catch(() => { /* ignore */ });
  }, [open, initialPatientId, patientsOpts, patientsSearchResults]);

  // Эффект для режима "Бронирования" удален, так как теперь 
  // бронирование разрешает создание приема без указания клиента (null).

  const handleClose = () => {
    dayAppointmentsCacheRef.current = {};
    onClose();
  };

  const normalizeDurationMinutes = React.useCallback((value: unknown, fallback = 30): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }, []);

  const extractServiceDurationMinutes = React.useCallback((serviceLike: any): number => {
    if (!serviceLike || typeof serviceLike !== "object") return 30;
    return normalizeDurationMinutes(
      serviceLike.durationMinutes
      ?? serviceLike.duration_minutes
      ?? serviceLike.duration
      ?? serviceLike.serviceDuration
      ?? serviceLike?.sellableItem?.durationMinutes
      ?? serviceLike?.sellableItem?.duration_minutes
      ?? serviceLike?.service?.durationMinutes
      ?? serviceLike?.service?.duration_minutes
      ?? serviceLike?.service?.duration,
      30
    );
  }, [normalizeDurationMinutes]);

  const loadDayAppointments = React.useCallback(async (date: string): Promise<any[]> => {
    if (dayAppointmentsCacheRef.current[date]) return dayAppointmentsCacheRef.current[date];
    const branchId = getBranchFilter();
    const branchParam = branchId ? `&branch=${branchId}` : "";
    const res: any = await apiFetch(`/api/v1/appointments/?date=${date}&pageSize=500${branchParam}`);
    const list: any[] = res?.data?.results ?? res?.results ?? [];
    dayAppointmentsCacheRef.current[date] = Array.isArray(list) ? list : [];
    return dayAppointmentsCacheRef.current[date];
  }, []);

  const getIntervalsFromAppointment = React.useCallback((appt: any): Array<{ performerId: string; start: dayjs.Dayjs; end: dayjs.Dayjs }> => {
    const rawStart = appt?.appointmentAt ?? appt?.appointment_at;
    if (!rawStart) return [];
    const start = dayjs(rawStart);
    if (!start.isValid()) return [];
    const fallbackDuration = normalizeDurationMinutes(appt?.duration, 30);
    const servicesRaw = appt?.services ?? appt?.services_json ?? appt?.servicesJson;
    let services: any[] = [];
    if (Array.isArray(servicesRaw)) services = servicesRaw;
    else if (typeof servicesRaw === "string") {
      try { services = JSON.parse(servicesRaw); } catch { services = []; }
    }
    if (services.length > 0) {
      return services
        .map((s) => {
          const performerId = String(
            s?.performer?.id
            ?? s?.performer
            ?? s?.performer_id
            ?? s?.doctor_id
            ?? appt?.doctorId
            ?? appt?.doctor_id
            ?? ""
          );
          if (!performerId) return null;
          // AppointmentListSellableItemNested не содержит durationMinutes,
          // поэтому ищем реальную длительность в кэше всех услуг по sellableItem.id
          const sellableItemId = s?.sellableItem?.id ?? s?.sellableItem ?? s?.sellable_item;
          const knownService = sellableItemId
            ? allServicesOpts.find((sv) => sv.id === String(sellableItemId))
            : null;
          const duration = (knownService ? extractServiceDurationMinutes(knownService) : 0)
            || extractServiceDurationMinutes(s)
            || fallbackDuration;
          return { performerId, start, end: start.add(duration, "minute") };
        })
        .filter((x): x is { performerId: string; start: dayjs.Dayjs; end: dayjs.Dayjs } => Boolean(x));
    }
    const fallbackPerformer = String(appt?.doctorId ?? appt?.doctor_id ?? "");
    if (!fallbackPerformer) return [];
    return [{ performerId: fallbackPerformer, start, end: start.add(fallbackDuration, "minute") }];
  }, [allServicesOpts, extractServiceDurationMinutes, normalizeDurationMinutes]);

  const findConflictForRows = React.useCallback(async (
    date: string,
    timeStr: string,
    rows: Array<{ doctorId: string; durationMinutes: number }>,
    excludeAppointmentId?: string
  ): Promise<{ doctorId: string; start: string; end: string } | null> => {
    const appts = await loadDayAppointments(date);
    const existingIntervals = appts
      .filter((a: any) => String(a?.id ?? "") !== String(excludeAppointmentId ?? ""))
      .flatMap((a: any) => getIntervalsFromAppointment(a));

    for (const row of rows) {
      if (!row.doctorId) continue;
      const start = dayjs(`${date}T${timeStr}:00`);
      const end = start.add(normalizeDurationMinutes(row.durationMinutes, 30), "minute");
      const conflict = existingIntervals.find((it) =>
        it.performerId === row.doctorId &&
        start.isBefore(it.end) &&
        it.start.isBefore(end)
      );
      if (conflict) {
        return {
          doctorId: row.doctorId,
          start: conflict.start.format("HH:mm"),
          end: conflict.end.format("HH:mm"),
        };
      }
    }
    return null;
  }, [getIntervalsFromAppointment, loadDayAppointments, normalizeDurationMinutes]);

  const handleSave = async () => {
    // ОПТИМИЗАЦИЯ: Удалены console.log для улучшения производительности
    if (isSaving || isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;

    setTouched(true);
    const now = dayjs();
    const yesterday = now.subtract(1, "day").startOf("day");
    if (scheduleMode === "once") {
      const chosen = visitDateTime ? dayjs(visitDateTime) : null;
      if (!chosen || !chosen.isValid() || chosen.isBefore(yesterday)) {
        notify?.({
          type: "error",
          message: "Нельзя создавать приём раньше вчерашнего дня",
          description: "Выберите вчерашнюю, текущую или будущую дату и время.",
        });
        isSavingRef.current = false;
        return;
      }
    }

    try {
      setIsSaving(true);

      // ── РЕЖИМ "НА ПЕРИОД" ────────────────────────────────────────
      if (scheduleMode === "period") {
        if (periodDates.length === 0 || (!selectedPatient && !isBooking)) {
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }

        const validServiceRows = serviceRows.filter((r) => r.serviceId && r.doctorId);
        if (validServiceRows.length === 0) {
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }

        const baseTime = visitDateTime ? dayjs(visitDateTime) : dayjs().hour(9).minute(0).second(0);
        const timeStr = baseTime.format("HH:mm");
        const hasPastDate = periodDates.some((date) => dayjs(`${date}T${timeStr}:00`).isBefore(yesterday));
        if (hasPastDate) {
          notify?.({
            type: "error",
            message: "Нельзя создавать приём раньше вчерашнего дня",
            description: "Уберите даты раньше вчерашнего из периода и попробуйте снова.",
          });
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }
        const rowsForConflictCheck = validServiceRows.map((row) => {
          const employeeServices = employeeServicesCache[row.doctorId] ?? [];
          const svc = employeeServices.find((s) => s.id === row.serviceId)
            ?? allServicesOpts.find((s) => s.id === row.serviceId)
            ?? servicesOpts.find((s) => s.id === row.serviceId);
          return {
            doctorId: row.doctorId,
            durationMinutes: extractServiceDurationMinutes(svc),
          };
        });

        for (const date of periodDates) {
          // Сбрасываем кэш перед проверкой каждой даты
          delete dayAppointmentsCacheRef.current[date];
          const conflict = await findConflictForRows(date, timeStr, rowsForConflictCheck);
          if (conflict) {
            const docName = doctorsOpts.find((d) => d.id === conflict.doctorId)?.full_name
              ?? allDoctorsOpts.find((d) => d.id === conflict.doctorId)?.full_name
              ?? "специалист";
            notify?.({
              type: "error",
              message: "Конфликт расписания",
              description: `${docName} уже занят в интервале ${conflict.start}-${conflict.end} (${date}). Выберите другое время.`,
            });
            setIsSaving(false);
            isSavingRef.current = false;
            return;
          }
        }

        const allServicesPayload = validServiceRows.map((row) => ({
          sellableItem: row.serviceId,
          performer: row.doctorId,
          quantity: 1,
        }));

        const patientId = selectedPatient?.id || null;

        const branchId = getBranchFilter();
        const requests = periodDates.map((date) => {
          const appointmentAt = dayjs(`${date}T${timeStr}:00`).toISOString();
          const payload: any = {
            patient: patientId,
            appointmentAt,
            services: allServicesPayload,
          };
          if (adminComment.trim()) payload.adminComment = adminComment.trim();
          if (branchId) payload.branch = branchId;
          return apiFetch("/api/v1/appointments/", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        });

        const results = await Promise.allSettled(requests);
        const failed = results.filter((result) => result.status === "rejected");
        const succeeded = results.length - failed.length;

        if (succeeded === 0) {
          const firstError = failed[0];
          notify?.({
            type: "error",
            message: "Ошибка при создании приёмов",
            description: firstError?.status === "rejected"
              ? firstError.reason?.message || String(firstError.reason)
              : undefined,
          });
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }

        if (failed.length > 0) {
          const firstError = failed[0];
          notify?.({
            type: "error",
            message: `Создано ${succeeded} из ${results.length} приёмов`,
            description: firstError?.status === "rejected"
              ? firstError.reason?.message || String(firstError.reason)
              : undefined,
          });
        }

        setPeriodWeekdays([]);
        setPeriodStartDate(dayjs().format("YYYY-MM-DD"));
        setPeriodEndDate("");
        setScheduleMode("once");
        setSelectedPatient(null);
        setServiceRows([{ serviceId: "", doctorId: "", quantity: 1 }]);
        setVisitDateTime("");
        setAdminComment("");
        setTouched(false);
        handleClose();
        onCreated?.();
        if (failed.length === 0) {
          notify?.({ type: "success", message: `Создано ${periodDates.length} приёмов!` });
        }
        return;
      }

      // ── ГРУППОВОЙ РЕЖИМ ──────────────────────────────────────────
      if (appointmentMode === "group") {
        const firstRow = serviceRows[0];
        if (!firstRow?.doctorId || !firstRow?.serviceId) {
          notify?.({ type: "error", message: "Выберите тренера и услугу" });
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }
        if (groupParticipants.length === 0) {
          notify?.({ type: "error", message: "Добавьте хотя бы одного участника" });
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }
        const cache = employeeServicesCache[firstRow.doctorId];
        const svc = (cache || servicesOpts).find(s => s.id === firstRow.serviceId);
        const groupDuration = extractServiceDurationMinutes(svc);

        // ── ГРУППОВОЙ НА ПЕРИОД ──────────────────────────────────
        if ((scheduleMode as string) === "period") {
          if (periodDates.length === 0) {
            setIsSaving(false);
            isSavingRef.current = false;
            return;
          }
          const baseTime = visitDateTime ? dayjs(visitDateTime) : dayjs().hour(9).minute(0).second(0);
          const timeStr = baseTime.format("HH:mm");
          for (const date of periodDates) {
            const conflict = await findConflictForRows(date, timeStr, [{ doctorId: firstRow.doctorId, durationMinutes: groupDuration }]);
            if (conflict) {
              const docName = doctorsOpts.find((d) => d.id === firstRow.doctorId)?.full_name
                ?? allDoctorsOpts.find((d) => d.id === firstRow.doctorId)?.full_name
                ?? "специалист";
              notify?.({
                type: "error",
                message: "Конфликт расписания",
                description: `${docName} уже занят в интервале ${conflict.start}-${conflict.end} (${date}). Выберите другое время.`,
              });
              setIsSaving(false);
              isSavingRef.current = false;
              return;
            }
          }
          const results = await Promise.allSettled(
            periodDates.map((date) =>
              createGroup({
                appointmentAt: dayjs(`${date}T${timeStr}:00`).toISOString(),
                performerId: firstRow.doctorId,
                sellableItemId: firstRow.serviceId,
                price: Number(svc?.price ?? 0),
                maxParticipants: (svc as any)?.maxParticipants ?? null,
                patientIds: groupParticipants.map(p => p.id),
                patientNames: groupParticipants.map(p => p.fio ?? p.label ?? ""),
              })
            )
          );
          const failed = results.filter((result) => result.status === "rejected");
          const succeeded = results.length - failed.length;

          if (succeeded === 0) {
            const firstError = failed[0];
            notify?.({
              type: "error",
              message: "Ошибка при создании групповых приёмов",
              description: firstError?.status === "rejected"
                ? firstError.reason?.message || String(firstError.reason)
                : undefined,
            });
            setIsSaving(false);
            isSavingRef.current = false;
            return;
          }

          if (failed.length > 0) {
            const firstError = failed[0];
            notify?.({
              type: "error",
              message: `Создано ${succeeded} из ${results.length} групповых занятий`,
              description: firstError?.status === "rejected"
                ? firstError.reason?.message || String(firstError.reason)
                : undefined,
            });
          }
          setPeriodWeekdays([]);
          setPeriodStartDate(dayjs().format("YYYY-MM-DD"));
          setPeriodEndDate("");
          setScheduleMode("once");
          setGroupParticipants([]);
          setGroupPatientInput(null);
          setServiceRows([{ serviceId: "", doctorId: "", quantity: 1 }]);
          setVisitDateTime("");
          setAdminComment("");
          setTouched(false);
          handleClose();
          onCreated?.();
          if (failed.length === 0) {
            notify?.({ type: "success", message: `Создано ${periodDates.length} групповых занятий!` });
          }
          return;
        }

        // ── ГРУППОВОЙ РАЗОВЫЙ ────────────────────────────────────
        {
          const visitDate = dayjs(visitDateTime);
          const conflict = await findConflictForRows(
            visitDate.format("YYYY-MM-DD"),
            visitDate.format("HH:mm"),
            [{ doctorId: firstRow.doctorId, durationMinutes: groupDuration }]
          );
          if (conflict) {
            const docName = doctorsOpts.find((d) => d.id === firstRow.doctorId)?.full_name
              ?? allDoctorsOpts.find((d) => d.id === firstRow.doctorId)?.full_name
              ?? "специалист";
            notify?.({
              type: "error",
              message: "Конфликт расписания",
              description: `${docName} уже занят в интервале ${conflict.start}-${conflict.end}. Выберите другое время.`,
            });
            setIsSaving(false);
            isSavingRef.current = false;
            return;
          }
        }
        try {
          await createGroup({
            appointmentAt: dayjs(visitDateTime).toISOString(),
            performerId: firstRow.doctorId,
            sellableItemId: firstRow.serviceId,
            price: Number(svc?.price ?? 0),
            maxParticipants: (svc as any)?.maxParticipants ?? null,
            patientIds: groupParticipants.map(p => p.id),
            patientNames: groupParticipants.map(p => p.fio ?? p.label ?? ""),
          });
        } catch (err: any) {
          notify?.({ type: "error", message: "Ошибка при создании группового приёма", description: err?.message });
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }
        setGroupParticipants([]);
        setGroupPatientInput(null);
        setServiceRows([{ serviceId: "", doctorId: "", quantity: 1 }]);
        setVisitDateTime("");
        setAdminComment("");
        setTouched(false);
        handleClose();
        onCreated?.();
        notify?.({ type: "success", message: "Групповой приём создан!" });
        return;
      }

      // ── ОБЫЧНЫЙ РЕЖИМ ────────────────────────────────────────────
      const patientId = selectedPatient?.id || null;

      if (!visitDateTime || (!isBooking && !patientId)) {
        setIsSaving(false);
        isSavingRef.current = false;
        return;
      }

      // Валидация строк услуг (игнорируем полностью пустые строки, если есть хотя бы одна заполненная)
      const validServiceRows = serviceRows.filter(
        (r) => r.serviceId && r.doctorId
      );

      if (validServiceRows.length === 0) {
        setIsSaving(false);
        isSavingRef.current = false;
        return;
      }

      // Build services array per new API spec
      const allServicesPayload: any[] = [];

      for (const row of validServiceRows) {
        allServicesPayload.push({
          sellableItem: row.serviceId,
          performer: row.doctorId,
          quantity: 1,
        });
      }

      const requestPayload: any = {
        patient: patientId,
        appointmentAt: dayjs(visitDateTime).toISOString(),
        services: allServicesPayload,
      };

      if (adminComment.trim()) {
        requestPayload.adminComment = adminComment.trim();
      }
      const singleBranchId = getBranchFilter();
      if (singleBranchId) requestPayload.branch = singleBranchId;
      {
        const visitDate = dayjs(visitDateTime);
        // Сбрасываем кэш перед проверкой — берём актуальные данные с сервера
        delete dayAppointmentsCacheRef.current[visitDate.format("YYYY-MM-DD")];
        const rowsForConflictCheck = validServiceRows.map((row) => {
          const employeeServices = employeeServicesCache[row.doctorId] ?? [];
          const svc = employeeServices.find((s) => s.id === row.serviceId)
            ?? allServicesOpts.find((s) => s.id === row.serviceId)
            ?? servicesOpts.find((s) => s.id === row.serviceId);
          return {
            doctorId: row.doctorId,
            durationMinutes: extractServiceDurationMinutes(svc),
          };
        });
        const conflict = await findConflictForRows(
          visitDate.format("YYYY-MM-DD"),
          visitDate.format("HH:mm"),
          rowsForConflictCheck
        );
        if (conflict) {
          const docName = doctorsOpts.find((d) => d.id === conflict.doctorId)?.full_name
            ?? allDoctorsOpts.find((d) => d.id === conflict.doctorId)?.full_name
            ?? "специалист";
          notify?.({
            type: "error",
            message: "Конфликт расписания",
            description: `${docName} уже занят в интервале ${conflict.start}-${conflict.end}. Выберите другое время.`,
          });
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }
      }

      try {
        await apiFetch("/api/v1/appointments/", {
          method: "POST",
          body: JSON.stringify(requestPayload),
        });
      } catch (err: any) {
        console.error("API Error creating appointment:", err);
        // Сбрасываем кеш дня чтобы следующая попытка загрузила актуальные данные
        const visitDate = dayjs(visitDateTime).format("YYYY-MM-DD");
        delete dayAppointmentsCacheRef.current[visitDate];

        const msg = String(err?.message ?? err ?? "").toLowerCase();
        const isOverlap =
          err?.status === 400 && (
            msg.includes("overlap") || msg.includes("conflict") || msg.includes("занят") ||
            msg.includes("пересека") || msg.includes("already booked") || msg.includes("time slot")
          ) ||
          msg.includes("overlap") || msg.includes("conflict") || msg.includes("занят") || msg.includes("пересека");

        if (isOverlap) {
          // Сбрасываем кэш — конфликт значит данные устарели
          dayAppointmentsCacheRef.current = {};
          notify?.({
            type: "error",
            message: "Конфликт по времени",
            description: "Это время уже занято у выбранного специалиста. Выберите другой слот.",
          });
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }
        notify?.({
          type: "error",
          message: "Ошибка при создании приёма",
          description: err?.message || String(err),
        });
        setIsSaving(false);
        isSavingRef.current = false;
        return;
      }

      // Сброс локального состояния
      setSelectedPatient(null);
      setServiceRows([{ serviceId: "", doctorId: "", quantity: 1 }]);
      setVisitDateTime("");
      setAdminComment("");
      setDiscount("");
      setCash("");
      setCashless("");
      setIsBooking(false);
      setTouched(false);

      handleClose();
      onCreated?.();

      notify?.({
        type: "success",
        message: "Прием успешно создан!",
      });
    } catch (e: unknown) {
       
      console.error(e);
      const err =
        (typeof e === "object" && e && "message" in e
          ? (e as { message?: string }).message
          : undefined) ?? String(e);
      notify?.({
        type: "error",
        message: "Ошибка при сохранении",
        description: err,
      });
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const doctorFilter = createFilterOptions<EmployeesRow>({
    matchFrom: "any",
    stringify: (option) => {
      const name = option.full_name || "";
      const spec = option.specialization || "";
      return `${name} ${spec}`;
    },
    ignoreCase: true,
    trim: true,
  });

  const serviceFilter = createFilterOptions<ServiceRow>({
    matchFrom: "any",
    stringify: (option) => {
      const name = option.name || "";
      const price = option.price ? String(option.price) : "";
      return `${name} ${price}`;
    },
    ignoreCase: true,
    trim: true,
  });

  const selectedDoctorId = serviceRows[0]?.doctorId ?? "";
  const servicesForSelectedDoctor = selectedDoctorId ? employeeServicesCache[selectedDoctorId] : undefined;
  const serviceOptions = servicesForSelectedDoctor ?? servicesOpts;
  const isDoctorServicesEmpty = Boolean(selectedDoctorId) && Array.isArray(servicesForSelectedDoctor) && servicesForSelectedDoctor.length === 0;
  const doctorNoOptionsText = doctorsLoading
    ? "Загрузка тренеров..."
    : "Нет доступных тренеров. Добавьте тренера в разделе сотрудников.";
  const serviceNoOptionsText = servicesLoading
    ? "Загрузка услуг..."
    : isDoctorServicesEmpty
      ? "Для выбранного тренера нет услуг. Добавьте услугу в разделе «Услуги»."
      : "Нет доступных услуг. Добавьте услугу в разделе «Услуги».";
  const serviceHelperText = touched && !serviceRows[0]?.serviceId
    ? "Выберите услугу"
    : isDoctorServicesEmpty
      ? "Для выбранного тренера нет услуг. Добавьте услугу в разделе «Услуги»."
      : "";

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: 390, sm: 480, md: 520 },
            maxWidth: "100vw",
            zIndex: (theme) => theme.zIndex.drawer + 10,
            display: "flex",
            flexDirection: "column",
            overscrollBehavior: "contain",
          },
        }}
        ModalProps={{
          slotProps: {
            backdrop: {
              sx: {
                zIndex: (theme) => theme.zIndex.appBar - 1,
              },
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
          }}
        >
          <Typography variant="h6">Добавить прием</Typography>
          <IconButton onClick={handleClose}>
            <CloseOutlined />
          </IconButton>
        </Box>

        {/* Переключатель режима */}
        <Box sx={{ px: 2, pb: 1.5 }}>
          <ToggleButtonGroup
            value={appointmentMode}
            exclusive
            onChange={(_, v) => { if (v) setAppointmentMode(v); }}
            size="medium"
            fullWidth
            sx={{
              gap: 1,
              '& .MuiToggleButton-root': {
                border: '2px solid',
                borderColor: 'divider',
                borderRadius: '8px !important',
                fontWeight: 600,
                fontSize: '0.9rem',
                py: 1,
                transition: 'all 0.2s',
                color: 'text.secondary',
              },
              '& .MuiToggleButton-root.Mui-selected': {
                borderColor: 'primary.main',
                bgcolor: (theme) => `${theme.palette.primary.main} !important`,
                color: 'primary.contrastText',
                boxShadow: (theme) => `0 4px 12px ${theme.palette.primary.main}55`,
              },
            }}
          >
            <ToggleButton value="single" sx={{ gap: 0.75 }}>
              <PersonOutlined fontSize="small" />
              Обычный
            </ToggleButton>
            <ToggleButton value="group" sx={{ gap: 0.75 }}>
              <GroupsOutlined fontSize="small" />
              Групповой
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Переключатель разовый / на период */}
        <Box sx={{ px: 2, pb: 1.5 }}>
            <ToggleButtonGroup
              value={scheduleMode}
              exclusive
              onChange={(_, v) => { if (v) setScheduleMode(v); }}
              size="small"
              fullWidth
              sx={{
                '& .MuiToggleButton-root': { fontWeight: 500, py: 0.75 },
                '& .MuiToggleButton-root.Mui-selected': {
                  bgcolor: (theme) => `${theme.palette.secondary.main} !important`,
                  color: 'secondary.contrastText',
                },
              }}
            >
              <ToggleButton value="once">Разовый</ToggleButton>
              <ToggleButton value="period" sx={{ gap: 0.5 }}>
                <CalendarMonthOutlined fontSize="small" />
                На период
              </ToggleButton>
            </ToggleButtonGroup>
        </Box>

        <Divider />
        <Box
          sx={{
            p: 2,
            flex: 1,
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          <Stack spacing={2}>
            {scheduleMode === "once" && (
            <CustomDateTimePicker
              label="Дата и время *"
              value={visitDateTime ? dayjs(visitDateTime) : null}
              onChange={(val) => {
                const formatted = val ? val.format() : "";
                setVisitDateTime(formatted);
              }}
              ampm={false}
              minutesStep={15}
              slotProps={{
                textField: {
                  fullWidth: true,
                  InputLabelProps: { shrink: true },
                  sx: { '& .MuiInputBase-root': { fontSize: '1rem', fontWeight: 500 } }
                },
              }}
            />
            )}

            {scheduleMode === "period" && (
              <Stack spacing={1.5}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>Дни недели</Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {WEEKDAYS.map((day) => (
                      <Chip
                        key={day.value}
                        label={day.label}
                        onClick={() => {
                          if (periodWeekdays.length === 0 && periodStartDate && periodEndDate === periodStartDate) {
                            setPeriodEndDate(dayjs(periodStartDate).add(1, "month").format("YYYY-MM-DD"));
                          }
                          setPeriodWeekdays((prev) =>
                            prev.includes(day.value) ? prev.filter((d) => d !== day.value) : [...prev, day.value]
                          );
                        }}
                        color={periodWeekdays.includes(day.value) ? "primary" : "default"}
                        variant={periodWeekdays.includes(day.value) ? "filled" : "outlined"}
                        sx={{ fontWeight: periodWeekdays.includes(day.value) ? 600 : 400, cursor: "pointer" }}
                      />
                    ))}
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Stack spacing={0.5} sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Начало</Typography>
                    <CustomDatePicker
                      value={periodStartDate ? dayjs(periodStartDate) : null}
                      onChange={(val) => {
                        const v = val ? val.format("YYYY-MM-DD") : "";
                        setPeriodStartDate(v);
                        if (!periodEndDate || periodEndDate < v) setPeriodEndDate(v);
                      }}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </Stack>
                  <Stack spacing={0.5} sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Конец</Typography>
                    <CustomDatePicker
                      value={periodEndDate ? dayjs(periodEndDate) : null}
                      onChange={(val) => setPeriodEndDate(val ? val.format("YYYY-MM-DD") : "")}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </Stack>
                </Stack>
                {periodDates.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {periodDates.length} {periodDates.length === 1 ? "день" : periodDates.length < 5 ? "дня" : "дней"}:
                    </Typography>
                    <Box sx={{ mt: 0.5, maxHeight: 120, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 0.5, p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                      {periodDates.map((dateStr) => (
                        <Chip key={dateStr} label={dayjs(dateStr).locale("ru").format("dd D MMM")} size="small" variant="outlined" sx={{ fontSize: 11, height: 22 }} />
                      ))}
                    </Box>
                  </Box>
                )}
              </Stack>
            )}
            {/* ── ТРЕНЕР ── */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Тренер / Исполнитель *
              </Typography>
              <Autocomplete
                fullWidth
                disabled={isWorkplaceNurse}
                options={allDoctorsOpts}
                loading={doctorsLoading}
                noOptionsText={doctorNoOptionsText}
                value={allDoctorsOpts.find((d) => d.id === serviceRows[0]?.doctorId) || null}
                onChange={(_, v) => {
                  const updated = [...serviceRows];
                  // Не сбрасываем serviceId при смене тренера — пусть фильтруется
                  updated[0] = { ...updated[0], doctorId: v?.id || "" };
                  setServiceRows(updated);
                  if (v?.id) {
                    if (!employeeServicesCache[v.id]) {
                      setServicesLoading(true);
                      loadServicesForEmployee(v.id).then(srvs => {
                        setEmployeeServicesCache(prev => ({ ...prev, [v.id]: srvs }));
                        setServicesLoading(false);
                      });
                    }
                  } else {
                    // Тренер сброшен — показываем все услуги обратно
                    setServicesOpts(allServicesOpts);
                  }
                }}
                getOptionLabel={(o) => `${o.full_name || o.id}${o.specialization ? ` — ${o.specialization}` : ""}`}
                filterOptions={doctorFilter}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>{o.full_name || o.id}{o.specialization ? ` — ${o.specialization}` : ""}</li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Выберите тренера"
                    size="small"
                    fullWidth
                    error={touched && !serviceRows[0]?.doctorId}
                    helperText={touched && !serviceRows[0]?.doctorId ? "Выберите тренера" : ""}
                  />
                )}
              />
            </Stack>

            {/* ── УСЛУГА ── */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Услуга *
              </Typography>
              <Autocomplete
                fullWidth
                options={serviceOptions}
                loading={servicesLoading}
                noOptionsText={serviceNoOptionsText}
                value={serviceOptions.find((s) => s.id === serviceRows[0]?.serviceId) || null}
                onChange={(_, v) => {
                  const updated = [...serviceRows];
                  updated[0] = { ...updated[0], serviceId: v?.id || "" };
                  setServiceRows(updated);
                  if (v?.id) {
                    // Фильтруем тренеров по обратному маппингу serviceId → Set<employeeId>
                    const empSet = serviceToEmployeesRef.current[v.id];
                    if (empSet && empSet.size > 0) {
                      setDoctorsOpts(allDoctorsOpts.filter(d => empSet.has(d.id)));
                    }
                    // Если маппинг ещё не загружен — не фильтруем (загрузка идёт в фоне)
                  } else {
                    // Услуга сброшена — восстанавливаем всех тренеров
                    setDoctorsOpts(allDoctorsOpts);
                  }
                }}
                getOptionLabel={(o) => `${o.name}${o.price ? ` — ${o.price} сом` : ""}`}
                filterOptions={serviceFilter}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>{o.name}{o.price ? ` — ${o.price} сом` : ""}</li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Выберите услугу"
                    size="small"
                    fullWidth
                    error={touched && !serviceRows[0]?.serviceId}
                    helperText={serviceHelperText}
                  />
                )}
              />
            </Stack>

            {/* ── ОБЫЧНЫЙ: выбор одного клиента ── */}
            {appointmentMode === "single" && (
              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Клиент *
                  </Typography>
                  {canReception && (
                    <Button size="small" onClick={() => setIsPatientDrawerOpen(true)}>
                      + Новый клиент
                    </Button>
                  )}
                </Stack>

                <Box sx={{ mb: 0.5 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isBooking}
                        onChange={(e) => {
                          setIsBooking(e.target.checked);
                          if (e.target.checked) setTouched(true);
                        }}
                        color="primary"
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">Бронирование (без клиента)</Typography>}
                  />
                </Box>

                <Autocomplete
                  disabled={isBooking}
                  options={patientsSearchResults.length > 0 ? patientsSearchResults : patientsOpts}
                  loading={patientsLoading || isSearchingPatients}
                  value={selectedPatient}
                  onInputChange={(_, val) => setPatientSearchInput(val)}
                  onChange={(_, v) => setSelectedPatient(v)}
                  getOptionLabel={(o: PatientOption) => {
                    const fio = o["ФИО клиента"] ?? o.fio ?? "";
                    const phone = o["Телефон"] ?? o.phone ?? "";
                    return `${fio || "Нет ФИО"} — ${phone || "Нет телефона"}`;
                  }}
                  filterOptions={(x) => x}
                  isOptionEqualToValue={(o, v) => o.id === (v?.id || "")}
                  renderOption={(props, option) => {
                    const fio = option["ФИО клиента"] ?? option.fio ?? "";
                    const phone = option["Телефон"] ?? option.phone ?? "";
                    return <li {...props} key={option.id}>{`${fio || "Нет ФИО"} — ${phone || "Нет телефона"}`}</li>;
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Поиск по ФИО или телефону"
                      fullWidth
                      size="small"
                      error={touched && !isBooking && !selectedPatient}
                      helperText={touched && !isBooking && !selectedPatient ? "Выберите клиента" : ""}
                    />
                  )}
                />

                {/* Комментарий — только в обычном режиме */}
                {(selectedPatient || isBooking) && (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Комментарий администратора
                    </Typography>
                    <TextField
                      placeholder="Комментарий (необязательно)"
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      error={false}
                      helperText=""
                    />
                  </Stack>
                )}
              </Stack>
            )}

            {/* ── ГРУППОВОЙ: мультиселект участников ── */}
            {appointmentMode === "group" && (() => {
              // Вычисляем лимит из выбранной услуги
              const currentServiceCache = serviceRows[0]?.doctorId && employeeServicesCache[serviceRows[0].doctorId]
                ? employeeServicesCache[serviceRows[0].doctorId]
                : servicesOpts;
              const selectedSvc = currentServiceCache.find(s => s.id === serviceRows[0]?.serviceId);
              const maxParts: number | null = (selectedSvc as any)?.maxParticipants ?? null;
              const isFull = maxParts != null && groupParticipants.length >= maxParts;

              return (
                <Stack spacing={0.75}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Клиенты *
                    </Typography>
                    {maxParts != null && (
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, color: isFull ? "primary.main" : "text.secondary" }}
                      >
                        {groupParticipants.length}/{maxParts} уч.
                        {isFull && " — достигнут лимит"}
                      </Typography>
                    )}
                  </Stack>

                  {!isFull && (
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Autocomplete
                        sx={{ flex: 1 }}
                        options={groupPatientResults}
                        value={groupPatientInput}
                        onChange={(_, v) => setGroupPatientInput(v)}
                        onInputChange={(_, val) => setGroupPatientSearch(val)}
                        getOptionLabel={(o: PatientOption) => {
                          const fio = o["ФИО клиента"] ?? o.fio ?? "";
                          const phone = o["Телефон"] ?? o.phone ?? "";
                          return `${fio || "Нет ФИО"} — ${phone || "Нет телефона"}`;
                        }}
                        filterOptions={(x) => x}
                        isOptionEqualToValue={(o, v) => o.id === v.id}
                        loading={groupPatientLoading}
                        noOptionsText="Введите имя клиента"
                        renderOption={(props, option) => {
                          const fio = option["ФИО клиента"] ?? option.fio ?? "";
                          const phone = option["Телефон"] ?? option.phone ?? "";
                          return <li {...props} key={option.id}>{`${fio || "Нет ФИО"} — ${phone || "Нет телефона"}`}</li>;
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            placeholder="Поиск клиента..."
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {groupPatientLoading && <CircularProgress size={14} />}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PersonAddOutlined />}
                        disabled={!groupPatientInput || groupParticipants.some(p => p.id === groupPatientInput?.id)}
                        onClick={() => {
                          if (!groupPatientInput) return;
                          setGroupParticipants(prev => [...prev, groupPatientInput]);
                          setGroupPatientInput(null);
                          setGroupPatientSearch("");
                        }}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        Добавить
                      </Button>
                    </Stack>
                  )}

                  {isFull && (
                    <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
                      Для услуги «{selectedSvc?.name}» уже набрано максимальное количество клиентов ({maxParts})
                    </Typography>
                  )}

                  {groupParticipants.length > 0 && (
                    <Stack spacing={0.75}>
                      {groupParticipants.map((p, idx) => {
                        const name = p.fio ?? p.label ?? p.id;
                        const initials = name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                        return (
                          <Box
                            key={p.id}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.25,
                              px: 1.5,
                              py: 0.75,
                              borderRadius: 2,
                              border: "1px solid",
                              borderColor: "divider",
                              bgcolor: "background.paper",
                            }}
                          >
                            <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15), color: "primary.main", flexShrink: 0 }}>
                              {initials}
                            </Avatar>
                            <Typography variant="body2" fontWeight={500} sx={{ flex: 1, minWidth: 0 }} noWrap>
                              {name}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                              #{idx + 1}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => setGroupParticipants(prev => prev.filter(x => x.id !== p.id))}
                              sx={{ color: "text.disabled", "&:hover": { color: "error.main" }, p: 0.25 }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}

                  {touched && groupParticipants.length === 0 && (
                    <Typography variant="caption" color="error">Добавьте хотя бы одного клиента</Typography>
                  )}
                </Stack>
              );
            })()}
          </Stack>
        </Box>
        <Divider />
        <Box
          sx={{
            p: 2,
            bgcolor: "background.paper",
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button variant="text" onClick={handleClose}>
              Отмена
            </Button>
            <Button
              variant="contained"
              disabled={
                isSaving ||
                !serviceRows.some((r) => r.serviceId && r.doctorId) ||
                (scheduleMode === "once" && !visitDateTime) ||
                (scheduleMode === "period" && periodDates.length === 0) ||
                (scheduleMode === "period" && appointmentMode === "single" && !isBooking && !selectedPatient) ||
                (scheduleMode === "period" && appointmentMode === "group" && groupParticipants.length === 0) ||
                (scheduleMode === "once" && appointmentMode === "single" && !isBooking && !selectedPatient) ||
                (scheduleMode === "once" && appointmentMode === "group" && groupParticipants.length === 0)
              }
              onMouseEnter={() => {
                if (!touched) setTouched(true);
              }}
              startIcon={
                isSaving ? (
                  <CircularProgress size={20} color="inherit" />
                ) : undefined
              }
              onClick={handleSave}
            >
              {isSaving
                ? "Создание..."
                : scheduleMode === "period"
                  ? `Записать на ${periodDates.length} ${periodDates.length === 1 ? "день" : periodDates.length < 5 ? "дня" : "дней"}`
                  : appointmentMode === "group"
                    ? "Добавить занятие"
                    : "Добавить прием"}
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <AddPatientDrawer
        open={isPatientDrawerOpen}
        onClose={() => setIsPatientDrawerOpen(false)}
        onCreated={(p) => {
          const entry: PatientOption = {
            id: p.id,
            fio: p.fio,
            phone: p.phone || undefined,
            "ФИО клиента": p.fio,
            Телефон: p.phone || undefined,
            label: [p.fio, p.phone || ""].filter(Boolean).join(" — ") || p.id,
          };
          setPatientsOpts((prev) => [
            entry,
            ...prev.filter((x) => x.id !== entry.id),
          ]);
          setSelectedPatient(entry);
        }}
      />

      <AddServiceDrawer
        open={isServiceDrawerOpen}
        onClose={() => setIsServiceDrawerOpen(false)}
        onCreated={(rec) => {
          const entry: ServiceRow = {
            id: String(rec.id ?? ""),
            name: rec.name || rec.service_name,
            price: rec.price ?? rec.price_som,
            employee_id: null,
            employee_ids: [],
          };
          setServicesOpts((prev) => [
            entry,
            ...prev.filter((x) => x.id !== entry.id),
          ]);
          setServiceRows((prev) => [
            ...prev,
            { serviceId: entry.id, doctorId: "", quantity: 1 },
          ]);
        }}
      />
    </>
  );
};

export default HomeAddAppointmentDrawer;

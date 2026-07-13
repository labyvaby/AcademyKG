import React from "react";
import { CustomDatePicker, CustomTimePicker } from "../../../components/ui";
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
import AppAutocomplete from "../../../components/ui/AppAutocomplete";
import { createFilterOptions } from "@mui/material/Autocomplete";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
// DeleteOutlined removed — single service row, no delete needed
import dayjs from "dayjs";
import "dayjs/locale/ru";

import { CustomDateTimePicker } from "../../../components/ui";
import { useDictionaries } from "../../../hooks/useDictionaries";
import { useAvailableServices, SELLABLE_SERVICES_QUERY_KEY } from "../../../hooks/useAvailableServices";
import { useQueryClient } from "@tanstack/react-query";
import { isValidSellableService, mapSellableToServiceRow } from "../../../utils/sellableServiceFilters";
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
import { PaymentSidebar } from "./PaymentSidebar";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import { useModalBackdropGuard } from "../../../hooks/useModalBackdropGuard";
import { useBranchCurrency } from "../../../hooks/useBranchCurrency";

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


function serviceMatchesAppointmentMode(service: ServiceRow, mode: "single" | "group"): boolean {
  const isGroup = Boolean((service as any).isGroup ?? (service as any).is_group);
  return mode === "group" ? isGroup : !isGroup;
}

// ... (existing filters)



export const HomeAddAppointmentDrawer: React.FC<
  HomeAddAppointmentDrawerProps
> = ({ open, onClose, onCreated, initialPatientId, initialDate, initialDoctorId, selectedDate }) => {
  const { suffix } = useBranchCurrency();
  const { open: notify } = useNotification();

  const [visitDateTime, setVisitDateTime] = React.useState<string>("");

  const [patientsOpts, setPatientsOpts] = React.useState<PatientOption[]>([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [doctorsOpts, setDoctorsOpts] = React.useState<EmployeesRow[]>([]);
  const [allDoctorsOpts, setAllDoctorsOpts] = React.useState<EmployeesRow[]>([]);
  const [doctorsLoading, setDoctorsLoading] = React.useState(false);
  // Обратный маппинг: serviceId -> Set<employeeId> (строится в фоне при загрузке врачей)
  const serviceToEmployeesRef = React.useRef<Record<string, Set<string>>>({});

  const { hasPermission, employeeId } = usePermissions();
  const isWorkplaceNurse = isOwnOnlySpecialist(hasPermission);
  const canReception = hasPermission(PERMISSIONS.RECEPTION_READ);

  const queryClient = useQueryClient();

  // Все услуги (без врача) — для выбора услуги первой
  const { services: allServicesOpts, isLoading: servicesLoading } = useAvailableServices({ enabled: open });

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

  const periodServicePrice = React.useMemo(() => {
    const firstRow = serviceRows[0];
    if (!firstRow?.serviceId) return null;
    const svc = allServicesOpts.find((s) => s.id === firstRow.serviceId);
    const p = Number(svc?.price ?? 0);
    return p > 0 ? p : null;
  }, [serviceRows, allServicesOpts]);
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

  const [periodPaymentOpen, setPeriodPaymentOpen] = React.useState(false);
  const [periodPaymentContext, setPeriodPaymentContext] = React.useState<import("../types").Appointment | null>(null);
  // Снапшоты периода (форма сбрасывается до открытия оплаты) — для чека «с по» + дни.
  const [periodPaymentFrom, setPeriodPaymentFrom] = React.useState<string>("");
  const [periodPaymentTo, setPeriodPaymentTo] = React.useState<string>("");
  const [periodPaymentDates, setPeriodPaymentDates] = React.useState<string[]>([]);

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

  // Стабильные callbacks для onInputChange — не пересоздаются при каждом рендере.
  // Inline-функции в JSX пересоздавались бы и вызывали сброс inputVal в AppAutocomplete.
  const handlePatientInputChange = React.useCallback((_: React.SyntheticEvent, val: string) => {
    setPatientSearchInput(val);
  }, []);
  const handleGroupPatientInputChange = React.useCallback((_: React.SyntheticEvent, val: string) => {
    setGroupPatientSearch(val);
  }, []);

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
    const isFirstLoad = !prevDateRef.current;
    prevDateRef.current = currentDateStr;
    // Эндпоинт /employees/ не зависит от даты, поэтому выбранные тренер/услуга/клиент
    // при простой смене даты не сбрасываем. Первичная загрузка сотрудников происходит
    // при открытии drawer; повторно дёргать её при смене даты не нужно, но оставляем
    // на случай если cache пустой.
    if (!isFirstLoad && allDoctorsOpts.length > 0) {
      return;
    }

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

  // Строим обратный маппинг serviceId → Set<employeeId> для фильтрации врачей при выборе услуги первой.
  // Используем React Query кэш чтобы не делать лишних запросов.
  const buildServiceToEmployeesMap = React.useCallback(async (emps: EmployeesRow[]) => {
    const map: Record<string, Set<string>> = {};
    await Promise.all(emps.map(async (emp) => {
      try {
        // Берём из кэша React Query если уже загружено, иначе запрашиваем
        const cacheKey = [SELLABLE_SERVICES_QUERY_KEY, { employeeId: emp.id }];
        const cached = queryClient.getQueryData<any[]>(cacheKey);
        const raw: any[] = cached ?? await (async () => {
          const res: any = await apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&employee=${emp.id}&pageSize=200`);
          const results = res?.data?.results ?? res?.results ?? [];
          queryClient.setQueryData(cacheKey, results);
          return results;
        })();
        raw
          .filter((item: any) => isValidSellableService(item))
          .forEach((item: any) => {
            const sid = String(item?.id ?? "");
            if (!sid) return;
            if (!map[sid]) map[sid] = new Set();
            map[sid].add(emp.id);
          });
      } catch { /* ignore */ }
    }));
    serviceToEmployeesRef.current = map;
  }, [queryClient]);

  // Установка начального клиента, если передан initialPatientId
  const fetchedInitialPatientRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!open) {
      fetchedInitialPatientRef.current = null;
      return;
    }
    if (!initialPatientId) return;

    // Если уже выбран нужный клиент — повторно ничего не делаем,
    // иначе при каждом изменении patientsOpts/patientsSearchResults эффект перезаписывал бы state.
    if (selectedPatient?.id === initialPatientId) return;

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

    // 3. Если нигде нет — грузим из базы (один раз на initialPatientId).
    if (fetchedInitialPatientRef.current === initialPatientId) return;
    fetchedInitialPatientRef.current = initialPatientId;

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
        setPatientsOpts(prev => prev.some(p => p.id === newOpt.id) ? prev : [...prev, newOpt]);
        setSelectedPatient(newOpt);
      }
    }).catch(() => { /* ignore */ });
  }, [open, initialPatientId, patientsOpts, patientsSearchResults, selectedPatient]);

  // Эффект для режима "Бронирования" удален, так как теперь 
  // бронирование разрешает создание приема без указания клиента (null).

  const handleClose = () => {
    dayAppointmentsCacheRef.current = {};
    onClose();
  };

  const isDirty = !!(
    selectedPatient ||
    visitDateTime ||
    serviceRows.some((r) => r.serviceId || r.doctorId) ||
    adminComment ||
    groupParticipants.length > 0
  );

  const { handleClose: handleBackdropClose, handleCloseButton, ConfirmLeaveDialog } = useModalBackdropGuard({
    isDirty,
    onClose: handleClose,
    confirmMessage: "Введённые данные приёма будут потеряны. Закрыть форму?",
  });

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

  const loadDayAppointments = React.useCallback(async (date: string, skipRateLimit = false): Promise<any[]> => {
    if (dayAppointmentsCacheRef.current[date]) return dayAppointmentsCacheRef.current[date];
    const branchId = getBranchFilter();
    const branchParam = branchId ? `&branch=${branchId}` : "";
    const res: any = await apiFetch(`/api/v1/appointments/?date=${date}&pageSize=500${branchParam}`, {}, false, skipRateLimit);
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
    excludeAppointmentId?: string,
    skipRateLimit = false,
  ): Promise<{ doctorId: string; start: string; end: string } | null> => {
    const appts = await loadDayAppointments(date, skipRateLimit);
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
    if (scheduleMode === "once") {
      const chosen = visitDateTime ? dayjs(visitDateTime) : null;
      if (!chosen || !chosen.isValid()) {
        notify?.({
          type: "error",
          message: "Выберите корректную дату и время приёма",
        });
        isSavingRef.current = false;
        return;
      }
    }

    try {
      setIsSaving(true);

      // ── РЕЖИМ "НА ПЕРИОД" ────────────────────────────────────────
      // Один приём в день оформления с quantity = число занятий периода.
      // Приёмы по датам занятий НЕ создаются: и запись, и деньги, и чек
      // живут в одном дне, иначе сумма размазывается по будущим дням.
      if (scheduleMode === "period") {
        if (periodDates.length === 0 || (appointmentMode !== "group" && !selectedPatient && !isBooking)) {
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

        const lessonsCount = periodDates.length;
        const bookingAt = visitDateTime ? dayjs(visitDateTime) : dayjs();
        const bookingDate = bookingAt.format("YYYY-MM-DD");
        const timeStr = bookingAt.format("HH:mm");

        const rowsForConflictCheck = validServiceRows.map((row) => {
          const svc = allServicesOpts.find((s) => s.id === row.serviceId);
          return {
            doctorId: row.doctorId,
            durationMinutes: extractServiceDurationMinutes(svc),
          };
        });
        delete dayAppointmentsCacheRef.current[bookingDate];
        const conflict = await findConflictForRows(bookingDate, timeStr, rowsForConflictCheck);
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

        const allServicesPayload = validServiceRows.map((row) => ({
          sellableItem: row.serviceId,
          performer: row.doctorId,
          quantity: lessonsCount,
        }));

        const payload: any = {
          patient: selectedPatient?.id || null,
          appointmentAt: bookingAt.toISOString(),
          services: allServicesPayload,
        };
        if (adminComment.trim()) payload.adminComment = adminComment.trim();
        const branchId = getBranchFilter();
        if (branchId) payload.branch = branchId;

        let createdPeriodId = "";
        try {
          const res: any = await apiFetch("/api/v1/appointments/", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          const created = res?.data ?? res;
          createdPeriodId = String(created?.id ?? "");
        } catch (err: any) {
          delete dayAppointmentsCacheRef.current[bookingDate];
          notify?.({
            type: "error",
            message: "Ошибка при создании записи на период",
            description: err?.message || String(err),
          });
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }

        // Снимки для оплаты и чека — берём ДО ресета формы.
        const patientForPayment = selectedPatient;
        const servicePrice = periodServicePrice;
        const firstRow = validServiceRows[0];
        const serviceNameForPayment = allServicesOpts.find((s) => s.id === firstRow?.serviceId)?.name ?? "Услуга";
        const doctorNameForPayment = doctorsOpts.find((d) => d.id === firstRow?.doctorId)?.full_name
          ?? allDoctorsOpts.find((d) => d.id === firstRow?.doctorId)?.full_name
          ?? "";
        const periodFromSnapshot = periodStartDate;
        const periodToSnapshot = periodEndDate;
        const periodDatesSnapshot = periodDates;
        const bookingIso = bookingAt.toISOString();

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
        notify?.({
          type: "success",
          message: `Запись на период создана (${lessonsCount} ${lessonsCount === 1 ? "занятие" : lessonsCount < 5 ? "занятия" : "занятий"})`,
        });

        // Оплата — обычная, одним чеком на всю сумму.
        if (createdPeriodId && patientForPayment?.id && servicePrice) {
          const total = servicePrice * lessonsCount;
          const context: import("../types").Appointment = {
            id: createdPeriodId,
            appointment_at: bookingIso,
            formatted_date: "",
            doctor_name: doctorNameForPayment,
            patient_name: patientForPayment.fio ?? patientForPayment["ФИО клиента"] ?? "",
            patient_id: patientForPayment.id,
            service_names: serviceNameForPayment,
            parsed_services: [
              {
                name: serviceNameForPayment,
                price: servicePrice,
                quantity: lessonsCount,
                performer_name: doctorNameForPayment,
              },
            ] as any,
            status: "scheduled",
            is_night: false,
            total_cost: total,
            total_amount: total,
            paid_cash: 0,
            paid_card: 0,
            paid_balance: 0,
            paid_bonuses: 0,
            discount: 0,
            debt: total,
          };
          setPeriodPaymentContext(context);
          setPeriodPaymentFrom(periodFromSnapshot);
          setPeriodPaymentTo(periodToSnapshot);
          setPeriodPaymentDates(periodDatesSnapshot);
          setPeriodPaymentOpen(true);
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
        const svc = allServicesOpts.find(s => s.id === firstRow.serviceId);
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
            const conflict = await findConflictForRows(date, timeStr, [{ doctorId: firstRow.doctorId, durationMinutes: groupDuration }], undefined, true);
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
              }, true)
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
          const svc = allServicesOpts.find((s) => s.id === row.serviceId);
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

      let createdAppointmentId = "";
      try {
        const res: any = await apiFetch("/api/v1/appointments/", {
          method: "POST",
          body: JSON.stringify(requestPayload),
        });
        const created = res?.data ?? res;
        createdAppointmentId = String(created?.id ?? "");
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

      // Снимок данных для авто-открытия оплаты — берём ДО сброса формы.
      const payPatient = selectedPatient;
      const payVisitIso = dayjs(visitDateTime).toISOString();
      const paySvcLines = validServiceRows.map((row) => {
        const svc = allServicesOpts.find((s) => s.id === row.serviceId);
        const docName = doctorsOpts.find((d) => d.id === row.doctorId)?.full_name
          ?? allDoctorsOpts.find((d) => d.id === row.doctorId)?.full_name
          ?? "";
        return {
          name: svc?.name ?? "Услуга",
          price: Number(svc?.price ?? 0),
          quantity: 1,
          performer_name: docName,
        };
      });
      const paySvcTotal = paySvcLines.reduce((acc, s) => acc + s.price * s.quantity, 0);
      const paySvcNames = paySvcLines.map((s) => s.name).join(", ");
      const payDocName = paySvcLines[0]?.performer_name ?? "";

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

      // Авто-открытие окна оплаты сразу после создания (меньше кликов).
      // Только для реального пациента — бронь без клиента оплату не открывает.
      if (createdAppointmentId && payPatient?.id) {
        const ctx: import("../types").Appointment = {
          id: createdAppointmentId,
          appointment_at: payVisitIso,
          formatted_date: "",
          doctor_name: payDocName,
          patient_name: payPatient.fio ?? payPatient["ФИО клиента"] ?? "",
          patient_id: payPatient.id,
          service_names: paySvcNames,
          parsed_services: paySvcLines as any,
          status: "scheduled",
          is_night: false,
          total_cost: paySvcTotal,
          total_amount: paySvcTotal,
          paid_cash: 0,
          paid_card: 0,
          paid_balance: 0,
          paid_bonuses: 0,
          discount: 0,
          debt: paySvcTotal,
        };
        setPeriodPaymentContext(ctx);
        setPeriodPaymentOpen(true);
      }
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

  React.useEffect(() => {
    const selectedServiceId = serviceRows[0]?.serviceId;
    if (!selectedServiceId) return;

    const selectedService = allServicesOpts.find((service) => service.id === selectedServiceId);

    if (selectedService && serviceMatchesAppointmentMode(selectedService, appointmentMode)) return;

    setServiceRows((prev) => {
      // Guard: если первая строка уже без serviceId — не создаём новый массив,
      // иначе ссылка меняется каждый рендер и эффект попадает в петлю.
      if (!prev[0] || prev[0].serviceId === "") return prev;
      return prev.map((row, idx) => idx === 0 ? { ...row, serviceId: "" } : row);
    });
    setDoctorsOpts((prev) => (prev === allDoctorsOpts ? prev : allDoctorsOpts));
  }, [appointmentMode, allDoctorsOpts, allServicesOpts, serviceRows]);

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
  // Услуги выбранного врача — хук реагирует на смену selectedDoctorId автоматически
  const { services: doctorServices, isLoading: doctorServicesLoading } = useAvailableServices({
    employeeId: selectedDoctorId || undefined,
    enabled: open && !!selectedDoctorId,
  });
  // Если врач выбран — показываем его услуги, иначе все услуги
  const rawServiceOptions = selectedDoctorId ? doctorServices : allServicesOpts;
  const serviceOptions = rawServiceOptions.filter((service) =>
    serviceMatchesAppointmentMode(service, appointmentMode)
  );
  const isServiceListLoading = servicesLoading || (!!selectedDoctorId && doctorServicesLoading);
  const isDoctorServicesEmpty = Boolean(selectedDoctorId) && !doctorServicesLoading && serviceOptions.length === 0;
  const doctorNoOptionsText = doctorsLoading
    ? "Загрузка тренеров..."
    : "Нет доступных тренеров. Добавьте тренера в разделе сотрудников.";
  const serviceNoOptionsText = isServiceListLoading
    ? "Загрузка услуг..."
    : isDoctorServicesEmpty
      ? appointmentMode === "group"
        ? "Для выбранного тренера нет групповых услуг."
        : "Для выбранного тренера нет индивидуальных услуг."
      : appointmentMode === "group"
        ? "Нет доступных групповых услуг."
        : "Нет доступных индивидуальных услуг.";
  const serviceHelperText = touched && !serviceRows[0]?.serviceId
    ? "Выберите услугу"
    : isDoctorServicesEmpty
      ? appointmentMode === "group"
        ? "Для выбранного тренера нет групповых услуг."
        : "Для выбранного тренера нет индивидуальных услуг."
      : "";

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={isSaving ? undefined : handleBackdropClose}
        PaperProps={{
          sx: {
            width: { xs: 390, sm: 480, md: 520 },
            maxWidth: "100vw",
            height: "100dvh",
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
          <IconButton onClick={isSaving ? undefined : handleCloseButton}>
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
              onChange={(_, v) => {
                if (!v) return;
                setScheduleMode(v);
                // Период-режим работает с одной услугой (UI показывает только
                // первую строку). Сбрасываем лишние строки, оставшиеся из
                // «Разового», иначе приёмы создаются со всеми услугами, а
                // надпись «Итого за период» и оплата считают только первую.
                if (v === "period") setServiceRows((rows) => rows.slice(0, 1));
              }}
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
          onTouchStart={(e) => {
            const tag = (e.target as HTMLElement).tagName.toLowerCase();
            const role = (e.target as HTMLElement).getAttribute("role") ?? "";
            const interactive = ["input", "textarea", "select", "button", "label", "a"].includes(tag)
              || ["combobox", "listbox", "option", "menuitem", "dialog", "switch"].includes(role)
              || (e.target as HTMLElement).closest("[role='listbox'],[role='menu'],[role='dialog'],[data-popper-placement]") !== null;
            if (!interactive && document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
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
              // Бэк: приём задним числом — не более 5 календарных дней.
              minDate={dayjs().subtract(5, "day").startOf("day")}
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
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                    gap: 1,
                  }}
                >
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Начало</Typography>
                    <CustomDatePicker
                      value={periodStartDate ? dayjs(periodStartDate) : null}
                      // Бэк: приём задним числом — не более 5 календарных дней.
                      minDate={dayjs().subtract(5, "day").startOf("day")}
                      onChange={(val) => {
                        const v = val ? val.format("YYYY-MM-DD") : "";
                        setPeriodStartDate(v);
                        if (!periodEndDate || periodEndDate < v) setPeriodEndDate(v);
                      }}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </Stack>
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Конец</Typography>
                    <CustomDatePicker
                      value={periodEndDate ? dayjs(periodEndDate) : null}
                      minDate={periodStartDate ? dayjs(periodStartDate) : undefined}
                      onChange={(val) => {
                        const v = val ? val.format("YYYY-MM-DD") : "";
                        // Не даём конец раньше начала: если выбрана более ранняя дата, поднимаем её до начала.
                        if (v && periodStartDate && v < periodStartDate) {
                          setPeriodEndDate(periodStartDate);
                        } else {
                          setPeriodEndDate(v);
                        }
                      }}
                      slotProps={{
                        textField: {
                          size: "small",
                          fullWidth: true,
                          error: Boolean(periodStartDate && periodEndDate && periodEndDate < periodStartDate),
                          helperText:
                            periodStartDate && periodEndDate && periodEndDate < periodStartDate
                              ? "Конец периода раньше начала"
                              : undefined,
                        },
                      }}
                    />
                  </Stack>
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>Время</Typography>
                    <CustomTimePicker
                      value={visitDateTime ? dayjs(visitDateTime) : null}
                      onChange={(val) => {
                        // Время относится к записи в дне оформления, а не к началу периода:
                        // приём создаётся один, на этот день.
                        const date = (visitDateTime ? dayjs(visitDateTime) : dayjs()).format("YYYY-MM-DD");
                        const time = val && val.isValid() ? val.format("HH:mm") : "09:00";
                        setVisitDateTime(dayjs(`${date}T${time}:00`).format());
                      }}
                      minutesStep={15}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </Stack>
                </Box>
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
                    {periodServicePrice !== null && (
                      <Box sx={{ mt: 1, px: 1.5, py: 0.75, bgcolor: "action.selected", borderRadius: 1, display: "inline-block" }}>
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          Итого за период: {periodDates.length} × {periodServicePrice} = {periodDates.length * periodServicePrice} {suffix}
                        </Typography>
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                      Создаётся одна запись на {dayjs(visitDateTime || undefined).format("DD.MM.YYYY")} — оплата и чек на всю сумму в этот же день.
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
            {/* ── ТРЕНЕР ── */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Тренер / Исполнитель *
              </Typography>
              <AppAutocomplete
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
                  // Услуги для врача загружаются автоматически через useAvailableServices({ employeeId })
                  // при изменении selectedDoctorId. Ничего дополнительного не нужно.
                }}
                getOptionLabel={(o) => `${o.full_name || o.id}${o.specialization ? ` — ${o.specialization}` : ""}`}
                filterOptions={doctorFilter}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderOption={(props, o) => {
                  const { key, ...optionProps } = props;
                  return <li key={key} {...optionProps}>{o.full_name || o.id}{o.specialization ? ` — ${o.specialization}` : ""}</li>;
                }}
                openOnFocus
                blurOnSelect="touch"
                slotProps={{
                  popper: {
                    disablePortal: true,
                    placement: "bottom-start",
                    modifiers: [
                      { name: "flip", enabled: false },
                      { name: "preventOverflow", enabled: false },
                    ],
                  },
                }}
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
              <AppAutocomplete
                fullWidth
                options={serviceOptions}
                loading={isServiceListLoading}
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
                getOptionLabel={(o) => `${o.name}${o.price ? ` — ${o.price} ${suffix}` : ""}`}
                filterOptions={serviceFilter}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderOption={(props, o) => {
                  const { key, ...optionProps } = props;
                  return <li key={key} {...optionProps}>{o.name}{o.price ? ` — ${o.price} ${suffix}` : ""}</li>;
                }}
                openOnFocus
                blurOnSelect="touch"
                slotProps={{
                  popper: {
                    disablePortal: true,
                    placement: "bottom-start",
                    modifiers: [
                      { name: "flip", enabled: false },
                      { name: "preventOverflow", enabled: false },
                    ],
                  },
                }}
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

                <AppAutocomplete
                  disabled={isBooking}
                  options={patientsSearchResults.length > 0 ? patientsSearchResults : patientsOpts}
                  loading={patientsLoading || isSearchingPatients}
                  value={selectedPatient}
                  onInputChange={handlePatientInputChange}
                  onChange={(_, v) => setSelectedPatient(v)}
                  getOptionLabel={(o: PatientOption) => {
                    const fio = o["ФИО клиента"] ?? o.fio ?? "";
                    const phone = o["Телефон"] ?? o.phone ?? "";
                    return `${fio || "Нет ФИО"} — ${phone || "Нет телефона"}`;
                  }}
                  filterOptions={(x) => x}
                  isOptionEqualToValue={(o, v) => o.id === (v?.id || "")}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    const fio = option["ФИО клиента"] ?? option.fio ?? "";
                    const phone = option["Телефон"] ?? option.phone ?? "";
                    return <li key={key} {...optionProps}>{`${fio || "Нет ФИО"} — ${phone || "Нет телефона"}`}</li>;
                  }}
                  openOnFocus
                  blurOnSelect="touch"
                  slotProps={{
                    popper: {
                      disablePortal: true,
                      placement: "bottom-start",
                      modifiers: [
                        { name: "flip", enabled: false },
                        { name: "preventOverflow", enabled: false },
                      ],
                    },
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
              const selectedSvc = allServicesOpts.find(s => s.id === serviceRows[0]?.serviceId);
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
                      <AppAutocomplete
                        sx={{ flex: 1 }}
                        options={groupPatientResults}
                        value={groupPatientInput}
                        onChange={(_, v) => setGroupPatientInput(v)}
                        onInputChange={handleGroupPatientInputChange}
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
                          const { key, ...optionProps } = props;
                          const fio = option["ФИО клиента"] ?? option.fio ?? "";
                          const phone = option["Телефон"] ?? option.phone ?? "";
                          return <li key={key} {...optionProps}>{`${fio || "Нет ФИО"} — ${phone || "Нет телефона"}`}</li>;
                        }}
                        openOnFocus
                        blurOnSelect="touch"
                        slotProps={{
                          popper: {
                            disablePortal: true,
                            placement: "bottom-start",
                            modifiers: [
                              { name: "flip", enabled: false },
                              { name: "preventOverflow", enabled: false },
                            ],
                          },
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
                      <Stack alignItems="flex-end" spacing={0.25}>
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
                        {groupPatientInput && groupParticipants.some(p => p.id === groupPatientInput?.id) && (
                          <Typography variant="caption" color="warning.main" sx={{ whiteSpace: "nowrap", fontSize: "0.7rem" }}>
                            Уже добавлен
                          </Typography>
                        )}
                      </Stack>
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
            pb: "calc(16px + env(safe-area-inset-bottom, 0px))",
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
                (scheduleMode === "period" && Boolean(periodStartDate && periodEndDate && periodEndDate < periodStartDate)) ||
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

      <PaymentSidebar
        open={periodPaymentOpen}
        onClose={() => {
          setPeriodPaymentOpen(false);
          setPeriodPaymentContext(null);
          setPeriodPaymentFrom("");
          setPeriodPaymentTo("");
          setPeriodPaymentDates([]);
        }}
        appointment={periodPaymentContext}
        periodFrom={periodPaymentFrom || null}
        periodTo={periodPaymentTo || null}
        periodDates={periodPaymentDates}
        onSaved={() => {
          setPeriodPaymentOpen(false);
          setPeriodPaymentContext(null);
          setPeriodPaymentFrom("");
          setPeriodPaymentTo("");
          setPeriodPaymentDates([]);
          onCreated?.();
        }}
      />

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
          // Инвалидируем кэш чтобы новая услуга появилась в списке
          queryClient.invalidateQueries({ queryKey: [SELLABLE_SERVICES_QUERY_KEY] });
          setServiceRows((prev) => [
            ...prev,
            { serviceId: String(rec.id ?? ""), doctorId: "", quantity: 1 },
          ]);
        }}
      />
      <ConfirmLeaveDialog />
    </>
  );
};

export default HomeAddAppointmentDrawer;

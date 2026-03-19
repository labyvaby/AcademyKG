import React from "react";
import { useNotification } from "@refinedev/core";
import {
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
} from "@mui/material";
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
import { apiFetch } from "../../../utility/apiClient";
import { roundDateTimeLocalToStep } from "../../../utility/time";
import { type ServiceRow } from "../../../services/services";
import type { EmployeesRow } from "../../expenses/types";
import type { PatientOption, ServiceRowEntry } from "../types";
import { usePermissions } from "../../../hooks/usePermissions";
import { createGroup } from "../../../features/group-appointments/api/group-appointments.api";

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

// ... (existing helper functions)

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
  const [doctorsLoading, setDoctorsLoading] = React.useState(false);
  const [servicesOpts, setServicesOpts] = React.useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);
  // Per-employee services cache: employeeId -> ServiceRow[]
  const [employeeServicesCache, setEmployeeServicesCache] = React.useState<Record<string, ServiceRow[]>>({});

  const { isNurse, isAdmin, employeeId } = usePermissions();
  // Ограничиваем только реальных медсестер, не администраторов
  const isWorkplaceNurse = isNurse() && !isAdmin();

  const [selectedPatient, setSelectedPatient] =
    React.useState<PatientOption | null>(null);
  const [serviceRows, setServiceRows] = React.useState<ServiceRowEntry[]>([
    { serviceId: "", doctorId: "", quantity: 1 },
  ]);


  const [adminComment, setAdminComment] = React.useState("");

  const [isBooking, setIsBooking] = React.useState(false);

  // Режим: "single" — обычный приём, "group" — групповой
  const [appointmentMode, setAppointmentMode] = React.useState<"single" | "group">("single");
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
        ? `/api/v1/clients/?search=${encodeURIComponent(cleanQ)}&page_size=50`
        : `/api/v1/clients/?page_size=50&ordering=fullName`;
      const res: any = await apiFetch(url);
      const data: any[] = res?.data?.results ?? res?.results ?? [];

      const mapped = data.map((r: any) => {
        const fio = r.fullName ?? r.full_name ?? r["ФИО клиента"] ?? "";
        const phone = r.phone ?? r.contactPhone ?? r["Телефон"] ?? "";
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
    if (query.length < 1) return;
    setGroupPatientLoading(true);
    try {
      const url = query
        ? `/api/v1/clients/?search=${encodeURIComponent(query)}&page_size=30`
        : `/api/v1/clients/?page_size=30&ordering=fullName`;
      const res: any = await apiFetch(url);
      const data: any[] = res?.data?.results ?? res?.results ?? [];
      setGroupPatientResults(data.map((r: any) => {
        const fio = r.fullName ?? r.full_name ?? "";
        const phone = r.phone ?? r.contactPhone ?? "";
        return { id: String(r.id ?? ""), fio, phone, "ФИО клиента": fio, "Телефон": phone, label: `${fio} — ${phone}` };
      }).filter((p: any) => p.id));
    } catch { setGroupPatientResults([]); }
    finally { setGroupPatientLoading(false); }
  }, []);

  React.useEffect(() => {
    if (appointmentMode !== "group") return;
    const t = setTimeout(() => fetchGroupPatients(groupPatientSearch), 350);
    return () => clearTimeout(t);
  }, [groupPatientSearch, appointmentMode, fetchGroupPatients]);

  // При открытии дровера — грузим первых клиентов
  React.useEffect(() => {
    if (open) fetchPatientsServerSide("");
  }, [open, fetchPatientsServerSide]);

  // При открытии, если дата/время ещё не заданы — заполняем переданным initialDate или текущим временем
  React.useEffect(() => {
    if (!open) {
      setAppointmentMode("single");
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

    apiFetch(`/api/v1/appointments/employees-by-date/?date=${currentDateStr}`)
      .then(async (res: any) => {
        if (cancelled) return;
        const results: any[] = res?.data?.results ?? res?.data ?? res?.results ?? [];
        if (results.length > 0) {
          setDoctorsOpts(mapEmps(results));
        } else {
          // Фоллбэк — все активные сотрудники
          const fallback: any = await apiFetch("/api/v1/employees/?status=active&page_size=200");
          if (!cancelled) {
            const fbResults: any[] = fallback?.data?.results ?? fallback?.results ?? [];
            setDoctorsOpts(mapEmps(fbResults));
          }
        }
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          const fallback: any = await apiFetch("/api/v1/employees/?status=active&page_size=200");
          if (!cancelled) {
            const fbResults: any[] = fallback?.data?.results ?? fallback?.results ?? [];
            setDoctorsOpts(mapEmps(fbResults));
          }
        } catch { if (!cancelled) setDoctorsOpts([]); }
      })
      .finally(() => { if (!cancelled) setDoctorsLoading(false); });
    return () => { cancelled = true; };
  }, [open, currentDateStr]);

  // Load services per employee when employee changes in a service row
  const loadServicesForEmployee = React.useCallback(async (employeeId: string): Promise<ServiceRow[]> => {
    if (!employeeId) return [];
    try {
      const res: any = await apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&employee=${employeeId}&page_size=200`);
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
    onClose();
  };

  const handleSave = async () => {
    // ОПТИМИЗАЦИЯ: Удалены console.log для улучшения производительности
    if (isSaving || isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;

    setTouched(true);

    try {
      setIsSaving(true);

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

      if (isBooking && !adminComment.trim()) {
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

      const requestPayload: Record<string, unknown> = {
        patient: patientId,
        appointmentAt: dayjs(visitDateTime).toISOString(),
        adminComment: adminComment || "",
        services: allServicesPayload,
      };

      try {
        await apiFetch("/api/v1/appointments/", {
          method: "POST",
          body: JSON.stringify(requestPayload),
        });
      } catch (err: any) {
        console.error("API Error creating appointment:", err);
        notify?.({
          type: "error",
          message: "Ошибка при создании приёма",
          description: err?.message || String(err),
        });
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
      // eslint-disable-next-line no-console
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
            size="small"
            fullWidth
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
            {/* ── ТРЕНЕР ── */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Тренер / Исполнитель *
              </Typography>
              <Autocomplete
                fullWidth
                disabled={isWorkplaceNurse}
                options={doctorsOpts}
                loading={doctorsLoading}
                value={doctorsOpts.find((d) => d.id === serviceRows[0]?.doctorId) || null}
                onChange={(_, v) => {
                  const updated = [...serviceRows];
                  updated[0] = { ...updated[0], doctorId: v?.id || "", serviceId: "" };
                  setServiceRows(updated);
                  if (v?.id && !employeeServicesCache[v.id]) {
                    setServicesLoading(true);
                    loadServicesForEmployee(v.id).then(srvs => {
                      setEmployeeServicesCache(prev => ({ ...prev, [v.id]: srvs }));
                      setServicesLoading(false);
                    });
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
                options={
                  serviceRows[0]?.doctorId && employeeServicesCache[serviceRows[0].doctorId]
                    ? employeeServicesCache[serviceRows[0].doctorId]
                    : servicesOpts
                }
                loading={servicesLoading}
                value={
                  (serviceRows[0]?.doctorId && employeeServicesCache[serviceRows[0].doctorId]
                    ? employeeServicesCache[serviceRows[0].doctorId]
                    : servicesOpts
                  ).find((s) => s.id === serviceRows[0]?.serviceId) || null
                }
                onChange={(_, v) => {
                  const updated = [...serviceRows];
                  updated[0] = { ...updated[0], serviceId: v?.id || "" };
                  setServiceRows(updated);
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
                    helperText={touched && !serviceRows[0]?.serviceId ? "Выберите услугу" : ""}
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
                  <Button size="small" onClick={() => setIsPatientDrawerOpen(true)}>
                    + Новый клиент
                  </Button>
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
                      Комментарий администратора {isBooking && "*"}
                    </Typography>
                    <TextField
                      placeholder={isBooking ? "Обязательное поле для бронирования" : "Комментарий (необязательно)"}
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      error={touched && isBooking && !adminComment.trim()}
                      helperText={touched && isBooking && !adminComment.trim() ? "Обязательное поле" : ""}
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
                    <Stack spacing={0.5}>
                      {groupParticipants.map((p) => (
                        <Stack key={p.id} direction="row" alignItems="center" justifyContent="space-between"
                          sx={{ px: 1.5, py: 0.75, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "action.hover" }}>
                          <Typography variant="body2">{p.fio ?? p.label ?? p.id}</Typography>
                          <Button size="small" color="error" sx={{ minWidth: 0, px: 0.75 }}
                            onClick={() => setGroupParticipants(prev => prev.filter(x => x.id !== p.id))}>
                            ✕
                          </Button>
                        </Stack>
                      ))}
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
                !visitDateTime ||
                isSaving ||
                !serviceRows.some((r) => r.serviceId && r.doctorId) ||
                (appointmentMode === "single" && !isBooking && !selectedPatient) ||
                (appointmentMode === "single" && isBooking && !adminComment.trim()) ||
                (appointmentMode === "group" && groupParticipants.length === 0)
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

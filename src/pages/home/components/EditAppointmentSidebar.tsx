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
  Tooltip,
} from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import { CardContent } from "@mui/material";
import { AppCard } from "../../../components/ui";

import { apiFetch } from "../../../utility/apiClient";
import type { Appointment, PatientOption, ServiceRowEntry } from "../types";
import type { EmployeesRow } from "../../../pages/expenses/types";
import { type ServiceRow } from "../../../services/services";
import AddPatientDrawer from "../../../components/patients/AddPatientDrawer";
import AddServiceDrawer from "../../../components/services/AddServiceDrawer";
import { roundDateTimeLocalToStep } from "../../../utility/time";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { CustomDateTimePicker } from "../../../components/ui";
import { useNotification } from "@refinedev/core";
import { useDictionaries } from "../../../hooks/useDictionaries";
import { usePermissions } from "../../../hooks/usePermissions";
import { PERMISSIONS } from "../../../constants/permissions";
import { isOwnOnlySpecialist } from "../../../utils/permissionHelpers";


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
  stringify: (o) => {
    const fio = o?.["ФИО клиента"] ?? o?.fio ?? "";
    const phone = o?.["Телефон"] ?? o?.phone ?? "";
    return [fio, phone].filter(Boolean).join(" ");
  },
  ignoreAccents: true,
  ignoreCase: true,
  trim: true,
});

export type EditAppointmentSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  item: Appointment;
  onSaved?: (updated: Appointment) => void;
  onDeleted?: (id: string) => void;
};

const EditAppointmentSidebar: React.FC<EditAppointmentSidebarProps> = ({
  isOpen,
  onClose,
  item,
  onSaved,
}) => {
  const { open: notify } = useNotification();
  const { hasPermission, employeeId } = usePermissions();
  const isWorkplaceNurse = isOwnOnlySpecialist(hasPermission);
  const canReception = hasPermission(PERMISSIONS.RECEPTION_READ);
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const [touched, setTouched] = React.useState(false);

  // локальные поля формы
  // item.appointment_at is ISO string, so we can use it directly or format it
  const [dateTime, setDateTime] = React.useState<string>(
    item.appointment_at ? roundDateTimeLocalToStep(item.appointment_at, 15) : ""
  );
  // Клиент
  const [patients, setPatients] = React.useState<PatientOption[]>([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [selectedPatient, setSelectedPatient] =
    React.useState<PatientOption | null>(
      item.patient_id
        ? {
          id: item.patient_id,
          label: item.patient_name || "Без имени",
          fio: item.patient_name,
          "ФИО клиента": item.patient_name,
        }
        : item.patient_name
          ? {
            id: "",
            label: item.patient_name,
            fio: item.patient_name,
            "ФИО клиента": item.patient_name,
          }
          : null
    );
  const [isBooking, setIsBooking] = React.useState<boolean>(!item.patient_id);

  // Доктора и Услуги
  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const [loadingEmps, setLoadingEmps] = React.useState(false);
  const [services, setServices] = React.useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);
  const [employeeServicesCache, setEmployeeServicesCache] = React.useState<Record<string, ServiceRow[]>>({});

  const loadServicesForEmployee = React.useCallback(async (empId: string): Promise<ServiceRow[]> => {
    if (!empId) return [];
    try {
      const res: any = await apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&employee=${empId}&pageSize=200`);
      const results: any[] = res?.data?.results ?? res?.results ?? [];
      return results.map((item: any) => ({
        id: item.id,
        name: item.displayName ?? item.service?.name ?? item.name ?? "",
        price: item.displayPrice ? parseFloat(item.displayPrice) : (item.service?.price ? parseFloat(item.service.price) : undefined),
        is_active: item.isActive ?? true,
      } as ServiceRow)).filter((s: ServiceRow) => s.id && s.name);
    } catch { return []; }
  }, []);


  const [serviceRows, setServiceRows] = React.useState<ServiceRowEntry[]>(
    () => {
      // Инициализируем из существующих данных приема
      let services: any[] = [];
      try {
        if (typeof item.services_json === 'string') {
          services = JSON.parse(item.services_json);
        } else if (Array.isArray(item.services_json)) {
          services = item.services_json;
        }
      } catch (e) {
        console.error("Error parsing services_json in Sidebar initialization", e);
      }

      if (Array.isArray(services) && services.length > 0) {
        // Если есть services_json, создаем строки для каждой услуги
        // Используем индивидуальные doctor_id/performer_id из каждой услуги
        return services.map((svc) => ({
          serviceId: svc.sellable_item_id || svc.service_id || svc.id || "",
          doctorId: svc.performer_id || svc.doctor_id || item.doctor_id || "",
          quantity: svc.quantity || 1,
        }));
      }
      // Фолбэк: одна пустая строка
      return [{ serviceId: "", doctorId: "", quantity: 1 }];
    }
  );

  // Автоподсчет суммы услуг из serviceRows
  const [price, setPrice] = React.useState<number | "">(
    item.total_amount ?? item.total_cost ?? ""
  );

  React.useEffect(() => {
    const servicesTotal = serviceRows.reduce((sum, row) => {
      const cache = row.doctorId ? employeeServicesCache[row.doctorId] : null;
      const service = (cache || services).find((s) => s.id === row.serviceId);
      const rowPrice = Number(service?.price) || 0;
      const rowQty = row.quantity || 1;
      return sum + (rowPrice * rowQty);
    }, 0);
    setPrice(servicesTotal || "");
  }, [serviceRows, services, employeeServicesCache]);

  const [adminComment, setAdminComment] = React.useState<string>(
    item.admin_comment || ""
  );

  // Быстрое добавление
  const [isPatientDrawerOpen, setIsPatientDrawerOpen] = React.useState(false);
  const [isServiceDrawerOpen, setIsServiceDrawerOpen] = React.useState(false);

  // СЕРВЕРНЫЙ ПОИСК ПАЦИЕНТОВ
  const [patientSearchInput, setPatientSearchInput] = React.useState("");
  const [patientsSearchResults, setPatientsSearchResults] = React.useState<PatientOption[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = React.useState(false);

  const fetchPatientsServerSide = React.useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setPatientsSearchResults([]);
      return;
    }

    setIsSearchingPatients(true);
    try {
      const cleanQ = query.trim();

      const res: any = await apiFetch(`/api/v1/clients/?search=${encodeURIComponent(cleanQ)}&pageSize=50`);
      const data = res?.data?.results ?? res?.results ?? [];

      const mapped = (data || []).map((r: any) => {
        const fio = r.full_name || r.fullName || r.fio || "";
        const phone = resolvePatientPhone(r);
        return {
          id: String(r.id),
          fio,
          phone,
          "ФИО клиента": fio,
          "Телефон": phone,
          label: `${fio} — ${phone}`
        };
      });
      setPatientsSearchResults(mapped as PatientOption[]);
    } catch (err) {
      console.error("Error searching patients:", err);
    } finally {
      setIsSearchingPatients(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearchInput) {
        fetchPatientsServerSide(patientSearchInput);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [patientSearchInput, fetchPatientsServerSide]);

  // Use cached dictionaries
  const {
    patients: dictPatients,
    employees: dictEmployees,
    services: dictServices,
    loading: dictLoading,
  } = useDictionaries(isOpen);

  React.useEffect(() => {
    if (dictPatients.length > 0) setPatients(dictPatients);
    if (dictEmployees.length > 0) setEmployees(dictEmployees);
    if (dictServices.length > 0) {
      const servicesArray = Array.isArray(item.services_json)
        ? item.services_json
        : typeof item.services_json === "string"
          ? JSON.parse(item.services_json)
          : [];
      const currentServiceIds = servicesArray.map((s: any) => s.id) || [];
      const filtered = dictServices.filter(
        (s) => s.is_active !== false || currentServiceIds.includes(s.id)
      );
      setServices(filtered);
    }
    setPatientsLoading(dictLoading);
    setLoadingEmps(dictLoading);
    setServicesLoading(dictLoading);
  }, [dictPatients, dictEmployees, dictServices, dictLoading]);

  // Загружаем услуги для уже выбранных исполнителей при открытии
  React.useEffect(() => {
    if (!isOpen) return;
    const uniqueDocIds = [...new Set(serviceRows.map(r => r.doctorId).filter(Boolean))];
    uniqueDocIds.forEach(docId => {
      if (!employeeServicesCache[docId]) {
        loadServicesForEmployee(docId).then(srvs => {
          setEmployeeServicesCache(prev => ({ ...prev, [docId]: srvs }));
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item.id]);

  // Сброс при закрытии
  React.useEffect(() => {
    if (!isOpen) {
      setBusy(false);
      busyRef.current = false;
      setTouched(false);
    }
  }, [isOpen]);

  // Сброс serviceRows при открытии другого приёма
  React.useEffect(() => {
    if (!isOpen) return;
    let parsed: any[] = [];
    try {
      if (typeof item.services_json === "string") {
        parsed = JSON.parse(item.services_json);
      } else if (Array.isArray(item.services_json)) {
        parsed = item.services_json;
      }
    } catch {
      parsed = [];
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      setServiceRows(parsed.map((svc) => ({
        serviceId: svc.sellable_item_id || svc.service_id || svc.id || "",
        doctorId: svc.performer_id || svc.doctor_id || item.doctor_id || "",
        quantity: svc.quantity || 1,
      })));
    } else {
      setServiceRows([{ serviceId: "", doctorId: "", quantity: 1 }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, isOpen]);

  const handleSubmit = async () => {
    if (busy || busyRef.current) return;

    setTouched(true);

    // Гарантируем ISO строку с часовым поясом, чтобы DB не интерпретировала как UTC
    const dt = dateTime ? dayjs(dateTime).format() : "";
    if (dt && dayjs(dt).isBefore(dayjs().subtract(1, "day").startOf("day"))) {
      notify?.({
        type: "error",
        message: "Нельзя сохранять приём в прошлом",
        description: "Выберите вчерашнюю, сегодняшнюю или будущую дату.",
      });
      return;
    }
    if (!dt || (!isBooking && !selectedPatient?.id)) {
      return;
    }

    // Валидация строк услуг (игнорируем полностью пустые строки, если есть хотя бы одна заполненная)
    const validServiceRows = serviceRows.filter((r) => r.serviceId && r.doctorId);
    if (validServiceRows.length === 0) {
      return;
    }

    // Блокируем только после прохождения всех валидаций
    busyRef.current = true;
    try {
      setBusy(true);

      // Build services array
      const allServicesPayload: any[] = [];
      for (const row of validServiceRows) {
        allServicesPayload.push({
          sellableItem: row.serviceId || "",
          performer: row.doctorId || "",
          quantity: row.quantity || 1,
        });
      }
      const payload: any = {
        appointmentAt: dt,
        patient: selectedPatient?.id || null,
        services: allServicesPayload,
      };

      if (adminComment.trim()) {
        payload.adminComment = adminComment.trim();
      }

      await apiFetch(`/api/v1/appointments/${item.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const firstDoctor = employees.find((e) => e.id === serviceRows[0]?.doctorId);
      const updatedItem: Appointment = {
        ...item,
        appointment_at: dt,
        formatted_date: dayjs(dt).format("DD.MM.YYYY HH:mm"),
        doctor_name: firstDoctor?.full_name || item.doctor_name,
        doctor_id: serviceRows[0]?.doctorId || undefined,
        patient_name: selectedPatient?.fio || item.patient_name,
        patient_id: selectedPatient?.id || undefined,
        admin_comment: adminComment || null,
      };

      onSaved?.(updatedItem);
      onClose();
      notify?.({ type: "success", message: "Прием сохранен" });
    } catch (e: any) {
      console.error("Update appointment failed:", e);
      const msg = String(e?.message ?? e ?? "").toLowerCase();
      const isOverlap = msg.includes("overlap") || msg.includes("conflict") || msg.includes("занят") || msg.includes("пересека");
      notify?.({
        type: "error",
        message: isOverlap ? "Конфликт по времени" : "Не удалось сохранить изменения приёма",
        description: isOverlap ? "Это время уже занято у выбранного специалиста. Выберите другой слот." : (e?.message || undefined),
      });
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={busy ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: 320, sm: 480, md: 520 },
          maxWidth: "100vw",
          overscrollBehavior: "contain",
        },
      }}
    >
      <Box
        sx={{
          width: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          px={2}
          py={1.5}
        >
          <Typography variant="h6">Редактирование приема</Typography>
        </Stack>
        <Divider />

        <Box px={2} py={2} sx={{ flex: 1, overflowY: "auto" }}>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Дата и время приема
            </Typography>
            <CustomDateTimePicker
              label="Дата и время *"
              value={dateTime ? dayjs(dateTime) : null}
              onChange={(val) =>
                setDateTime(val ? val.format() : "")
              }
              ampm={false}
              minutesStep={15}
              slotProps={{
                textField: {
                  fullWidth: true,
                  InputLabelProps: { shrink: true },
                  sx: {
                    '& .MuiInputBase-root': {
                      fontSize: '1.1rem',
                      fontWeight: 500,
                    }
                  }
                },
              }}
            />

            {/* Клиент */}
            <Stack spacing={0.5}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2" color="text.secondary">
                  Клиент *
                </Typography>
                {canReception && (
                  <Button
                    size="small"
                    onClick={() => setIsPatientDrawerOpen(true)}
                  >
                    + Добавить клиента
                  </Button>
                )}
              </Stack>
              <Autocomplete
                disabled={isBooking}
                options={patientSearchInput.length >= 2 ? patientsSearchResults : patients}
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
                  return (
                    <li {...props} key={option.id}>{`${fio || "Нет ФИО"} — ${phone || "Нет телефона"
                      }`}</li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Поиск по ФИО или телефону"
                    fullWidth
                    error={touched && !isBooking && !selectedPatient}
                    helperText={touched && !isBooking && !selectedPatient ? "Выберите клиента" : ""}
                  />
                )}
              />
            </Stack>

            {/* Опция бронирования */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: isBooking ? "warning.lighter" : "action.hover",
                border: "1px solid",
                borderColor: isBooking ? "warning.light" : "divider",
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": {
                  bgcolor: isBooking ? "warning.lighter" : "action.selected",
                },
              }}
              onClick={() => {
                if (!isBooking) {
                  setSelectedPatient(null);
                  setTouched(true);
                }
                setIsBooking(!isBooking);
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Бронирование (без клиента)
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    bgcolor: isBooking ? "primary.main" : "text.disabled",
                    position: "relative",
                    transition: "bgcolor 0.2s",
                  }}
                >
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      bgcolor: "white",
                      position: "absolute",
                      top: 3,
                      left: isBooking ? 19 : 3,
                      transition: "left 0.2s",
                    }}
                  />
                </Box>
              </Stack>
            </Box>

            {/* Контент ниже отображается если выбран клиент ИЛИ включено бронирование */}
            {(selectedPatient || isBooking) && (
              <>
                {/* Новая карточка со строками услуга + врач */}
                <AppCard
                  variant="outlined"
                  sx={{ bgcolor: "background.paper" }}
                  disableContentPadding
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontWeight: 600 }}
                        >
                          Услуги
                        </Typography>
                      </Stack>

                      <Divider />

                      {serviceRows.map((row, index) => (
                        <React.Fragment key={index}>
                          {index > 0 && <Divider />}
                          <Stack spacing={1.5}>
                            <Stack spacing={1.5}>
                              {index === 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  Специалист / Исполнитель
                                </Typography>
                              )}
                              {/* Врач */}
                              <Autocomplete
                                fullWidth
                                disabled={isWorkplaceNurse}
                                options={
                                  row.serviceId
                                    ? (() => {
                                      const filtered = employees.filter((d) =>
                                        d.serviceIds?.includes(row.serviceId)
                                      );
                                      return filtered.length > 0 ? filtered : employees;
                                    })()
                                    : employees
                                }
                                loading={loadingEmps}
                                value={
                                  employees.find((d) => d.id === row.doctorId) ||
                                  null
                                }
                                onChange={(_, v) => {
                                  const updated = [...serviceRows];
                                  updated[index].doctorId = v?.id || "";
                                  updated[index].serviceId = "";
                                  setServiceRows(updated);
                                  if (v?.id && !employeeServicesCache[v.id]) {
                                    setServicesLoading(true);
                                    loadServicesForEmployee(v.id).then(srvs => {
                                      setEmployeeServicesCache(prev => ({ ...prev, [v.id]: srvs }));
                                      setServicesLoading(false);
                                    });
                                  }
                                }}
                                getOptionLabel={(o) =>
                                  `${o.full_name || o.id} — ${o.specialization || "Нет специализации"
                                  }`
                                }
                                filterOptions={createFilterOptions<EmployeesRow>({
                                  matchFrom: "start",
                                  stringify: (o) =>
                                    `${o.full_name ?? ""} ${o.specialization ?? ""
                                      }`.trim(),
                                })}
                                isOptionEqualToValue={(o, v) => o.id === v.id}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder="Исполнитель"
                                    size="small"
                                    fullWidth
                                    error={touched && !row.doctorId}
                                    helperText={touched && !row.doctorId ? "Выберите исполнителя" : ""}
                                  />
                                )}
                              />

                              {index === 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  Наименование услуги
                                </Typography>
                              )}
                              {/* Услуга */}
                              <Stack direction="row" spacing={1} alignItems="flex-start">
                                <Autocomplete
                                  sx={{ flex: 1 }}
                                  options={
                                    row.doctorId && employeeServicesCache[row.doctorId]
                                      ? employeeServicesCache[row.doctorId]
                                      : services
                                  }
                                  loading={servicesLoading}
                                  value={
                                    (row.doctorId && employeeServicesCache[row.doctorId]
                                      ? employeeServicesCache[row.doctorId]
                                      : services
                                    ).find((s) => s.id === row.serviceId) || null
                                  }
                                  onChange={(_, v) => {
                                    const updated = [...serviceRows];
                                    updated[index].serviceId = v?.id || "";
                                    if (updated[index].doctorId && v) {
                                      const emp = employees.find(d => d.id === updated[index].doctorId);
                                      if (emp?.serviceIds?.length && !emp.serviceIds.includes(v.id)) {
                                        updated[index].doctorId = "";
                                      }
                                    }
                                    setServiceRows(updated);
                                  }}
                                  getOptionLabel={(o) =>
                                    `${o.name} — ${o.price || 0} сом`
                                  }
                                  filterOptions={createFilterOptions<ServiceRow>({
                                    matchFrom: "start",
                                    stringify: (o) =>
                                      `${o.name ?? ""} ${String(
                                        o.price ?? ""
                                      )}`.trim(),
                                  })}
                                  isOptionEqualToValue={(o, v) => o.id === v.id}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      placeholder="Услуга"
                                      size="small"
                                      fullWidth
                                      error={touched && !row.serviceId}
                                      helperText={touched && !row.serviceId ? "Выберите услугу" : ""}
                                    />
                                  )}
                                />
                                {serviceRows.length > 1 && (
                                  <Tooltip title="Удалить услугу">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => {
                                        setServiceRows(
                                          serviceRows.filter((_, i) => i !== index)
                                        );
                                      }}
                                      sx={{
                                        mt: 0.5,
                                        border: '1px solid',
                                        borderColor: 'error.main',
                                        '&:hover': {
                                          backgroundColor: 'rgba(211, 47, 47, 0.08)',
                                        }
                                      }}
                                    >
                                      <DeleteOutlined fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Stack>
                            </Stack>
                          </Stack>
                        </React.Fragment>
                      ))}

                      {/* Кнопка добавить услугу */}
                      <Button
                        size="small"
                        onClick={() => {
                          // Копируем сотрудника из последней строки для удобства
                          const lastRow = serviceRows[serviceRows.length - 1];
                          const previousDoctorId = lastRow?.doctorId || "";
                          setServiceRows([
                            ...serviceRows,
                            {
                              serviceId: "",
                              doctorId:
                                isWorkplaceNurse && employeeId
                                  ? employeeId
                                  : previousDoctorId,
                              quantity: 1,
                            },
                          ]);
                        }}
                        sx={{ alignSelf: "flex-start", mt: "4px !important" }}
                      >
                        + Добавить услугу
                      </Button>

                      <Divider />

                      {/* Общая стоимость */}
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="body2" color="text.secondary">
                          Общая стоимость
                        </Typography>
                        <Typography variant="h6">
                          {serviceRows.reduce((sum, row) => {
                            const cache = row.doctorId ? employeeServicesCache[row.doctorId] : null;
                            const service = (cache || services).find((s) => s.id === row.serviceId);
                            return sum + (Number(service?.price) || 0);
                          }, 0)}{" "}
                          сом
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </AppCard>

                <TextField
                  placeholder="Комментарий администратора"
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  error={false}
                  helperText=""
                />
              </>
            )}
          </Stack>
        </Box>

        <Divider />
        <Box
          px={2}
          py={1.5}
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          gap={1.5}
        >
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              busy ||
              !dateTime ||
              (!isBooking && !selectedPatient) ||
              !serviceRows.some((r) => r.serviceId && r.doctorId)
            }
            onMouseEnter={() => {
              if (!touched) setTouched(true);
            }}
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
        </Box>
      </Box>

      {/* Быстрое добавление клиента */}
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
          setPatients((prev) => [
            entry,
            ...prev.filter((x) => x.id !== entry.id),
          ]);
          setSelectedPatient(entry);
          setIsPatientDrawerOpen(false);
        }}
      />

      {/* Быстрое добавление услуги */}
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
          setServices((prev) => [
            entry,
            ...prev.filter((x) => x.id !== entry.id),
          ]);
          // Добавляем новую строку с созданной услугой
          setServiceRows((prev) => [
            ...prev,
            { serviceId: entry.id, doctorId: "", quantity: 1 },
          ]);
          setIsServiceDrawerOpen(false);
        }}
      />
    </Drawer >
  );
};

export default EditAppointmentSidebar;

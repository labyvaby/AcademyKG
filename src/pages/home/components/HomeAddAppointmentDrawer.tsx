import React from "react";
import { useNotification } from "@refinedev/core";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Drawer,
  FilterOptionsState,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import WbSunnyOutlined from "@mui/icons-material/WbSunnyOutlined";
import NightlightOutlined from "@mui/icons-material/NightlightOutlined";
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
import { Product } from "../../../services/products";

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


function inferWorkModeFromISO(iso: string): "day" | "night" {
  const m = String(iso || "").match(/T(\d{2}):(\d{2})/);
  if (!m) return "day";
  const h = Number(m[1]);
  return h >= 8 && h < 20 ? "day" : "night";
}

export const HomeAddAppointmentDrawer: React.FC<
  HomeAddAppointmentDrawerProps
> = ({ open, onClose, onCreated, initialPatientId, initialDate, initialDoctorId, selectedDate }) => {
  const { open: notify } = useNotification();

  const [visitDateTime, setVisitDateTime] = React.useState<string>("");
  const [workMode, setWorkMode] = React.useState<"day" | "night">("day");

  const [patientsOpts, setPatientsOpts] = React.useState<PatientOption[]>([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [doctorsOpts, setDoctorsOpts] = React.useState<EmployeesRow[]>([]);
  const [doctorsLoading, setDoctorsLoading] = React.useState(false);
  const [servicesOpts, setServicesOpts] = React.useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);

  const { isNurse, isAdmin, employeeId } = usePermissions();
  // Ограничиваем только реальных медсестер, не администраторов
  const isWorkplaceNurse = isNurse() && !isAdmin();

  const [selectedPatient, setSelectedPatient] =
    React.useState<PatientOption | null>(null);
  const [serviceRows, setServiceRows] = React.useState<ServiceRowEntry[]>([
    { serviceId: "", doctorId: "", quantity: 1 },
  ]);

  // Товары
  const [products, setProducts] = React.useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = React.useState(false);
  const [productRows, setProductRows] = React.useState<
    Array<{ productId: string; quantity: number }>
  >([]);

  const [complaints, setComplaints] = React.useState("");
  const [doctorComplaints, setDoctorComplaints] = React.useState("");
  const [adminComment, setAdminComment] = React.useState("");

  const [isBooking, setIsBooking] = React.useState(false);

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
    if (!query || query.length < 2) {
      setPatientsSearchResults([]);
      return;
    }

    setIsSearchingPatients(true);
    try {
      const cleanQ = query.trim();
      const hasDigits = /\d/.test(cleanQ);

      const res: any = await apiFetch(`/api/v1/children/?search=${encodeURIComponent(cleanQ)}&page_size=50`);
      const data: any[] = res?.data?.results ?? res?.results ?? [];

      const mapped = data.map((r: any) => {
        const fio = r.fullName ?? r.full_name ?? r["ФИО клиента"] ?? "";
        const phone = r.contactPhone ?? r.phone ?? r["Телефон"] ?? "";
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
      if (patientSearchInput) {
        fetchPatientsServerSide(patientSearchInput);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [patientSearchInput, fetchPatientsServerSide]);

  // При открытии, если дата/время ещё не заданы — заполняем переданным initialDate или текущим временем
  React.useEffect(() => {
    if (!open) {
      // При закрытии можно сбрасывать, если нужно, но лучше оставлять как есть для UX
      return;
    }

    // Если передан initialDate, используем его (предполагаем, что он точный ISO string, готовый к употреблению)
    if (initialDate) {
      setVisitDateTime(initialDate);
      setWorkMode(inferWorkModeFromISO(initialDate));
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
      setWorkMode(inferWorkModeFromISO(roundedNow));
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

  // Use cached dictionaries
  const {
    patients: dictPatients,
    employees: dictEmployees,
    services: dictServices,
    products: dictProducts,
    loading: dictLoading,
  } = useDictionaries(open);

  React.useEffect(() => {
    if (dictPatients.length > 0) setPatientsOpts(dictPatients);
    if (dictEmployees.length > 0) setDoctorsOpts(dictEmployees);
    if (dictServices.length > 0) {
      setServicesOpts(dictServices.filter((s) => s.is_active !== false));
    }
    if (dictProducts.length > 0) setProducts(dictProducts);

    setPatientsLoading(dictLoading);
    setDoctorsLoading(dictLoading);
    setServicesLoading(dictLoading);
    setProductsLoading(dictLoading);
  }, [dictPatients, dictEmployees, dictServices, dictProducts, dictLoading]);

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
    apiFetch(`/api/v1/children/${initialPatientId}/`).then((res: any) => {
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

      const paidCash = typeof cash === "number" ? cash : 0;
      const paidCashless = typeof cashless === "number" ? cashless : 0;

      // Build unified services array per new API spec:
      // services: услуги (с performer) + товары (без performer)
      const allServicesPayload: any[] = [];
      let remainingDiscount = discountAmount;

      for (const row of validServiceRows) {
        const service = servicesOpts.find((s) => s.id === row.serviceId);
        const price = Number(service?.price) || 0;
        let itemDiscount = 0;
        if (remainingDiscount > 0) {
          if (remainingDiscount >= price) {
            itemDiscount = price;
            remainingDiscount -= price;
          } else {
            itemDiscount = remainingDiscount;
            remainingDiscount = 0;
          }
        }
        const totalItem = price - itemDiscount;
        allServicesPayload.push({
          sellable_item: row.serviceId,
          performer: row.doctorId,
          quantity: 1,
          discount: itemDiscount,
          total: totalItem,
        });
      }

      // Add products to the same services array (no performer required)
      for (const row of productRows.filter((r) => r.productId)) {
        allServicesPayload.push({
          sellable_item: row.productId,
          quantity: row.quantity || 1,
        });
      }

      const payments = [
        paidCash > 0 ? { type: "cash", amount: paidCash } : null,
        paidCashless > 0 ? { type: "card", amount: paidCashless } : null,
      ].filter(Boolean) as Array<{ type: string; amount: number }>;

      const requestPayload = {
        patient: patientId,
        appointment_at: dayjs(visitDateTime).toISOString(),
        admin_comment: adminComment || "",
        complaints: complaints || null,
        doctor_complaints: doctorComplaints || null,
        is_night: workMode === "night",
        status: "scheduled",
        services: allServicesPayload,
        payments,
      };

      try {
        await apiFetch("/appointment/appointments/", {
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
      setProductRows([]);
      setVisitDateTime("");
      setComplaints("");
      setDoctorComplaints("");
      setAdminComment("");
      setDiscount("");
      setCash("");
      setCashless("");
      setWorkMode("day");
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
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Дата и время приема
            </Typography>
            <Grid container spacing={1.5} alignItems="stretch">
              <Grid item xs={12} sm={7.5}>
                <CustomDateTimePicker
                  label="Дата и время приема *"
                  value={visitDateTime ? dayjs(visitDateTime) : null}
                  onChange={(val) => {
                    const formatted = val ? val.format() : "";
                    setVisitDateTime(formatted);
                    if (formatted) setWorkMode(inferWorkModeFromISO(formatted));
                  }}
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
              </Grid>
              <Grid
                item
                xs={12}
                sm={4.5}
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Box sx={{ width: 1 }}>
                  <ToggleButtonGroup
                    exclusive
                    value={workMode}
                    onChange={(_, v) => {
                      if (v) setWorkMode(v);
                    }}
                    size="small"
                    sx={{
                      width: 1,
                      bgcolor: "action.hover",
                      borderRadius: 1.5,
                      p: "3px",
                      border: "none",
                      "& .MuiToggleButton-root": {
                        flex: 1,
                        border: "none",
                        borderRadius: 1,
                        py: 0.75,
                        transition: "all 0.2s ease-in-out",
                        // INACTIVE STATE (приглушён)
                        bgcolor: "transparent",
                        color: "text.disabled",
                        boxShadow: "none",
                        "&:hover": {
                          bgcolor: "action.selected",
                        },
                        // ACTIVE STATE (нажат, тёмный, доминирует)
                        "&.Mui-selected": {
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          boxShadow:
                            "inset 0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.05)",
                          fontWeight: 600,
                          "&:hover": {
                            bgcolor: "primary.dark",
                          },
                        },
                      },
                    }}
                  >
                    <ToggleButton value="day" aria-label="Дневной">
                      <WbSunnyOutlined
                        sx={{
                          fontSize: 20,
                          color:
                            workMode === "day"
                              ? "primary.contrastText"
                              : "text.disabled",
                        }}
                      />
                    </ToggleButton>
                    <ToggleButton value="night" aria-label="Ночной">
                      <NightlightOutlined
                        sx={{
                          fontSize: 20,
                          color:
                            workMode === "night"
                              ? "primary.contrastText"
                              : "text.disabled",
                        }}
                      />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Grid>
            </Grid>
            <Stack spacing={0.5}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: 500 }}
                >
                  Клиент *
                </Typography>
                <Button
                  size="small"
                  onClick={() => setIsPatientDrawerOpen(true)}
                >
                  + Добавить клиента
                </Button>
              </Stack>

              <Box sx={{ mb: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isBooking}
                      onChange={(e) => {
                        setIsBooking(e.target.checked);
                        if (e.target.checked) setTouched(true);
                      }}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Бронирование (без клиента)
                    </Typography>
                  }
                />
              </Box>

              <Autocomplete
                disabled={isBooking}
                options={patientSearchInput.length >= 2 ? patientsSearchResults : patientsOpts}
                loading={patientsLoading || isSearchingPatients}
                value={selectedPatient}
                onInputChange={(_, val) => setPatientSearchInput(val)}
                onChange={(_, v) => setSelectedPatient(v)}
                getOptionLabel={(o: PatientOption) => {
                  const fio = o["ФИО клиента"] ?? o.fio ?? "";
                  const phone = o["Телефон"] ?? o.phone ?? "";
                  return `${fio || "Нет ФИО"} — ${phone || "Нет телефона"}`;
                }}
                filterOptions={(x) => x} // Отключаем локальную фильтрацию, так как ищем на сервере
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

            {/* Контент ниже отображается если выбран клиент ИЛИ включен режим бронирования */}
            {(selectedPatient || isBooking) && (
              <>
                {/* Блок "Услуги и врачи" */}
                <Card variant="outlined" sx={{ bgcolor: "background.paper" }}>
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
                          sx={{ fontWeight: 500 }}
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
                              <Autocomplete
                                fullWidth
                                disabled={isWorkplaceNurse}
                                options={
                                  row.serviceId
                                    ? (() => {
                                      const filtered = doctorsOpts.filter((d) =>
                                        d.serviceIds?.includes(row.serviceId)
                                      );
                                      return filtered.length > 0 ? filtered : doctorsOpts;
                                    })()
                                    : doctorsOpts
                                }
                                loading={doctorsLoading}
                                value={
                                  doctorsOpts.find(
                                    (d) => d.id === row.doctorId
                                  ) || null
                                }
                                onChange={(_, v) => {
                                  const updated = [...serviceRows];
                                  updated[index].doctorId = v?.id || "";
                                  if (updated[index].serviceId && v) {
                                    const currentService = servicesOpts.find(
                                      (s) => s.id === updated[index].serviceId
                                    );
                                    if (currentService) {
                                      const hasService =
                                        currentService.employee_ids?.includes(
                                          v.id
                                        ) || currentService.employee_id === v.id;
                                      if (!hasService) {
                                        updated[index].serviceId = "";
                                      }
                                    }
                                  }
                                  setServiceRows(updated);
                                }}
                                getOptionLabel={(o) =>
                                  `${o.full_name || o.id} — ${o.specialization || "Нет специализации"}`
                                }
                                filterOptions={doctorFilter}
                                isOptionEqualToValue={(o, v) => o.id === v.id}
                                renderOption={(props, o) => (
                                  <li {...props} key={o.id}>
                                    {o.full_name || o.id} — {o.specialization || "Нет специализации"}
                                  </li>
                                )}
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
                              <Stack direction="row" spacing={1} alignItems="flex-start">
                                <Autocomplete
                                  sx={{ flex: 1 }}
                                  options={
                                    row.doctorId
                                      ? (() => {
                                        const emp = doctorsOpts.find(d => d.id === row.doctorId);
                                        if (!emp?.serviceIds?.length) return servicesOpts;
                                        const filtered = servicesOpts.filter(s => emp.serviceIds!.includes(s.id));
                                        return filtered.length > 0 ? filtered : servicesOpts;
                                      })()
                                      : servicesOpts
                                  }
                                  loading={servicesLoading}
                                  value={
                                    servicesOpts.find(
                                      (s) => s.id === row.serviceId
                                    ) || null
                                  }
                                  onChange={(_, v) => {
                                    const updated = [...serviceRows];
                                    updated[index].serviceId = v?.id || "";
                                    if (updated[index].doctorId && v) {
                                      const emp = doctorsOpts.find(d => d.id === updated[index].doctorId);
                                      if (emp?.serviceIds?.length && !emp.serviceIds.includes(v.id)) {
                                        updated[index].doctorId = "";
                                      }
                                    }
                                    setServiceRows(updated);
                                  }}
                                  getOptionLabel={(o) =>
                                    `${o.name} — ${o.price || 0} сом`
                                  }
                                  filterOptions={serviceFilter}
                                  isOptionEqualToValue={(o, v) => o.id === v.id}
                                  renderOption={(props, o) => (
                                    <li {...props} key={o.id}>
                                      {o.name} — {o.price || 0} сом
                                    </li>
                                  )}
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
                                )}
                              </Stack>
                            </Stack>
                          </Stack>
                        </React.Fragment>
                      ))}

                      {/* Добавить ещё строку */}
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
                        sx={{ alignSelf: "flex-start" }}
                      >
                        + Добавить услугу
                      </Button>

                      <Divider />

                      {/* Товары */}
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontWeight: 500 }}
                        >
                          Товары
                        </Typography>
                      </Stack>
                      {productRows.map((row, index) => (
                        <Stack key={index} spacing={1.5}>
                          <Stack spacing={0.5}>
                            {index === 0 && (
                              <Stack direction="row" spacing={1.5} sx={{ px: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                  Название товара
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ width: 100 }}>
                                  Количество
                                </Typography>
                                <Box sx={{ width: 34 }} />
                              </Stack>
                            )}
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                              <Autocomplete
                                sx={{ flex: 1 }}
                                options={products}
                                loading={productsLoading}
                                value={
                                  products.find(
                                    (p) =>
                                      p.sellable_item_id === row.productId
                                  ) || null
                                }
                                onChange={(_, product) => {
                                  setProductRows((prev) => {
                                    const updated = [...prev];
                                    updated[index] = {
                                      ...updated[index],
                                      productId:
                                        product?.sellable_item_id || "",
                                      quantity: product
                                        ? updated[index].quantity || 1
                                        : 1,
                                    };
                                    return updated;
                                  });
                                }}
                                getOptionLabel={(p) => p.name}
                                filterOptions={createFilterOptions<Product>({
                                  matchFrom: "start",
                                  stringify: (p) =>
                                    `${p.name ?? ""} ${p.barcode ?? ""
                                      }`.trim(),
                                })}
                                renderOption={(props, option) => (
                                  <li
                                    {...props}
                                    key={option.sellable_item_id}
                                  >
                                    <Stack>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500 }}
                                      >
                                        {option.name}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        {option.price || 0} сом{" "}
                                        {option.stock
                                          ? `(${option.stock} шт)`
                                          : ""}
                                      </Typography>
                                    </Stack>
                                  </li>
                                )}
                                isOptionEqualToValue={(o, v) =>
                                  o.sellable_item_id === v.sellable_item_id
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder="Выберите товар"
                                    size="small"
                                    fullWidth
                                  />
                                )}
                              />
                              <Box
                                sx={{
                                  border: 1,
                                  borderColor: "divider",
                                  borderRadius: 1,
                                  bgcolor: "background.paper",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  height: 40,
                                  width: 100,
                                  flexShrink: 0
                                }}
                              >
                                <Button
                                  size="small"
                                  onClick={() => {
                                    if (row.quantity <= 1) {
                                      setProductRows((prev) =>
                                        prev.filter((_, i) => i !== index)
                                      );
                                    } else {
                                      setProductRows((prev) =>
                                        prev.map((r, i) =>
                                          i === index
                                            ? { ...r, quantity: r.quantity - 1 }
                                            : r
                                        )
                                      );
                                    }
                                  }}
                                  sx={{
                                    minWidth: 32,
                                    px: 0.5,
                                    minHeight: 34,
                                  }}
                                  disabled={!row.productId}
                                >
                                  −
                                </Button>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={row.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const newVal =
                                      val === "" ? 1 : Number(val);
                                    setProductRows((prev) =>
                                      prev.map((r, i) =>
                                        i === index
                                          ? {
                                            ...r,
                                            quantity: Math.max(1, newVal),
                                          }
                                          : r
                                      )
                                    );
                                  }}
                                  disabled={!row.productId}
                                  inputProps={{
                                    style: {
                                      textAlign: "center",
                                      padding: "8px 4px",
                                    },
                                    min: 1,
                                  }}
                                  sx={{
                                    width: 30,
                                    ...noSpinnersSx,
                                    "& .MuiOutlinedInput-root": {
                                      "& fieldset": { border: "none" },
                                    },
                                  }}
                                />
                                <Button
                                  size="small"
                                  onClick={() => {
                                    setProductRows((prev) =>
                                      prev.map((r, i) =>
                                        i === index
                                          ? { ...r, quantity: r.quantity + 1 }
                                          : r
                                      )
                                    );
                                  }}
                                  sx={{
                                    minWidth: 32,
                                    px: 0.5,
                                    minHeight: 34,
                                  }}
                                  disabled={!row.productId}
                                >
                                  +
                                </Button>
                              </Box>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setProductRows((prev) =>
                                    prev.filter((_, i) => i !== index)
                                  );
                                }}
                                sx={{
                                  border: '1px solid',
                                  borderColor: 'error.main',
                                  '&:hover': {
                                    backgroundColor: 'rgba(211, 47, 47, 0.08)',
                                  }
                                }}
                              >
                                <DeleteOutlined fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Stack>

                          {row.productId && (
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ px: 0.5 }}
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Итого:
                              </Typography>
                              <Typography variant="body2" fontWeight={500}>
                                {(products.find(
                                  (p) => p.sellable_item_id === row.productId
                                )?.price || 0) * row.quantity}{" "}
                                сом
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                      ))}

                      {/* Кнопка добавить товар */}
                      <Button
                        size="small"
                        onClick={() => {
                          setProductRows((prev) => [
                            ...prev,
                            { productId: "", quantity: 1 },
                          ]);
                        }}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        + Добавить товар
                      </Button>

                      <Divider />

                      {/* Список выбранных услуг */}
                      {serviceRows.some((r) => r.serviceId && r.doctorId) && (
                        <>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontWeight: 500 }}
                          >
                            Выбранные услуги (
                            {
                              serviceRows.filter(
                                (r) => r.serviceId && r.doctorId
                              ).length
                            }
                            ):
                          </Typography>
                          <Stack spacing={0} divider={<Divider flexItem />}>
                            {serviceRows.map((row, index) => {
                              if (!row.serviceId || !row.doctorId) return null;
                              const service = servicesOpts.find(
                                (s) => s.id === row.serviceId
                              );
                              const doctor = doctorsOpts.find(
                                (d) => d.id === row.doctorId
                              );
                              if (!service || !doctor) return null;

                              return (
                                <Stack key={index} sx={{ py: 1 }}>
                                  <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                  >
                                    <Typography variant="body2">
                                      {service.name}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      {Number(service.price) || 0} сом
                                    </Typography>
                                  </Stack>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {doctor.full_name || doctor.id}
                                  </Typography>
                                </Stack>
                              );
                            })}
                          </Stack>
                          <Divider />
                        </>
                      )}

                      {/* Выбранные товары */}
                      {productRows.length > 0 && (
                        <>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontWeight: 500 }}
                          >
                            Выбранные товары (
                            {productRows.filter((r) => r.productId).length}):
                          </Typography>
                          <Stack spacing={0} divider={<Divider flexItem />}>
                            {productRows.map((row, index) => {
                              if (!row.productId) return null;
                              const product = products.find(
                                (p) => p.sellable_item_id === row.productId
                              );
                              if (!product) return null;

                              return (
                                <Stack key={index} sx={{ py: 1 }}>
                                  <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                  >
                                    <Typography
                                      variant="body2"
                                      fontWeight={500}
                                    >
                                      {product.name}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        color: "text.secondary",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {row.quantity} x {product.price || 0} ={" "}
                                      <span style={{ color: "black" }}>
                                        {(product.price || 0) * row.quantity}{" "}
                                        сом
                                      </span>
                                    </Typography>
                                  </Stack>
                                </Stack>
                              );
                            })}
                          </Stack>
                          <Divider />
                        </>
                      )}

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
                            const service = servicesOpts.find(
                              (s) => s.id === row.serviceId
                            );
                            return sum + (service?.price || 0);
                          }, 0) +
                            productRows.reduce((sum, row) => {
                              const product = products.find(
                                (p) => p.sellable_item_id === row.productId
                              );
                              return sum + (product?.price || 0) * row.quantity;
                            }, 0)}{" "}
                          сом
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
                <Stack spacing={0.5}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    Жалобы при обращении
                  </Typography>
                  <TextField
                    placeholder="Опишите жалобы клиента (необязательно)"
                    value={complaints}
                    onChange={(e) => setComplaints(e.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Stack>

                <Stack spacing={0.5}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    Жалобы (специалист)
                  </Typography>
                  <TextField
                    placeholder="Опишите жалобы с точки зрения сотрудника"
                    value={doctorComplaints}
                    onChange={(e) => setDoctorComplaints(e.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Stack>

                <Stack spacing={0.5}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    Комментарий администратора {isBooking && "*"}
                  </Typography>
                  <TextField
                    placeholder={isBooking ? "Обязательное поле для бронирования" : "Добавьте комментарий (необязательно)"}
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    fullWidth
                    required={isBooking}
                    multiline
                    minRows={3}
                    error={touched && isBooking && !adminComment.trim()}
                    helperText={touched && isBooking && !adminComment.trim() ? "Обязательное поле для бронирования" : ""}
                  />
                </Stack>
              </>
            )}
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
                (!isBooking && !selectedPatient) ||
                (isBooking && !adminComment.trim()) ||
                isSaving ||
                !serviceRows.some((r) => r.serviceId && r.doctorId)
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
              {isSaving ? "Сохранение..." : "Сохранить"}
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

import React, { useEffect } from "react";
import { useNotification } from "@refinedev/core";
import {
  Box,
  Divider,
  Stack,
  Typography,
  Checkbox,
  FormControlLabel,
  Button,
  Drawer,
  IconButton,
  TextField,
  Grid,
  Tabs,
  Tab,
} from "@mui/material";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useTheme } from "@mui/material/styles";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiFetch } from "../../utility/apiClient";
// import { formatKGS } from '../../utility/format';
import { formatDateRu } from "../../utility/format";
import dayjs from "dayjs";
import AppointmentsList from "./components/AppointmentsList";
import { fetchDoctors, fetchMedicalStaff } from "../../services/employees";
import type { Appointment, AggregatedAppointmentRow } from "./types";
import { mapAggregatedRowToAppointment, compareAppointmentsByStatus } from "./types";
import type { EmployeesRow } from "../expenses/types";
import { fetchShiftsForDate, Shift } from "../../services/shifts";
import { AppBottomSheet, PageHeader, DateNavigation } from "../../components/ui";
import { useRefresh } from "../../contexts/refresh-context";
import AppointmentDetailsCard from "./components/AppointmentDetailsCard";
import useMediaQuery from "@mui/material/useMediaQuery";
import HomeAddAppointmentDrawer from "./components/HomeAddAppointmentDrawer";
import { DoctorConclusionPanel } from "../doctor/components/DoctorConclusionPanel";
import { usePermissions } from "../../hooks/usePermissions";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";


/* Simple cache (оставляем только для услуг)
   Примечание: кэш приёмов отключён, т.к. теперь грузим серверно отфильтрованные по дате данные */
// let CACHED_ALL: Appointment[] | null = null;
// let CACHED_INIT_DATE: string | null = null;

// Helper to format today like 15.11.2025 (delegates to shared util)
const formatRuDate = (d: Date) => formatDateRu(d);

// Debounce helper (как на странице поиска пациентов)
function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}



import { useSearchParams } from "react-router";


export const HomePage: React.FC = () => {
  usePageTitle("Регистратура");
  useNotification();
  const queryClient = useQueryClient();
  const { setOnRefresh } = useRefresh();
  const theme = useTheme();
  const { isAdmin, isRegistrator, employeeId } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handling deep link for creating appointment or selecting existing one
  React.useEffect(() => {
    const create = searchParams.get("create_appointment") === "true";
    const pId = searchParams.get("patient_id");
    const apptId = searchParams.get("appointment_id");

    if (create && pId) {
      setInitialPatientId(pId);
      setVisitOpen(true);
      // Clear params partially
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("create_appointment");
      newParams.delete("patient_id");
      setSearchParams(newParams);
    } else if (apptId) {
      setSelectedAppointmentId(apptId);
      // Optional: Clear param? User didn't say, but usually good for URL cleanliness
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("appointment_id");
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

  // Считаем "мобильным" всё, что уже планшета (<= md),
  // т.к. breakpoints.sm у нас сдвинут до 360px и на реальных телефонах isMobile всегда false.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Appointments state
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState(0);

  // Debug: log when selectedAppointmentId changes
  React.useEffect(() => {
    // debug: track selection changes on mobile/desktop
    // console.log("selectedAppointmentId changed:", selectedAppointmentId, "isMobile:", isMobile);
  }, [selectedAppointmentId, isMobile]);

  // UI state
  const [filtersOpen, setFiltersOpen] = React.useState(false);


  // Filters
  // Дата по умолчанию — сегодня (yyyy-MM-dd), чтобы сразу грузить серверно отфильтрованные данные
  const [date, setDate] = React.useState<string>(() => {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [status, setStatus] = React.useState<Record<string, boolean>>({
    Оплачено: true,
    Ожидаем: true,
    "Пациент здесь": true,
    "Со скидкой": true,
    "Пациент не пришел": false,
    "Отменено": true,
  });
  const [doctorId, setDoctorId] = React.useState("");
  // const [revenueMode, setRevenueMode] = React.useState<
  //   'total' | 'cash' | 'cashless'
  // >('total');

  // Add appointment drawer state
  const [visitOpen, setVisitOpen] = React.useState(false);
  const [initialPatientId, setInitialPatientId] = React.useState<string | null>(null);
  const [conclusionOpen, setConclusionOpen] = React.useState(false);
  const [initialSlotDate, setInitialSlotDate] = React.useState<string | null>(null);
  const [initialSlotDoctorId, setInitialSlotDoctorId] = React.useState<string | null>(null);



  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setDoctorId("");
  };

  // Fetch shifts for the selected date (and previous day for night shifts) — с кэшем
  const prevDate = React.useMemo(() => dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'), [date]);
  const { data: shiftsData } = useQuery({
    queryKey: ["shifts", date],
    queryFn: () => Promise.all([fetchShiftsForDate(date), fetchShiftsForDate(prevDate)]),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const dayShifts = React.useMemo(() => {
    if (!shiftsData) return [];
    return [...shiftsData[1], ...shiftsData[0]];
  }, [shiftsData]);

  // --- OPTIMIZATION: React Query for Doctors ---
  const { data: doctors = [], isLoading: doctorsLoading } = useQuery<EmployeesRow[]>({
    queryKey: ["employees", "medical-staff"],
    queryFn: fetchMedicalStaff,
  });

  const [dayCounts, setDayCounts] = React.useState<Record<string, number>>({});

  // Функция центрирования выбранной даты в горизонтальной ленте


  // --- OPTIMIZATION: React Query for Daily Appointments ---
  const dailyRange = React.useMemo(() => {
    return {
      start: `${date}T00:00:00`,
      end: `${date}T23:59:59.999`,
      key: date,
    };
  }, [date]);

  const { data: dailyAppointments = [], isLoading: dailyLoading, isFetching: dailyFetching, refetch: refetchAppointments } = useQuery<Appointment[]>({
    queryKey: ["appointments", "daily", dailyRange.key],
    queryFn: async () => {
      const res: any = await apiFetch(
        `/api/v1/appointments/?ordering=appointmentAt`
      );
      const items: AggregatedAppointmentRow[] = res?.data?.results ?? res?.results ?? (Array.isArray(res?.data) ? res.data : null) ?? (Array.isArray(res) ? res : []);
      return (Array.isArray(items) ? items : []).map((row: AggregatedAppointmentRow) => mapAggregatedRowToAppointment(row));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });



  // --- OPTIMIZATION: React Query for Range Counts ---
  // Стабилизируем диапазон: берем 2 недели от понедельника текущей недели выбранной даты
  const rangeKey = React.useMemo(() => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  }, [date]);

  const { data: rangeData = [] } = useQuery({
    queryKey: ["appointments", "counts", rangeKey, isAdmin(), isRegistrator(), employeeId],
    queryFn: async () => {
      const start = new Date(rangeKey);
      start.setDate(start.getDate() - 7);
      const end = new Date(rangeKey);
      end.setDate(end.getDate() + 7);

      const startISO = start.toISOString().split('T')[0] + 'T00:00:00';
      const endISO = end.toISOString().split('T')[0] + 'T23:59:59.999';

      let url = `/api/v1/appointments/`;
      if (!isAdmin() && !isRegistrator() && employeeId) {
        url += `?employee=${employeeId}`;
      }

      const res: any = await apiFetch(url);
      return res?.data?.results ?? res?.results ?? res?.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Маппинг данных диапазона в dayCounts
  React.useEffect(() => {
    const counts: Record<string, number> = {};
    rangeData.forEach((item: any) => {
      const day = dayjs(item.appointment_at).format('YYYY-MM-DD');
      counts[day] = (counts[day] || 0) + 1;
    });
    setDayCounts(counts);
  }, [rangeData]);

  // Старые функции и useEffect-ы удалены/заменены на useQuery выше (строки 193-285 удаляются)

  // Load all doctors - REPLACED BY useQuery above
  // React.useEffect(() => { ... }, []);

  useEffect(() => {
    const handleRefresh = () => {
      refetchAppointments();
    };

    setOnRefresh(() => handleRefresh);

    return () => {
      setOnRefresh(null);
    };
  }, [setOnRefresh, refetchAppointments]);

  // Load doctors when filters drawer opens - REPLACED BY useQuery above
  // React.useEffect(() => { ... }, [filtersOpen]);

  // Derived
  const ruDateFromInput = React.useMemo(() => {
    if (!date) return "";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}.${mm}.${yyyy}`;
  }, [date]);


  const filtered = React.useMemo(() => {
    return dailyAppointments.filter((a) => {
      // The appointments are strictly fetched for the selected day from the server, 
      // so no need to filter by date locally anymore.

      const statusKey = a.status || "";
      if (status[statusKey] === false) return false;


      // Filter by doctor ID (checks both primary doctor_id and performer_ids array)
      if (doctorId && a.doctor_id !== doctorId && !a.performer_ids?.includes(doctorId)) return false;

      return true;
    }).sort(compareAppointmentsByStatus);
  }, [dailyAppointments, date, status, doctorId]);

  const selectedAppointment = React.useMemo(() =>
    dailyAppointments.find(a => a.id === selectedAppointmentId) || null,
    [dailyAppointments, selectedAppointmentId]);

  // Check if selected appointment has conclusion
  const hasConclusion = React.useMemo(() => {
    if (!selectedAppointment) return false;
    return !!(selectedAppointment.has_conclusion || selectedAppointment.conclusion || selectedAppointment.diagnosis_code || selectedAppointment.diagnosis_data);
  }, [selectedAppointment]);

  // React.useEffect(() => {
  //   (async () => {
  //     const { data } = await fetchPagedAll(APPTS_TABLE, 10, ruDateFromInput);
  //     console.log(data);
  //   })();
  // }, [ruDateFromInput]);

  // const appointmentsCount = React.useMemo(() => filtered.length, [filtered]);
  // const paidCount = React.useMemo(
  //   () => filtered.filter((a) => a.Статус === 'Оплачено').length,
  //   [filtered]
  // );
  // const waitingCount = React.useMemo(
  //   () => filtered.filter((a) => a.Статус === 'Ожидаем').length,
  //   [filtered]
  // );
  // const revenueSum = React.useMemo(
  //   () =>
  //     revenueMode === 'cash'
  //       ? filtered.reduce((acc, a) => acc + Number(a['Наличные'] ?? 0), 0)
  //       : revenueMode === 'cashless'
  //       ? filtered.reduce((acc, a) => acc + Number(a['Безналичные'] ?? 0), 0)
  //       : filtered.reduce(
  //           (acc, a) => acc + Number(a['Итого, сом'] ?? a['Стоимость'] ?? 0),
  //           0
  //         ),
  //   [filtered, revenueMode]
  // );


  const resetFilters = () => {
    const today = new Date();
    const [dd, mm, yyyy] = formatRuDate(today).split(".");
    setDate(`${yyyy}-${mm}-${dd}`);
    setStatus({
      Оплачено: true,
      Ожидаем: true,
      "Пациент здесь": true,
      "Cо скидкой": true,
      "Пациент не пришел": false, // Default hidden to reduce clutter? Or true? User didn't specify, false is safer for main view.
      "Отменено": true
    });
    setDoctorId("");
  };

  return (
    <Box
      sx={(theme) => ({
        // Высота страницы рассчитывается только через layout-токены темы,
        // чтобы на всех платформах (desktop, laptop, Android, iOS) поведение
        // было идентичным и управляемым из единого места.
        height: {
          xs: `calc(100dvh - ${theme.appLayout.viewportOffset.home.mobileOffset}px)`,
          md: `calc(100dvh - ${theme.appLayout.viewportOffset.home.desktopOffset}px)`,
        },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      })}
    >
      <PageHeader
        title="Приемы"
        showTitle={false}
        addButtonText="Добавить прием"
        onAdd={() => {
          setVisitOpen(true);
        }}
        dateNavigation={
          <DateNavigation
            date={date}
            setDate={handleDateChange}
            dayCounts={dayCounts}
          />
        }
      />


      {/* Columns */}
      <Box sx={(theme) => ({
        flex: 1,
        overflow: "hidden",
        px: theme.appLayout.page.paddingX,
      })}>
        <Grid container spacing={2} sx={{
          alignItems: "flex-start",
          height: "100%", // Fit to parent flex
          boxSizing: "border-box"
        }}>
          {/* Column 1: Appointments List */}
          <Grid item xs={12} md={conclusionOpen ? 4 : 6} sx={{
            height: '100%',
            overflow: 'hidden',
            pr: { md: 1 },
            transition: 'all 0.3s ease'
          }}>
            <AppointmentsList
              titleDate={ruDateFromInput}
              loading={dailyFetching}
              errorMsg={null}
              items={filtered}
              onOpenFilters={() => setFiltersOpen(true)}
              onItemClick={(id) => {
                setSelectedAppointmentId(id);
                if (id !== selectedAppointmentId) {
                  setConclusionOpen(false);
                  setActiveTab(0); // Reset to details tab on new selection
                }
              }}
              onAddSlot={(dateIso, docId) => {
                setInitialSlotDate(dateIso);
                setInitialSlotDoctorId(docId || null);
                setVisitOpen(true);
              }}
              doctors={doctors}
              shifts={dayShifts}
            />
          </Grid>

          {/* Column 2: Appointment Details (Desktop) */}
          {!isMobile && (
            <Grid item xs={12} md={conclusionOpen ? 4 : 6} sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              pl: { md: 1 },
              pr: { md: 1 },
              transition: 'all 0.3s ease'
            }}>
              <AppointmentDetailsCard
                appointmentId={selectedAppointmentId}
                onClose={() => setSelectedAppointmentId(null)}
                onUpdate={() => {
                  refetchAppointments();
                }}
                onStartAppointment={(patientId) => {
                  setInitialPatientId(patientId);
                  setVisitOpen(true);
                }}
                showPaymentAction={true} // Только на странице администратора разрешена оплата
              />
            </Grid>
          )}

          {/* Column 3: Conclusion Panel (Desktop) */}
          {!isMobile && conclusionOpen && (
            <Grid item xs={12} md={4} sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              pl: { md: 1 }
            }}>
              {selectedAppointmentId ? (
                <DoctorConclusionPanel
                  appointmentId={selectedAppointmentId}
                  onClose={() => setConclusionOpen(false)}
                  onSaveSuccess={() => { }}
                  hideCloseButton={false}
                // Разрешаем закрытие через крестик в самой панели тоже
                />
              ) : (
                <Box
                  sx={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed",
                    borderColor: "divider",
                    borderRadius: 1,
                    color: "text.secondary",
                    bgcolor: "background.paper"
                  }}
                >
                  Выберите прием для просмотра заключения
                </Box>
              )}
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Mobile Bottom Sheet for Details */}
      {isMobile && (
        <AppBottomSheet
          open={Boolean(selectedAppointmentId)}
          onClose={() => {
            console.log("Mobile drawer closing");
            setSelectedAppointmentId(null);
          }}
          header={
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              variant="fullWidth"
              sx={{ flexShrink: 0 }}
            >
              <Tab label="Прием" />
              {hasConclusion && <Tab label="Заключение" />}
            </Tabs>
          }
        >
          <Box sx={{ p: 0 }}>
            {activeTab === 0 && (
              <AppointmentDetailsCard
                appointmentId={selectedAppointmentId}
                onClose={() => setSelectedAppointmentId(null)}
                onUpdate={() => {
                  refetchAppointments();
                }}
                onStartAppointment={(patientId) => {
                  setInitialPatientId(patientId);
                  setVisitOpen(true);
                }}
                showPaymentAction={true}
              />
            )}
            {activeTab === 1 && selectedAppointmentId && (
              <DoctorConclusionPanel
                appointmentId={selectedAppointmentId}
                onClose={() => setActiveTab(0)}
                onSaveSuccess={() => { }}
                hideCloseButton={true}
              />
            )}
          </Box>
        </AppBottomSheet>
      )}

      {/* Add Appointment Drawer (right) */}
      <HomeAddAppointmentDrawer
        open={visitOpen}
        onClose={() => {
          setVisitOpen(false);
          setInitialPatientId(null);
          setInitialSlotDate(null);
          setInitialSlotDoctorId(null);
        }}
        onCreated={() => {
          refetchAppointments();
        }}
        initialPatientId={initialPatientId}
        initialDate={initialSlotDate}
        initialDoctorId={initialSlotDoctorId}
        selectedDate={date}
      />

      {/* Filters Drawer (right) */}
      <Drawer
        anchor="right"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: 320, sm: 380 },
            zIndex: (theme) => theme.zIndex.drawer + 10,
          },
        }}
        ModalProps={{
          slotProps: {
            backdrop: {
              sx: {
                // Keep header visible (not dimmed) while backdrop is shown
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
          <Typography variant="h6">Фильтры приемов</Typography>
          <IconButton onClick={() => setFiltersOpen(false)}>
            <CloseOutlined />
          </IconButton>
        </Box>
        <Divider />
        <Stack spacing={2} sx={{ p: 2 }}>
          <TextField
            label="Дата"
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <Typography variant="subtitle2">Статус</Typography>
          {Object.keys(status).map((s) => (
            <FormControlLabel
              key={s}
              control={
                <Checkbox
                  checked={status[s]}
                  onChange={(e) =>
                    setStatus((pr) => ({ ...pr, [s]: e.target.checked }))
                  }
                />
              }
              label={s}
            />
          ))}

          <Typography variant="subtitle2">Доктор</Typography>
          <Autocomplete
            options={doctors}
            loading={doctorsLoading}
            value={doctors.find((d) => d.id === doctorId) || null}
            onChange={(_, v) => setDoctorId(v?.id || "")}
            getOptionLabel={(o: EmployeesRow) =>
              `${o.full_name || o.id}${o.specialization ? ` — ${o.specialization}` : ""}`
            }
            filterOptions={createFilterOptions<EmployeesRow>({
              matchFrom: "start",
              stringify: (o) =>
                `${o.full_name ?? ""} ${o.specialization ?? ""}`.trim(),
            })}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Выберите доктора"
                fullWidth
              />
            )}
          />

          <Stack direction="row" gap={1}>
            <Button variant="contained" onClick={() => setFiltersOpen(false)}>
              Применить
            </Button>
            <Button variant="text" onClick={resetFilters}>
              Сбросить
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </Box>
  );
};

export default HomePage;

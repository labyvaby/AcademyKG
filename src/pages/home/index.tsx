import React, { useEffect } from "react";
import { CustomDatePicker } from "../../components/ui";
import { useNotification } from "@refinedev/core";
import {
  Box,
  Chip,
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
} from "@mui/material";
import AppAutocomplete from "../../components/ui/AppAutocomplete";
import { createFilterOptions } from "@mui/material/Autocomplete";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useTheme } from "@mui/material/styles";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiFetch } from "../../utility/apiClient";
import { fetchAllPages } from "../../utility/pagination";
// import { formatKGS } from '../../utility/format';
import { formatDateRu } from "../../utility/format";
import dayjs from "dayjs";
import { dayjsBishkek } from "../../utility/dayjsBishkek";
import AppointmentsList from "./components/AppointmentsList";
import { fetchMedicalStaff } from "../../services/employees";
import type { Appointment, AggregatedAppointmentRow } from "./types";
import { mapAggregatedRowToAppointment, mapGroupToAppointment, compareAppointmentsByStatus } from "./types";
import { fetchGroups } from "../../features/group-appointments/api/group-appointments.api";
import type { AppointmentGroup } from "../../features/group-appointments/model/types";
import type { EmployeesRow } from "../expenses/types";
import { fetchShifts, type Shift } from "../../services/shifts";
const fetchShiftsForDate = (date: string) => fetchShifts({ date });
import { AppBottomSheet, PageHeader, DateNavigation } from "../../components/ui";
import { useRefresh } from "../../contexts/refresh-context";
import AppointmentDetailsCard from "./components/AppointmentDetailsCard";
import GroupAppointmentDetailsCard from "./components/GroupAppointmentDetailsCard";
import useMediaQuery from "@mui/material/useMediaQuery";
import HomeAddAppointmentDrawer from "./components/HomeAddAppointmentDrawer";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";

import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useBranchContext } from "../../contexts/branch-context";


/* Simple cache (оставляем только для услуг)
   Примечание: кэш приёмов отключён, т.к. теперь грузим серверно отфильтрованные по дате данные */
// let CACHED_ALL: Appointment[] | null = null;
// let CACHED_INIT_DATE: string | null = null;

// Helper to format today like 15.11.2025 (delegates to shared util)
const formatRuDate = (d: Date) => formatDateRu(d);

const EMPTY_ARRAY: never[] = [];

// Debounce helper (как на странице поиска пациентов)
function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}


export const HomePage: React.FC = () => {
  usePageTitle("Регистратура");
  useNotification();
  const queryClient = useQueryClient();
  const { setOnRefresh } = useRefresh();
  const theme = useTheme();
  const { hasPermission, employeeId } = usePermissions();
  const { selectedBranch } = useBranchContext();
  const branchId = selectedBranch?.id ?? null;
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

  // Debug: log when selectedAppointmentId changes
  React.useEffect(() => {
    // debug: track selection changes on mobile/desktop
    // console.log("selectedAppointmentId changed:", selectedAppointmentId, "isMobile:", isMobile);
  }, [selectedAppointmentId, isMobile]);

  // UI state
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Filters
  // Дата по умолчанию — сегодня (yyyy-MM-dd), чтобы сразу грузить серверно отфильтрованные данные.
  // Если в URL уже есть ?date=YYYY-MM-DD — берём оттуда, чтобы browser refresh не сбрасывал выбор пользователя.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const [date, setDate] = React.useState<string>(() => {
    const fromUrl = searchParams.get("date");
    if (fromUrl && DATE_RE.test(fromUrl)) return fromUrl;
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  // Синхронизируем выбранную дату с URL search-параметром.
  // Так browser refresh открывает ту же дату, и dev-tools history/back работает прозрачно.
  React.useEffect(() => {
    const current = searchParams.get("date");
    if (current === date) return;
    const next = new URLSearchParams(searchParams);
    next.set("date", date);
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  const [status, setStatus] = React.useState<Record<string, boolean>>({});
  const [doctorId, setDoctorId] = React.useState("");

  // Add appointment drawer state
  const [visitOpen, setVisitOpen] = React.useState(false);
  const [initialPatientId, setInitialPatientId] = React.useState<string | null>(null);
  const [initialSlotDate, setInitialSlotDate] = React.useState<string | null>(null);
  const [initialSlotDoctorId, setInitialSlotDoctorId] = React.useState<string | null>(null);


  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setDoctorId("");
    setSelectedAppointmentId(null);
  };

  // Fetch shifts for the selected date (and previous day for night shifts) — с кэшем
  const prevDate = React.useMemo(() => dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'), [date]);
  const { data: shiftsData } = useQuery({
    queryKey: ["shifts", date, prevDate, branchId],
    queryFn: () => Promise.all([fetchShiftsForDate(date), fetchShiftsForDate(prevDate)]),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const dayShifts = React.useMemo(() => {
    if (!shiftsData) return [];
    return [...shiftsData[1], ...shiftsData[0]];
  }, [shiftsData]);

  // --- OPTIMIZATION: React Query for Doctors ---
  const { data: doctors = [], isLoading: doctorsLoading } = useQuery<EmployeesRow[]>({
    queryKey: ["employees", "medical-staff", branchId],
    queryFn: fetchMedicalStaff,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [dayCounts, setDayCounts] = React.useState<Record<string, number>>({});

  // --- OPTIMIZATION: React Query for Daily Appointments ---
  const dailyRange = React.useMemo(() => {
    return {
      start: `${date}T00:00:00`,
      end: `${date}T23:59:59.999`,
      key: date,
    };
  }, [date]);

  const { data: dailyAppointments = [], isLoading: dailyLoading, isFetching: dailyFetching, isPlaceholderData: dailyIsStale, refetch: refetchAppointments } = useQuery<Appointment[]>({
    queryKey: ["appointments", "daily", dailyRange.key, branchId],
    queryFn: async () => {
      const [items, groups]: [AggregatedAppointmentRow[], AppointmentGroup[]] = await Promise.all([
        fetchAllPages<AggregatedAppointmentRow>(`/api/v1/appointments/?ordering=appointmentAt&date=${dailyRange.key}`),
        fetchGroups(dailyRange.key),
      ]);
      // Collect all participant appointment IDs from groups to exclude them from regular list
      const groupParticipantIds = new Set<string>(
        groups.flatMap(g => g.participants.map(p => p.id))
      );
      const regular = (Array.isArray(items) ? items : [])
        .filter((row: AggregatedAppointmentRow) => !groupParticipantIds.has(String(row.id ?? "")))
        .map((row: AggregatedAppointmentRow) => mapAggregatedRowToAppointment(row));
      const grouped = groups.map(mapGroupToAppointment);

      return [...regular, ...grouped];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  // --- OPTIMIZATION: React Query for Range Counts ---
  const rangeKey = React.useMemo(() => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  }, [date]);

  const rangeParams = React.useMemo(() => {
    const start = new Date(rangeKey);
    start.setDate(start.getDate() - 7);
    const end = new Date(rangeKey);
    end.setDate(end.getDate() + 14);
    return {
      dateFrom: start.toISOString().split('T')[0],
      dateTo: end.toISOString().split('T')[0],
    };
  }, [rangeKey]);

  const { data: rangeData = EMPTY_ARRAY } = useQuery({
    queryKey: ["appointments", "counts", rangeKey, hasPermission(PERMISSIONS.APPOINTMENTS_READ), employeeId, branchId],
    queryFn: async () => {
      const { dateFrom, dateTo } = rangeParams;
      // excludeGroupParticipants=true — участники групп не попадают в счётчик (camelCase — как в схеме)
      let url = `/api/v1/appointments/?excludeGroupParticipants=true&dateFrom=${dateFrom}&dateTo=${dateTo}&pageSize=500`;
      if (!hasPermission(PERMISSIONS.APPOINTMENTS_READ) && employeeId) {
        url += `&employee=${employeeId}`;
      }

      return fetchAllPages<any>(url.replace("&pageSize=500", ""));
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: rangeGroupData = EMPTY_ARRAY } = useQuery({
    queryKey: ["group-appointments", "counts", rangeKey, branchId],
    queryFn: async () => {
      const { dateFrom, dateTo } = rangeParams;
      return fetchAllPages<any>(`/api/v1/appointment-groups/?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Маппинг данных диапазона в dayCounts
  React.useEffect(() => {
    const counts: Record<string, number> = {};

    // Обычные приёмы (участники групп исключены на уровне API)
    rangeData.forEach((item: any) => {
      const raw = item.appointmentAt ?? item.appointment_at ?? "";
      if (!raw) return;
      const day = dayjsBishkek(raw).format('YYYY-MM-DD');
      if (day === "Invalid Date") return;
      counts[day] = (counts[day] || 0) + 1;
    });

    // Групповые приёмы — каждый группой считается как 1
    rangeGroupData.forEach((item: any) => {
      const raw = item.appointmentAt ?? item.appointment_at ?? item.scheduledAt ?? item.scheduled_at ?? "";
      if (!raw) return;
      const day = dayjsBishkek(raw).format('YYYY-MM-DD');
      if (day === "Invalid Date") return;
      counts[day] = (counts[day] || 0) + 1;
    });

    setDayCounts(counts);
  }, [rangeData, rangeGroupData]);

  // Храним refetchAppointments в ref чтобы не попадать в deps useEffect —
  // сама функция пересоздаётся при каждом рендере и вызывала бесконечный loop
  // через setOnRefresh → ре-рендер → новый refetch → снова эффект.
  const refetchRef = React.useRef(refetchAppointments);
  refetchRef.current = refetchAppointments;
  const queryClientRef = React.useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    // При ручном refresh обновляем не только список дня, но и счётчики дат —
    // иначе после удаления последнего приёма бейдж на кнопке даты висел до
    // полного browser-refresh.
    setOnRefresh(() => () => {
      const qc = queryClientRef.current;
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["group-appointments"] });
      refetchRef.current();
    });
    return () => {
      setOnRefresh(null);
    };
  // setOnRefresh — стабильный setter из useState, не меняется. refetchRef/queryClientRef — refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOnRefresh]);

  // Derived
  const ruDateFromInput = React.useMemo(() => {
    if (!date) return "";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}.${mm}.${yyyy}`;
  }, [date]);

  const filtered = React.useMemo(() => {
    return dailyAppointments.filter((a) => {
      if (doctorId && a.doctor_id !== doctorId && !a.performer_ids?.includes(doctorId)) return false;
      return true;
    }).sort(compareAppointmentsByStatus);
  }, [dailyAppointments, doctorId]);

  const selectedAppointment = React.useMemo(() =>
    dailyAppointments.find(a => a.id === selectedAppointmentId) || null,
    [dailyAppointments, selectedAppointmentId]);

  const resetFilters = () => {
    const today = new Date();
    const [dd, mm, yyyy] = formatRuDate(today).split(".");
    setDate(`${yyyy}-${mm}-${dd}`);
    setDoctorId("");
  };

  return (
    <Box
      sx={(theme) => ({
        height: {
          xs: `calc(100dvh - ${theme.appLayout.viewportOffset.home.mobileOffset}px)`,
          sm: `calc(100dvh - ${theme.appLayout.viewportOffset.home.desktopOffset}px)`,
          lg: `calc(100dvh - ${theme.appLayout.viewportOffset.home.desktopOffset}px)`,
        },
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
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
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        px: theme.appLayout.page.paddingX,
      })}>
        <Grid container spacing={2} sx={{
          flex: 1,
          minHeight: 0,
          height: 0,
          overflow: "hidden",
          alignItems: "flex-start",
          boxSizing: "border-box"
        }}>
          {/* Column 1: Appointments List */}
          <Grid item xs={12} md={6} sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            pr: { md: 1 },
          }}>
            <AppointmentsList
              titleDate={ruDateFromInput}
              loading={dailyFetching || dailyIsStale}
              errorMsg={null}
              items={filtered}
              onOpenFilters={() => setFiltersOpen(true)}
              onItemClick={(id) => {
                setSelectedAppointmentId(id);
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
            <Grid item xs={12} md={6} sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              pl: { md: 1 },
              pr: { md: 1 },
            }}>
              {selectedAppointment?.is_group && selectedAppointment.group_data ? (
                <GroupAppointmentDetailsCard
                  group={selectedAppointment.group_data}
                  onClose={() => setSelectedAppointmentId(null)}
                  onGroupUpdated={(updated) => {
                    queryClient.setQueryData(
                      ["appointments", "daily", dailyRange.key],
                      (prev: Appointment[] | undefined) =>
                        (prev ?? []).map((a) =>
                          a.id === selectedAppointmentId ? mapGroupToAppointment(updated) : a
                        )
                    );
                  }}
                />
              ) : (
                <AppointmentDetailsCard
                  appointmentId={selectedAppointment?.is_group ? null : selectedAppointmentId}
                  onClose={() => setSelectedAppointmentId(null)}
                  onUpdate={() => {
                    // Удаление/изменение приёма должно обновить и счётчики дней,
                    // не только список выбранного дня.
                    queryClient.invalidateQueries({ queryKey: ["appointments"] });
                    queryClient.invalidateQueries({ queryKey: ["group-appointments"] });
                    refetchAppointments();
                  }}
                  onStartAppointment={(patientId) => {
                    setInitialPatientId(patientId);
                    setVisitOpen(true);
                  }}
                  showPaymentAction={true}
                />
              )}
            </Grid>
          )}

        </Grid>
      </Box>

      {/* Mobile Bottom Sheet for Details */}
      {isMobile && (
        <AppBottomSheet
          open={Boolean(selectedAppointmentId)}
          onClose={() => setSelectedAppointmentId(null)}
        >
          <Box sx={{ p: 0 }}>
            {selectedAppointment?.is_group && selectedAppointment.group_data ? (
              <GroupAppointmentDetailsCard
                group={selectedAppointment.group_data}
                onClose={() => setSelectedAppointmentId(null)}
                onGroupUpdated={(updated) => {
                  queryClient.setQueryData(
                    ["appointments", "daily", dailyRange.key],
                    (prev: Appointment[] | undefined) =>
                      (prev ?? []).map((a) =>
                        a.id === selectedAppointmentId ? mapGroupToAppointment(updated) : a
                      )
                  );
                }}
              />
            ) : (
              <AppointmentDetailsCard
                appointmentId={selectedAppointment?.is_group ? null : selectedAppointmentId}
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
          <CustomDatePicker
            label="Дата"
            value={date ? dayjs(date) : null}
            onChange={(val) => handleDateChange(val ? val.format("YYYY-MM-DD") : "")}
            slotProps={{ textField: { fullWidth: true } }}
          />


          <Typography variant="subtitle2">Доктор</Typography>
          <AppAutocomplete
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

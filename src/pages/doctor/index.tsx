import React, { useState, useEffect, useMemo } from "react";
import AppAutocomplete from "../../components/ui/AppAutocomplete";
import { dayjsBishkek } from "../../utility/dayjsBishkek";
import {
    Box,
    Grid,
    useMediaQuery,
    useTheme,
    Stack,
    Typography,
    Tabs,
    Tab,
    TextField,
    Avatar
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { usePageTitle } from "../../hooks/usePageTitle";
import type { Appointment, AggregatedAppointmentRow } from "../home/types";
import { mapAggregatedRowToAppointment, compareAppointmentsByStatus } from "../home/types";
import AppointmentsList from "../home/components/AppointmentsList";
import { AppointmentDetailsCard } from "../home/components/AppointmentDetailsCard";
import { PageHeader, AppBottomSheet, DateNavigation } from "../../components/ui";
import { useRefresh } from "../../contexts/refresh-context";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";

import { fetchMedicalStaff } from "../../services/employees";
import type { EmployeesRow } from "../expenses/types";
import { apiFetch } from "../../utility/apiClient";

const DoctorWorkPage: React.FC = () => {
    usePageTitle("Кабинет специалиста");
    useNotification();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const { setOnRefresh } = useRefresh();
    const { hasPermission, hasRole, loading: permLoading, employeeId, employee } = usePermissions();
    const queryClient = useQueryClient();

    // Тренер/specialist видит только свои приёмы, даже если у него есть appointments.read
    const isSpecialist = hasRole('specialist');
    const canSeeAll = hasPermission(PERMISSIONS.APPOINTMENTS_READ) && !isSpecialist;

    const [date, setDate] = useState(() => {
        const t = new Date();
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    });
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState(0);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

    const ruDateFromInput = useMemo(() => {
        if (!date) return "";
        const [yyyy, mm, dd] = date.split("-");
        return `${dd}.${mm}.${yyyy}`;
    }, [date]);

    // --- Загрузка приёмов ---
    const queryKey = ["doctor-appointments-v2", date, employeeId, canSeeAll, selectedDoctorId];

    const { data: appointments = [], isLoading, isFetching, isPlaceholderData, refetch } = useQuery<Appointment[]>({
        queryKey,
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const params = new URLSearchParams({ ordering: "appointmentAt", date, pageSize: "200" });
            if (!canSeeAll && employeeId) {
                params.set("specialist", employeeId);
            } else if (canSeeAll && selectedDoctorId) {
                params.set("specialist", selectedDoctorId);
            }
            const res: any = await apiFetch(`/api/v1/appointments/?${params.toString()}`);
            const data: any[] = res?.data?.results ?? res?.results ?? [];
            const specialistFilter = params.get("specialist");

            // Берём список специалистов из кэша React Query для подстановки имён
            const currentDoctors: EmployeesRow[] =
                queryClient.getQueryData<EmployeesRow[]>(["employees", "medical-staff"]) ?? [];

            // Имя текущего специалиста (для fallback когда тренер смотрит свои приёмы)
            const currentEmployeeName = !canSeeAll && employee
                ? (employee.full_name ?? employee.fullName ?? employee.name ?? null)
                : null;

            return data.map((row: any) => {
                const appt = mapAggregatedRowToAppointment(row as AggregatedAppointmentRow);

                // Подставляем doctor_id из specialist фильтра если отсутствует
                if (specialistFilter) {
                    if (!appt.doctor_id) appt.doctor_id = specialistFilter;
                    if (!appt.performer_ids?.length) appt.performer_ids = [specialistFilter];
                }

                // Подставляем doctor_id из сервисов если отсутствует
                if (!appt.doctor_id && appt.parsed_services?.[0]?.performer_id) {
                    appt.doctor_id = appt.parsed_services[0].performer_id;
                }

                // Подставляем имя специалиста из списка врачей по doctor_id
                if (!appt.doctor_name && appt.doctor_id) {
                    const doc = currentDoctors.find(d => String(d.id) === String(appt.doctor_id));
                    if (doc) appt.doctor_name = doc.full_name || "";
                }

                // Подставляем имена исполнителей в сервисах
                if (appt.parsed_services) {
                    appt.parsed_services.forEach(svc => {
                        if (!svc.performer_name && svc.performer_id) {
                            const doc = currentDoctors.find(d => String(d.id) === String(svc.performer_id));
                            if (doc) svc.performer_name = doc.full_name || "";
                        }
                    });
                }

                // Финальный fallback: для специалиста подставляем его собственное имя
                if (currentEmployeeName) {
                    if (!appt.doctor_name) appt.doctor_name = currentEmployeeName;
                    if (appt.parsed_services) {
                        appt.parsed_services.forEach(svc => {
                            if (!svc.performer_name) svc.performer_name = currentEmployeeName;
                        });
                    }
                }

                return appt;
            });
        },
        enabled: !permLoading && (canSeeAll || !!employeeId),
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: false
});

    // --- Счётчики дней (диапазон ±2 недели от выбранной даты) ---
    const rangeKey = useMemo(() => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff)).toISOString().split("T")[0];
    }, [date]);

    const rangeParams = useMemo(() => {
        const start = new Date(rangeKey);
        start.setDate(start.getDate() - 7);
        const end = new Date(rangeKey);
        end.setDate(end.getDate() + 14);
        return {
            dateFrom: start.toISOString().split("T")[0],
            dateTo: end.toISOString().split("T")[0]
};
    }, [rangeKey]);

    const { data: dayCounts = {} } = useQuery<Record<string, number>>({
        queryKey: ["doctor-counts", rangeKey, employeeId, canSeeAll, selectedDoctorId],
        queryFn: async () => {
            const { dateFrom, dateTo } = rangeParams;
            const params = new URLSearchParams({ dateFrom, dateTo, excludeGroupParticipants: "true", pageSize: "500" });
            if (!canSeeAll && employeeId) params.set("specialist", employeeId);
            else if (canSeeAll && selectedDoctorId) params.set("specialist", selectedDoctorId);
            const res: any = await apiFetch(`/api/v1/appointments/?${params.toString()}`);
            const data: any[] = res?.data?.results ?? res?.results ?? [];
            const counts: Record<string, number> = {};
            data.forEach(item => {
                const raw = item.appointmentAt ?? item.appointment_at ?? "";
                if (!raw) return;
                const day = dayjsBishkek(raw).format("YYYY-MM-DD");
                if (day && day !== "Invalid Date") counts[day] = (counts[day] || 0) + 1;
            });
            return counts;
        },
        enabled: !permLoading && (canSeeAll || !!employeeId),
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false
});

    // --- Список специалистов (для подстановки имён и фильтра суперадмина) ---
    const { data: doctors = [] } = useQuery<EmployeesRow[]>({
        queryKey: ["employees", "medical-staff"],
        queryFn: fetchMedicalStaff,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false
});

    // API уже фильтрует по дате (?date=), просто сортируем
    const filteredAppointments = useMemo(() =>
        [...appointments].sort(compareAppointmentsByStatus),
    [appointments]);

    const selectedAppointment = useMemo(() =>
        appointments.find(a => a.id === selectedAppointmentId) ?? null,
        [appointments, selectedAppointmentId]);

    // --- Кнопка обновления ---
    useEffect(() => {
        setOnRefresh(() => () => {
            queryClient.invalidateQueries({ queryKey: ["doctor-appointments-v2"] });
            queryClient.invalidateQueries({ queryKey: ["doctor-counts"] });
        });
        return () => setOnRefresh(null);
    }, [setOnRefresh, queryClient]);

    return (
        <Box
            sx={(theme) => ({
                height: {
                    xs: `calc(100dvh - ${theme.appLayout.viewportOffset.home.mobileOffset}px)`,
                    sm: `calc(100dvh - ${theme.appLayout.viewportOffset.home.desktopOffset}px)`,
                    lg: `calc(100dvh - ${theme.appLayout.viewportOffset.home.desktopOffset}px)`
},
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
                overflow: "hidden"
})}
        >
            <PageHeader
                title="Кабинет специалиста"
                showTitle={false}
                dateNavigation={
                    <DateNavigation
                        date={date}
                        setDate={setDate}
                        dayCounts={dayCounts}
                    />
                }
            />

            {canSeeAll && (
                <Box sx={{ px: 2, pb: 1 }}>
                    <AppAutocomplete
                        size="small"
                        options={doctors}
                        value={doctors.find(d => d.id === selectedDoctorId) ?? null}
                        onChange={(_, v) => setSelectedDoctorId(v?.id ?? null)}
                        getOptionLabel={(d) => d.full_name ?? ""}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        noOptionsText="Нет специалистов"
                        renderOption={(props, d) => (
                            <li {...props} key={d.id}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                                        {(d.full_name ?? "?")[0]}
                                    </Avatar>
                                    <Typography variant="body2">{d.full_name}</Typography>
                                </Stack>
                            </li>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Все специалисты"
                                size="small"
                                sx={{ minWidth: 220, bgcolor: "background.paper", borderRadius: 1 }}
                            />
                        )}
                        sx={{ maxWidth: 320 }}
                    />
                </Box>
            )}

            <Box sx={(theme) => ({
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                px: theme.appLayout.page.paddingX
})}>
                <Grid container spacing={2} sx={{ flex: 1, minHeight: 0, height: 0, overflow: "hidden", alignItems: "flex-start", boxSizing: "border-box" }}>
                    <Grid item xs={12} md={6} sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", pr: { md: 1 } }}>
                        <AppointmentsList
                            titleDate={ruDateFromInput}
                            loading={isFetching || isPlaceholderData}
                            errorMsg={null}
                            items={filteredAppointments}
                            doctors={doctors}
                            onOpenFilters={() => {}}
                            onItemClick={(id) => {
                                setSelectedAppointmentId(id);
                                setActiveTab(0);
                            }}
                            hideDoctorFilter={!canSeeAll || !!selectedDoctorId}
                            restrictToDoctorId={!canSeeAll ? (employeeId ?? undefined) : undefined}
                        />
                    </Grid>

                    {!isMobile && (
                        <Grid item xs={12} md={6} sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", pl: { md: 1 }, pr: { md: 1 } }}>
                            {selectedAppointmentId ? (
                                <AppointmentDetailsCard
                                    appointmentId={selectedAppointmentId}
                                    onClose={() => setSelectedAppointmentId(null)}
                                    onUpdate={() => {
                                        queryClient.invalidateQueries({ queryKey: ["doctor-appointments-v2"] });
                                        queryClient.invalidateQueries({ queryKey: ["doctor-counts"] });
                                    }}
                                />
                            ) : (
                                <Box sx={{
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "1px dashed",
                                    borderColor: "divider",
                                    borderRadius: 1,
                                    color: "text.secondary",
                                    bgcolor: "background.paper"
}}>
                                    Выберите прием из списка
                                </Box>
                            )}
                        </Grid>
                    )}
                </Grid>
            </Box>

            {isMobile && (
                <AppBottomSheet
                    open={Boolean(selectedAppointmentId)}
                    onClose={() => setSelectedAppointmentId(null)}
                >
                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
                            <Tab label="Прием" />
                            <Tab label="Работа" />
                        </Tabs>
                    </Box>
                    {activeTab === 0 && selectedAppointmentId && (
                        <AppointmentDetailsCard
                            appointmentId={selectedAppointmentId}
                            onClose={() => setSelectedAppointmentId(null)}
                            onUpdate={() => {
                                queryClient.invalidateQueries({ queryKey: ["doctor-appointments-v2"] });
                                queryClient.invalidateQueries({ queryKey: ["doctor-counts"] });
                            }}
                        />
                    )}
                    {activeTab === 1 && (
                        <Box sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">Работа</Typography>
                        </Box>
                    )}
                </AppBottomSheet>
            )}

        </Box>
    );
};

export default DoctorWorkPage;

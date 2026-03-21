import React, { useState, useEffect, useMemo } from "react";
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
    Autocomplete,
    TextField,
    Avatar,
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "../../hooks/usePageTitle";
import type { Appointment, AggregatedAppointmentRow } from "../home/types";
import { mapAggregatedRowToAppointment, compareAppointmentsByStatus } from "../home/types";
import AppointmentsList from "../home/components/AppointmentsList";
import { AppointmentDetailsCard } from "../home/components/AppointmentDetailsCard";
import { PageHeader, AppBottomSheet, DateNavigation } from "../../components/ui";
import { useRefresh } from "../../contexts/refresh-context";
import DoctorWorkDrawer from "../../components/home/DoctorWorkDrawer";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchDoctors } from "../../services/employees";
import type { EmployeesRow } from "../expenses/types";
import { apiFetch } from "../../utility/apiClient";

const DoctorWorkPage: React.FC = () => {
    usePageTitle("Кабинет специалиста");
    useNotification();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const { setOnRefresh } = useRefresh();
    const { isAdmin, loading: permLoading, employeeId } = usePermissions();
    const queryClient = useQueryClient();

    const canSeeAll = isAdmin();

    const [date, setDate] = useState(() => {
        const t = new Date();
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    });
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const [doctorWorkOpen, setDoctorWorkOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

    const ruDateFromInput = useMemo(() => {
        if (!date) return "";
        const [yyyy, mm, dd] = date.split("-");
        return `${dd}.${mm}.${yyyy}`;
    }, [date]);

    // --- Загрузка приёмов ---
    const queryKey = ["doctor-appointments", date, employeeId, canSeeAll, selectedDoctorId];

    const { data: appointments = [], isLoading, refetch } = useQuery<Appointment[]>({
        queryKey,
        queryFn: async () => {
            const params = new URLSearchParams({ ordering: "appointmentAt", date });
            if (!canSeeAll && employeeId) {
                params.set("specialist", employeeId);
            } else if (canSeeAll && selectedDoctorId) {
                params.set("specialist", selectedDoctorId);
            }
            const url = `/api/v1/appointments/?${params.toString()}`;
            const res: any = await apiFetch(url);
            const data: any[] = res?.data?.results ?? res?.results ?? [];
            const specialistFilter = params.get("specialist");
            return data.map((row: any) => {
                const appt = mapAggregatedRowToAppointment(row as AggregatedAppointmentRow);
                if (specialistFilter) {
                    if (!appt.doctor_id) appt.doctor_id = specialistFilter;
                    if (!appt.performer_ids?.length) appt.performer_ids = [specialistFilter];
                }
                return appt;
            });
        },
        enabled: !permLoading && (canSeeAll || !!employeeId),
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // --- Счётчики дней (все приёмы специалиста без фильтра по дате) ---
    const countsKey = ["doctor-counts", employeeId, canSeeAll, selectedDoctorId];

    const { data: dayCounts = {} } = useQuery<Record<string, number>>({
        queryKey: countsKey,
        queryFn: async () => {
            const params = new URLSearchParams({});
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
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // --- Список специалистов для суперадмин ---
    const { data: doctors = [] } = useQuery<EmployeesRow[]>({
        queryKey: ["doctor-page-doctors"],
        queryFn: fetchDoctors,
        enabled: canSeeAll,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
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
            queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
            queryClient.invalidateQueries({ queryKey: ["doctor-counts"] });
        });
        return () => setOnRefresh(null);
    }, [setOnRefresh, queryClient]);

    return (
        <Box
            sx={(theme) => ({
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
                    <Autocomplete
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
                overflow: "hidden",
                px: theme.appLayout.page.paddingX,
            })}>
                <Grid container spacing={2} sx={{ alignItems: "flex-start", height: "100%", boxSizing: "border-box" }}>
                    <Grid item xs={12} md={6} sx={{ height: "100%", overflow: "hidden", pr: { md: 1 } }}>
                        <AppointmentsList
                            titleDate={ruDateFromInput}
                            loading={isLoading}
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
                        <Grid item xs={12} md={6} sx={{ height: "100%", display: "flex", flexDirection: "column", pl: { md: 1 }, pr: { md: 1 } }}>
                            {selectedAppointmentId ? (
                                <AppointmentDetailsCard
                                    appointmentId={selectedAppointmentId}
                                    onClose={() => setSelectedAppointmentId(null)}
                                    onUpdate={() => {
                                        queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
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
                                    bgcolor: "background.paper",
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
                                queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
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

            <DoctorWorkDrawer
                open={doctorWorkOpen}
                onClose={() => setDoctorWorkOpen(false)}
                appointment={selectedAppointment}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] })}
            />
        </Box>
    );
};

export default DoctorWorkPage;

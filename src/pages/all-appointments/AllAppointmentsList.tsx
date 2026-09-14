import React from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Paper,
    Typography,
    Grid2,
    TextField,
    MenuItem,
    Button,
    Stack,
    List,
    ListItemButton,
    ListItemText,
    Collapse,
    useTheme,
    useMediaQuery,
    ToggleButtonGroup,
    ToggleButton,
    Chip,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";

import { useActiveMonths } from "../../hooks/useActiveMonths";
import { PageHeader, AppBottomSheet } from "../../components/ui";
import { formatDateRu } from "../../utility/format";
import { apiFetch } from "../../utility/apiClient";
import { fetchAllPages } from "../../utility/pagination";
import AppointmentsList from "../home/components/AppointmentsList";
import AppointmentDetailsCard from "../home/components/AppointmentDetailsCard";
import { mapAggregatedRowToAppointment, Appointment, AggregatedAppointmentRow } from "../home/types";
import { fetchMedicalStaff } from "../../services/employees";
import { EmployeesRow } from "../expenses/types";
import dayjs from "dayjs";
import type { AppointmentGroup } from "../../features/group-appointments/model/types";

export const AllAppointmentsList: React.FC = () => {
    const { t } = useTranslation();
    const MONTH_NAMES = t("common.months", { returnObjects: true }) as string[];
    usePageTitle(t("menu.allServices"));
    const { hasPermission, hasRole, employeeId, employee } = usePermissions();
    const isSpecialist = hasRole('specialist');
    const canViewAll = hasPermission(PERMISSIONS.APPOINTMENTS_READ) && !isSpecialist;

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const activeMonthsSet = useActiveMonths("HistoryAppointments", "appointment_at", true);

    // State
    const [history, setHistory] = React.useState<Appointment[]>([]);
    const [doctors, setDoctors] = React.useState<EmployeesRow[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Filters State - Default to current year and month
    const [selectedYear, setSelectedYear] = React.useState<string | null>(dayjs().year().toString());
    const [selectedMonth, setSelectedMonth] = React.useState<string | null>(dayjs().format("YYYY-MM"));
    const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);

    // UI State for Details/Conclusion

    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedEmployeeFilter, setSelectedEmployeeFilter] = React.useState<string | null>(null);
    const [expandedEmployee, setExpandedEmployee] = React.useState<string | null>(null);

    // Filter mode: "date" | "services"
    const [filterMode, setFilterMode] = React.useState<"date" | "services">("date");
    // Services mode: selected employee to drill down
    const [selectedServiceEmployee, setSelectedServiceEmployee] = React.useState<string | null>(null);

    // Guard against race conditions: each fetch gets a unique id; only the latest is committed
    const fetchIdRef = React.useRef(0);

    // Fetch Data
    const fetchData = React.useCallback(async () => {
        const myId = ++fetchIdRef.current;
        setLoading(true);
        try {
            // Fetch Doctors for avatars
            // Fetch Doctors for avatars
            let currentDoctors = doctors;
            if (currentDoctors.length === 0) {
                currentDoctors = await fetchMedicalStaff();
                if (fetchIdRef.current !== myId) return;
                setDoctors(currentDoctors);
            }

            const params = new URLSearchParams({ ordering: "-appointmentAt" });
            if (!canViewAll && employeeId) params.set("specialist", employeeId);
            // Always fetch full month — date filtering is done client-side
            // so the employee list in the left panel stays intact when a date is selected
            if (selectedMonth) {
                const lastDay = dayjs(selectedMonth).endOf("month").format("YYYY-MM-DD");
                params.set("dateFrom", `${selectedMonth}-01`);
                params.set("dateTo", lastDay);
            }

            const data = await fetchAllPages<any>(`/api/v1/appointments/?${params.toString()}`);
            if (fetchIdRef.current !== myId) return;

            // Группы подгружаются отдельно через useEffect при смене selectedDate
            // Здесь просто маппим обычные приёмы
            const mapped = (data as AggregatedAppointmentRow[]).map(mapAggregatedRowToAppointment);

            // Загружаем группы за весь месяц (фильтрация по дате — на клиенте)
            let allGroups: AppointmentGroup[] = [];
            if (selectedMonth) {
                const lastDay = dayjs(selectedMonth).endOf("month").format("YYYY-MM-DD");
                const { fetchGroupsByRange } = await import("../../features/group-appointments/api/group-appointments.api");
                allGroups = await fetchGroupsByRange(`${selectedMonth}-01`, lastDay);
            }
            if (fetchIdRef.current !== myId) return;

            // Exclude regular appointments that are actually group participants
            const groupParticipantIds = new Set<string>(
                allGroups.flatMap(g => g.participants.map(p => p.id))
            );

            const { mapGroupToAppointment } = await import("../home/types");
            const groupedAppointments = allGroups.map(mapGroupToAppointment);

            const filteredMapped = mapped.filter(appt => !groupParticipantIds.has(String(appt.id)));

            const finalAppointments = [...filteredMapped, ...groupedAppointments];

            // Имя текущего залогиненного сотрудника (fallback для specialist-фильтра)
            const currentEmployeeName = !canViewAll && employeeId
                ? (employee?.full_name ?? employee?.fullName ?? employee?.name ?? null)
                : null;

            // Inject missing doctor names from currentDoctors array
            finalAppointments.forEach(appt => {
                // Fix base doctor_id if it's missing but we have it in services
                if (!appt.doctor_id && appt.parsed_services?.[0]?.performer_id) {
                    appt.doctor_id = appt.parsed_services[0].performer_id;
                }

                // Fix base doctor_name from doctor_id
                if (!appt.doctor_name && appt.doctor_id) {
                    const doc = currentDoctors.find(d => String(d.id) === String(appt.doctor_id));
                    if (doc) appt.doctor_name = doc.full_name || (doc as any).fullName || "";
                }

                // Fix parsed_services performer_name from performer_id
                if (appt.parsed_services) {
                    appt.parsed_services.forEach(svc => {
                        if (!svc.performer_name && svc.performer_id) {
                            const doc = currentDoctors.find(d => String(d.id) === String(svc.performer_id));
                            if (doc) svc.performer_name = doc.full_name || (doc as any).fullName || "";
                        }
                    });
                }

                // Финальный fallback: если у специалиста нет имени в данных —
                // подставляем имя текущего пользователя (актуально когда API
                // возвращает specialist-фильтрованные записи без doctor_name)
                if (currentEmployeeName) {
                    if (!appt.doctor_name) {
                        appt.doctor_name = currentEmployeeName;
                    }
                    if (appt.parsed_services) {
                        appt.parsed_services.forEach(svc => {
                            if (!svc.performer_name) {
                                svc.performer_name = currentEmployeeName;
                            }
                        });
                    }
                }
            });

            setHistory(finalAppointments);
        } catch (error) {
            if (fetchIdRef.current === myId) {
                console.error("Error fetching all appointments:", error);
            }
        } finally {
            if (fetchIdRef.current === myId) {
                setLoading(false);
            }
        }
    }, [canViewAll, employeeId, employee, selectedYear, selectedMonth]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // (группы на этой странице не объединяем — API не поддерживает диапазон дат для групп)

    // --- Derived State (Client-Side Grouping) ---

    // Defer heavy list computations so UI stays responsive during filter changes
    const deferredEmployeeFilter = React.useDeferredValue(selectedEmployeeFilter);
    const deferredServiceEmployee = React.useDeferredValue(selectedServiceEmployee);
    const deferredDate = React.useDeferredValue(selectedDate);

    // 1. Filter by Search Query
    const filteredHistory = React.useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return history;
        return history.filter(h =>
            (h.patient_name || "").toLowerCase().includes(q) ||
            (h.doctor_name || "").toLowerCase().includes(q) ||
            (h.service_names || "").toLowerCase().includes(q)
        );
    }, [history, searchQuery]);

    // 2. Available Years
    const availableYears = React.useMemo(() => {
        const currentYear = dayjs().year();
        const startYear = 2023; // Assuming clinic data starts around 2023
        const years: string[] = [];
        for (let y = currentYear; y >= startYear; y--) {
            years.push(y.toString());
        }
        return years;
    }, []);

    // 3. Available Months (for selected Year)
    const availableMonths = React.useMemo(() => {
        if (!selectedYear) return [];
        const monthMap = new Map<string, number>();

        for (let i = 0; i < 12; i++) {
            const key = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
            // If activeMonthsSet is loaded, only include months that have data globally
            if (activeMonthsSet) {
                if (activeMonthsSet.has(key)) {
                    monthMap.set(key, i);
                }
            } else {
                // Return all months by default while loading to avoid shrinking dropdown and blocked UI
                // Or we can just fallback to showing all until loaded
                monthMap.set(key, i);
            }
        }

        return Array.from(monthMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0])) // Descending sorting (latest month first)
            .map(([value, monthIndex]) => ({ value, monthIndex }));
    }, [selectedYear, activeMonthsSet]);

    const noSpecialistLabel = t("allAppointments.noSpecialist");
    const noServiceLabel = t("allAppointments.noService");
    const noServiceNameLabel = t("allAppointments.noServiceName");

    const isDoctorInvolved = React.useCallback((h: Appointment, doctorName: string) => {
        if (doctorName === noSpecialistLabel) {
            const noMain = !h.doctor_name;
            const noServices = !h.parsed_services || h.parsed_services.length === 0 || h.parsed_services.every((s: any) => !s.performer_name && !s.doctor_name);
            if (noMain && noServices) return true;
        }

        if (h.doctor_name === doctorName) return true;
        const services = h.parsed_services || [];
        if (services.length > 0) {
            return services.some((s: any) => s.performer_name === doctorName || s.doctor_name === doctorName);
        }
        return false;
    }, [noSpecialistLabel]);

    const getInvolvedDoctors = React.useCallback((h: Appointment, doctorsList: EmployeesRow[]) => {
        const docNames = new Set<string>();
        if (h.doctor_name) docNames.add(h.doctor_name);
        const services = h.parsed_services || [];
        services.forEach((s: any) => {
            if (s.performer_name) docNames.add(s.performer_name);
            else if (s.doctor_name) docNames.add(s.doctor_name);
        });

        // Если имя не нашлось — попробовать через performer_id из сервисов или doctor_id
        if (docNames.size === 0) {
            const ids = [
                h.doctor_id,
                ...services.map((s: any) => s.performer_id).filter(Boolean),
                ...(h.performer_ids ?? []),
            ].filter(Boolean).map(String);

            for (const id of ids) {
                const doc = doctorsList.find(d => String(d.id) === id);
                if (doc) {
                    const name = doc.full_name || (doc as any).fullName || "";
                    if (name) docNames.add(name);
                }
            }
        }

        if (docNames.size === 0) docNames.add(noSpecialistLabel);
        return Array.from(docNames);
    }, [noSpecialistLabel]);

    // 4. Group by Employee -> Day (for hierarchy in Left Panel)
    const groupedByEmployee = React.useMemo(() => {
        const empMap = new Map<string, { employeeName: string, total: number, days: Map<string, number> }>();

        filteredHistory.forEach(h => {
            if (!h.appointment_at) return;
            // appointment_at is already filtered by selectedYear/selectedMonth from the server query
            // so we don't need to filter again here
            const dayKey = h.appointment_at.slice(0, 10); // fast "YYYY-MM-DD" extraction

            const docNames = getInvolvedDoctors(h, doctors);
            docNames.forEach(empName => {
                if (!empMap.has(empName)) {
                    empMap.set(empName, { employeeName: empName, total: 0, days: new Map() });
                }
                const empData = empMap.get(empName)!;
                empData.total++;
                empData.days.set(dayKey, (empData.days.get(dayKey) || 0) + 1);
            });
        });

        return Array.from(empMap.values()).map(emp => ({
            employeeName: emp.employeeName,
            total: emp.total,
            days: Array.from(emp.days.entries())
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([date, count]) => ({ date, count }))
        })).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    }, [filteredHistory, getInvolvedDoctors, doctors]);

    // 5. Group by Employee -> Service (for "services" filter mode)
    const groupedByService = React.useMemo(() => {
        // filteredHistory is already constrained to selectedYear/selectedMonth by server query
        const empMap = new Map<string, Map<string, number>>();

        filteredHistory.forEach(h => {
            const services = h.parsed_services || [];

            if (services.length === 0) {
                // Fallback: use doctor_name + service_names string
                const empName = h.doctor_name || noSpecialistLabel;
                const svcName = h.service_names || noServiceLabel;
                if (!empMap.has(empName)) empMap.set(empName, new Map());
                empMap.get(empName)!.set(svcName, (empMap.get(empName)!.get(svcName) || 0) + 1);
                return;
            }

            services.forEach(s => {
                const svcName = s.name || s.service_name || noServiceNameLabel;
                const empName = s.performer_name || h.doctor_name || noSpecialistLabel;
                if (!empMap.has(empName)) empMap.set(empName, new Map());
                empMap.get(empName)!.set(svcName, (empMap.get(empName)!.get(svcName) || 0) + 1);
            });
        });

        return Array.from(empMap.entries())
            .map(([empName, svcMap]) => ({
                empName,
                total: Array.from(svcMap.values()).reduce((a, b) => a + b, 0),
                services: Array.from(svcMap.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([svcName, count]) => ({ svcName, count })),
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredHistory, noSpecialistLabel, noServiceLabel, noServiceNameLabel]);

    // 6. Final Display List (Middle Panel)
    const displayList = React.useMemo(() => {
        // filteredHistory is already constrained to selectedYear/selectedMonth by the server query.
        // We only need to additionally filter by selectedDate and employee.
        // Use deferred values so employee/date selection doesn't block the UI
        const empFilter = filterMode === "services" ? deferredServiceEmployee : deferredEmployeeFilter;

        let list: Appointment[];

        if (deferredDate) {
            list = filteredHistory.filter(h =>
                h.appointment_at?.startsWith(deferredDate) &&
                (!empFilter || isDoctorInvolved(h, empFilter))
            );
        } else if (empFilter) {
            list = filteredHistory.filter(h => isDoctorInvolved(h, empFilter));
        } else {
            list = filteredHistory;
        }

        // Sort descending by ISO string (lexicographic = chronological for ISO dates)
        return [...list].sort((a, b) =>
            (b.appointment_at || "").localeCompare(a.appointment_at || "")
        );
    }, [filteredHistory, deferredDate, deferredEmployeeFilter, isDoctorInvolved, filterMode, deferredServiceEmployee]);




    return (
        <Box
            sx={{
                height: {
                    xs: "calc(100dvh - 56px)",
                    md: "calc(100dvh - 64px)",
                    lg: "100%",
                },
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <PageHeader
                title={t("menu.allServices")}
                showTitle={false}
                showSearch
                searchVal={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder={t("allAppointments.searchPlaceholder")}
            >
            </PageHeader>

            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    pb: theme.appLayout.page.paddingY,
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                }}
            >
                <Box
                    sx={(t) => ({
                        px: t.appLayout.page.paddingX,
                    })}
                >
                    <Grid2 container spacing={2} sx={{ flex: 1, minHeight: 0 }}>

                        {/* LEFT COLUMN: PERIOD FILTER */}
                        <Grid2
                            size={{ xs: 12, md: 3 }}
                            sx={(theme) => ({
                                position: { md: "sticky" },
                                top: { md: theme.spacing(2) },
                                alignSelf: "flex-start",
                                height: {
                                    xs: "auto",
                                    md: `calc(100dvh - ${theme.appLayout.viewportOffset.employees.desktopOffset}px)`,
                                },
                                display: "flex",
                                flexDirection: "column",
                            })}
                        >
                            <Paper
                                elevation={0}
                                variant="outlined"
                                sx={{ height: { xs: "auto", md: "100%" }, overflow: "hidden", display: "flex", flexDirection: "column" }}
                            >
                                {/* Header with title and reset */}
                                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t("allAppointments.filter")}</Typography>
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setSelectedYear(null);
                                            setSelectedMonth(null);
                                            setSelectedDate(null);
                                            setSelectedEmployeeFilter(null);
                                            setExpandedEmployee(null);
                                            setSelectedServiceEmployee(null);
                                        }}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        {t("common.reset")}
                                    </Button>
                                </Box>

                                {/* Mode switcher */}
                                <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
                                    <ToggleButtonGroup
                                        value={filterMode}
                                        exclusive
                                        onChange={(_, v) => {
                                            if (v) {
                                                setFilterMode(v);
                                                setSelectedServiceEmployee(null);
                                                setSelectedEmployeeFilter(null);
                                                setSelectedDate(null);
                                                setExpandedEmployee(null);
                                            }
                                        }}
                                        size="small"
                                        fullWidth
                                    >
                                        <ToggleButton value="date" sx={{ textTransform: "none", gap: 0.5, fontSize: "0.75rem" }}>
                                            <CalendarMonthIcon fontSize="inherit" />
                                            {t("allAppointments.byDate")}
                                        </ToggleButton>
                                        <ToggleButton value="services" sx={{ textTransform: "none", gap: 0.5, fontSize: "0.75rem" }}>
                                            <MedicalServicesIcon fontSize="inherit" />
                                            {t("allAppointments.byServices")}
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>

                                <Box sx={{ overflowY: "auto", flex: 1, p: 1.5, pt: 0.5 }}>
                                    {/* Period selectors (always visible) */}
                                    <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                                        <Stack spacing={0.5}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>{t("allAppointments.year")}</Typography>
                                            <TextField
                                                select
                                                size="small"
                                                fullWidth
                                                value={selectedYear ?? ""}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setSelectedYear(v || null);
                                                    setSelectedMonth(null);
                                                    setSelectedDate(null);
                                                    setSelectedServiceEmployee(null);
                                                }}
                                                SelectProps={{ displayEmpty: true }}
                                            >
                                                <MenuItem value=""><Typography variant="body2" color="text.secondary">{t("allAppointments.allYears")}</Typography></MenuItem>
                                                {availableYears.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                                            </TextField>
                                        </Stack>

                                        {selectedYear && (
                                            <Stack spacing={0.5}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={600}>{t("allAppointments.month")}</Typography>
                                                <TextField
                                                    select
                                                    size="small"
                                                    fullWidth
                                                    value={selectedMonth ?? ""}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setSelectedMonth(v || null);
                                                        setSelectedDate(null);
                                                        setSelectedServiceEmployee(null);
                                                    }}
                                                    SelectProps={{ displayEmpty: true }}
                                                    disabled={availableMonths.length === 0}
                                                >
                                                    <MenuItem value=""><Typography variant="body2" color="text.secondary">{t("allAppointments.allMonths")}</Typography></MenuItem>
                                                    {availableMonths.map(m => (
                                                        <MenuItem key={m.value} value={m.value}>{MONTH_NAMES[m.monthIndex]}</MenuItem>
                                                    ))}
                                                </TextField>
                                            </Stack>
                                        )}
                                    </Stack>

                                    {/* DATE MODE */}
                                    {filterMode === "date" && selectedMonth && (
                                        <Stack spacing={0.5}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>{t("allAppointments.employees")}</Typography>
                                            <List dense sx={{ py: 0 }}>
                                                {groupedByEmployee.map(emp => {
                                                    const isExpanded = expandedEmployee === emp.employeeName;
                                                    const isSelected = selectedEmployeeFilter === emp.employeeName;

                                                    return (
                                                        <React.Fragment key={emp.employeeName}>
                                                            <ListItemButton
                                                                selected={isSelected}
                                                                onClick={() => {
                                                                    if (isExpanded) {
                                                                        setExpandedEmployee(null);
                                                                        setSelectedEmployeeFilter(null);
                                                                        setSelectedDate(null);
                                                                    } else {
                                                                        setExpandedEmployee(emp.employeeName);
                                                                        setSelectedEmployeeFilter(emp.employeeName);
                                                                        setSelectedDate(null);
                                                                    }
                                                                }}
                                                                sx={{ borderRadius: 1, mb: 0.5, pr: 1 }}
                                                            >
                                                                <ListItemText
                                                                    primary={emp.employeeName}
                                                                    primaryTypographyProps={{ variant: "body2", sx: { fontWeight: isSelected ? 600 : 400 } }}
                                                                />
                                                                <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 10, px: 0.8, py: 0.2, fontSize: '0.75rem', fontWeight: 600, mr: 1, minWidth: 20, textAlign: 'center' }}>
                                                                    {emp.total}
                                                                </Box>
                                                                {isExpanded ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
                                                            </ListItemButton>
                                                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                                <List dense disablePadding>
                                                                    {emp.days.map(day => (
                                                                        <ListItemButton
                                                                            key={day.date}
                                                                            selected={selectedDate === day.date}
                                                                            onClick={() => {
                                                                                if (selectedDate === day.date) {
                                                                                    setSelectedDate(null);
                                                                                } else {
                                                                                    setSelectedEmployeeFilter(emp.employeeName);
                                                                                    setSelectedDate(day.date);
                                                                                }
                                                                            }}
                                                                            sx={{ borderRadius: 1, mb: 0.5, pl: 3 }}
                                                                        >
                                                                            <Typography variant="body2" sx={{ flex: 1, color: "text.secondary" }}>{formatDateRu(day.date)}</Typography>
                                                                            <Typography variant="caption" color="text.secondary">{day.count}</Typography>
                                                                        </ListItemButton>
                                                                    ))}
                                                                </List>
                                                            </Collapse>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </List>
                                        </Stack>
                                    )}

                                    {/* SERVICES MODE */}
                                    {filterMode === "services" && (
                                        <Stack spacing={0.5}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                {t("allAppointments.employeesAndServices")}
                                            </Typography>
                                            {groupedByService.length === 0 && (
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                    {t("allAppointments.noDataForPeriod")}
                                                </Typography>
                                            )}
                                            <List dense sx={{ py: 0 }}>
                                                {groupedByService.map(emp => {
                                                    const isSelected = selectedServiceEmployee === emp.empName;
                                                    return (
                                                        <React.Fragment key={emp.empName}>
                                                            <ListItemButton
                                                                selected={isSelected}
                                                                onClick={() => {
                                                                    setSelectedServiceEmployee(isSelected ? null : emp.empName);
                                                                }}
                                                                sx={{ borderRadius: 1, mb: 0.5, pr: 1 }}
                                                            >
                                                                <ListItemText
                                                                    primary={emp.empName}
                                                                    primaryTypographyProps={{ variant: "body2", sx: { fontWeight: isSelected ? 600 : 400 } }}
                                                                />
                                                                <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 10, px: 0.8, py: 0.2, fontSize: '0.75rem', fontWeight: 600, mr: 1, minWidth: 20, textAlign: 'center' }}>
                                                                    {emp.total}
                                                                </Box>
                                                                {isSelected ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
                                                            </ListItemButton>
                                                            <Collapse in={isSelected} timeout="auto" unmountOnExit>
                                                                <Box sx={{ pl: 2, pb: 1 }}>
                                                                    <Stack spacing={0.5}>
                                                                        {emp.services.map(svc => (
                                                                            <Box
                                                                                key={svc.svcName}
                                                                                sx={{
                                                                                    display: "flex",
                                                                                    alignItems: "center",
                                                                                    justifyContent: "space-between",
                                                                                    px: 1,
                                                                                    py: 0.4,
                                                                                    borderRadius: 1,
                                                                                    bgcolor: "action.hover",
                                                                                }}
                                                                            >
                                                                                <Typography variant="body2" sx={{ color: "text.secondary", flex: 1, mr: 1, fontSize: "0.78rem" }}>
                                                                                    {svc.svcName}
                                                                                </Typography>
                                                                                <Chip
                                                                                    label={svc.count}
                                                                                    size="small"
                                                                                    sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700, minWidth: 28 }}
                                                                                />
                                                                            </Box>
                                                                        ))}
                                                                    </Stack>
                                                                </Box>
                                                            </Collapse>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </List>
                                        </Stack>
                                    )}
                                </Box>
                            </Paper>
                        </Grid2>

                        {/* MIDDLE COLUMN: LIST */}
                        <Grid2
                            size={{ xs: 12, md: 4 }}
                            sx={(theme) => ({
                                position: { md: "sticky" },
                                top: { md: theme.spacing(2) },
                                alignSelf: "flex-start",
                                height: {
                                    xs: "auto",
                                    md: `calc(100dvh - ${theme.appLayout.viewportOffset.employees.desktopOffset}px)`,
                                },
                            })}
                        >
                            <Paper
                                elevation={0}
                                variant="outlined"
                                sx={{ height: { xs: "auto", md: "100%" }, overflow: "hidden", display: "flex", flexDirection: "column" }}
                            >
                                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                        {filterMode === "services" && selectedServiceEmployee
                                            ? `${selectedServiceEmployee} (${displayList.length})`
                                            : t("allAppointments.appointmentsList", { count: displayList.length })
                                        }
                                    </Typography>
                                </Box>
                                <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ flex: 1, overflowY: 'auto' }}>
                                        <AppointmentsList
                                            titleDate={selectedDate ? formatDateRu(selectedDate) : t("allAppointments.selectedPeriod")}
                                            loading={loading}
                                            errorMsg={null}
                                            items={displayList}
                                            onOpenFilters={() => { }}
                                            onItemClick={(id) => {
                                                setSelectedId(id);
                                            }}
                                            doctors={doctors}
                                            onAddSlot={undefined}
                                            shifts={[]}
                                            hideDoctorFilter={true}
                                            selectedDoctorName={filterMode === "services" ? selectedServiceEmployee : selectedEmployeeFilter}
                                        />
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid2>

                        {/* RIGHT COLUMN: DETAILS */}
                        {!isMobile && (
                            <Grid2
                                size={{ xs: 12, md: 5 }}
                                sx={(theme) => ({
                                    position: { md: "sticky" },
                                    top: { md: theme.spacing(2) },
                                    alignSelf: "flex-start",
                                    height: {
                                        md: `calc(100dvh - ${theme.appLayout.viewportOffset.employees.desktopOffset}px)`,
                                    },
                                })}
                            >
                                <AppointmentDetailsCard
                                    appointmentId={selectedId}
                                    onClose={() => setSelectedId(null)}
                                    onUpdate={() => fetchData()}
                                    showPaymentAction={false}
                                    readOnly={true}
                                />
                            </Grid2>
                        )}
                    </Grid2>
                </Box>

                {/* Mobile Sheet */}
                {isMobile && (
                    <AppBottomSheet open={!!selectedId} onClose={() => setSelectedId(null)}>
                        <Box sx={{ p: 0, height: '80vh' }}>
                            <AppointmentDetailsCard
                                appointmentId={selectedId}
                                onClose={() => setSelectedId(null)}
                                onUpdate={() => fetchData()}
                                showPaymentAction={false}
                                readOnly={true}
                            />
                        </Box>
                    </AppBottomSheet>
                )}

            </Box>
        </Box >
    );
};

export default AllAppointmentsList;

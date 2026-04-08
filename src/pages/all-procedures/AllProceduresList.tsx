import React from "react";
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
    Badge,
    useTheme,
    useMediaQuery
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";

import { useActiveMonths } from "../../hooks/useActiveMonths";
import { PageHeader, AppBottomSheet } from "../../components/ui";
import { formatDateRu } from "../../utility/format";
import { apiFetch } from "../../utility/apiClient";
import AppointmentsList from "../home/components/AppointmentsList";
import AppointmentDetailsCard from "../home/components/AppointmentDetailsCard";
import { mapAggregatedRowToAppointment, Appointment, AggregatedAppointmentRow } from "../home/types";
import { fetchMedicalStaff } from "../../services/employees";
import { EmployeesRow } from "../expenses/types";
import dayjs from "dayjs";

// Names for months in Russian
const MONTH_NAMES = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

export const AllProceduresList: React.FC = () => {
    usePageTitle("Все процедуры");
    const { hasPermission, hasRole, employeeId } = usePermissions();
    const isSpecialist = hasRole('specialist');
    const canViewAll = hasPermission(PERMISSIONS.APPOINTMENTS_READ) && !isSpecialist;

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const activeMonthsSet = useActiveMonths("HistoryAppointments", "appointment_at", true);

    // State
    const [history, setHistory] = React.useState<Appointment[]>([]);
    const [doctors, setDoctors] = React.useState<EmployeesRow[]>([]); // Storing nurses here
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

    // Fetch Data
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            let fetchedNurses = doctors;
            if (fetchedNurses.length === 0) {
                fetchedNurses = await fetchMedicalStaff();
                setDoctors(fetchedNurses);
            }

            const params = new URLSearchParams({ pageSize: '500', ordering: '-appointmentAt' });
            if (!canViewAll && employeeId) params.set('specialist', employeeId);
            const res: any = await apiFetch(`/api/v1/appointments/?${params.toString()}`);
            const data: any[] = res?.data?.results ?? res?.results ?? [];

            const mapped = data.map(r => mapAggregatedRowToAppointment(r as AggregatedAppointmentRow));
            const nurseIds = fetchedNurses.map(n => n.id);

            const proceduresOnly = mapped.filter(app => {
                if (!app.performer_ids || !Array.isArray(app.performer_ids)) return false;
                if (!canViewAll) {
                    return employeeId && app.performer_ids.includes(employeeId) && app.performer_ids.some((id: string) => nurseIds.includes(id));
                }
                return app.performer_ids.some((id: string) => nurseIds.includes(id));
            });
            setHistory(proceduresOnly);
        } catch (error) {
            console.error("Error fetching all procedures:", error);
        } finally {
            setLoading(false);
        }
    }, [canViewAll, employeeId]);

    React.useEffect(() => {
        fetchData();
    }, [canViewAll, employeeId, fetchData]);


    // --- Derived State (Client-Side Grouping) ---

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
        const years = new Set<string>();
        // Always include current year in options if not present
        years.add(dayjs().year().toString());

        filteredHistory.forEach(h => {
            if (h.appointment_at) {
                years.add(new Date(h.appointment_at).getFullYear().toString());
            }
        });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [filteredHistory]);

    // 3. Available Months (for selected Year)
    const availableMonths = React.useMemo(() => {
        if (!selectedYear) return [];
        const monthMap = new Map<string, number>();

        for (let i = 0; i < 12; i++) {
            const key = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
            if (activeMonthsSet) {
                if (activeMonthsSet.has(key)) {
                    monthMap.set(key, i);
                }
            } else {
                monthMap.set(key, i);
            }
        }

        return Array.from(monthMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0])) // Descending sorting
            .map(([value, monthIndex]) => ({ value, monthIndex }));
    }, [selectedYear, activeMonthsSet]);

    const isDoctorInvolved = React.useCallback((h: Appointment, doctorName: string) => {
        if (h.doctor_name === doctorName) return true;
        const services = h.parsed_services || [];
        if (services.length > 0) {
            return services.some((s: any) => s.performer_name === doctorName || s.doctor_name === doctorName);
        }
        return false;
    }, []);

    const getInvolvedDoctors = React.useCallback((h: Appointment) => {
        const docNames = new Set<string>();
        if (h.doctor_name) docNames.add(h.doctor_name);
        const services = h.parsed_services || [];
        services.forEach((s: any) => {
            if (s.performer_name) docNames.add(s.performer_name);
            else if (s.doctor_name) docNames.add(s.doctor_name);
        });

        if (doctors.length > 0) {
            const validNames = new Set(doctors.map(d => d.full_name));
            return Array.from(docNames).filter(n => validNames.has(n));
        }

        if (docNames.size === 0) docNames.add("Неизвестно");
        return Array.from(docNames);
    }, [doctors]);

    // 4. Group by Employee -> Day (for hierarchy in Left Panel)
    const groupedByEmployee = React.useMemo(() => {
        // Filter by Year/Month first
        const relevant = filteredHistory.filter(h => {
            if (!h.appointment_at) return false;
            const d = dayjs(h.appointment_at);
            const y = d.format("YYYY");
            if (selectedYear && y !== selectedYear) return false;

            if (selectedMonth) {
                const m = d.format("YYYY-MM");
                if (m !== selectedMonth) return false;
            }

            return true;
        });

        const empMap = new Map<string, { employeeName: string, total: number, days: Map<string, number> }>();

        relevant.forEach(h => {
            const d = dayjs(h.appointment_at);
            const dayKey = d.format("YYYY-MM-DD");

            const docNames = getInvolvedDoctors(h);

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
                .sort((a, b) => b[0].localeCompare(a[0])) // Descending dates
                .map(([date, count]) => ({ date, count }))
        })).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    }, [filteredHistory, selectedYear, selectedMonth, selectedDate, selectedEmployeeFilter, getInvolvedDoctors]);

    // 5. Final Display List (Middle Panel)
    const displayList = React.useMemo(() => {
        let list: Appointment[] = [];

        if (!selectedDate) {
            list = filteredHistory.filter(h => {
                if (!h.appointment_at) return false;
                const d = dayjs(h.appointment_at);
                const y = d.format("YYYY");
                if (selectedYear && y !== selectedYear) return false;
                if (selectedMonth) {
                    const m = d.format("YYYY-MM");
                    if (m !== selectedMonth) return false;
                }
                if (selectedEmployeeFilter) {
                    if (!isDoctorInvolved(h, selectedEmployeeFilter)) return false;
                }
                return true;
            });
        } else {
            list = filteredHistory.filter(h => {
                if (!h.appointment_at) return false;
                const d = dayjs(h.appointment_at);
                if (d.format("YYYY-MM-DD") !== selectedDate) return false;
                if (selectedEmployeeFilter) {
                    if (!isDoctorInvolved(h, selectedEmployeeFilter)) return false;
                }
                return true;
            });
        }

        return list.sort((a, b) => dayjs(b.appointment_at).valueOf() - dayjs(a.appointment_at).valueOf());
    }, [filteredHistory, selectedYear, selectedMonth, selectedDate, selectedEmployeeFilter, isDoctorInvolved]);




    return (
        <Box
            sx={{
                minHeight: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
                overflow: { xs: "visible", lg: "hidden" },
            }}
        >
            <PageHeader
                title="Все процедуры"
                showTitle={false}
                showSearch
                searchVal={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Поиск пациента, процедуры..."
            >
            </PageHeader>

            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
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
                                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Период</Typography>
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setSelectedYear(null);
                                            setSelectedMonth(null);
                                            setSelectedDate(null);
                                            setSelectedEmployeeFilter(null);
                                            setExpandedEmployee(null);
                                        }}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Сброс
                                    </Button>
                                </Box>

                                <Box sx={{ overflowY: "auto", flex: 1, p: 2 }}>
                                    <Stack spacing={2}>
                                        <Stack spacing={0.5}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Год</Typography>
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
                                                }}
                                                SelectProps={{ displayEmpty: true }}
                                            >
                                                <MenuItem value=""><Typography variant="body2" color="text.secondary">Все годы</Typography></MenuItem>
                                                {availableYears.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                                            </TextField>
                                        </Stack>

                                        {selectedYear && (
                                            <Stack spacing={0.5}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={600}>Месяц</Typography>
                                                <TextField
                                                    select
                                                    size="small"
                                                    fullWidth
                                                    value={selectedMonth ?? ""}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setSelectedMonth(v || null);
                                                        setSelectedDate(null);
                                                    }}
                                                    SelectProps={{ displayEmpty: true }}
                                                    disabled={availableMonths.length === 0}
                                                >
                                                    <MenuItem value=""><Typography variant="body2" color="text.secondary">Все месяцы</Typography></MenuItem>
                                                    {availableMonths.map(m => (
                                                        <MenuItem key={m.value} value={m.value}>{MONTH_NAMES[m.monthIndex]}</MenuItem>
                                                    ))}
                                                </TextField>
                                            </Stack>
                                        )}

                                        {selectedMonth && (
                                            <Stack spacing={0.5}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={600}>Сотрудники</Typography>
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
                                    </Stack>
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
                                        Список процедур ({displayList.length})
                                    </Typography>
                                </Box>
                                <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ flex: 1, overflowY: 'auto' }}>
                                        <AppointmentsList
                                            titleDate={selectedDate ? formatDateRu(selectedDate) : "Выбранный период"}
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
                                            selectedDoctorName={selectedEmployeeFilter}
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

export default AllProceduresList;

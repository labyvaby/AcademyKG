import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Box,
    useMediaQuery,
    useTheme,
    Paper,
    Typography,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    alpha,
    CircularProgress,
    Skeleton,
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import RefreshIcon from '@mui/icons-material/Refresh';

import { PageHeader, MonthNavigation } from "../../components/ui";
import { AppointmentsSummaryCards } from "../reports/components/AppointmentsSummaryCards";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { useActiveMonths } from "../../hooks/useActiveMonths";
import { formatKGS } from "../../utility/format";
import { supabase } from "../../utility/supabaseClient";
import dayjs from "dayjs";
import SalaryReportRow, { COLUMNS_REGISTRATOR, COLUMNS_DOCTOR, COLUMNS_NURSE, COLUMNS_ADMIN, ColumnConfig } from "./components/SalaryReportRow";
import { calculateEmployeeSalary } from "../../features/employees/utils";

interface EmployeeSalaryData {
    id: string;
    full_name: string;
    role: string;
    role_name: string;
    day_hours: number;
    night_hours: number;
    hours_sum: number;
    day_hours_sum: number;
    night_hours_sum: number;
    appointments_count: number;
    distributed_appointments: number;
    created_by_count: number;
    percent_sum: number;
    expenses_sum: number;
    total_salary: number;
    salary_rules: any;
    total_count: number;
    waiting_count: number;
    cancelled_count: number;
    discounted_count: number;
    paid_count: number;
    raw_shifts: any[];
    raw_appointments: any[];
    raw_expenses: any[];
}

const SalaryReportsPage: React.FC = () => {
    usePageTitle("Отчет по ЗП");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
    const { open: notify } = useNotification();
    const { isSuperAdmin, hasRole, employeeId, loading: permissionsLoading } = usePermissions();

    const canSeeAll = useMemo(() => isSuperAdmin() || hasRole(['accountant', 'admin']), [isSuperAdmin, hasRole]);

    // State
    const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
    const [loading, setLoading] = useState(true);
    const [salaryData, setSalaryData] = useState<EmployeeSalaryData[]>([]);
    const [monthAppointments, setMonthAppointments] = useState<any[]>([]);
    const [allClinicAppts, setAllClinicAppts] = useState<any[]>([]);
    const activeMonths = useActiveMonths('AppointmentsAggregated', 'appointment_at');

    // Session cache: key = 'YYYY-MM', invalidated on realtime events for the current month
    const cache = React.useRef(new Map<string, { salaryData: EmployeeSalaryData[]; monthAppointments: any[]; allClinicAppts: any[] }>());

    const fetchData = useCallback(async (forceRefresh = false) => {
        if (permissionsLoading) return;
        if (!canSeeAll && !employeeId) return;

        const cacheKey = dayjs(selectedDate).format('YYYY-MM');

        if (!forceRefresh && cache.current.has(cacheKey)) {
            const cached = cache.current.get(cacheKey)!;
            setSalaryData(cached.salaryData);
            setMonthAppointments(cached.monthAppointments);
            setAllClinicAppts(cached.allClinicAppts);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const startOfMonth = dayjs(selectedDate).startOf('month');
            const endOfMonth = dayjs(selectedDate).endOf('month');

            // 2. Fetch Roles first to know who are registrators
            const { data: roles, error: rolesError } = await supabase
                .from("roles")
                .select("id, name, display_name");

            if (rolesError) throw rolesError;

            const rolesMap = new Map((roles || []).map(r => [r.id, r.display_name]));
            const roleNameMap = new Map((roles || []).map(r => [r.id, r.name as string]));
            const registratorRoleIds = (roles || [])
                .filter(r => r.name === 'registrator' || r.name === 'receptionist')
                .map(r => r.id);
            const nurseRoleIds = new Set((roles || [])
                .filter(r => r.name === 'nurse' || r.name === 'procedure')
                .map(r => r.id));

            // 1. Fetch Employees
            let empQuery = supabase
                .from("Employees")
                .select("id, full_name, salary_rules, role_id")
                .eq("status", "active");

            if (!canSeeAll) {
                // We need the current employee AND all registrators for correct distribution
                empQuery = empQuery.or(`id.eq.${employeeId},role_id.in.(${registratorRoleIds.join(',')})`);
            }

            const { data: employees, error: empError } = await empQuery;
            if (empError) throw empError;

            // 2. Fetch Actual Work Shifts (SKUD)
            let skudQuery = supabase
                .from("WorkShifts")
                .select("employee_id, clock_in, clock_out, is_night_shift")
                .gte("clock_in", startOfMonth.toISOString())
                .lte("clock_in", endOfMonth.toISOString())
                .limit(10000);

            if (!canSeeAll) {
                const empIds = (employees || []).map(e => e.id);
                skudQuery = skudQuery.in("employee_id", empIds);
            }

            const { data: skudShifts, error: skudError } = await skudQuery;

            if (skudError) throw skudError;

            // 3. Fetch Appointments (Aggregated) — filtered by employee for salary calc
            let apptQuery = supabase
                .from("AppointmentsAggregated")
                .select("id, doctor_id, performer_ids, total_amount, paid_cash, paid_card, discount, services_json, status, appointment_at, is_night")
                .gte("appointment_at", startOfMonth.toISOString())
                .lte("appointment_at", endOfMonth.toISOString())
                .limit(10000);

            if (!canSeeAll) {
                apptQuery = apptQuery.or(`doctor_id.eq.${employeeId},performer_ids.cs.{${employeeId}}`);
            }

            const { data: appointments, error: apptError } = await apptQuery;

            if (apptError) throw apptError;

            // 3.1 Fetch ALL clinic appointments for registrator distribution and created_by count
            const { data: allClinicAppointments } = await supabase
                .from("AppointmentsAggregated")
                .select("appointment_at, is_night, created_by, status, services_json, paid_bonuses, performer_ids, doctor_id")
                .gte("appointment_at", startOfMonth.toISOString())
                .lte("appointment_at", endOfMonth.toISOString())
                .limit(10000);

            setMonthAppointments(appointments || []);
            setAllClinicAppts(allClinicAppointments || []);

            // 3.2 Fetch all employee roles to know who is a doctor
            const { data: allEmpRoles } = await supabase
                .from("Employees")
                .select("id, role_id");

            const doctorRoleIds = new Set(
                (roles || []).filter(r => r.name === 'doctor').map(r => r.id)
            );

            const doctorEmpIds = new Set(
                (allEmpRoles || [])
                    .filter(e => doctorRoleIds.has(e.role_id))
                    .map(e => e.id)
            );

            const nurseEmpIds = new Set(
                (allEmpRoles || [])
                    .filter(e => nurseRoleIds.has(e.role_id))
                    .map(e => e.id)
            );

            // 4. Fetch Expenses
            // Salary categories use affects_month to determine which month they deduct from.
            // "Заработная плата"/"ЗП" affects previous month; "Аванс" affects same month as created_at.
            // Old records without affects_month fall back to created_at range for backwards compatibility.
            const selectedMonth = dayjs(selectedDate).format("YYYY-MM");

            let expQuery = supabase
                .from("Expenses")
                .select("employee_id, total_amount, created_at, category, affects_month")
                .or(
                    `affects_month.eq.${selectedMonth},and(affects_month.is.null,created_at.gte.${startOfMonth.toISOString()},created_at.lte.${endOfMonth.toISOString()})`
                )
                .limit(10000);

            if (!canSeeAll) {
                expQuery = expQuery.eq("employee_id", employeeId);
            }

            const { data: expenses, error: expensesError } = await expQuery;

            if (expensesError) throw expensesError;

            // Grouping data by employeeId for performance
            const shiftsByEmployee = new Map<string, any[]>();
            (skudShifts || []).forEach(s => {
                const list = shiftsByEmployee.get(s.employee_id) || [];
                list.push(s);
                shiftsByEmployee.set(s.employee_id, list);
            });

            const expensesByEmployee = new Map<string, any[]>();
            (expenses || []).forEach(e => {
                const list = expensesByEmployee.get(e.employee_id) || [];
                list.push(e);
                expensesByEmployee.set(e.employee_id, list);
            });

            const appointmentsByEmployee = new Map<string, any[]>();
            (appointments || []).forEach(a => {
                const ids = new Set<string>();
                if (a.doctor_id) ids.add(a.doctor_id);
                if (Array.isArray(a.performer_ids)) {
                    a.performer_ids.forEach((id: string) => ids.add(id));
                } else if (typeof a.performer_ids === 'string') {
                    a.performer_ids.replace(/{|}/g, '').split(',').forEach((s: string) => {
                        const id = s.trim();
                        if (id) ids.add(id);
                    });
                }
                ids.forEach(id => {
                    const list = appointmentsByEmployee.get(id) || [];
                    list.push(a);
                    appointmentsByEmployee.set(id, list);
                });
            });

            // 5. Calculate everything
            const filteredEmployees = employees || [];

            const calculatedData: EmployeeSalaryData[] = filteredEmployees.sort((a, b) =>
                (a.full_name || '').localeCompare(b.full_name || '', 'ru')
            ).map(emp => {
                const rules = emp.salary_rules || {};
                const empId = emp.id;

                const empShifts = shiftsByEmployee.get(empId) || [];
                const empExps = expensesByEmployee.get(empId) || [];
                const empAppointments = appointmentsByEmployee.get(empId) || [];

                const result = calculateEmployeeSalary(empShifts, empAppointments, rules, empId, empExps);

                return {
                    id: emp.id,
                    full_name: emp.full_name || "Без имени",
                    role: rolesMap.get(emp.role_id) || "Сотрудник",
                    role_name: roleNameMap.get(emp.role_id) || "",
                    day_hours: result.dayHours,
                    night_hours: result.nightHours,
                    hours_sum: result.hoursSum,
                    day_hours_sum: result.dayHoursSum,
                    night_hours_sum: result.nightHoursSum,
                    appointments_count: result.appointmentsCount,
                    distributed_appointments: 0,
                    created_by_count: 0,
                    percent_sum: result.percentSum,
                    expenses_sum: result.expensesSum,
                    total_salary: result.totalSalary,
                    salary_rules: rules,
                    total_count: result.totalCount,
                    waiting_count: result.waitingCount,
                    cancelled_count: result.cancelledCount,
                    discounted_count: result.discountedCount,
                    paid_count: result.paidCount,
                    raw_shifts: empShifts,
                    raw_appointments: empAppointments,
                    raw_expenses: empExps
                };
            });

            // Включаем ровно те же статусы, что на странице "Отчеты"
            const paidStatuses = ['Оплачено', 'Частично оплачено', 'Со скидкой', 'Бесплатно'];

            // На странице "Отчеты" приём — это когда НИ ОДНА МЕДСЕСТРА не участвует в performer_ids.
            const isActualAppointment = (appt: any): boolean => {
                let perfIds: string[] = [];
                if (Array.isArray(appt.performer_ids)) {
                    perfIds = appt.performer_ids;
                } else if (typeof appt.performer_ids === 'string' && appt.performer_ids) {
                    perfIds = appt.performer_ids.replace(/^\{|\}$/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
                }
                const isProcedure = perfIds.some((id: string) => nurseEmpIds.has(id));
                return !isProcedure;
            };
            const registrators = calculatedData.filter(e => e.role_name === 'registrator' || e.role_name === 'receptionist');

            if (registrators.length > 0) {
                const startOfMonthD = dayjs(selectedDate).startOf('month');
                const daysInMonth = startOfMonthD.daysInMonth();

                // 2a. Pre-calculate clinic-wide daily paid appointment counts and registrator hours
                const dailyClinicStats = Array.from({ length: daysInMonth }, (_, i) => {
                    const currentDay = startOfMonthD.date(i + 1);
                    const allDayAppts = (allClinicAppointments || []).filter(a => {
                        if (!dayjs(a.appointment_at).isSame(currentDay, 'day')) return false;
                        if (!paidStatuses.includes(a.status)) return false;
                        if (!isActualAppointment(a)) return false;
                        return true;
                    });

                    const dayApptCount = allDayAppts.filter(a => !a.is_night).length;
                    const nightApptCount = allDayAppts.filter(a => a.is_night).length;

                    // Sum of hours for all registrators for this day
                    let totalRegDayHours = 0;
                    let totalRegNightHours = 0;
                    const regHoursMap = new Map<string, { day: number, night: number }>();

                    registrators.forEach(reg => {
                        const regShifts = (shiftsByEmployee.get(reg.id) || []).filter((s: any) =>
                            dayjs(s.clock_in).isSame(currentDay, 'day')
                        );
                        // We only need hours for distribution, light calculation
                        const regExps = (expensesByEmployee.get(reg.id) || []).filter((e: any) =>
                            dayjs(e.created_at).isSame(currentDay, 'day')
                        );
                        const regAppts = (appointmentsByEmployee.get(reg.id) || []).filter((a: any) =>
                            dayjs(a.appointment_at).isSame(currentDay, 'day')
                        );
                        const calc = calculateEmployeeSalary(regShifts, regAppts, reg.salary_rules || {}, reg.id, regExps);

                        regHoursMap.set(reg.id, { day: calc.dayHours, night: calc.nightHours });
                        totalRegDayHours += calc.dayHours;
                        totalRegNightHours += calc.nightHours;
                    });

                    return {
                        dayApptCount,
                        nightApptCount,
                        totalRegDayHours,
                        totalRegNightHours,
                        regHoursMap
                    };
                });

                // 2b. Assign creator counts and distributed shares
                registrators.forEach(reg => {
                    reg.created_by_count = (allClinicAppointments || []).filter(a => {
                        if (a.created_by !== reg.id) return false;
                        if (!paidStatuses.includes(a.status)) return false;
                        if (!isActualAppointment(a)) return false;
                        return true;
                    }).length;

                    (reg as any).bonuses_sum = (allClinicAppointments || []).reduce((sum, a) =>
                        a.created_by === reg.id && paidStatuses.includes(a.status)
                            ? sum + (Number(a.paid_bonuses) || 0)
                            : sum
                        , 0);
                });

                // Distribute appointments per day using largest remainder method so
                // sum(distributed_appointments) across all registrators == total appointments that day.
                // Only registrators who actually worked that day participate.
                dailyClinicStats.forEach(stats => {
                    const total = stats.dayApptCount + stats.nightApptCount;
                    if (total === 0) return;

                    // Only include registrators who actually worked this day
                    const shares = registrators.map(reg => {
                        const mine = stats.regHoursMap.get(reg.id);
                        if (!mine || (mine.day === 0 && mine.night === 0)) return { reg, raw: 0, worked: false };
                        const dayShare = stats.totalRegDayHours > 0 ? stats.dayApptCount * (mine.day / stats.totalRegDayHours) : 0;
                        const nightShare = stats.totalRegNightHours > 0 ? stats.nightApptCount * (mine.night / stats.totalRegNightHours) : 0;
                        return { reg, raw: dayShare + nightShare, worked: true };
                    }).filter(s => s.worked);

                    // If nobody worked this day — skip (don't distribute)
                    if (shares.length === 0) return;

                    // Floor each share and collect remainders
                    let allocated = 0;
                    const floored = shares.map(s => {
                        const f = Math.floor(s.raw);
                        allocated += f;
                        return { reg: s.reg, floor: f, remainder: s.raw - f };
                    });

                    // Distribute remaining slots to those with largest remainders
                    let leftover = total - allocated;
                    floored
                        .slice()
                        .sort((a, b) => b.remainder - a.remainder)
                        .forEach(item => {
                            if (leftover <= 0) return;
                            item.floor += 1;
                            leftover -= 1;
                        });

                    floored.forEach(item => {
                        item.reg.distributed_appointments = (item.reg.distributed_appointments || 0) + item.floor;
                    });
                });
            }

            // Third pass: recalculate total_salary for registrators using distributed_appointments
            registrators.forEach(reg => {
                const result = calculateEmployeeSalary(
                    shiftsByEmployee.get(reg.id) || [],
                    appointmentsByEmployee.get(reg.id) || [],
                    reg.salary_rules || {},
                    reg.id,
                    expensesByEmployee.get(reg.id) || [],
                    reg.distributed_appointments
                );
                reg.hours_sum = result.hoursSum;
                reg.day_hours_sum = result.dayHoursSum;
                reg.night_hours_sum = result.nightHoursSum;
                reg.percent_sum = result.percentSum;
                reg.total_salary = result.totalSalary;
            });

            const finalData = canSeeAll
                ? calculatedData
                : calculatedData.filter(r => r.id === employeeId);

            cache.current.set(cacheKey, {
                salaryData: finalData,
                monthAppointments: appointments || [],
                allClinicAppts: allClinicAppointments || [],
            });

            setSalaryData(finalData);
        } catch (e) {
            console.error(e);
            notify?.({ type: "error", message: "Ошибка загрузки данных отчета" });
        } finally {
            setLoading(false);
        }
    }, [selectedDate, notify, canSeeAll, employeeId, permissionsLoading]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Realtime subscriptions — invalidate cache for current month and refresh
    useEffect(() => {
        const invalidateAndRefetch = () => {
            const cacheKey = dayjs(selectedDate).format('YYYY-MM');
            cache.current.delete(cacheKey);
            fetchData(true);
        };

        const channel = supabase
            .channel('salary-reports-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'WorkShifts' }, invalidateAndRefetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'AppointmentsAggregated' }, invalidateAndRefetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Expenses' }, invalidateAndRefetch)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData, selectedDate]);

    const summary = useMemo(() => {
        return {
            total_salary: salaryData.reduce((acc, curr) => acc + curr.total_salary, 0),
            total_hours: salaryData.reduce((acc, curr) => acc + curr.day_hours + curr.night_hours, 0),
            total_appts: salaryData.reduce((acc, curr) => acc + curr.appointments_count, 0),
            total_advance: salaryData.reduce((acc, curr) => acc + curr.expenses_sum, 0),
        };
    }, [salaryData]);

    return (
        <Box sx={{ height: { xs: "calc(100vh - 56px)", md: "calc(100vh - 64px)" }, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PageHeader
                title="Отчет по зарплате"
                showTitle={false}
                showSearch={false}
                dateNavigation={<MonthNavigation date={selectedDate} setDate={setSelectedDate} activeMonths={activeMonths} />}
            />

            <Box sx={(theme) => ({
                px: theme.appLayout.page.paddingX,
                pb: { xs: 15, md: theme.appLayout.page.paddingY },
                pt: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                minHeight: 0
            })}>
                <Stack spacing={{ xs: 1, md: 3 }} sx={{ display: 'flex', flexDirection: 'column' }}>

                    {/* All summary cards in one row */}
                    <AppointmentsSummaryCards
                        dateFrom={dayjs(selectedDate).startOf('month').toISOString()}
                        dateTo={dayjs(selectedDate).endOf('month').toISOString()}
                        employeeId={canSeeAll ? undefined : (employeeId || undefined)}
                        appointments={monthAppointments}
                        extraCards={[
                            {
                                title: 'Аванс',
                                primaryValue: formatKGS(summary.total_advance),
                                secondaryText: 'Выплачено авансом',
                                color: 'primary' as const,
                            },
                            {
                                title: 'К выплате',
                                primaryValue: formatKGS(summary.total_salary),
                                secondaryText: 'Итого за месяц',
                                color: 'info' as const,
                            },
                        ]}
                    />

                    {/* Salary List/Table */}
                    {loading ? (
                        <Box sx={{ minHeight: 400 }}>
                            <Stack spacing={1}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} variant="rectangular" height={isMobile ? 120 : 60} sx={{ borderRadius: 2 }} />
                                ))}
                            </Stack>
                        </Box>
                    ) : salaryData.length === 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                            <Typography color="text.secondary">Нет данных за выбранный месяц</Typography>
                        </Box>
                    ) : isMobile ? (
                        /* Mobile/tablet: grouped card list by role */
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {(() => {
                                const roleGroups: { label: string; roleNames: string[] }[] = [
                                    { label: 'Специалисты', roleNames: ['doctor'] },
                                    { label: 'Медсёстры / Процедуры', roleNames: ['nurse', 'procedure'] },
                                    { label: 'Регистраторы', roleNames: ['registrator', 'receptionist'] },
                                    { label: 'Администраторы', roleNames: ['admin', 'accountant', 'superadmin'] },
                                    { label: 'Техперсонал / Санитарки', roleNames: ['cleaner', 'сleaner'] },
                                ];

                                const rendered: React.ReactNode[] = [];
                                const seen = new Set<string>();

                                roleGroups.forEach(group => {
                                    const rows = salaryData.filter(r => group.roleNames.includes(r.role_name));
                                    rows.forEach(r => seen.add(r.id));
                                    if (rows.length === 0) return;

                                    rendered.push(
                                        <Box key={group.label}>
                                            <Box sx={{ px: 1, py: 0.75, mb: 0.75, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1.5, border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}` }}>
                                                <Typography variant="caption" fontWeight={800} color="primary.main" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                                                    {group.label}
                                                </Typography>
                                            </Box>
                                            <Stack spacing={0.75}>
                                                {rows.map((row) => (
                                                    <SalaryReportRow
                                                        key={row.id}
                                                        row={row}
                                                        selectedDate={selectedDate}
                                                        salaryRules={row.salary_rules || {}}
                                                        allAppointments={allClinicAppts}
                                                        allSalaryData={salaryData}
                                                        isMobile
                                                    />
                                                ))}
                                            </Stack>
                                        </Box>
                                    );
                                });

                                // Remaining employees not in any group
                                const rest = salaryData.filter(r => !seen.has(r.id));
                                if (rest.length > 0) {
                                    rendered.push(
                                        <Box key="other">
                                            <Box sx={{ px: 1, py: 0.75, mb: 0.75, bgcolor: alpha(theme.palette.grey[500], 0.08), borderRadius: 1.5, border: `1px solid ${theme.palette.divider}` }}>
                                                <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                                                    Прочие
                                                </Typography>
                                            </Box>
                                            <Stack spacing={0.75}>
                                                {rest.map((row) => (
                                                    <SalaryReportRow
                                                        key={row.id}
                                                        row={row}
                                                        selectedDate={selectedDate}
                                                        salaryRules={row.salary_rules || {}}
                                                        allAppointments={allClinicAppts}
                                                        allSalaryData={salaryData}
                                                        isMobile
                                                    />
                                                ))}
                                            </Stack>
                                        </Box>
                                    );
                                }

                                return rendered;
                            })()}
                        </Box>
                    ) : (
                        /* Desktop: grouped tables by role */
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {(() => {
                                // Define role groups: order, label, column config, matching role_names
                                const roleGroups: { label: string; roleNames: string[]; cols: ColumnConfig }[] = [
                                    { label: 'Специалисты', roleNames: ['doctor'], cols: COLUMNS_DOCTOR },
                                    { label: 'Медсёстры / Процедуры', roleNames: ['nurse', 'procedure'], cols: COLUMNS_NURSE },
                                    { label: 'Регистраторы', roleNames: ['registrator', 'receptionist'], cols: COLUMNS_REGISTRATOR },
                                    { label: 'Администраторы', roleNames: ['admin', 'accountant', 'superadmin'], cols: COLUMNS_ADMIN },
                                    { label: 'Техперсонал / Санитарки', roleNames: ['cleaner', 'сleaner'], cols: COLUMNS_ADMIN },
                                ];

                                const rendered: React.ReactNode[] = [];
                                const seen = new Set<string>();

                                roleGroups.forEach(group => {
                                    const rows = salaryData.filter(r => group.roleNames.includes(r.role_name));
                                    rows.forEach(r => seen.add(r.id));
                                    if (rows.length === 0) return;

                                    const cols = group.cols;
                                    rendered.push(
                                        <Paper key={group.label} variant="outlined" sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                                            <Box sx={{ px: 2, py: 1, bgcolor: alpha(theme.palette.primary.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}` }}>
                                                <Typography variant="subtitle2" fontWeight={800} color="primary.main">{group.label}</Typography>
                                            </Box>
                                            <Table size="small" sx={{ fontSize: '0.75rem', '& .MuiTableCell-root': { fontSize: '0.75rem', py: 0.6, px: 1 } }}>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Сотрудник</TableCell>
                                                        {cols.hours && <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Дневные</TableCell>}
                                                        {cols.hours && <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Ночные</TableCell>}
                                                        {cols.hours && <TableCell align="right" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Часы</TableCell>}
                                                        {cols.appointments && <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>{cols.appointmentsLabel ?? 'Все приёмы'}</TableCell>}
                                                        {cols.distributed && <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper', color: 'info.main' }}>Распределённые</TableCell>}
                                                        {cols.createdBy && <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper', color: 'success.main' }}>Создал</TableCell>}
                                                        {cols.statusWaiting && <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Ожидание</TableCell>}
                                                        {cols.statusCancelled && <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Отменены</TableCell>}
                                                        {cols.statusDiscount && <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Со скидкой</TableCell>}
                                                        {cols.bonuses && <TableCell align="right" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Бонусы</TableCell>}
                                                        {cols.percent && <TableCell align="right" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Зарплата</TableCell>}
                                                        <TableCell align="right" sx={{ fontWeight: 800, bgcolor: 'background.paper', color: 'error.main' }}>Аванс</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 800, bgcolor: 'background.paper', color: 'primary.main' }}>К выплате</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {rows.map((row) => (
                                                        <SalaryReportRow
                                                            key={row.id}
                                                            row={row}
                                                            selectedDate={selectedDate}
                                                            salaryRules={row.salary_rules || {}}
                                                            allAppointments={allClinicAppts}
                                                            allSalaryData={salaryData}
                                                            columns={cols}
                                                        />
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Paper>
                                    );
                                });

                                // Remaining employees not in any group
                                const rest = salaryData.filter(r => !seen.has(r.id));
                                if (rest.length > 0) {
                                    rendered.push(
                                        <Paper key="other" variant="outlined" sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
                                            <Box sx={{ px: 2, py: 1, bgcolor: alpha(theme.palette.grey[500], 0.08), borderBottom: `1px solid ${theme.palette.divider}` }}>
                                                <Typography variant="subtitle2" fontWeight={800} color="text.secondary">Прочие</Typography>
                                            </Box>
                                            <Table size="small" sx={{ fontSize: '0.75rem', '& .MuiTableCell-root': { fontSize: '0.75rem', py: 0.6, px: 1 } }}>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Сотрудник</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Дневные</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Ночные</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 800, bgcolor: 'background.paper' }}>Часы</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 800, bgcolor: 'background.paper', color: 'error.main' }}>Аванс</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 800, bgcolor: 'background.paper', color: 'primary.main' }}>К выплате</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {rest.map((row) => (
                                                        <SalaryReportRow
                                                            key={row.id}
                                                            row={row}
                                                            selectedDate={selectedDate}
                                                            salaryRules={row.salary_rules || {}}
                                                            allAppointments={allClinicAppts}
                                                            allSalaryData={salaryData}
                                                            columns={COLUMNS_ADMIN}
                                                        />
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Paper>
                                    );
                                }

                                return rendered;
                            })()}
                        </Box>
                    )}
                </Stack>
            </Box>
        </Box>
    );
};

export default SalaryReportsPage;

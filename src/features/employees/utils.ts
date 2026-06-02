import dayjs from "dayjs";

export interface SalaryRules {
    fixed_salary?: {
        enabled?: boolean;
        day_hourly_rate?: number;
        appointment_rate?: number;
    };
    dynamic_rules?: {
        services: string[];
        percent: number;
        fixed_amount: number;
    }[];
}

export interface CalculationResult {
    dayHours: number;
    hoursSum: number;
    dayHoursSum: number;
    distributedAppointments: number;
    createdByCount: number;
    appointmentsCount: number;
    percentSum: number;
    totalCount: number;
    waitingCount: number;
    cancelledCount: number;
    discountedCount: number;
    discountSum: number;
    paidCount: number;
    paidSum: number;
    expensesSum: number;
    totalSalary: number;
    hasWarning?: boolean;
}

export function calculateEmployeeSalary(
    shifts: any[],
    appointments: any[],
    rules: SalaryRules,
    employeeId: string,
    expenses: any[] = [],
    distributedCountOverride?: number
): CalculationResult {
    const fixed = (rules.fixed_salary && rules.fixed_salary.enabled)
        ? rules.fixed_salary
        : { day_hourly_rate: 0, appointment_rate: 0 };

    // 1. Calculate hours from shifts
    let dayHours = 0;
    let hasWarning = false;

    shifts.forEach(s => {
        if (s.clock_in && s.clock_out) {
            const start = dayjs(s.clock_in);
            let end = dayjs(s.clock_out);
            let totalDuration = end.diff(start, 'hour', true);

            if (totalDuration > 0) {
                if (totalDuration > 36) {
                    end = start.add(36, 'hour');
                    totalDuration = 36;
                    hasWarning = true;
                }
                dayHours += totalDuration;
            }
        }
    });

    // 2. Metrics calculation
    let totalCount = 0;
    let waitingCount = 0;
    let cancelledCount = 0;
    let discountedCount = 0;
    let discountSum = 0;
    let paidCount = 0;
    let paidSum = 0;

    const empAppointments = appointments.filter(a => {
        let performerIds: string[] = [];
        if (Array.isArray(a.performer_ids)) {
            performerIds = a.performer_ids;
        } else if (typeof a.performer_ids === 'string' && a.performer_ids) {
            performerIds = a.performer_ids.replace(/^\{|\}$/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        const isPerformer = a.doctor_id === employeeId || performerIds.includes(employeeId);
        if (!isPerformer) return false;

        totalCount++;

        if (a.status === 'Ожидаем' || a.status === 'Пациент здесь') waitingCount++;
        if (a.status === 'Отменено' || a.status === 'Пациент не пришел') cancelledCount++;
        if (a.status === 'Со скидкой' || a.status === 'Бесплатно') {
            discountedCount++;
            discountSum += Number(a.discount || 0);
        }
        if (a.status === 'Оплачено' || a.status === 'Частично оплачено' || a.status === 'Со скидкой' || a.status === 'Бесплатно' || a.status === 'Завершено') {
            paidCount++;
            paidSum += Number(a.paid_cash || 0) + Number(a.paid_card || 0);
        }

        return true;
    });

    const validAppointments = empAppointments.filter(a => a.status !== "Отменено");
    const paidAppointments = validAppointments.filter(a =>
        a.status === "Оплачено" || a.status === "Частично оплачено" ||
        a.status === "Со скидкой" || a.status === "Бесплатно" || a.status === "Завершено"
    );

    const hoursPay = dayHours * (fixed.day_hourly_rate || 0);
    const effectiveApptCount = distributedCountOverride !== undefined
        ? distributedCountOverride
        : paidAppointments.length;
    const apptsFixedPay = effectiveApptCount * (fixed.appointment_rate || 0);

    // Dynamic rules calculation
    let percentSum = 0;
    const dynamicRules = rules.dynamic_rules || [];

    paidAppointments.forEach(appt => {
        const servicesJSON = appt.services_json;
        let servicesArr: any[] = [];

        if (typeof servicesJSON === 'string') {
            try { servicesArr = JSON.parse(servicesJSON); } catch { /* ignore */ }
        } else if (Array.isArray(servicesJSON)) {
            servicesArr = servicesJSON;
        }

        servicesArr.forEach((srv: any) => {
            const srvPerformerId = srv.performer_id || srv.doctor_id;
            let performerIds: string[] = [];
            if (Array.isArray(appt.performer_ids)) {
                performerIds = appt.performer_ids;
            } else if (typeof appt.performer_ids === 'string') {
                performerIds = appt.performer_ids.replace(/{|}/g, '').split(',').map((s: string) => s.trim());
            }

            const isPerformer = srvPerformerId === employeeId ||
                (appt.doctor_id === employeeId && !srvPerformerId) ||
                (performerIds.includes(employeeId) && !srvPerformerId);

            if (isPerformer) {
                const rawName = srv.service_name || srv.name || "";
                const serviceName = String(rawName).trim().toLowerCase();

                const rule = dynamicRules.find((r: any) =>
                    Array.isArray(r.services) && r.services.some((sn: string) => {
                        const ruleSvcName = String(sn).trim().toLowerCase();
                        return ruleSvcName === serviceName || serviceName.includes(ruleSvcName) || ruleSvcName.includes(serviceName);
                    })
                );

                if (rule) {
                    const servicePriceFromSrv = Number(srv.price ?? srv.cost ?? srv.total ?? srv.amount ?? 0);
                    let finalPrice = servicePriceFromSrv;
                    if (finalPrice <= 0 && servicesArr.length === 1) {
                        finalPrice = Number(appt.total_amount || appt.total_cost || 0);
                    }
                    if (Number(rule.percent || 0) > 0 && finalPrice > 0) {
                        percentSum += (finalPrice * Number(rule.percent || 0)) / 100;
                    }
                    if (Number(rule.fixed_amount || 0) > 0) {
                        percentSum += Number(rule.fixed_amount || 0);
                    }
                }
            }
        });
    });

    const expensesSum = expenses
        .filter(exp => {
            if (exp.employee_id !== employeeId) return false;
            const cat = exp.category ? exp.category.toLowerCase() : "";
            return cat.includes("аванс") || cat.includes("заработная плата") || cat.includes("зп");
        })
        .reduce((sum, exp) => sum + (Number(exp.total_amount) || 0), 0);

    const earnings = hoursPay + apptsFixedPay + percentSum;
    const netSalary = earnings - expensesSum;

    return {
        dayHours: Math.round(dayHours * 10) / 10,
        hoursSum: Math.round((hoursPay + apptsFixedPay) * 100) / 100,
        dayHoursSum: Math.round(hoursPay * 100) / 100,
        distributedAppointments: 0,
        createdByCount: 0,
        appointmentsCount: validAppointments.length,
        percentSum: Math.round(percentSum * 100) / 100,
        totalCount,
        waitingCount,
        cancelledCount,
        discountedCount,
        discountSum: Math.round(discountSum * 100) / 100,
        paidCount,
        paidSum: Math.round(paidSum * 100) / 100,
        expensesSum: Math.round(expensesSum * 100) / 100,
        totalSalary: Math.round(netSalary * 100) / 100,
        hasWarning,
    };
}

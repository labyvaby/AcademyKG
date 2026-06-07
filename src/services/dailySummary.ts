/**
 * «Сводка дня» — сборка данных для PDF из единого ендпоинта
 * GET /api/v1/reports/daily-summary/ (см. docs/backend-requests-daily-summary.md
 * и ответ бэка frontend-daily-summary-api.md).
 *
 * Бэк отдаёт всё готовым: блоки `day` / `monthToDate` (доход, счётчики, расходы,
 * долги, наличка) + `cashPosition` (включая ГОТОВУЮ actualCash). Фронт ничего
 * не пересчитывает — только маппит ответ в плоскую модель PDF.
 */
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { getDailySummary } from "./reports";

dayjs.locale("ru");

const num = (v: string | number | null | undefined): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export interface DailySummaryData {
    // Шапка
    brandName: string;
    responsibleName: string;
    date: string;               // YYYY-MM-DD
    weekdayLabel: string;       // «Вторник»
    weekOfMonth: number;        // ceil(day/7)
    periodFrom: string;         // «01.05»
    periodTo: string;           // «19.05.2026»

    // Приход (за день)
    incomeAfk: number;          // byCategory.afk
    income: number;             // total − afk − acupuncture (остаток) ⚠️ см. флаг ниже
    acupuncture: number;        // byCategory.acupuncture

    // Расходы операционные
    expensesToday: number;
    expensesPeriod: number;

    // Наличка (cashPosition)
    cashPrevDay: number;
    cashToday: number;
    cashPeriod: number;

    // Расходы ответственного
    personExpensesToday: number;
    personExpensesPeriod: number;

    // Авансы
    advancesToday: number;
    advancesPeriod: number;

    // Долги детей
    childDebtToday: number;
    childDebtPeriod: number;

    // Фактическая наличка — ГОТОВАЯ из API (не пересчитываем)
    factualCash: number;

    // Счётчики
    lessonsCount: number;        // appointmentsCount за день
    childrenCount: number;       // uniquePatientsCount за период
    specialistsCount: number;    // individualSpecialistsCount за период
    afkPaymentsToday: number;    // afkPaymentsCount за день
    lfkPaymentsCount: number;    // lfkPaymentsCount за период
    lfkRecalcCount: number;      // lfkRecalculationCount за период
    penaltiesPeriod: number;     // deductionExpenses за период
}

export interface AssembleParams {
    date: string;                       // YYYY-MM-DD
    branchId: string;                   // UUID, ОБЯЗАТЕЛЕН (требование API)
    responsibleName: string;            // отображаемое ФИО
    responsibleEmployeeId?: string | null;
    signal?: AbortSignal;
}

export async function assembleDailySummary(p: AssembleParams): Promise<DailySummaryData> {
    if (!p.branchId) {
        throw new Error("Для сводки дня нужно выбрать конкретный филиал.");
    }

    const res = await getDailySummary(
        p.branchId,
        p.date,
        p.responsibleEmployeeId ?? undefined,
        p.signal,
    );
    const r = res.data;
    const day = r.day;
    const mtd = r.monthToDate;
    const cp = r.cashPosition;

    const d = dayjs(p.date);

    // Маппинг «Приход» (подтверждён заказчиком 2026-06-04):
    // АФК = byCategory.afk, Иглотерапия = byCategory.acupuncture,
    // «Приход» = total − afk − acupuncture (остаток). Три строки на одной оси byCategory
    // и в сумме = day.income.total. Инвариант с фото: 5000+55400+8500 = 68900.
    // (byKind.individual НЕ используем — задвоил бы иглотерапию, это другая ось.)
    const incomeAfk = num(day.income.byCategory.afk);
    const acupuncture = num(day.income.byCategory.acupuncture);
    const incomeTotal = num(day.income.total);
    const income = incomeTotal - incomeAfk - acupuncture;

    return {
        brandName: r.branch.brandName || r.branch.name || "Academy KG",
        responsibleName: p.responsibleName,
        date: p.date,
        weekdayLabel: capitalize(d.format("dddd")),
        weekOfMonth: Math.ceil(d.date() / 7),
        periodFrom: d.startOf("month").format("DD.MM"),
        periodTo: d.format("DD.MM.YYYY"),

        incomeAfk,
        income,
        acupuncture,

        expensesToday: num(day.expenses.operationalExpenses),
        expensesPeriod: num(mtd.expenses.operationalExpenses),

        cashPrevDay: num(cp.previousDayCashNet),
        cashToday: num(cp.currentDayCashNet),
        cashPeriod: num(cp.monthToDateCashNet),

        personExpensesToday: num(day.expenses.responsibleEmployeeExpenses),
        personExpensesPeriod: num(mtd.expenses.responsibleEmployeeExpenses),

        advancesToday: num(day.expenses.advanceExpenses),
        advancesPeriod: num(mtd.expenses.advanceExpenses),

        childDebtToday: num(day.debt.debtSum),
        childDebtPeriod: num(mtd.debt.debtSum),

        factualCash: num(cp.actualCash),

        lessonsCount: day.counts.appointmentsCount,
        childrenCount: mtd.counts.uniquePatientsCount,
        specialistsCount: mtd.counts.individualSpecialistsCount,
        afkPaymentsToday: day.counts.afkPaymentsCount,
        lfkPaymentsCount: mtd.counts.lfkPaymentsCount,
        lfkRecalcCount: mtd.counts.lfkRecalculationCount,
        penaltiesPeriod: num(mtd.expenses.deductionExpenses),
    };
}

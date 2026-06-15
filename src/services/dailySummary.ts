/**
 * «Сводка дня» — сборка данных для PDF из единого ендпоинта
 * GET /api/v1/reports/daily-summary/ (см. docs/backend-requests-daily-summary.md
 * и ответ бэка frontend-daily-summary-api.md).
 *
 * Кассовые строки СОЗНАТЕЛЬНО считаются на фронте по модели заказчика
 * (фото-образец 19.05.2026, уравнения сходятся точно):
 *   наличка за сегодня  = day.income.total − операц.расходы дня
 *   наличка за период   = monthToDate.income.total − операц.расходы периода
 *   за прошлый день     = период − сегодня
 *   фактическая наличка = период − авансы − долги − расходы ответственного
 * Вычитание операц.расходов из налички подтверждено заказчиком 2026-06-15
 * (ответ на вопрос «наличка за сегодня — выручка или выручка минус расходы?»:
 * «с учётом минуса расходов»). На образце 19.05 расходы дня = 0, поэтому
 * фото это не опровергало; теперь правило явное. Фактическая наличка
 * наследует net-период (операц.расходы входят в неё через cashPeriod).
 * `cashPosition` бэка НЕ используется: его netCash вычитает авансы/выплаты ЗП
 * и берёт только наличный канал — инварианты образца на нём не сходятся,
 * а actualCash вычитает авансы дважды (см.
 * docs/backend-questions-daily-summary-followup.md, F3). После правки формул
 * бэком можно вернуться на cashPosition.
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

    // Наличка (фронт-формулы по модели образца, не cashPosition — см. шапку)
    cashPrevDay: number;        // период − сегодня
    cashToday: number;          // day.income.total − операц.расходы дня
    cashPeriod: number;         // monthToDate.income.total − операц.расходы периода

    // Расходы ответственного
    personExpensesToday: number;
    personExpensesPeriod: number;

    // Авансы
    advancesToday: number;
    advancesPeriod: number;

    // Долги детей
    childDebtToday: number;
    childDebtPeriod: number;

    // Фактическая наличка = период − авансы − долги − расходы ответственного
    factualCash: number;

    // Счётчики
    lessonsCount: number;        // appointmentsCount за день
    childrenCount: number;       // appointmentsCount за период (посещения, не уникальные)
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

    const d = dayjs(p.date);

    // Маппинг «Приход» (подтверждён заказчиком 2026-06-04):
    // АФК = byCategory.afk, Иглотерапия = byCategory.acupuncture,
    // «Приход» = total − afk − acupuncture (остаток). Три строки на одной оси byCategory
    // и в сумме = day.income.total. Инвариант с фото: 5000+55400+8500 = 68900.
    // (byKind.individual НЕ используем — задвоил бы иглотерапию, это другая ось.)
    const incomeAfk = num(day.income.byCategory.afk);
    const acupuncture = num(day.income.byCategory.acupuncture);
    const incomeTotal = num(day.income.total);
    // byCategory у бэка — аллокация через paymentFactor и может не сходиться
    // с total копейка в копейку; не даём остатку уйти в минус («Приход: -1»).
    const income = Math.max(0, incomeTotal - incomeAfk - acupuncture);

    // Кассовые строки по модели образца (см. шапку файла). Наличка =
    // выручка МИНУС операционные расходы (подтверждено заказчиком 2026-06-15).
    const cashToday = incomeTotal - num(day.expenses.operationalExpenses);
    const cashPeriod = num(mtd.income.total) - num(mtd.expenses.operationalExpenses);
    const cashPrevDay = cashPeriod - cashToday;
    // ⚠️ Возможное двойное вычитание: cashPeriod уже вычел ВСЕ операционные
    // расходы; если responsibleEmployeeExpenses — их подмножество (расходы,
    // отнесённые на ответственного), то здесь они вычитаются второй раз.
    // На образце расходы ответственного = 0, проверить нельзя → вопрос бэку
    // (disjoint ли operationalExpenses и responsibleEmployeeExpenses).
    const factualCash =
        cashPeriod -
        num(mtd.expenses.advanceExpenses) -
        num(mtd.debt.debtSum) -
        num(mtd.expenses.responsibleEmployeeExpenses);

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

        cashPrevDay,
        cashToday,
        cashPeriod,

        personExpensesToday: num(day.expenses.responsibleEmployeeExpenses),
        personExpensesPeriod: num(mtd.expenses.responsibleEmployeeExpenses),

        advancesToday: num(day.expenses.advanceExpenses),
        advancesPeriod: num(mtd.expenses.advanceExpenses),

        childDebtToday: num(day.debt.debtSum),
        childDebtPeriod: num(mtd.debt.debtSum),

        factualCash,

        lessonsCount: day.counts.appointmentsCount,
        // На образце «детей» = 906 при 76 занятиях/день — это сумма посещений
        // за период, а не уникальные дети (uniquePatientsCount не используем).
        childrenCount: mtd.counts.appointmentsCount,
        specialistsCount: mtd.counts.individualSpecialistsCount,
        afkPaymentsToday: day.counts.afkPaymentsCount,
        lfkPaymentsCount: mtd.counts.lfkPaymentsCount,
        lfkRecalcCount: mtd.counts.lfkRecalculationCount,
        penaltiesPeriod: num(mtd.expenses.deductionExpenses),
    };
}

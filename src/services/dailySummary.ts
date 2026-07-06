/**
 * «Сводка дня» — сборка данных для PDF из единого ендпоинта
 * GET /api/v1/reports/daily-summary/ (см. docs/backend-requests-daily-summary.md
 * и ответ бэка frontend-daily-summary-api.md).
 *
 * Приход (строки «Приход/АФК/Иглотерапия») — НАЧИСЛЕНИЕ (F4, 2026-06-16):
 * стоимость всех проведённых занятий, включая неоплаченные → income.accrued*.
 * Кассовые строки («наличка») — фактически полученное (income.total, paid_*).
 *
 * Кассовые строки СОЗНАТЕЛЬНО считаются на фронте по модели заказчика
 * (наличка = живые деньги − операц.расходы, подтверждено 2026-06-15):
 *   наличка за сегодня  = (day.income.cash + cashless) − операц.расходы дня
 *   наличка за период   = (monthToDate.income.cash + cashless) − операц.расходы периода
 *   за прошлый день     = период − сегодня
 * С бэк-фикса 2026-07-06 пополнения клиентского баланса входят в income.cash/
 * cashless (приход кассы в день пополнения), а оплаты приёмов балансом — в
 * income.balance (выручка без движения денег). Поэтому income.total для
 * кассовых строк НЕ годится: он суммирует и пополнение, и списание → двойной
 * счёт балансовых денег. netCash бэка тоже не годится: он дополнительно
 * вычитает авансы и выплаты ЗП, а строка «наличка» их не вычитает
 * (авансы — отдельной строкой ниже).
 *
 * Фактическая наличка — берём ГОТОВОЕ поле cashPosition.actualCash. Бэк привёл
 * его к варианту «а» заказчика (F3, 2026-06-16):
 *   actualCash = monthToDateCashNet − долги
 * где netCash уже вычитает operational + advance + payroll по филиалу. Это
 * убирает двойной вычет расходов ответственного (они — подмножество
 * операционных, бэк подтвердил) — поэтому фактическую НЕ пересчитываем сами.
 * responsibleEmployeeExpenses остаётся информационным (строки расходов отв.).
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

    // Приход (F4, 2026-06-16) = НАЧИСЛЕНИЕ: стоимость всех проведённых занятий,
    // включая неоплаченные. АФК = accruedByCategory.afk, Иглотерапия =
    // accruedByCategory.acupuncture, «Приход» = accruedTotal − afk − acupuncture.
    const incomeAfk = num(day.income.accruedByCategory.afk);
    const acupuncture = num(day.income.accruedByCategory.acupuncture);
    const accruedTotal = num(day.income.accruedTotal);
    // accruedByCategory у бэка — аллокация и может не сходиться с accruedTotal
    // копейка в копейку; не даём остатку уйти в минус («Приход: -1»).
    const income = Math.max(0, accruedTotal - incomeAfk - acupuncture);

    // Кассовые строки — ЖИВЫЕ деньги (cash + cashless) минус операционные
    // расходы (модель заказчика, подтверждено 2026-06-15). С бэк-фикса
    // 2026-07-06 пополнения баланса уже входят в income.cash/cashless в день
    // пополнения, а income.balance — списания баланса без движения денег.
    // income.total (= cash+cashless+balance+bonuses) сюда НЕ годится: он
    // задваивает балансовые деньги (день пополнения через cash + день оплаты
    // через balance).
    const liveMoney = (inc: { cash: string; cashless: string }) =>
        num(inc.cash) + num(inc.cashless);
    const cashToday = liveMoney(day.income) - num(day.expenses.operationalExpenses);
    const cashPeriod = liveMoney(mtd.income) - num(mtd.expenses.operationalExpenses);
    const cashPrevDay = cashPeriod - cashToday;
    // Фактическая наличка — готовое поле бэка (вариант «а» заказчика, F3):
    // actualCash = monthToDateCashNet − долги. Сами не пересчитываем — иначе
    // вернётся двойной вычет расходов ответственного (см. шапку файла).
    const factualCash = num(r.cashPosition.actualCash);

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

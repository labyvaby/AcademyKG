export interface DailyFinancialData {
    date: string;
    servicesSum: number;
    productsSum: number;
    cashSum: number;
    cardSum: number;
    balanceSum: number;
    bonusesSum: number;
    discountSum: number;
    debtSum: number;
    appointmentsCount: number;
    proceduresCount: number;
    dayCount: number;
    nightCount: number;
    waitingCount: number;
    hasActivity: boolean;
}

export interface FinancialSummaryCards {
    appointments: number;
    procedures: number;
    day: number;
    night: number;
    servicesSum: number;
    productsSum: number;
    cashAndCardSum: number;
    debtSum: number;
}

export interface FinancialReportResponse {
    canView: boolean;
    month: string;
    days: DailyFinancialData[];
    displayDays: DailyFinancialData[];
    totals: Partial<DailyFinancialData>;
    summaryCards: FinancialSummaryCards;
}

export interface PayrollRow {
    employeeId: string;
    fullName: string;
    roleName: string;
    dayHours: number;
    paidAppointmentsCount: number;
    distributedAppointmentsCount: number;
    advancesSum: number;
    payoutsSum: number;
    deductionsSum: number;
    expensesSum: number;
    grossEarnings: number;
    netSalary: number;
    percentSum: number;
    fixedSum: number;
    status: {
        code: 'green' | 'red' | 'blue';
        hasWarning: boolean;
        hasOpenShift: boolean;
    };
    paidOut: boolean;
}

export interface PayrollGroup {
    key: 'doctors' | 'nurses' | 'registrars' | 'admins' | 'cleaners' | 'others';
    title: string;
    rows: PayrollRow[];
    totals: {
        advancesSum: number;
        payoutsSum: number;
        deductionsSum: number;
        netSalary: number;
        grossEarnings: number;
        expensesSum: number;
        [key: string]: number;
    };
}

export interface PayrollReportResponse {
    canSeeAll: boolean;
    month: string;
    groups: PayrollGroup[];
    totals: {
        advancesSum: number;
        payoutsSum: number;
        deductionsSum: number;
        netSalary: number;
        grossEarnings: number;
        expensesSum: number;
        [key: string]: number;
    };
    summary: {
        warningsCount: number;
        openShiftsCount: number;
        paidOutCount: number;
    };
}

export interface ExpensesMonthlyTotals {
    totalExpenses: number;
    payrollExpenses: number;
    advanceExpenses: number;
    deductionExpenses: number;   // удержания/штрафы (есть в OpenAPI)
    operationalExpenses: number;
    otherExpenses?: number;
    cashExpenses: number;
    cashlessExpenses: number;
}

export interface ExpensesMonthlyCategoryRow {
    categoryId: string | null;
    categoryName: string;
    cashSum: number;
    cashlessSum: number;
    totalSum: number;
    count: number;
}

export interface ExpensesMonthlyEmployeeRow {
    employeeId: string | null;
    employeeName: string;
    cashSum: number;
    cashlessSum: number;
    totalSum: number;
    count: number;
}

export interface ExpensesMonthlyReportResponse {
    month: string;
    totals: ExpensesMonthlyTotals;
    byCategory: ExpensesMonthlyCategoryRow[];
    byEmployee: ExpensesMonthlyEmployeeRow[];
}

export interface AvailableMonthsResponse {
    financialMonths: string[];
    payrollMonths: string[];
    expensesMonths: string[];
}

export type LessonType = "individual" | "pair";
export type PeriodHalf = "first" | "second";
export type PayslipDetailScope = "month" | "first" | "second";

export interface SpecialistPayslipSlot {
    time: string;                       // "08:00"
    patientName: string | null;         // null = слот пустой; при коллизиях бэк склеивает имена через запятую
    lessonType: LessonType | null;      // "individual" | "pair" | null. "window" backend не возвращает
    // "Поступила" = paid_cash + paid_card + paid_balance + paid_bonuses (включая бонусы).
    sum: string;                        // decimal-строка ("1000.00")
    // Доля специалиста за слот через payroll-формулу:
    //   paymentFactor = (paid_cash + paid_card + paid_balance) / total_cost   // БЕЗ бонусов
    //   earned        = service_price * paymentFactor * percent
    // Неоплаченный приём → sum = "0.00", earned = "0.00".
    earned: string;                     // decimal-строка
}

export interface SpecialistPayslipDay {
    date: string;                       // YYYY-MM-DD
    weekdayLabel: string;               // "Пятница"
    // Backend всегда возвращает фиксированную сетку 08:00–18:00 (11 слотов),
    // даже для дней без приёмов. Фронт не добивает пустые дни сам.
    slots: SpecialistPayslipSlot[];
    totals: {
        count: number;
        sumTotal: string;               // decimal-строка
        sumEarned: string;              // decimal-строка
    };
}

export interface SpecialistPayslipResponse {
    employee: {
        id: string;
        fullName: string;
        roleName: string;
    };
    period: {
        month: string;                  // "YYYY-MM"
        dateFrom: string;               // YYYY-MM-DD
        dateTo: string;                 // YYYY-MM-DD
        label: string;                  // готовая русская подпись от бэка
        summaryScope: "month";          // summary ВСЕГДА считается за календарный месяц
        detailScope: PayslipDetailScope;
    };
    // ВНИМАНИЕ: summary — за весь месяц. Слоты days[] могут не покрывать его
    // полностью (приёмы вне сетки 08–18 в слоты не попадают, но в summary входят).
    // Не сверять sum(days[].slots[].earned) с summary.percentSum.
    summary: {
        grossEarnings: string;
        netSalary: string;
        percentSum: string;
        fixedSum: string;
        advancesSum: string;
        payoutsSum: string;
        deductionsSum: string;
        expensesSum: string;
        dayHours: string;
        paidAppointmentsCount: number;
    };
    days: SpecialistPayslipDay[];
}

export interface Envelope<T> {
    data: T;
    meta: any;
}

// ── Сводка дня (GET /api/v1/reports/daily-summary/) ──────────────────────
// Денежные поля приходят строками-decimal; парсим на фронте.
export interface DailySummaryIncome {
    cash: string;
    cashless: string;
    balance: string;
    bonuses: string;
    total: string;
    byKind: { group: string; individual: string };
    byCategory: { afk: string; lfk: string; acupuncture: string; other: string };
    // F4 (2026-06-16): НАЧИСЛЕННЫЙ приход — стоимость всех проведённых занятий,
    // включая неоплаченные (price×quantity без коэффициента оплаты). Для строк
    // «Приход/АФК/Иглотерапия». Поля выше (total/byKind/byCategory) — по-прежнему
    // фактически полученное (paid_*), для строк налички.
    accruedTotal: string;
    accruedByKind: { group: string; individual: string };
    accruedByCategory: { afk: string; lfk: string; acupuncture: string; other: string };
}
export interface DailySummaryCountsBlock {
    appointmentsCount: number;
    uniquePatientsCount: number;
    individualSpecialistsCount: number;
    afkPaymentsCount: number;
    lfkPaymentsCount: number;
    lfkRecalculationCount: number;
}
export interface DailySummaryExpensesBlock {
    operationalExpenses: string;
    advanceExpenses: string;
    deductionExpenses: string;
    payrollExpenses: string;
    responsibleEmployeeExpenses: string;
    totalExpenses: string;
}
export interface DailySummaryRangeBlock {
    income: DailySummaryIncome;
    counts: DailySummaryCountsBlock;
    expenses: DailySummaryExpensesBlock;
    debt: { debtSum: string };
    cash: { netCash: string };
}
export interface DailySummaryCashPosition {
    previousDayCashNet: string;
    currentDayCashNet: string;
    monthToDateCashNet: string;
    actualCash: string;          // НЕ пересчитывать на фронте — брать как есть
    responsibleEmployeeId: string | null;
}
export interface DailySummaryResponse {
    date: string;
    branch: { id: string; name: string; brandName: string };
    ranges: {
        day: { dateFrom: string; dateTo: string };
        monthToDate: { dateFrom: string; dateTo: string };
    };
    day: DailySummaryRangeBlock;
    monthToDate: DailySummaryRangeBlock;
    cashPosition: DailySummaryCashPosition;
}

// ── Занятия за день (GET /api/v1/reports/daily-lessons/) ─────────────────
// Отдельный отчёт детализации занятий за день (см.
// docs/backend-requests-2026-06-15.md). Денежные поля — строки-decimal.
export interface DailyLessonsStandard {
    count: number;          // занятий по стандартной цене
    unitPrice: string;      // стандартная цена за занятие
    total: string;          // count × unitPrice
}
export interface DailyLessonsException {
    specialistName: string; // performer
    patientName: string;    // ребёнок
    note: string;           // повод особой цены ("тех.персонал"/скидка) или ""
    count: number;
    unitPrice: string;
    total: string;
}
export interface DailyLessonsCategory {
    name: string;           // услуга/категория (имя для синей строки)
    order: number;          // порядок вывода
    standard: DailyLessonsStandard;
    exceptions: DailyLessonsException[];
    subtotal: { count: number; total: string };
}
export interface DailyLessonsAfkRow {
    label: string;          // готовая подпись «N чел. dd.mm — dd.mm …»
    count: number;          // человек (Кол д)
    unitPrice: string;      // цена за человека (Сумма)
    total: string;          // count × unitPrice (Итого)
}
export interface DailyLessonsResponse {
    date: string;
    branch: { id: string; name: string; brandName: string };
    lessons: {
        categories: DailyLessonsCategory[];
        totals: { count: number; total: string };
    };
    afk: {
        rows: DailyLessonsAfkRow[];
        totals: { count: number; total: string };
    };
}

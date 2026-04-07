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
    nightHours: number;
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

export interface Envelope<T> {
    data: T;
    meta: any;
}

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
    services: { title: string; value: number; color: string };
    cash: { title: string; value: number; color: string };
    card: { title: string; value: number; color: string };
    debt: { title: string; value: number; color: string };
    [key: string]: any;
}

export interface FinancialReportResponse {
    canView: boolean;
    month: string;
    days: DailyFinancialData[];
    displayDays: DailyFinancialData[];
    totals: Partial<DailyFinancialData>;
    summaryCards: any[]; // API structure may vary, usually array of card objects
}

export interface PayrollRow {
    employeeId: string;
    fullName: string;
    roleName: string;
    dayHours: number;
    nightHours: number;
    paidAppointmentsCount: number;
    distributedAppointmentsCount: number;
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
        netSalary: number;
        grossEarnings: number;
        expensesSum: number;
        [key: string]: number;
    };
    summary: {
        warningsCount: number;
        openShiftsCount: number;
        paidOutCount: number;
        totalNetSalary: number;
    };
}

export interface Envelope<T> {
    data: T;
    meta: any;
}

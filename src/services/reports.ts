import { apiFetch } from "../utility/apiClient";
import {
    FinancialReportResponse,
    PayrollReportResponse,
    ExpensesMonthlyReportResponse,
    AvailableMonthsResponse,
    SpecialistPayslipResponse,
    PeriodHalf,
    Envelope,
} from "../types/reports";

export const getFinancialReport = async (
    month: string,
    branch?: string,
    organization?: string,
    signal?: AbortSignal,
): Promise<Envelope<FinancialReportResponse>> => {
    const params = new URLSearchParams({ month });
    if (branch) params.append("branch", branch);
    if (organization) params.append("organization", organization);

    return apiFetch<Envelope<FinancialReportResponse>>(
        `/api/v1/reports/financial-monthly/?${params.toString()}`,
        { signal },
    );
};

export const getPayrollReport = async (
    month: string,
    branch?: string,
    organization?: string,
    signal?: AbortSignal,
): Promise<Envelope<PayrollReportResponse>> => {
    const params = new URLSearchParams({ month });
    if (branch) params.append("branch", branch);
    if (organization) params.append("organization", organization);

    return apiFetch<Envelope<PayrollReportResponse>>(
        `/api/v1/reports/payroll-monthly/?${params.toString()}`,
        { signal },
    );
};

export const getExpensesMonthlyReport = async (
    month: string,
    branch?: string,
    organization?: string,
    signal?: AbortSignal,
): Promise<Envelope<ExpensesMonthlyReportResponse>> => {
    const params = new URLSearchParams({ month });
    if (branch) params.append("branch", branch);
    if (organization) params.append("organization", organization);

    return apiFetch<Envelope<ExpensesMonthlyReportResponse>>(
        `/api/v1/reports/expenses-monthly/?${params.toString()}`,
        { signal },
    );
};

export const getSpecialistPayslip = async (
    employeeId: string,
    month: string,                  // YYYY-MM
    periodHalf?: PeriodHalf,        // "first" | "second"; пусто = весь месяц
    branch?: string,
    organization?: string,
    signal?: AbortSignal,
): Promise<Envelope<SpecialistPayslipResponse>> => {
    const params = new URLSearchParams({
        employee: employeeId,
        month,
    });
    if (periodHalf) params.append("periodHalf", periodHalf);
    if (branch) params.append("branch", branch);
    if (organization) params.append("organization", organization);

    return apiFetch<Envelope<SpecialistPayslipResponse>>(
        `/api/v1/reports/specialist-payslip/?${params.toString()}`,
        { signal },
    );
};

export const getAvailableMonths = async (
    branch?: string,
    organization?: string,
    signal?: AbortSignal,
): Promise<Envelope<AvailableMonthsResponse>> => {
    const params = new URLSearchParams();
    if (branch) params.append("branch", branch);
    if (organization) params.append("organization", organization);
    const query = params.toString();

    return apiFetch<Envelope<AvailableMonthsResponse>>(
        `/api/v1/reports/available-months/${query ? `?${query}` : ""}`,
        { signal },
    );
};

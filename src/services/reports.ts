import { apiFetch } from "../utility/apiClient";
import { FinancialReportResponse, PayrollReportResponse, Envelope } from "../types/reports";

export const getFinancialReport = async (month: string, branch?: string, organization?: string): Promise<Envelope<FinancialReportResponse>> => {
    const params = new URLSearchParams({ month });
    if (branch) params.append("branch", branch);
    if (organization) params.append("organization", organization);

    return apiFetch<Envelope<FinancialReportResponse>>(`/api/v1/reports/financial-monthly/?${params.toString()}`);
};

export const getPayrollReport = async (month: string, branch?: string, organization?: string): Promise<Envelope<PayrollReportResponse>> => {
    const params = new URLSearchParams({ month });
    if (branch) params.append("branch", branch);
    if (organization) params.append("organization", organization);

    return apiFetch<Envelope<PayrollReportResponse>>(`/api/v1/reports/payroll-monthly/?${params.toString()}`);
};

import { apiFetch } from "../utility/apiClient";
import { CashboxSummaryResponse } from "../types/cashbox";

export const getCashboxSummary = async (params: {
    dateFrom?: string;
    dateTo?: string;
    organization?: string;
    branch?: string;
    method?: 'cash' | 'card';
    signal?: AbortSignal;
    /** Пакетная загрузка по всем филиалам — не упираться в клиентский rate-limit */
    skipClientRateLimit?: boolean;
}): Promise<CashboxSummaryResponse> => {
    const queryParams = new URLSearchParams();
    if (params.dateFrom) queryParams.append("dateFrom", params.dateFrom);
    if (params.dateTo) queryParams.append("dateTo", params.dateTo);
    if (params.organization) queryParams.append("organization", params.organization);
    if (params.branch) queryParams.append("branch", params.branch);
    if (params.method) queryParams.append("method", params.method);

    return apiFetch<CashboxSummaryResponse>(
        `/api/v1/cashbox/summary/?${queryParams.toString()}`,
        { signal: params.signal },
        false,
        params.skipClientRateLimit ?? false,
    );
};

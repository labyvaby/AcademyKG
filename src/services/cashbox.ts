import { apiFetch } from "../utility/apiClient";
import {
    CashboxEntry,
    CashboxEntryMethod,
    CashboxEntryType,
    CashboxMovement,
    CashboxMovementType,
    CashboxPage,
    CashboxShift,
    CashboxShiftStatus,
    CashboxShiftSummaryData,
    CashboxSummaryResponse,
} from "../types/cashbox";

type Envelope<T> = { data: T; meta?: unknown };

const buildQuery = (params: Record<string, string | number | boolean | undefined | null>): string => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === "") continue;
        q.append(k, String(v));
    }
    const s = q.toString();
    return s ? `?${s}` : "";
};

// Для POST/GET по конкретной смене/движению глобальный ?branch= не нужен —
// apiClient сам не подставляет его в non-GET и в детальные UUID-запросы.
const json = (method: "POST" | "PATCH", body: unknown, signal?: AbortSignal): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
});

// ---------------------------------------------------------------------------
// Сводка
// ---------------------------------------------------------------------------

export const getCashboxSummary = async (params: {
    dateFrom?: string;
    dateTo?: string;
    /** Суперадмин/бухгалтер без branch: сводка по всей организации с byBranch */
    organization?: string;
    branch?: string;
    method?: 'cash' | 'card';
    signal?: AbortSignal;
    /** Пакетная загрузка — не упираться в клиентский rate-limit */
    skipClientRateLimit?: boolean;
}): Promise<CashboxSummaryResponse> => {
    const query = buildQuery({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        organization: params.organization,
        branch: params.branch,
        method: params.method,
    });
    // Без branch/organization apiClient подставил бы глобальный branch суперадмина,
    // а в режиме «Все филиалы» он и так null — маркер нужен, чтобы не зависеть от этого.
    const noBranch = !params.branch ? `${query ? "&" : "?"}_noBranch=1` : "";
    return apiFetch<CashboxSummaryResponse>(
        `/api/v1/cashbox/summary/${query}${noBranch}`,
        { signal: params.signal },
        false,
        params.skipClientRateLimit ?? false,
    );
};

// ---------------------------------------------------------------------------
// Журнал операций
// ---------------------------------------------------------------------------

export const getCashboxEntries = async (params: {
    branch?: string;
    organization?: string;
    dateFrom?: string;
    dateTo?: string;
    method?: CashboxEntryMethod;
    type?: CashboxEntryType;
    createdBy?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
}): Promise<CashboxPage<CashboxEntry>> => {
    const query = buildQuery({
        branch: params.branch,
        organization: params.organization,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        method: params.method,
        type: params.type,
        createdBy: params.createdBy,
        page: params.page,
        pageSize: params.pageSize,
    });
    const noBranch = !params.branch ? `${query ? "&" : "?"}_noBranch=1` : "";
    const res = await apiFetch<Envelope<CashboxPage<CashboxEntry>>>(
        `/api/v1/cashbox/entries/${query}${noBranch}`,
        { signal: params.signal },
    );
    return res.data;
};

// ---------------------------------------------------------------------------
// Смены кассы
// ---------------------------------------------------------------------------

export const getCurrentCashboxShift = async (branch: string, signal?: AbortSignal): Promise<CashboxShift | null> => {
    const res = await apiFetch<Envelope<{ shift: CashboxShift | null }>>(
        `/api/v1/cashbox/shifts/current/?branch=${encodeURIComponent(branch)}`,
        { signal },
    );
    return res.data?.shift ?? null;
};

export const openCashboxShift = async (body: {
    branch: string;
    openingCash?: number;
    comment?: string;
}): Promise<CashboxShift> => {
    const res = await apiFetch<Envelope<CashboxShift>>(`/api/v1/cashbox/shifts/open/`, json("POST", body));
    return res.data;
};

export const closeCashboxShift = async (
    shiftId: string,
    body: { countedCash: number; comment?: string },
): Promise<CashboxShift> => {
    const res = await apiFetch<Envelope<CashboxShift>>(
        `/api/v1/cashbox/shifts/${shiftId}/close/`,
        json("POST", body),
    );
    return res.data;
};

export const listCashboxShifts = async (params: {
    branch?: string;
    status?: CashboxShiftStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
}): Promise<CashboxPage<CashboxShift>> => {
    const query = buildQuery({
        branch: params.branch,
        status: params.status,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        page: params.page,
        pageSize: params.pageSize,
    });
    const res = await apiFetch<Envelope<CashboxPage<CashboxShift>>>(`/api/v1/cashbox/shifts/${query}`, {
        signal: params.signal,
    });
    return res.data;
};

export const getCashboxShiftSummary = async (
    shiftId: string,
    signal?: AbortSignal,
): Promise<CashboxShiftSummaryData> => {
    const res = await apiFetch<Envelope<CashboxShiftSummaryData>>(
        `/api/v1/cashbox/shifts/${shiftId}/summary/?_noBranch=1`,
        { signal },
    );
    return res.data;
};

// ---------------------------------------------------------------------------
// Внесение / изъятие / инкассация
// ---------------------------------------------------------------------------

export const listCashboxMovements = async (params: {
    branch?: string;
    type?: CashboxMovementType;
    shift?: string;
    dateFrom?: string;
    dateTo?: string;
    includeVoided?: boolean;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
}): Promise<CashboxPage<CashboxMovement>> => {
    const query = buildQuery({
        branch: params.branch,
        type: params.type,
        shift: params.shift,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        includeVoided: params.includeVoided ? "true" : undefined,
        page: params.page,
        pageSize: params.pageSize,
    });
    const res = await apiFetch<Envelope<CashboxPage<CashboxMovement>>>(`/api/v1/cashbox/movements/${query}`, {
        signal: params.signal,
    });
    return res.data;
};

export const createCashboxMovement = async (body: {
    branch: string;
    type: CashboxMovementType;
    amount: number;
    comment?: string;
    recipient?: string;
    occurredAt?: string;
}): Promise<CashboxMovement> => {
    const res = await apiFetch<Envelope<CashboxMovement>>(`/api/v1/cashbox/movements/`, json("POST", body));
    return res.data;
};

export const voidCashboxMovement = async (movementId: string, reason: string): Promise<CashboxMovement> => {
    const res = await apiFetch<Envelope<CashboxMovement>>(
        `/api/v1/cashbox/movements/${movementId}/void/`,
        json("POST", { reason }),
    );
    return res.data;
};

/**
 * Авансы и удержания специалиста для расчётного листа (per-day).
 *
 * Подмешивается в дневные карточки PDF (`specialistPayslipPdf.ts`): под таблицей
 * дня, в который сотрудник взял аванс / получил удержание, рисуется строка
 * «Аванс: 5000 — <примечание>». Примечание = поле `comment` транзакции.
 *
 * Ограничение источника (то же, что в `dailyDetails.ts`): у payroll-транзакции
 * нет даты выдачи — есть только `createdAt` (когда внесли запись) и `affectsMonth`.
 * Поэтому «в какой день взяли аванс» = день внесения; аванс, проведённый задним
 * числом, попадёт в день внесения, а не в фактический день выдачи.
 */
import { apiFetch } from "../utility/apiClient";
import { dayjsBranch } from "../utility/branchTime";

const num = (v: string | number | null | undefined): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

export interface PayslipAdjustment {
    date: string;       // YYYY-MM-DD (createdAt в TZ Бишкека)
    amount: number;
    note: string;       // comment транзакции
}

export interface DayAdjustments {
    advances: PayslipAdjustment[];
    deductions: PayslipAdjustment[];
}

export interface PayslipAdjustmentsResult {
    byDate: Map<string, DayAdjustments>;   // ключ — YYYY-MM-DD
    advancesTotal: number;
    deductionsTotal: number;
}

type PayrollTxApi = {
    employee?: { id?: string } | string | null;
    kind?: string;
    totalAmount?: string | number;
    comment?: string | null;
    createdAt?: string;
};

const unwrapList = <T>(res: any): T[] => {
    const d = res?.data ?? res;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.results)) return d.results;
    return [];
};

const employeeIdOf = (emp: PayrollTxApi["employee"]): string =>
    (typeof emp === "object" && emp ? emp.id : typeof emp === "string" ? emp : "") ?? "";

export interface AssemblePayslipAdjustmentsParams {
    employeeId: string;     // UUID сотрудника
    month: string;          // YYYY-MM (affectsMonth)
    dateFrom: string;       // YYYY-MM-DD — начало периода детализации
    dateTo: string;         // YYYY-MM-DD — конец периода детализации (включительно)
    branchId?: string | null;
    signal?: AbortSignal;
}

export async function assemblePayslipAdjustments(
    p: AssemblePayslipAdjustmentsParams,
): Promise<PayslipAdjustmentsResult> {
    const branchPart = p.branchId ? `&branch=${p.branchId}` : "";
    // employee= как оптимизация; на всякий случай дополнительно фильтруем на фронте.
    const url =
        `/api/v1/payroll-transactions/?affectsMonth=${p.month}` +
        `&employee=${p.employeeId}${branchPart}&pageSize=500`;

    const res = await apiFetch<any>(url, { signal: p.signal });
    const rows = unwrapList<PayrollTxApi>(res);

    const byDate = new Map<string, DayAdjustments>();
    let advancesTotal = 0;
    let deductionsTotal = 0;

    for (const t of rows) {
        if (employeeIdOf(t.employee) !== p.employeeId) continue;
        if (t.kind !== "advance" && t.kind !== "deduction") continue;
        if (!t.createdAt) continue;
        const date = dayjsBranch(t.createdAt).format("YYYY-MM-DD");
        if (date < p.dateFrom || date > p.dateTo) continue;

        const amount = num(t.totalAmount);
        const entry: PayslipAdjustment = { date, amount, note: (t.comment ?? "").trim() };

        let bucket = byDate.get(date);
        if (!bucket) {
            bucket = { advances: [], deductions: [] };
            byDate.set(date, bucket);
        }
        if (t.kind === "advance") {
            bucket.advances.push(entry);
            advancesTotal += amount;
        } else {
            bucket.deductions.push(entry);
            deductionsTotal += amount;
        }
    }

    return { byDate, advancesTotal, deductionsTotal };
}

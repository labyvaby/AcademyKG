import { apiFetch, getBranchFilter } from "../utility/apiClient";
import { mapApiPayroll } from "../pages/expenses/types";
import type { PayrollTransaction, PayrollKind } from "../pages/expenses/types";
import { fetchAllPages } from "../utility/pagination";

export const PayrollTransactionsService = {
  async getAll(signal?: AbortSignal): Promise<PayrollTransaction[]> {
    const url = "/api/v1/payroll-transactions/?ordering=-createdAt";
    const data = await fetchAllPages<any>(url, { signal });
    return data.map(mapApiPayroll);
  },

  async create(payload: {
    employee_id: string;
    kind: PayrollKind;
    affects_month: string;
    name?: string | null;
    cash_amount?: number;
    cashless_amount?: number;
    comment?: string | null;
  }): Promise<PayrollTransaction> {
    const body: Record<string, any> = {
      employee: payload.employee_id,
      kind: payload.kind,
      affectsMonth: payload.affects_month,
      cashAmount: String(Number(payload.cash_amount) || 0),
      cashlessAmount: String(Number(payload.cashless_amount) || 0),
    };
    const branchId = getBranchFilter();
    if (branchId) body.branch = branchId;
    if (payload.name?.trim()) body.name = payload.name.trim();
    if (payload.comment?.trim()) body.comment = payload.comment.trim();

    const res: any = await apiFetch("/api/v1/payroll-transactions/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return mapApiPayroll(res?.data ?? res);
  },

  async update(id: string | number, payload: {
    employee_id?: string;
    kind?: PayrollKind;
    affects_month?: string;
    name?: string | null;
    cash_amount?: number;
    cashless_amount?: number;
    comment?: string | null;
  }): Promise<PayrollTransaction> {
    const body: Record<string, any> = {};
    if (payload.employee_id !== undefined) body.employee = payload.employee_id;
    if (payload.kind !== undefined) body.kind = payload.kind;
    if (payload.affects_month !== undefined) body.affectsMonth = payload.affects_month;
    if (payload.cash_amount !== undefined) body.cashAmount = String(Number(payload.cash_amount) || 0);
    if (payload.cashless_amount !== undefined) body.cashlessAmount = String(Number(payload.cashless_amount) || 0);
    if (payload.name !== undefined) body.name = payload.name ?? "";
    if (payload.comment !== undefined) body.comment = payload.comment ?? "";

    const res: any = await apiFetch(`/api/v1/payroll-transactions/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return mapApiPayroll(res?.data ?? res);
  },

  async delete(id: string | number): Promise<boolean> {
    await apiFetch(`/api/v1/payroll-transactions/${id}/`, { method: "DELETE" });
    return true;
  },
};

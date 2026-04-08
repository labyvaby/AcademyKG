import { apiFetch, getBranchFilter, resolveApiUrl } from "../utility/apiClient";
import { mapApiExpense } from "../pages/expenses/types";
import type { Expense } from "../pages/expenses/types";
import { fetchAllPages } from "../utility/pagination";

function resolvePhotoUrl(url: string | null | undefined): string | null {
  return resolveApiUrl(url);
}

export const ExpensesService = {
  async getAll(employeeId?: string | null, signal?: AbortSignal): Promise<Expense[]> {
    let url = "/api/v1/expenses/?ordering=-createdAt";
    if (employeeId) url += `&employee=${employeeId}`;
    const data = await fetchAllPages<any>(url, { signal });
    return data.map((r) => {
      const e = mapApiExpense(r);
      if (typeof e.photo === "string") e.photo = resolvePhotoUrl(e.photo);
      return e;
    });
  },

  async create(expense: {
    employee_id?: string | null;
    category_id?: string | null;
    category?: string | null;
    name: string;
    cash_amount?: number;
    cashless_amount?: number;
    total_amount?: number;
    comment?: string | null;
    photo?: File | null;
    created_at?: string;
  }): Promise<Expense> {
    const fd = new FormData();
    const branchId = getBranchFilter();
    if (branchId) fd.append("branch", String(branchId));
    if (expense.employee_id) fd.append("employee", String(expense.employee_id));
    if (expense.category_id) fd.append("category", String(expense.category_id));
    fd.append("name", expense.name);
    fd.append("cashAmount", String(Number(expense.cash_amount) || 0));
    fd.append("cashlessAmount", String(Number(expense.cashless_amount) || 0));
    if (expense.created_at) fd.append("createdAt", expense.created_at);
    if (expense.comment) fd.append("comment", expense.comment);
    if (expense.photo instanceof File) fd.append("photo", expense.photo);

    const res: any = await apiFetch("/api/v1/expenses/", { method: "POST", body: fd });
    const item = res?.data ?? res;
    const e = mapApiExpense(item);
    if (typeof e.photo === "string") e.photo = resolvePhotoUrl(e.photo);
    return e;
  },

  async update(id: number | string, updates: {
    employee_id?: string | null;
    category_id?: string | null;
    category?: string | null;
    name?: string;
    cash_amount?: number;
    cashless_amount?: number;
    total_amount?: number;
    comment?: string | null;
    photo?: File | string | null;
    created_at?: string;
  }): Promise<Expense> {
    const fd = new FormData();
    fd.append("employee", updates.employee_id ? String(updates.employee_id) : "");
    fd.append("category", updates.category_id ? String(updates.category_id) : "");
    if (updates.name !== undefined) fd.append("name", updates.name);
    if (updates.cash_amount !== undefined) fd.append("cashAmount", String(Number(updates.cash_amount) || 0));
    if (updates.cashless_amount !== undefined) fd.append("cashlessAmount", String(Number(updates.cashless_amount) || 0));
    if (updates.created_at) fd.append("createdAt", updates.created_at);
    if (updates.comment !== undefined) fd.append("comment", updates.comment ?? "");
    if (updates.photo instanceof File) fd.append("photo", updates.photo);

    const res: any = await apiFetch(`/api/v1/expenses/${id}/`, { method: "PATCH", body: fd });
    const item = res?.data ?? res;
    const normalizedItem = {
      ...item,
      id: item?.id ?? id,
      createdAt: item?.createdAt ?? item?.created_at ?? updates.created_at,
      category:
        typeof item?.category === "string"
          ? { id: item.category, name: updates.category ?? "" }
          : item?.category,
    };
    const e = mapApiExpense(normalizedItem);
    if (typeof e.photo === "string") e.photo = resolvePhotoUrl(e.photo);
    return e;
  },

  async delete(id: number | string): Promise<boolean> {
    await apiFetch(`/api/v1/expenses/${id}/`, { method: "DELETE" });
    return true;
  },
};

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
    if (employeeId) {
      url += `&employee=${employeeId}`;
    }
    const data = await fetchAllPages<any>(url, { signal });
    return data.map((r) => {
      const e = mapApiExpense(r);
      if (typeof e.photo === "string") e.photo = resolvePhotoUrl(e.photo);
      return e;
    });
  },

  async create(expense: any): Promise<Expense> {
    const fd = new FormData();

    // Map snake_case form fields → camelCase API fields
    const employeeId = expense.employee_id ?? expense.employeeId ?? null;
    const categoryId = expense.category_id ?? expense.categoryId ?? null;

    if (employeeId) fd.append("employee", String(employeeId));
    if (categoryId) fd.append("category", String(categoryId));
    const branchId = getBranchFilter();
    if (branchId) fd.append("branch", String(branchId));
    if (expense.name) fd.append("name", expense.name);
    fd.append("cashAmount", String(Number(expense.cash_amount ?? expense.cashAmount) || 0));
    fd.append("cashlessAmount", String(Number(expense.cashless_amount ?? expense.cashlessAmount) || 0));
    if (expense.created_at ?? expense.createdAt) {
      fd.append("createdAt", String(expense.created_at ?? expense.createdAt));
    }
    if (expense.affects_month ?? expense.affectsMonth) {
      fd.append("affectsMonth", String(expense.affects_month ?? expense.affectsMonth));
    }
    if (expense.comment) fd.append("comment", expense.comment);
    if (expense.photo instanceof File) {
      fd.append("photo", expense.photo);
    } else if (expense.photoFile instanceof File) {
      fd.append("photo", expense.photoFile);
    }

    const res: any = await apiFetch("/api/v1/expenses/", {
      method: "POST",
      body: fd,
    });
    const item = res?.data ?? res;
    const e = mapApiExpense(item);
    if (typeof e.photo === "string") e.photo = resolvePhotoUrl(e.photo);
    return e;
  },

  async update(id: number | string, updates: any): Promise<Expense> {
    const fd = new FormData();

    const employeeId = updates.employee_id ?? updates.employeeId ?? null;
    const categoryId = updates.category_id ?? updates.categoryId ?? null;

    // Always send employee/category (can be empty string to clear)
    fd.append("employee", employeeId ? String(employeeId) : "");
    fd.append("category", categoryId ? String(categoryId) : "");
    if (updates.name !== undefined) fd.append("name", updates.name);
    if (updates.cash_amount !== undefined) fd.append("cashAmount", String(Number(updates.cash_amount) || 0));
    if (updates.cashless_amount !== undefined) fd.append("cashlessAmount", String(Number(updates.cashless_amount) || 0));
    if (updates.created_at ?? updates.createdAt) {
      fd.append("createdAt", String(updates.created_at ?? updates.createdAt));
    }
    if (updates.affects_month !== undefined || updates.affectsMonth !== undefined) {
      const affectsMonth = updates.affects_month ?? updates.affectsMonth;
      fd.append("affectsMonth", affectsMonth ? String(affectsMonth) : "");
    }
    if (updates.comment !== undefined) fd.append("comment", updates.comment ?? "");
    if (updates.photo instanceof File) {
      fd.append("photo", updates.photo);
    } else if (updates.photoFile instanceof File) {
      fd.append("photo", updates.photoFile);
    }

    const res: any = await apiFetch(`/api/v1/expenses/${id}/`, {
      method: "PATCH",
      body: fd,
    });
    const item = res?.data ?? res;
    const normalizedItem = {
      ...item,
      id: item?.id ?? id,
      createdAt: item?.createdAt ?? item?.created_at ?? updates.created_at ?? updates.createdAt,
      category:
        typeof item?.category === "string"
          ? {
              id: item.category,
              name: updates.category ?? updates.category_name ?? "",
            }
          : item?.category,
      branch:
        typeof item?.branch === "string"
          ? {
              id: item.branch,
              name: updates.branch_name ?? "",
            }
          : item?.branch,
    };
    const e = mapApiExpense(normalizedItem);
    if (typeof e.photo === "string") e.photo = resolvePhotoUrl(e.photo);
    return e;
  },

  async delete(id: number | string): Promise<boolean> {
    await apiFetch(`/api/v1/expenses/${id}/`, {
      method: "DELETE",
    });
    return true;
  },
};

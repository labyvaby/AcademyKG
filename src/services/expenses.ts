
import { apiFetch } from "../utility/apiClient";
import type { Expense } from "../pages/expenses/types";

export const ExpensesService = {
  async getAll(employeeId?: string | null) {
    let url = "/api/v1/expenses/?page_size=1000";

    if (employeeId) {
      url += `&employee_id=${employeeId}`;
    }

    const res: any = await apiFetch(url);
    const data = res?.data?.results ?? res?.results ?? res;
    return data as Expense[];
  },

  async create(expense: any) {
    const formData = new FormData();
    Object.entries(expense).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Map snake_case to camelCase for Django if needed, 
        // though some APIs use snake_case. Based on Swagger: cashAmount, cashlessAmount etc.
        const apiKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        if (value instanceof File) {
          formData.append(apiKey, value);
        } else {
          formData.append(apiKey, String(value));
        }
      }
    });

    const res: any = await apiFetch("/api/v1/expenses/", {
      method: "POST",
      body: formData,
    });
    return (res?.data ?? res) as Expense;
  },

  async update(id: number | string, updates: Partial<Expense>) {
    const formData = new FormData();
    const { id: _, created_at, updated_at, ...cleanUpdates } = updates as any;

    Object.entries(cleanUpdates).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const apiKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        if (value instanceof File) {
          formData.append(apiKey, value);
        } else {
          formData.append(apiKey, String(value));
        }
      }
    });

    const res: any = await apiFetch(`/api/v1/expenses/${id}/`, {
      method: "PATCH",
      body: formData,
    });
    return (res?.data ?? res) as Expense;
  },

  async delete(id: number | string) {
    await apiFetch(`/api/v1/expenses/${id}/`, {
      method: "DELETE",
    });
    return true;
  }
};

import React from "react";
import {
  dedupeEmployees,
  mapAnyToEmployee,
  sanitizeKGLocal,
  isKGLocalValid,
  composeKGPhone,
  parseKGLocalFrom,
} from "../api";
import type { EmployesRow } from "../types";
import { apiFetch } from "../../../utility/apiClient";
import { fetchSellableServices } from "../../../services/services";
import { useSimplePageCache } from "../../../hooks/useSimplePageCache";

const PAGE_SIZE = 30;
const EMPLOYEE_WRITE_FIELDS = new Set([
  "fullName",
  "inn",
  "nickname",
  "birthDate",
  "photoUrl",
  "telegramId",
  "bankAccountNumber",
  "status",
  "role",
  "authUser",
  "organization",
  "branch",
  "specializationIds",
  "serviceIds",
  "userEmail",
  "userPhoneNumber",
]);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function translateAuthError(rawError: unknown): string {
  const msg = getErrorMessage(rawError).toLowerCase();
  if (msg.includes("unable to validate email address") || msg.includes("invalid format") || msg.includes("invalid email")) {
    return "Указанный email-адрес не существует или имеет неверный формат.";
  }
  if (msg.includes("already been registered") || msg.includes("already registered") || msg.includes("already exists")) {
    return "Пользователь с такой почтой или номером телефона уже зарегистрирован.";
  }
  if (msg.includes("password should be at least")) {
    return "Пароль должен состоять минимум из 8 символов.";
  }
  if (msg.includes("phone number format")) {
    return "Неверный формат номера телефона.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network error")) {
    return "Сеть недоступна или сервер не отвечает.";
  }
  return `Ошибка: ${getErrorMessage(rawError)}`;
}

export function useEmployeesPageState() {
  const [items, setItems] = React.useState<EmployesRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const qDebounced = useDebounced(q, 300);

  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState<null | EmployesRow>(null);
  const [detailsOpen, setDetailsOpen] = React.useState<null | EmployesRow>(null);
  const [deleteOpen, setDeleteOpen] = React.useState<null | EmployesRow>(null);

  const [hasMore, setHasMore] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [page, setPage] = React.useState(0);

  const { restoreState } = useSimplePageCache('employees-page', { items, q, detailsOpen });

  const fetchEmployees = React.useCallback(async (pageNum: number, isNewSearch = false) => {
    try {
      if (isNewSearch) {
        setLoading(true);
        setErrorMsg(null);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams({
        page: String(pageNum + 1),
        ordering: "-createdAt",
      });
      if (qDebounced.trim()) {
        params.set("search", qDebounced.trim());
      }

      const res: any = await apiFetch(`/api/v1/employees/?${params.toString()}`);
      const rawList = res?.data?.results ?? res?.results ?? [];

      const mapped: EmployesRow[] = (Array.isArray(rawList) ? rawList : [])
        .map((r: unknown) => {
          if (typeof r === "object" && r !== null) {
            return mapAnyToEmployee(r as Record<string, unknown>);
          }
          return null;
        })
        .filter((x): x is EmployesRow => x !== null);

      setItems((prev) => {
        const newItems = isNewSearch ? mapped : prev.concat(mapped);
        return isNewSearch ? newItems : dedupeEmployees(newItems);
      });

      setHasMore(mapped.length === PAGE_SIZE);
    } catch (e: unknown) {
      console.error("Fetch employees error:", getErrorMessage(e));
      setErrorMsg("Не удалось загрузить сотрудников");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [qDebounced]);

  const isInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      const cached = restoreState();
      if (cached) {
        setItems(cached.items);
        setQ(cached.q);
        setDetailsOpen(cached.detailsOpen);
        setLoading(false);
        return;
      }
    }
    setPage(0);
    fetchEmployees(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, fetchEmployees]);

  const loadMore = React.useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchEmployees(nextPage, false);
    }
  }, [loadingMore, hasMore, loading, page, fetchEmployees]);

  const reload = React.useCallback(() => {
    setPage(0);
    fetchEmployees(0, true);
  }, [fetchEmployees]);

  return {
    items,
    setItems,
    filtered: items,
    loading,
    errorMsg,
    addOpen,
    setAddOpen,
    editOpen,
    setEditOpen,
    detailsOpen,
    setDetailsOpen,
    deleteOpen,
    setDeleteOpen,
    q,
    setQ,
    hasMore,
    loadingMore,
    loadMore,
    reload,
  } as const;
}

// Отображаемые имена ролей (системное имя → человекочитаемое)
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  superadmin: "Супер админ",
  manager: "Управляющий",
  accountant: "Бухгалтер",
  cashier: "Кассир",
  receptionist: "Ресепшн",
  specialist: "Специалист (тренер)",
  doctor: "Сотрудник",
  nurse: "Медсестра",
  admin: "Администратор",
};

// Получение всех ролей из /api/v1/roles/
export async function fetchRoles(): Promise<{ id: string; name: string; display_name: string }[]> {
  try {
    const res: any = await apiFetch("/api/v1/roles/");
    const results: any[] = res?.data ?? res?.results ?? [];
    return Array.isArray(results)
      ? results.map((r: any) => ({
          id: r.id ?? "",
          name: r.name ?? "",
          display_name: r.displayName ?? ROLE_DISPLAY_NAMES[r.name] ?? r.name ?? "",
        })).filter(r => r.id && r.name)
      : [];
  } catch {
    return [];
  }
}

function sanitizeEmployeeWritePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (!EMPLOYEE_WRITE_FIELDS.has(key)) return false;
      if (value === undefined) return false;
      if (typeof value === "string" && !value.trim()) return false;
      return !(Array.isArray(value) && value.length === 0);
    }),
  );
}

// Создать сотрудника через REST API
export async function createEmployeeApi(payload: Record<string, unknown>): Promise<any> {
  const safePayload = sanitizeEmployeeWritePayload(payload);
  console.log("[createEmployeeApi] payload:", JSON.stringify(safePayload, null, 2));
  const res = await apiFetch("/api/v1/employees/", {
    method: "POST",
    body: JSON.stringify(safePayload),
  });
  return (res as any)?.data ?? res;
}

// Обновить сотрудника через REST API
export async function updateEmployeeApi(id: string, payload: Record<string, unknown>): Promise<any> {
  const safePayload = sanitizeEmployeeWritePayload(payload);
  console.log("[updateEmployeeApi] PATCH", id, JSON.stringify(safePayload, null, 2));
  const res = await apiFetch(`/api/v1/employees/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(safePayload),
  });
  console.log("[updateEmployeeApi] response:", res);
  return (res as any)?.data ?? res;
}

// Удалить сотрудника
export async function deleteEmployeeApi(id: string): Promise<void> {
  await apiFetch(`/api/v1/employees/${id}/`, { method: "DELETE" });
}

// Создать пользователя (admin-create)
export async function adminCreateUser(payload: {
  phoneNumber?: string;
  password: string;
  fullName?: string;
  employeeId?: string;
}): Promise<{ id: string }> {
  const res: any = await apiFetch("/api/v1/users/admin-create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return (res?.data ?? res) as { id: string };
}

// Получить специализации
export async function fetchSpecializations(): Promise<{ id: string; name: string }[]> {
  try {
    const res: any = await apiFetch("/api/v1/specializations/?pageSize=200");
    const results = res?.data?.results ?? res?.results ?? [];
    return Array.isArray(results) ? results : [];
  } catch {
    return [];
  }
}

export const employeeFormUtils = {
  sanitizeKGLocal,
  isKGLocalValid,
  composeKGPhone,
  parseKGLocalFrom,
  fetchServices: fetchSellableServices,
  translateAuthError,
  createEmployeeApi,
  updateEmployeeApi,
  deleteEmployeeApi,
  adminCreateUser,
  fetchSpecializations,
};

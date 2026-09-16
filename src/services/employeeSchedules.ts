import { apiFetch } from "../utility/apiClient";

// Пакетное создание смен сотрудников — POST /api/v1/employee-schedules/bulk/
// (ответ бэка 2026-09-15). Одна транзакция вместо N параллельных POST,
// которые упирались в клиентский rate-limit (12 запросов / 3 с на путь).

export type EmployeeScheduleBulkItem = {
  employee: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm:ss */
  startTime?: string;
  endTime?: string;
  shiftType?: "day" | "night";
  isDayOff?: boolean;
  /** Без него бэк подставит employee.primaryBranch */
  branch?: string;
};

export type EmployeeScheduleOnConflict = "error" | "skip" | "replace";

export type EmployeeScheduleBulkResult = {
  created: unknown[];
  updated: unknown[];
  skipped: unknown[];
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};

const BULK_LIMIT = 500;

export const createEmployeeSchedulesBulk = async (
  items: EmployeeScheduleBulkItem[],
  onConflict: EmployeeScheduleOnConflict = "skip",
): Promise<EmployeeScheduleBulkResult> => {
  const total: EmployeeScheduleBulkResult = {
    created: [],
    updated: [],
    skipped: [],
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
  };
  // Лимит бэка — 500 записей за запрос; при больших диапазонах режем на пачки.
  for (let i = 0; i < items.length; i += BULK_LIMIT) {
    const chunk = items.slice(i, i + BULK_LIMIT);
    const res = await apiFetch<{ data?: EmployeeScheduleBulkResult } & Partial<EmployeeScheduleBulkResult>>(
      "/api/v1/employee-schedules/bulk/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: chunk, onConflict }),
      },
      false,
      true,
    );
    const data = res?.data ?? res;
    total.created.push(...(data?.created ?? []));
    total.updated.push(...(data?.updated ?? []));
    total.skipped.push(...(data?.skipped ?? []));
    total.createdCount += Number(data?.createdCount ?? data?.created?.length ?? 0);
    total.updatedCount += Number(data?.updatedCount ?? data?.updated?.length ?? 0);
    total.skippedCount += Number(data?.skippedCount ?? data?.skipped?.length ?? 0);
  }
  return total;
};

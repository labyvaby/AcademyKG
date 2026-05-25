import { apiFetch } from "../utility/apiClient";

export type Shift = {
  id: string;
  employee: { id: string; fullName: string } | null;
  shiftDate: string;   // YYYY-MM-DD
  startTime: string;   // HH:mm:ss
  endTime: string;     // HH:mm:ss
  isNightShift: boolean;
  clockIn?: string | null;
  clockOut?: string | null;
};

const toShift = (d: any): Shift => ({
  id: String(d.id),
  employee: d.employee
    ? { id: String(d.employee.id), fullName: String(d.employee.fullName ?? "") }
    : null,
  shiftDate: d.shiftDate ?? "",
  startTime: (d.startTime ?? "").slice(0, 5),
  endTime: (d.endTime ?? "").slice(0, 5),
  isNightShift: d.isNightShift ?? false,
  clockIn: d.clockIn ?? null,
  clockOut: d.clockOut ?? null,
});

export const fetchShifts = async (params?: {
  date?: string;
  employee?: string;
  page?: number;
  pageSize?: number;
}): Promise<Shift[]> => {
  try {
    const q = new URLSearchParams();
    if (params?.date) q.set("date", params.date);
    if (params?.employee) q.set("employee", params.employee);
    q.set("pageSize", String(params?.pageSize ?? 200));
    if (params?.page) q.set("page", String(params.page));

    const res: any = await apiFetch(`/api/v1/work-shifts/?${q.toString()}`);
    const results = res?.data?.results ?? res?.results ?? [];
    return results.map(toShift);
  } catch (e: any) {
    if (e?.status !== 429) console.error("fetchShifts failed", e);
    return [];
  }
};

export const createShift = async (data: {
  employee: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  isNightShift?: boolean;
}): Promise<Shift | null> => {
  try {
    const res: any = await apiFetch("/api/v1/work-shifts/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return toShift(res?.data ?? res);
  } catch (e) {
    console.error("createShift failed", e);
    throw e;
  }
};

export const updateShift = async (id: string, data: Partial<{
  shiftDate: string;
  startTime: string;
  endTime: string;
  isNightShift: boolean;
  clockIn: string;
  clockOut: string;
}>): Promise<Shift | null> => {
  try {
    const res: any = await apiFetch(`/api/v1/work-shifts/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return toShift(res?.data ?? res);
  } catch (e) {
    console.error("updateShift failed", e);
    throw e;
  }
};

export const deleteShift = async (id: string): Promise<boolean> => {
  try {
    await apiFetch(`/api/v1/work-shifts/${id}/`, { method: "DELETE" });
    return true;
  } catch (e) {
    console.error("deleteShift failed", e);
    return false;
  }
};

export const selfClockIn = async (data: {
  shiftDate: string;
  startTime: string;
  endTime: string;
  isNightShift?: boolean;
}): Promise<Shift | null> => {
  const res: any = await apiFetch("/api/v1/work-shifts/self-clock-in/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return toShift(res?.data ?? res);
};

export const selfClockOut = async (): Promise<Shift | null> => {
  const res: any = await apiFetch("/api/v1/work-shifts/self-clock-out/", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return toShift(res?.data ?? res);
};

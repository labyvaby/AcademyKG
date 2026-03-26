import { apiFetch } from "../utility/apiClient";
import dayjs from "dayjs";

export type Shift = {
  id: string;
  employes_id: string; // Keep this name for compatibility with existing components
  shift_date: string;  // YYYY-MM-DD
  start_time: string;  // HH:mm
  end_time: string;    // HH:mm
  is_night_shift?: boolean;
  clock_in?: string;   // ISO datetime
  clock_out?: string;  // ISO datetime
  employee?: {
    full_name: string;
  };
};

type ApiShift = {
  id: string;
  employee?: string | { id: string; full_name?: string; fullName?: string };
  employe?: string | { id: string; full_name?: string; fullName?: string };
  employeeName?: string;
  employes_id?: string;
  employesId?: string;
  shift_date?: string;
  shiftDate?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  clockIn?: string;
  clock_in?: string;
  clockOut?: string;
  clock_out?: string;
  isNightShift?: boolean;
  is_night_shift?: boolean;
};

const toShift = (d: any): Shift => {
  let employeeId = "";
  let employeeData: { full_name: string } | undefined = undefined;

  if (typeof d.employee === 'object' && d.employee !== null) {
    employeeId = d.employee.id || "";
    employeeData = { full_name: d.employee.fullName || d.employee.full_name || "" };
  } else if (typeof d.employee === 'string') {
    employeeId = d.employee;
  } else {
    employeeId = d.employes_id || d.employesId || "";
    if (d.employeeName) employeeData = { full_name: d.employeeName };
  }

  const clockIn = d.clockIn || d.clock_in;
  const clockOut = d.clockOut || d.clock_out;

  return {
    id: String(d.id),
    employes_id: employeeId,
    shift_date: d.date || d.shiftDate || d.shift_date || (clockIn ? dayjs(clockIn).format('YYYY-MM-DD') : ""),
    start_time: (d.startTime || d.start_time || (clockIn ? dayjs(clockIn).format('HH:mm') : "")).slice(0, 5),
    end_time: (d.endTime || d.end_time || (clockOut ? dayjs(clockOut).format('HH:mm') : "")).slice(0, 5),
    is_night_shift: d.isNightShift ?? d.is_night_shift ?? false,
    clock_in: clockIn,
    clock_out: clockOut,
    employee: employeeData,
  };
};

export const fetchShifts = async (params?: { employee?: string, startDate?: string, endDate?: string, shift_date?: string }): Promise<Shift[]> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employee) queryParams.append("employee", params.employee);
    if (params?.shift_date) queryParams.append("date", params.shift_date);
    queryParams.append("pageSize", "200");

    const res: any = await apiFetch(`/api/v1/employee-schedules/?${queryParams.toString()}`);
    const results = res?.data?.results ?? res?.results ?? [];

    return results.map((d: any) => toShift(d));
  } catch (e) {
    console.error("fetchShifts failed", e);
    return [];
  }
};

export const fetchShiftsForDate = async (date: string): Promise<Shift[]> => {
    return fetchShifts({ shift_date: date });
};

export const createShift = async (shift: Partial<Shift>): Promise<Shift | null> => {
    try {
        const payload = {
            employee: shift.employes_id,
            shift_date: shift.shift_date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            is_night_shift: !!shift.is_night_shift,
        };

        const res: any = await apiFetch("/api/v1/work-shifts/", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        
        return toShift(res?.data ?? res);
    } catch (e) {
        console.error("createShift failed", e);
        return null;
    }
};

export const updateShift = async (id: string, shift: Partial<Shift>): Promise<Shift | null> => {
    try {
        const payload: any = {};
        if (shift.employes_id) payload.employee = shift.employes_id;
        if (shift.is_night_shift !== undefined) payload.is_night_shift = shift.is_night_shift;
        if (shift.shift_date) payload.shift_date = shift.shift_date;
        if (shift.start_time) payload.start_time = shift.start_time;
        if (shift.end_time) payload.end_time = shift.end_time;

        const res: any = await apiFetch(`/api/v1/work-shifts/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
        
        return toShift(res?.data ?? res);
    } catch (e) {
        console.error("updateShift failed", e);
        return null;
    }
};

export const deleteShift = async (id: string): Promise<boolean> => {
  try {
    await apiFetch(`/api/v1/work-shifts/${id}/`, {
      method: "DELETE",
    });
    return true;
  } catch (e) {
    console.error("deleteShift failed", e);
    return false;
  }
};

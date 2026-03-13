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

const toShift = (d: ApiShift): Shift => {
  // Handle nested employee object if present
  let employeeData = undefined;
  let employeeId = "";

  if (typeof d.employee === 'object' && d.employee !== null) {
      employeeId = d.employee.id || "";
      employeeData = { full_name: d.employee.fullName || d.employee.full_name || d.employeeName || "" };
  } else if (typeof d.employe === 'object' && d.employe !== null) {
      employeeId = d.employe.id || "";
      employeeData = { full_name: d.employe.fullName || d.employe.full_name || d.employeeName || "" };
  } else {
      employeeId = (d.employee || d.employe || d.employes_id || d.employesId || "") as string;
      if (d.employeeName) {
          employeeData = { full_name: d.employeeName };
      }
  }

  const clockIn = d.clockIn || d.clock_in;
  const clockOut = d.clockOut || d.clock_out;

  return {
    id: String(d.id),
    employes_id: employeeId,
    shift_date: d.shiftDate || d.shift_date || (clockIn ? dayjs(clockIn).format('YYYY-MM-DD') : ""),
    start_time: (d.startTime || d.start_time || (clockIn ? dayjs(clockIn).format('HH:mm') : "")).slice(0, 5),
    end_time: (d.endTime || d.end_time || (clockOut ? dayjs(clockOut).format('HH:mm') : "")).slice(0, 5),
    is_night_shift: d.isNightShift ?? d.is_night_shift ?? false,
    clock_in: clockIn,
    clock_out: clockOut,
    employee: employeeData
  };
};

export const fetchShifts = async (params?: { employee?: string, startDate?: string, endDate?: string, shift_date?: string }): Promise<Shift[]> => {
  try {
    const query = new URLSearchParams();
    query.append("ordering", "-clockIn");
    query.append("page_size", "1000");

    if (params?.employee) query.append("employee", params.employee);
    if (params?.startDate) query.append("clockIn_0", dayjs(params.startDate).startOf('day').toISOString());
    if (params?.endDate) query.append("clockIn_1", dayjs(params.endDate).endOf('day').toISOString());
    if (params?.shift_date) query.append("shift_date", params.shift_date);

    const res: any = await apiFetch(`/api/v1/work-shifts/?${query.toString()}`);
    const results = res?.data?.results || res?.results || [];
    return results.map(toShift);
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
        const clockIn = dayjs(`${shift.shift_date}T${shift.start_time}`).toISOString();
        let clockOut = null;
        if (shift.end_time) {
            let clockOutDate = shift.shift_date;
            if (shift.is_night_shift) {
                // If the end time is early (e.g. 08:00), it's probably next day
                const [h] = (shift.end_time || "00:00").split(':').map(Number);
                if (h < 12) {
                   clockOutDate = dayjs(shift.shift_date).add(1, 'day').format('YYYY-MM-DD');
                }
            }
            clockOut = dayjs(`${clockOutDate}T${shift.end_time}`).toISOString();
        }

        const body = {
            employee: shift.employes_id,
            clockIn: clockIn,
            clockOut: clockOut,
            isNightShift: !!shift.is_night_shift
        };

        const res: any = await apiFetch("/api/v1/work-shifts/", {
            method: "POST",
            body: JSON.stringify(body)
        });
        
        const data = res?.data || res;
        return toShift(data);
    } catch (e) {
        console.error("createShift failed", e);
        return null;
    }
};

export const updateShift = async (id: string, shift: Partial<Shift>): Promise<Shift | null> => {
    try {
        const body: any = {};
        if (shift.employes_id) body.employee = shift.employes_id;
        if (shift.is_night_shift !== undefined) body.isNightShift = shift.is_night_shift;
        
        if (shift.shift_date && shift.start_time) {
            body.clockIn = dayjs(`${shift.shift_date}T${shift.start_time}`).toISOString();
        }
        
        if (shift.shift_date && shift.end_time) {
            let clockOutDate = shift.shift_date;
             if (shift.is_night_shift) {
                const [h] = (shift.end_time || "00:00").split(':').map(Number);
                if (h < 12) {
                   clockOutDate = dayjs(shift.shift_date).add(1, 'day').format('YYYY-MM-DD');
                }
            }
            body.clockOut = dayjs(`${clockOutDate}T${shift.end_time}`).toISOString();
        }

        const res: any = await apiFetch(`/api/v1/work-shifts/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(body)
        });
        
        const data = res?.data || res;
        return toShift(data);
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

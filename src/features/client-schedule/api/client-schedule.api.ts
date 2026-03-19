import { ClientShift, Client } from "../model/types";
import { apiFetch } from "../../../utility/apiClient";

// ── Маппинг из API ответа ──────────────────────────────────────────────────

function toClient(r: any): Client {
  return {
    id: String(r.id ?? r.uuid ?? ""),
    fullName: r.fullName ?? r.full_name ?? r.fio ?? "",
    photoUrl: r.photoUrl ?? r.photo_url ?? r.photo ?? undefined,
  };
}

function toShift(r: any): ClientShift {
  const patient = r.patient ?? {};
  return {
    id: String(r.id ?? ""),
    clientId: String(r.patientId ?? r.patient_id ?? patient.id ?? ""),
    date: r.date ?? "",
    startTime: r.startTime ?? r.start_time ?? "09:00",
    endTime: r.endTime ?? r.end_time ?? "18:00",
    isNextWeekEnd: false,
    client: patient.id
      ? { id: String(patient.id), fullName: patient.fullName ?? patient.full_name ?? "", photoUrl: patient.photo ?? undefined }
      : undefined,
  };
}

// ── Результат bulk создания ────────────────────────────────────────────────

export type BulkResult = {
  mode: string;
  summary: { received: number; created: number; skipped: number };
  results: Array<{ index: number; status: "created" | "skipped"; id?: string; code?: string }>;
  created: ClientShift[];
};

// ── API ───────────────────────────────────────────────────────────────────

export const clientScheduleApi = {
  /** Загрузить список клиентов */
  fetchClients: async (): Promise<Client[]> => {
    try {
      const res: any = await apiFetch("/api/v1/clients/?page_size=500&ordering=fullName");
      const results: any[] = res?.data?.results ?? res?.results ?? [];
      return results.map(toClient).filter((c) => c.id && c.fullName);
    } catch {
      return [];
    }
  },

  /** Загрузить смены клиентов за диапазон дат */
  fetchShifts: async (startDate: string, endDate: string): Promise<ClientShift[]> => {
    try {
      const res: any = await apiFetch(
        `/api/v1/client-schedules/?start_date=${startDate}&end_date=${endDate}&page_size=500`
      );
      const results: any[] = res?.data?.results ?? res?.results ?? [];
      return results.map(toShift).filter((s) => s.id && s.date);
    } catch {
      return [];
    }
  },

  /** Создать одну запись */
  createShift: async (shift: Omit<ClientShift, "id" | "client">): Promise<ClientShift> => {
    const res: any = await apiFetch("/api/v1/client-schedules/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient: shift.clientId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
      }),
    });
    return toShift(res?.data ?? res);
  },

  /** Bulk создание (несколько дат сразу) — при выборе дней недели */
  createShiftsBulk: async (
    shifts: Array<Omit<ClientShift, "id" | "client">>
  ): Promise<BulkResult> => {
    const body = shifts.map((s) => ({
      patient: s.clientId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    const res: any = await apiFetch("/api/v1/client-schedules/bulk/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = res?.data ?? res;
    return {
      mode: data.mode ?? "partial_success_skip_duplicates",
      summary: data.summary ?? { received: shifts.length, created: 0, skipped: 0 },
      results: data.results ?? [],
      created: (data.created ?? []).map(toShift),
    };
  },

  /** Обновить запись */
  updateShift: async (id: string, patch: { startTime?: string; endTime?: string }): Promise<ClientShift> => {
    const res: any = await apiFetch(`/api/v1/client-schedules/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(patch.startTime ? { startTime: patch.startTime } : {}),
        ...(patch.endTime ? { endTime: patch.endTime } : {}),
      }),
    });
    return toShift(res?.data ?? res);
  },

  /** Удалить запись */
  deleteShift: async (id: string): Promise<boolean> => {
    await apiFetch(`/api/v1/client-schedules/${id}/`, { method: "DELETE" });
    return true;
  },
};

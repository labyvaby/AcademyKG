/**
 * Group Appointments API
 *
 * Endpoints:
 *   GET    /api/v1/appointment-groups/?date=YYYY-MM-DD
 *   POST   /api/v1/appointment-groups/
 *   POST   /api/v1/appointment-groups/{id}/add-participant/
 *   PATCH  /api/v1/appointments/{id}/   (status + payment per participant)
 */

import type { AppointmentGroup, GroupParticipant, GroupAppointmentStatus } from "../model/types";
import { apiFetch } from "../../../utility/apiClient";

// ── Маппинг из API ответа ──────────────────────────────────────────────────

function toParticipant(r: any): GroupParticipant {
  return {
    id: String(r.id ?? ""),
    patientId: String(r.patientId ?? r.patient_id ?? ""),
    patientName: r.patientName ?? r.patient_name ?? "",
    patientPhoto: r.patientPhoto ?? r.patient_photo ?? null,
    status: r.status ?? "scheduled",
    total: Number(r.total ?? 0),
    paidCash: Number(r.paidCash ?? r.paid_cash ?? 0),
    paidCard: Number(r.paidCard ?? r.paid_card ?? 0),
    paidBalance: Number(r.paidBalance ?? r.paid_balance ?? 0),
    debt: Number(r.debt ?? 0),
  };
}

function toGroup(r: any): AppointmentGroup {
  return {
    id: String(r.id ?? ""),
    appointmentAt: r.appointmentAt ?? r.appointment_at ?? "",
    performerId: String(r.performerId ?? r.performer_id ?? ""),
    performerName: r.performerName ?? r.performer_name ?? "",
    sellableItemId: String(r.sellableItemId ?? r.sellable_item_id ?? ""),
    sellableItemName: r.sellableItemName ?? r.sellable_item_name ?? "",
    price: Number(r.price ?? 0),
    maxParticipants: r.maxParticipants ?? r.max_participants ?? null,
    trainerNotCame: Boolean(r.trainerNotCame ?? r.trainer_not_came ?? false),
    participants: (r.participants ?? []).map(toParticipant),
  };
}

// ── Функции API ────────────────────────────────────────────────────────────

export async function fetchGroups(date: string): Promise<AppointmentGroup[]> {
  try {
    const res: any = await apiFetch(`/api/v1/appointment-groups/?date=${date}`);
    const results: any[] = res?.data?.results ?? res?.results ?? [];
    return results.map(toGroup);
  } catch {
    return [];
  }
}

export async function fetchGroupsByRange(dateFrom: string, dateTo: string): Promise<AppointmentGroup[]> {
  try {
    const res: any = await apiFetch(`/api/v1/appointment-groups/?dateFrom=${dateFrom}&dateTo=${dateTo}&pageSize=500`);
    const results: any[] = res?.data?.results ?? res?.results ?? [];
    return results.map(toGroup);
  } catch {
    return [];
  }
}

export async function createGroup(payload: {
  appointmentAt: string;
  performerId: string;
  performerName?: string;
  sellableItemId: string;
  sellableItemName?: string;
  price: number;
  maxParticipants?: number | null;
  patientIds: string[];
  patientNames: string[];
}): Promise<AppointmentGroup> {
  const res: any = await apiFetch("/api/v1/appointment-groups/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appointmentAt: payload.appointmentAt,
      performer: payload.performerId,
      sellableItem: payload.sellableItemId,
      patients: payload.patientIds,
      adminComment: "",
    }),
  });

  const data = res?.data ?? res;
  // Патчим имена если бэкенд их не вернул
  const group = toGroup(data);
  if (!group.performerName && payload.performerName) group.performerName = payload.performerName;
  if (!group.sellableItemName && payload.sellableItemName) group.sellableItemName = payload.sellableItemName;
  return group;
}

export async function addParticipantToGroup(
  groupId: string,
  participant: { patientId: string; patientName: string },
): Promise<AppointmentGroup> {
  const res: any = await apiFetch(
    `/api/v1/appointment-groups/${groupId}/add-participant/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient: participant.patientId }),
    }
  );
  return toGroup(res?.data ?? res);
}

export async function updateParticipantStatus(
  _groupId: string,
  participantId: string,
  status: GroupAppointmentStatus,
): Promise<void> {
  await apiFetch(`/api/v1/appointments/${participantId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiFetch(`/api/v1/appointment-groups/${groupId}/`, {
    method: "DELETE",
  });
}

export async function updateGroup(
  groupId: string,
  payload: { appointmentAt?: string; performerId?: string; sellableItemId?: string; maxParticipants?: number | null },
): Promise<AppointmentGroup> {
  const body: Record<string, any> = {};
  if (payload.appointmentAt !== undefined) body.appointmentAt = payload.appointmentAt;
  if (payload.performerId !== undefined) body.performer = payload.performerId;
  if (payload.sellableItemId !== undefined) body.sellableItem = payload.sellableItemId;
  if (payload.maxParticipants !== undefined) body.maxParticipants = payload.maxParticipants;
  const res: any = await apiFetch(`/api/v1/appointment-groups/${groupId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return toGroup(res?.data ?? res);
}

export async function setGroupTrainerNotCame(groupId: string): Promise<AppointmentGroup | null> {
  const res: any = await apiFetch(`/api/v1/appointment-groups/${groupId}/trainer-not-came/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = res?.data ?? res;
  return data?.id ? toGroup(data) : null;
}

export async function payParticipant(
  groupId: string,
  participantId: string,
  payment: { paidCash?: number; paidCard?: number; paidBalance?: number },
): Promise<GroupParticipant> {
  const res: any = await apiFetch(`/api/v1/appointments/${participantId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paidCash: payment.paidCash ?? 0,
      paidCard: payment.paidCard ?? 0,
      paidBalance: payment.paidBalance ?? 0,
    }),
  });

  const data = res?.data ?? res;

  // Если бэкенд вернул обновлённого участника — маппим
  if (data?.id) return toParticipant(data);

  // Иначе возвращаем fallback — страница перезагрузит данные
  return toParticipant({
    id: participantId,
    patientId: "",
    patientName: "",
    status: "paid",
    total: 0,
    paidCash: payment.paidCash ?? 0,
    paidCard: payment.paidCard ?? 0,
    paidBalance: payment.paidBalance ?? 0,
    debt: 0,
    ...data,
  });
}

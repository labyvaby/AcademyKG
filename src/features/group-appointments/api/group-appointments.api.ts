/**
 * Group Appointments API
 *
 * Currently uses mock data. Replace with real API calls when backend is ready.
 *
 * Expected endpoints:
 *   GET    /api/v1/appointment-groups/?date=YYYY-MM-DD
 *   POST   /api/v1/appointment-groups/
 *   PATCH  /api/v1/appointments/{id}/   (status + payment per participant)
 */

import type { AppointmentGroup, GroupParticipant, GroupAppointmentStatus } from "../model/types";
import { MOCK_GROUPS } from "../model/mockData";

// In-memory store for mock mutations
let mockStore: AppointmentGroup[] = JSON.parse(JSON.stringify(MOCK_GROUPS));

export async function fetchGroups(date: string): Promise<AppointmentGroup[]> {
  // TODO: replace with apiFetch(`/api/v1/appointment-groups/?date=${date}`)
  await new Promise((r) => setTimeout(r, 300)); // simulate latency
  return mockStore.filter((g) => g.appointmentAt.startsWith(date));
}

export async function createGroup(payload: {
  appointmentAt: string;
  performerId: string;
  sellableItemId: string;
  price: number;
  patientIds: string[];
  patientNames: string[];
}): Promise<AppointmentGroup> {
  // TODO: replace with apiFetch("/api/v1/appointment-groups/", { method: "POST", ... })
  await new Promise((r) => setTimeout(r, 400));

  const newGroup: AppointmentGroup = {
    id: `grp-${Date.now()}`,
    appointmentAt: payload.appointmentAt,
    performerId: payload.performerId,
    performerName: "Сотрудник", // TODO: resolve from employees list
    sellableItemId: payload.sellableItemId,
    sellableItemName: "Услуга", // TODO: resolve from services list
    price: payload.price,
    participants: payload.patientIds.map((pid, i) => ({
      id: `appt-${Date.now()}-${i}`,
      patientId: pid,
      patientName: payload.patientNames[i] ?? "Клиент",
      status: "scheduled",
      total: payload.price,
      paidCash: 0,
      paidCard: 0,
      paidBalance: 0,
      paidBonuses: 0,
      debt: payload.price,
    })),
  };

  mockStore = [...mockStore, newGroup];
  return newGroup;
}

export async function updateParticipantStatus(
  groupId: string,
  participantId: string,
  status: GroupAppointmentStatus,
): Promise<void> {
  // TODO: replace with apiFetch(`/api/v1/appointments/${participantId}/`, { method: "PATCH", body: JSON.stringify({ status }) })
  await new Promise((r) => setTimeout(r, 200));
  mockStore = mockStore.map((g) =>
    g.id !== groupId
      ? g
      : {
          ...g,
          participants: g.participants.map((p) =>
            p.id === participantId ? { ...p, status } : p,
          ),
        },
  );
}

export async function payParticipant(
  groupId: string,
  participantId: string,
  payment: { paidCash?: number; paidCard?: number; paidBalance?: number; paidBonuses?: number },
): Promise<GroupParticipant> {
  // TODO: replace with apiFetch(`/api/v1/appointments/${participantId}/`, { method: "PATCH", body: JSON.stringify(payment) })
  await new Promise((r) => setTimeout(r, 300));

  let updated: GroupParticipant | null = null;

  mockStore = mockStore.map((g) => {
    if (g.id !== groupId) return g;
    return {
      ...g,
      participants: g.participants.map((p) => {
        if (p.id !== participantId) return p;
        const paidCash = (p.paidCash ?? 0) + (payment.paidCash ?? 0);
        const paidCard = (p.paidCard ?? 0) + (payment.paidCard ?? 0);
        const paidBalance = (p.paidBalance ?? 0) + (payment.paidBalance ?? 0);
        const paidBonuses = (p.paidBonuses ?? 0) + (payment.paidBonuses ?? 0);
        const totalPaid = paidCash + paidCard + paidBalance + paidBonuses;
        const debt = Math.max(0, p.total - totalPaid);
        updated = { ...p, paidCash, paidCard, paidBalance, paidBonuses, debt, status: debt === 0 ? "paid" : p.status };
        return updated;
      }),
    };
  });

  if (!updated) throw new Error("Participant not found");
  return updated;
}

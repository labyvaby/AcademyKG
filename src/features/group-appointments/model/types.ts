export type GroupAppointmentStatus =
  | "scheduled"
  | "arrived"
  | "in_progress"
  | "completed"
  | "paid"
  | "partially_paid"
  | "cancelled"
  | "not_came";

export const GROUP_STATUS_LABELS: Record<GroupAppointmentStatus, string> = {
  scheduled: "Ожидаем",
  arrived: "Клиент здесь",
  in_progress: "В работе",
  completed: "Завершено",
  paid: "Оплачено",
  partially_paid: "Частично оплачено",
  cancelled: "Отменено",
  not_came: "Не пришёл",
};

export type GroupParticipant = {
  id: string; // appointment id
  patientId: string;
  patientName: string;
  patientPhoto?: string | null;
  status: GroupAppointmentStatus;
  total: number;
  paidCash: number;
  paidCard: number;
  paidBalance: number;
  paidBonuses: number;
  debt: number;
};

export type AppointmentGroup = {
  id: string;
  appointmentAt: string; // ISO
  performerId: string;
  performerName: string;
  sellableItemId: string;
  sellableItemName: string;
  price: number; // per participant
  participants: GroupParticipant[];
};

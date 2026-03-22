export type GroupAppointmentStatus =
  | "scheduled"
  | "arrived"
  | "in_progress"
  | "completed"
  | "paid"
  | "partially_paid"
  | "cancelled"
  | "not_came"
  | "no_show";

export const GROUP_STATUS_LABELS: Record<GroupAppointmentStatus, string> = {
  scheduled: "Ожидаем",
  arrived: "Клиент здесь",
  in_progress: "В работе",
  completed: "Завершено",
  paid: "Оплачено",
  partially_paid: "Частично оплачено",
  cancelled: "Отменено",
  not_came: "Не пришёл",
  no_show: "Не пришёл",
};

export const GROUP_STATUS_COLOR: Record<GroupAppointmentStatus, "default" | "warning" | "info" | "success" | "error" | "primary"> = {
  scheduled: "warning",
  arrived: "info",
  in_progress: "primary",
  completed: "default",
  paid: "success",
  partially_paid: "info",
  cancelled: "error",
  not_came: "error",
  no_show: "error",
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
  paidBalance: number; // баланс клиента (нал+безнал)
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
  maxParticipants?: number | null; // макс кол-во участников из услуги
  participants: GroupParticipant[];
};

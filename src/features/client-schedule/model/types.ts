export interface Client {
  id: string;
  fullName: string;
  phone?: string | null;
  photoUrl?: string;
}

export interface ClientShift {
  id: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isNextWeekEnd?: boolean; // Смена заканчивается на следующей неделе
  client?: Client;
}

export interface ClientDaySegment {
  shiftId: string;
  startMin: number;
  endMin: number;
  clientName: string;
  clientPhoto?: string;
  clientId: string;
  label: string;
  shift: ClientShift;
}

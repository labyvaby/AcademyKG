// Centralized common domain types used across the app

// Patient entity minimal shape used by Patient Search UI
export type Patient = {
  id: string;
  fio: string;
  phone?: string;
  inn?: string | null;
  photo?: string | null;
  birth_date?: string | null;
  is_blacklisted?: boolean | null;
  blacklist_reason?: string | null;
  responsiblePersons?: { fullName: string; phone: string }[];
  // Ребёнок сотрудника + автоматическая скидка при оплате (read-only снимок API).
  is_employee_child?: boolean | null;
  employee_parent_name?: string | null;
  employee_child_discount_percent?: number | null;
};

// History row for patient's appointments (normalized view)
export type HistoryRow = {
  ID: string;
  "Дата и время": string;
  "Дата n8n"?: string;
  "Доктор ФИО"?: string;
  "Пациент ФИО"?: string;
  Услуга?: string;
  "Услуга ID"?: string;
  Статус?: string;
  Стоимость?: number;
  "Итого, сом"?: number;
  "Жалобы при обращении"?: string;
  "Жалобы (врач)"?: string;
  "Комментарий администратора"?: string;
  has_conclusion?: boolean;
  diagnosis_code?: string;
  diagnosis_title?: string;
  conclusion?: string;
  diagnosis_data?: any;
  weight?: number;
  height?: number;
  temperature?: number;
  anamnesis?: string;
  objective?: string;
};

// Created entities returned from "quick add" drawers
export type CreatedPatient = {
  id: string;
  fio: string;
  phone?: string | null;
  birth_date?: string | null;
  photo?: string | null;
  is_blacklisted?: boolean | null;
  blacklist_reason?: string | null;
  responsiblePersons?: { fullName: string; phone: string }[];
};

export type CreatedEmployee = {
  id: string;
  full_name: string;
  phone?: string | null;
};

import dayjs from "dayjs";
import type { AppointmentGroup } from "../../features/group-appointments/model/types";
import { dayjsBishkek } from "../../utility/dayjsBishkek";

export type AppointmentServiceJson = {
  id?: string;
  service_id?: string;
  name?: string;
  service_name?: string;
  price?: number;
  cost?: number;
  image_url?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  doctor_photo?: string | null;
  performer_id?: string | null;
  performer_name?: string | null;
  performer_photo?: string | null;
  status?: string;
  quantity?: number;
};

export type Appointment = {
  id: string;
  appointment_at: string; // ISO string
  duration?: number | null; // minutes
  formatted_date: string; // DD.MM.YYYY HH:MI
  doctor_name: string;
  doctor_id?: string;
  doctor_photo_url?: string | null;
  patient_name: string;
  patient_id?: string;
  service_names: string;
  services_json?: AppointmentServiceJson[] | string | null;
  parsed_services?: AppointmentServiceJson[] | null;
  status: "Оплачено" | "Ожидаем" | "Со скидкой" | string;
  is_night: boolean;
  total_cost: number;
  total_amount: number;
  paid_cash: number;
  paid_card: number;
  paid_balance: number;
  paid_bonuses: number;
  discount: number;
  debt: number;
  admin_comment?: string | null;
  complaints?: string | null;
  doctor_complaints?: string | null;
  diagnosis_code?: string | null; // Код диагноза по МКБ-10
  conclusion?: string | null; // Заключение врача
  clinic_diagnosis_id?: string | null; // ID выбранного клинического диагноза
  diagnosis_title?: string | null; // Название диагноза (из ClinicDiagnoses)
  /**
   * Дополнительное поле из агрегирующего представления, используемое
   * как запасной вариант для расчёта общей суммы.
   */
  estimated_total?: number | null;
  weight?: number | null;
  height?: number | null;
  temperature?: number | null;
  anamnesis?: string | null;
  objective?: string | null;
  diagnosis_data?: any[] | null;
  conclusion_history?: any[] | null;
  performer_ids?: string[] | null;
  has_conclusion?: boolean;
  // Групповой приём
  is_group?: boolean;
  group_data?: AppointmentGroup | null;
  attended?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
};

// Строка из агрегирующего представления AppointmentsAggregated
// Поддерживает и snake_case (старый Supabase) и camelCase (новый REST API)
export type AggregatedAppointmentRow = {
  id?: string;
  // snake_case (legacy)
  appointment_at?: string;
  formatted_date?: string;
  doctor_name?: string;
  doctor_id?: string | null;
  doctor_photo_url?: string | null;
  patient_name?: string;
  patient_id?: string | null;
  service_names?: string;
  services_json?: AppointmentServiceJson[] | string | null;
  is_night?: boolean | null;
  total_cost?: number | null;
  total_amount?: number | null;
  paid_cash?: number | null;
  paid_card?: number | null;
  paid_balance?: number | null;
  paid_bonuses?: number | null;
  discount?: number | null;
  debt?: number | null;
  admin_comment?: string | null;
  complaints?: string | null;
  doctor_complaints?: string | null;
  diagnosis_code?: string | null;
  conclusion?: string | null;
  clinic_diagnosis_id?: string | null;
  diagnosis_title?: string | null;
  estimated_total?: number | null;
  performer_ids?: string[] | null;
  has_conclusion?: boolean;
  weight?: number | null;
  height?: number | null;
  temperature?: number | null;
  anamnesis?: string | null;
  objective?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  // camelCase (новый REST API)
  appointmentAt?: string;
  doctorName?: string;
  doctorId?: string | null;
  doctorPhotoUrl?: string | null;
  patientName?: string;
  patientId?: string | null;
  serviceNames?: string;
  servicesJson?: AppointmentServiceJson[] | string | null;
  isNight?: boolean | null;
  totalCost?: number | null;
  totalAmount?: number | null;
  paidCash?: number | null;
  paidCard?: number | null;
  paidBalance?: number | null;
  paidBonuses?: number | null;
  adminComment?: string | null;
  doctorComplaints?: string | null;
  diagnosisCode?: string | null;
  clinicDiagnosisId?: string | null;
  diagnosisTitle?: string | null;
  estimatedTotal?: number | null;
  performerIds?: string[] | null;
  hasConclusion?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string | null;
  updatedByName?: string | null;
  duration?: number | null;
  status?: string;
};

export const mapAggregatedRowToAppointment = (
  row: AggregatedAppointmentRow,
): Appointment => {
  // Поддержка обоих форматов: snake_case (старый) и camelCase (новый REST API)
  const r = row as any;
  const appointmentAt = r.appointment_at ?? r.appointmentAt ?? "";
  const totalCost = r.total_cost ?? r.totalCost ?? r.total ?? 0;
  const totalAmount = r.total_amount ?? r.totalAmount ?? totalCost;
  const servicesRaw = r.services_json ?? r.servicesJson ?? r.services ?? null;

  // New API: patient is a nested object
  const patientNested = r.patient ?? null;
  const patientName = r.patient_name ?? r.patientName
    ?? (patientNested ? (patientNested.fullName ?? patientNested.full_name ?? patientNested.name ?? "") : "")
    ?? "";
  const patientId = r.patient_id ?? r.patientId ?? patientNested?.id ?? undefined;

  // New API: services array with performer
  const servicesArr: any[] = Array.isArray(r.services) ? r.services : [];
  const firstService = servicesArr[0];
  const doctorName = r.doctor_name ?? r.doctorName
    ?? firstService?.performer?.fullName ?? firstService?.performer?.full_name ?? "";
  const doctorId = r.doctor_id ?? r.doctorId
    ?? firstService?.performer?.id ?? undefined;
  const doctorPhotoUrl = r.doctor_photo_url ?? r.doctorPhotoUrl
    ?? firstService?.performer?.photoUrl ?? null;
  const serviceNames = r.service_names ?? r.serviceNames
    ?? servicesArr.map((s: any) => s.sellableItem?.displayName ?? s.sellable_item?.display_name ?? s.name ?? "").filter(Boolean).join(", ")
    ?? "";

  // Normalize services from new REST API format
  // API returns: {id, sellableItem: "uuid", performer: "uuid", performerName: "...", price: "1234.00", ...}
  const normalizeServices = (arr: any[]): AppointmentServiceJson[] =>
    arr.map((s: any) => {
      // Already normalized (old format has name/performer_name)
      if (s.performer_name || s.doctor_name) return s;
      // performer and sellableItem are plain UUIDs (strings), name is in performerName / sellableItemName
      const performerId = typeof s.performer === "string" ? s.performer : s.performer?.id ?? null;
      const performerName = s.performerName ?? s.performer_name
        ?? (typeof s.performer === "object" ? (s.performer?.fullName ?? s.performer?.full_name ?? "") : null)
        ?? (doctorName || null); // фоллбэк — имя специалиста из самого приёма
      const sellableId = typeof s.sellableItem === "string" ? s.sellableItem : s.sellableItem?.id ?? s.sellable_item?.id ?? s.id ?? null;
      const sellableName = s.sellableItemName ?? s.serviceName ?? s.service_name ?? (typeof s.sellableItem === "object" ? (s.sellableItem?.displayName ?? s.sellableItem?.name ?? "") : null) ?? "Услуга";
      return {
        id: String(s.id ?? sellableId ?? ""),
        service_id: String(sellableId ?? ""),
        name: sellableName,
        price: Number(s.price ?? 0),
        quantity: Number(s.quantity ?? 1),
        performer_id: performerId ? String(performerId) : null,
        performer_name: performerName ?? null,
        performer_photo: s.performer?.photoUrl ?? s.performer?.photo ?? null,
      } as AppointmentServiceJson;
    });

  let parsedServices: AppointmentServiceJson[] | null = null;
  try {
    if (servicesRaw) {
      if (typeof servicesRaw === "string") parsedServices = normalizeServices(JSON.parse(servicesRaw));
      else if (Array.isArray(servicesRaw)) parsedServices = normalizeServices(servicesRaw);
    } else if (servicesArr.length > 0) {
      parsedServices = normalizeServices(servicesArr);
    }
  } catch { /* ignore */ }

  // Если сервисы есть но у них нет имени специалиста — подставим из doctorName
  if (parsedServices && parsedServices.every(s => !s.performer_name) && doctorName) {
    parsedServices = parsedServices.map(s => ({
      ...s,
      performer_name: s.performer_name ?? doctorName,
      performer_id: s.performer_id ?? (doctorId ? String(doctorId) : null),
    }));
  }

  // Normalize API status codes (English) to Russian display names
  const STATUS_MAP: Record<string, string> = {
    scheduled: "Ожидаем",
    waiting: "Ожидаем",
    arrived: "Клиент здесь",
    client_here: "Клиент здесь",
    in_progress: "В работе",
    completed: "Завершено",
    paid: "Оплачено",
    partially_paid: "Частично оплачено",
    discounted: "Со скидкой",
    cancelled: "Отменено",
    canceled: "Отменено",
    not_came: "Клиент не пришел",
    no_show: "Клиент не пришел",
    patient_not_came: "Клиент не пришел",
    free: "Бесплатно",
    trainer_not_came: "Клиент не пришел",
  };
  const rawStatus = r.status ?? "";
  const normalizedStatus = STATUS_MAP[rawStatus?.toLowerCase?.()] ?? rawStatus ?? "Ожидаем";

  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return {
    id: String(r.id ?? ""),
    appointment_at: appointmentAt,
    duration: r.duration,
    formatted_date: appointmentAt
      ? dayjsBishkek(appointmentAt).format("HH:mm DD.MM.YYYY")
      : (r.formatted_date ?? ""),
    doctor_name: doctorName,
    doctor_id: doctorId,
    doctor_photo_url: doctorPhotoUrl,
    patient_name: patientName,
    patient_id: patientId,
    service_names: serviceNames,
    services_json: parsedServices ?? servicesRaw,
    parsed_services: parsedServices,
    status: normalizedStatus,
    is_night: Boolean(r.is_night ?? r.isNight),
    total_cost: n(totalCost),
    total_amount: n(totalAmount),
    paid_cash: n(r.paid_cash ?? r.paidCash),
    paid_card: n(r.paid_card ?? r.paidCard),
    paid_balance: n(r.paid_balance ?? r.paidBalance),
    paid_bonuses: n(r.paid_bonuses ?? r.paidBonuses),
    discount: n(r.discount),
    debt: n(r.debt),
    admin_comment: r.admin_comment ?? r.adminComment ?? null,
    complaints: r.complaints ?? null,
    doctor_complaints: r.doctor_complaints ?? r.doctorComplaints ?? null,
    diagnosis_code: r.diagnosis_code ?? r.diagnosisCode ?? null,
    conclusion: r.conclusion ?? null,
    clinic_diagnosis_id: r.clinic_diagnosis_id ?? r.clinicDiagnosisId ?? null,
    diagnosis_title: r.diagnosis_title ?? r.diagnosisTitle ?? null,
    estimated_total: r.estimated_total ?? r.estimatedTotal ?? null,
    performer_ids: (() => {
      const direct = r.performer_ids ?? r.performerIds;
      if (Array.isArray(direct) && direct.length > 0) return direct;
      // Фоллбэк: собираем performer_id из сервисов
      if (doctorId) return [String(doctorId)];
      const fromServices = (parsedServices ?? [])
        .map((s: any) => s.performer_id)
        .filter(Boolean)
        .map(String);
      return fromServices.length > 0 ? fromServices : [];
    })(),
    has_conclusion: Boolean(r.has_conclusion ?? r.hasConclusion),
    weight: r.weight ?? null,
    height: r.height ?? null,
    temperature: r.temperature ?? null,
    anamnesis: r.anamnesis ?? null,
    objective: r.objective ?? null,
    created_at: r.created_at ?? r.createdAt,
    updated_at: r.updated_at ?? r.updatedAt,
    created_by_name: r.created_by_name ?? r.createdByName
      ?? (r.createdBy ? (r.createdBy.fullName ?? r.createdBy.full_name ?? r.createdBy.email ?? null) : null)
      ?? null,
    updated_by_name: r.updated_by_name ?? r.updatedByName
      ?? (r.updatedBy ? (r.updatedBy.fullName ?? r.updatedBy.full_name ?? r.updatedBy.email ?? null) : null)
      ?? null,
    diagnosis_data: r.diagnosis_data ?? r.diagnosisData ?? null,
    conclusion_history: r.conclusion_history ?? r.conclusionHistory ?? null,
    attended: Boolean(r.attended ?? false),
  };
};

/** Конвертирует AppointmentGroup в Appointment для отображения в общем списке */
export const mapGroupToAppointment = (group: AppointmentGroup): Appointment => {
  const totalDebt = group.participants.reduce((s, p) => s + p.debt, 0);
  const totalPaid = group.participants.reduce((s, p) => s + p.paidCash + p.paidCard + p.paidBalance, 0);
  const totalAmount = group.participants.length * group.price;
  const allPaid = group.participants.length > 0 && totalDebt === 0;
  const anyPaid = totalPaid > 0;
  const status = allPaid ? "Оплачено" : anyPaid ? "Частично оплачено" : "Ожидаем";

  return {
    id: `group_${group.id}`,
    appointment_at: group.appointmentAt,
    formatted_date: dayjsBishkek(group.appointmentAt).format("HH:mm DD.MM.YYYY"),
    doctor_name: group.performerName,
    doctor_id: group.performerId,
    patient_name: `Группа: ${group.participants.length} уч.`,
    patient_id: undefined,
    service_names: group.sellableItemName,
    status,
    is_night: false,
    total_cost: totalAmount,
    total_amount: totalAmount,
    paid_cash: group.participants.reduce((s, p) => s + p.paidCash, 0),
    paid_card: group.participants.reduce((s, p) => s + p.paidCard, 0),
    paid_balance: group.participants.reduce((s, p) => s + p.paidBalance, 0),
    paid_bonuses: 0,
    discount: 0,
    debt: totalDebt,
    is_group: true,
    group_data: group,
    performer_ids: [group.performerId],
  };
};

// Option in patient autocomplete on Home page
export type PatientOption = {
  id: string;
  label: string;
  fio?: string;
  phone?: string;
  "ФИО пациента"?: string;
  "ФИО клиента"?: string;
  Телефон?: string;
};

// Row in "услуга + врач" таблице при создании приёма
export type ServiceRowEntry = {
  quantity: number;
  serviceId: string;
  doctorId: string;
};

// Словарь флагов по статусам приёмов
export type StatusMap = Record<string, boolean>;

/**
 * Веса для сортировки статусов приёмов.
 * Чем меньше число, тем выше статус в списке.
 */
const STATUS_PRIORITY: Record<string, number> = {
  "Ожидаем": 1,
  "Пациент здесь": 2,
  "Со скидкой": 3,
  "Оплачено": 4,
  "Отменено": 100,
  "Пациент не пришел": 101,
};

/**
 * Сравнивает два приёма для сортировки.
 * Приоритет: Статус (по весам), затем время приёма.
 */
export const compareAppointmentsByStatus = (a: Appointment, b: Appointment): number => {
  const priorityA = STATUS_PRIORITY[a.status] ?? 50; // 50 для неизвестных статусов
  const priorityB = STATUS_PRIORITY[b.status] ?? 50;

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  // Если статусы одинаковые, сортируем по времени (по возрастанию)
  return dayjs(a.appointment_at).unix() - dayjs(b.appointment_at).unix();
};

import { API_BASE_URL } from "../utility/apiClient";

// Публичная витрина онлайн-записи: /api/v1/public/booking/… без авторизации.
// Контракт: kg_academy_back/docs/frontend-online-booking.md (2026-10-22).
// Не через apiFetch: гостю не нужен JWT, редирект на /login и клиентский
// rate-limit сотрудника (у витрины свой лимит на бэке по IP).

const BASE = `${API_BASE_URL}/api/v1/public/booking`;

export type PublicBranch = {
  id: string;
  name: string;
  brandName: string;
  address: string;
  logoUrl: string | null;
  timezone: string;
  currency: string;
  /** Телефон филиала для гостей (перенос и отмена — звонком); "" — не указан. */
  phone: string;
};

export type PublicInfo = {
  organization: { id: string; name: string; brandName: string; brandDescription: string; brandSubtitle: string };
  branches: PublicBranch[];
  /** Ссылки для блока «Важно»; "" — ссылки нет. */
  terms: { termsUrl: string; privacyUrl: string };
};

export type PublicService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: string;
  imageUrl: string | null;
};

export type PublicSpecialist = {
  id: string;
  fullName: string;
  nickname: string;
  photoUrl: string | null;
  specializations: string[];
  /** Ближайший день с окнами и первые окна; null — окон нет в горизонте записи. */
  nearest: { date: string; times: string[] } | null;
  /** Онлайн-предоплата при записи к специалисту; null — без предоплаты. */
  prepayment: { amount: string } | null;
};

export type PublicCalendar = {
  dateFrom: string;
  dateTo: string;
  timezone: string;
  durationMinutes: number;
  slotStepMinutes: number;
  /** Каждый день диапазона; без окон — times: [] */
  days: { date: string; times: string[] }[];
};

/**
 * awaiting_payment — ждём онлайн-предоплату; pending — ждёт звонка администратора;
 * cancelled — подтверждённый приём потом отменили; expired — предоплата не пришла, запись снята.
 */
export type PublicBookingStatus = "awaiting_payment" | "pending" | "confirmed" | "rejected" | "cancelled" | "expired";

/**
 * Онлайн-предоплата (Bakai Paylink). Оплату подтверждает только вебхук банка:
 * признак — status "paid" здесь, кнопка «Я оплатил» на странице банка ничего не доказывает.
 */
export type PublicPayment = {
  status: "pending" | "paid" | "expired" | "failed";
  amount: string;
  /** Есть, только пока ссылку можно оплатить. */
  payUrl: string | null;
  expiresAt: string;
  paidAt: string | null;
};

export type PublicBooking = {
  code: string;
  status: PublicBookingStatus;
  startAt: string;
  date: string;
  time: string;
  durationMinutes: number;
  price: string;
  currency: string;
  clientName: string;
  branch: { id: string; name: string; address: string; timezone: string; phone: string };
  service: { id: string; name: string };
  specialist: { id: string; fullName: string };
  /** null — заявка без предоплаты. */
  payment: PublicPayment | null;
  createdAt: string;
};

export type CreatePublicBookingInput = {
  branch: string;
  service: string;
  specialist: string;
  /** YYYY-MM-DD, локальная дата филиала */
  date: string;
  /** HH:MM, локальное время филиала */
  time: string;
  clientName: string;
  clientBirthDate?: string | null;
  contactName?: string;
  /** E.164 */
  contactPhone: string;
  comment?: string;
};

/** Ошибка витрины: code — машинный код бэка (slot_taken, slot_unavailable, too_many_bookings, payment_unavailable…). */
export class PublicBookingError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number, code = "", fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const snakeToCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new PublicBookingError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.", 0, "network");
  }

  const payload = await response.json().catch(() => null);
  if (response.ok) return (payload?.data ?? payload) as T;

  const errors: Array<{ code?: string; detail?: string; attr?: string | null }> = payload?.errors ?? [];
  const fieldErrors: Record<string, string> = {};
  errors.forEach((e) => {
    if (e.attr && e.detail) fieldErrors[snakeToCamel(e.attr)] = e.detail;
  });
  const first = errors[0];
  const message =
    response.status === 429
      ? "Слишком много попыток. Подождите немного и попробуйте снова."
      : first?.detail || payload?.detail || "Не удалось выполнить запрос. Попробуйте ещё раз.";
  throw new PublicBookingError(message, response.status, first?.code ?? "", fieldErrors);
}

export const getPublicInfo = (signal?: AbortSignal) => request<PublicInfo>("/", { signal });

export const getPublicServices = (branchId: string, signal?: AbortSignal) =>
  request<PublicService[]>(`/branches/${branchId}/services/`, { signal });

export const getPublicSpecialists = (branchId: string, serviceId: string, signal?: AbortSignal) =>
  request<PublicSpecialist[]>(`/branches/${branchId}/specialists/?service=${encodeURIComponent(serviceId)}`, {
    signal,
  });

export const getPublicCalendar = (branchId: string, specialistId: string, serviceId: string, signal?: AbortSignal) =>
  request<PublicCalendar>(
    `/branches/${branchId}/specialists/${specialistId}/calendar/?service=${encodeURIComponent(serviceId)}`,
    { signal },
  );

export const createPublicBooking = (input: CreatePublicBookingInput) =>
  request<PublicBooking>("/bookings/", { method: "POST", body: JSON.stringify(input) });

export const getPublicBooking = (code: string, signal?: AbortSignal) =>
  request<PublicBooking>(`/bookings/${encodeURIComponent(code.trim())}/`, { signal });

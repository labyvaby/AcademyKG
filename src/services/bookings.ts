import { apiFetch } from "../utility/apiClient";

// Онлайн-заявки и настройки онлайн-записи (CRM).
// Контракт: kg_academy_back/docs/frontend-online-booking.md (2026-10-22).
// Заявка — не приём: приём создаёт POST /bookings/{id}/confirm/ на выбранного клиента.

export type BookingStatus = "new" | "confirmed" | "rejected";

export type BookingRef = { id: string; fullName: string };

export type Booking = {
  id: string;
  code: string;
  status: BookingStatus;
  /** ISO с часовым поясом филиала, напр. "2026-10-23T09:00:00+06:00" */
  startAt: string;
  durationMinutes: number;
  price: string;
  currency: string;
  /** Кого записывают */
  clientName: string;
  clientBirthDate: string | null;
  /** Кто оставил заявку (родитель); пусто — сам клиент */
  contactName: string;
  /** E.164 */
  contactPhone: string;
  comment: string;
  branch: { id: string; name: string; timezone: string };
  service: { id: string; name: string };
  performer: BookingRef;
  patient: BookingRef | null;
  appointment: string | null;
  rejectionReason: string;
  processedAt: string | null;
  processedBy: BookingRef | null;
  createdAt: string;
};

export type SuggestedPatient = {
  id: string;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  branch: { id: string; name: string } | null;
};

export type BookingDetail = Booking & { suggestedPatients: SuggestedPatient[] };

type Envelope<T> = { data?: T } & Partial<T>;
type Page<T> = { count: number; results: T[] };

const unwrap = <T,>(res: Envelope<T> | null | undefined): T => ((res?.data ?? res) as T);

export type BookingListParams = {
  status?: BookingStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  ordering?: string;
};

export const listBookings = async (params: BookingListParams = {}): Promise<Page<Booking>> => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const res = await apiFetch<Envelope<Page<Booking>>>(`/api/v1/bookings/?${query.toString()}`);
  const page = unwrap(res);
  return { count: Number(page?.count ?? 0), results: page?.results ?? [] };
};

/** Счётчик новых заявок (для бейджа в меню и вкладки «Новые»). */
export const countNewBookings = async (): Promise<number> => {
  const page = await listBookings({ status: "new", pageSize: 1 });
  return page.count;
};

export const getBooking = async (id: string): Promise<BookingDetail> =>
  unwrap(await apiFetch<Envelope<BookingDetail>>(`/api/v1/bookings/${id}/`));

/** Создаёт приём на клиента и переводит заявку в confirmed. Нужны bookings.update + appointments.create. */
export const confirmBooking = async (id: string, patientId: string): Promise<BookingDetail> =>
  unwrap(
    await apiFetch<Envelope<BookingDetail>>(`/api/v1/bookings/${id}/confirm/`, {
      method: "POST",
      body: JSON.stringify({ patient: patientId }),
    }),
  );

export const rejectBooking = async (id: string, reason: string): Promise<BookingDetail> =>
  unwrap(
    await apiFetch<Envelope<BookingDetail>>(`/api/v1/bookings/${id}/reject/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  );

// ── Настройки онлайн-записи (одна запись на филиал) ─────────────────────────

export type BookingSettings = {
  id: string;
  branch: string;
  branchName: string;
  isEnabled: boolean;
  slotStepMinutes: number;
  minLeadMinutes: number;
  horizonDays: number;
  services: string[];
  employees: string[];
  updatedAt: string;
};

export type BookingSettingsInput = Partial<
  Pick<BookingSettings, "isEnabled" | "slotStepMinutes" | "minLeadMinutes" | "horizonDays" | "services" | "employees">
>;

export const listBookingSettings = async (): Promise<BookingSettings[]> => {
  // _noBranch: настройки нужны по всем доступным филиалам, а не только по выбранному в шапке.
  const res = await apiFetch<Envelope<Page<BookingSettings>>>("/api/v1/booking-settings/?_noBranch=1&pageSize=100");
  return unwrap(res)?.results ?? [];
};

export const createBookingSettings = async (
  branchId: string,
  input: BookingSettingsInput,
): Promise<BookingSettings> =>
  unwrap(
    await apiFetch<Envelope<BookingSettings>>("/api/v1/booking-settings/", {
      method: "POST",
      body: JSON.stringify({ branch: branchId, ...input }),
    }),
  );

export const updateBookingSettings = async (id: string, input: BookingSettingsInput): Promise<BookingSettings> =>
  unwrap(
    await apiFetch<Envelope<BookingSettings>>(`/api/v1/booking-settings/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );

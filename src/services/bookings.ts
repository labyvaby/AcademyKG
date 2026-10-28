import { apiFetch } from "../utility/apiClient";

// Онлайн-заявки и настройки онлайн-записи (CRM).
// Контракт: kg_academy_back/docs/frontend-online-booking.md (2026-10-22).
// Заявка — не приём: приём создаёт POST /bookings/{id}/confirm/ на выбранного клиента.

/** awaiting_payment — ждёт онлайн-предоплату (обработать нельзя); expired — не оплатили вовремя. */
export type BookingStatus = "awaiting_payment" | "new" | "confirmed" | "rejected" | "expired";

export type BookingRef = { id: string; fullName: string };

export type PrepaymentStatus = "pending" | "paid" | "expired" | "failed";
/** appointment — проведена в приём; balance — на баланс клиента; refunded — вернули гостю вне CRM. */
export type PrepaymentResolution = "appointment" | "balance" | "refunded";

/** Онлайн-предоплата заявки (Bakai Paylink). */
export type BookingPrepayment = {
  status: PrepaymentStatus;
  amount: string;
  /** Сумма по данным банка; null — ещё не оплачено. */
  paidAmount: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  /** Ссылку можно переслать гостю, пока она жива. */
  payUrl: string | null;
  providerTxnId: string;
  resolution: PrepaymentResolution | null;
  resolutionComment: string;
  resolvedAt: string | null;
  resolvedBy: BookingRef | null;
  /** Клиент, которому зачислены деньги. */
  patient: BookingRef | null;
};

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
  /** «Взято в работу»: кто звонит гостю. Не блокировка. */
  claimedAt: string | null;
  claimedBy: BookingRef | null;
  /** Текущая цена услуги — она уйдёт в приём (price — цена, которую видел гость). */
  currentPrice: string;
  /** null — заявка без предоплаты. */
  prepayment: BookingPrepayment | null;
  /** Деньги пришли, а заявка закрыта без приёма и без решения по деньгам. */
  prepaymentNeedsAttention: boolean;
  /** На время заявки у специалиста уже есть приём (записали вручную) — заявку нужно разобрать. */
  slotTaken: boolean;
  createdAt: string;
};

export type SuggestedPatient = {
  id: string;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  branch: { id: string; name: string } | null;
};

/** Приём специалиста на время заявки (во всех филиалах). */
export type SlotConflict = {
  id: string;
  appointmentAt: string;
  durationMinutes: number;
  status: string;
  branch: { id: string; name: string } | null;
  /** null — приём вне филиалов сотрудника: клиента не показываем. */
  patient: BookingRef | null;
  /** Приём в филиалах сотрудника — им можно закрыть заявку. */
  accessible: boolean;
  /** У клиента приёма тот же телефон, что в заявке. */
  sameClient: boolean;
};

export type BookingDetail = Booking & { suggestedPatients: SuggestedPatient[]; slotConflicts: SlotConflict[] };

type Envelope<T> = { data?: T } & Partial<T>;
type Page<T> = { count: number; results: T[] };

const unwrap = <T,>(res: Envelope<T> | null | undefined): T => ((res?.data ?? res) as T);

export type BookingListParams = {
  status?: BookingStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  ordering?: string;
  /** true — новые, время визита которых прошло (пропущенные); false — остальные. */
  overdue?: boolean;
  /** Оплачены онлайн, закрыты без приёма и без решения по деньгам. */
  needsAttention?: boolean;
  prepaymentStatus?: PrepaymentStatus;
  /** Филиал; "all" — все доступные, даже если в сайдбаре выбран один; не задан — как в сайдбаре. */
  branch?: string;
};

export const listBookings = async (params: BookingListParams = {}): Promise<Page<Booking>> => {
  const { branch, ...rest } = params;
  const query = new URLSearchParams();
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  // «Все филиалы» явно: _noBranch не даёт apiFetch подставить филиал из сайдбара.
  if (branch === "all") query.set("_noBranch", "1");
  else if (branch) query.set("branch", branch);
  const res = await apiFetch<Envelope<Page<Booking>>>(`/api/v1/bookings/?${query.toString()}`);
  const page = unwrap(res);
  return { count: Number(page?.count ?? 0), results: page?.results ?? [] };
};

/** Счётчик заявок по фильтру (бейджи в меню и на вкладках). */
export const countBookings = async (params: BookingListParams): Promise<number> =>
  (await listBookings({ ...params, pageSize: 1 })).count;

/** Счётчик новых заявок (для бейджа в меню): и ждущие, и пропущенные. */
export const countNewBookings = (): Promise<number> => countBookings({ status: "new" });

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

/** Что сделать с деньгами оплаченной заявки, закрытой без приёма. */
export type PrepaymentDecision = {
  resolution: Exclude<PrepaymentResolution, "appointment">;
  /** Для balance — клиент, на баланс которого зачислить. */
  patient?: string;
  comment?: string;
};

/** Оплаченную онлайн заявку бэк отклоняет только вместе с решением по деньгам. */
export const rejectBooking = async (
  id: string,
  reason: string,
  prepaymentResolution?: PrepaymentDecision,
): Promise<BookingDetail> =>
  unwrap(
    await apiFetch<Envelope<BookingDetail>>(`/api/v1/bookings/${id}/reject/`, {
      method: "POST",
      body: JSON.stringify(prepaymentResolution ? { reason, prepaymentResolution } : { reason }),
    }),
  );

/** Закрыть заявку приёмом, созданным вручную: заявка confirmed, предоплата — в этот приём. */
export const attachBooking = async (id: string, appointmentId: string): Promise<BookingDetail> =>
  unwrap(
    await apiFetch<Envelope<BookingDetail>>(`/api/v1/bookings/${id}/attach/`, {
      method: "POST",
      body: JSON.stringify({ appointment: appointmentId }),
    }),
  );

/** Решение по деньгам отклонённой или снятой заявки, по которой пришла оплата. */
export const resolveBookingPrepayment = async (id: string, decision: PrepaymentDecision): Promise<BookingDetail> =>
  unwrap(
    await apiFetch<Envelope<BookingDetail>>(`/api/v1/bookings/${id}/resolve-prepayment/`, {
      method: "POST",
      body: JSON.stringify(decision),
    }),
  );

/** «Взять в работу» (перебивает чужую отметку) / снять отметку. */
export const claimBooking = async (id: string, claim: boolean): Promise<BookingDetail> =>
  unwrap(await apiFetch<Envelope<BookingDetail>>(`/api/v1/bookings/${id}/claim/`, { method: claim ? "POST" : "DELETE" }));

// ── Приём поверх заявки ─────────────────────────────────────────────────────

/** Заявка, которая держит время приёма: `bookingConflicts` в ответе POST/PATCH /appointments/. */
export type BookingConflict = Pick<
  Booking,
  "id" | "code" | "status" | "startAt" | "durationMinutes" | "clientName" | "contactName" | "contactPhone" | "branch" | "performer"
>;

export const BOOKING_CONFLICTS_EVENT = "booking-conflicts";

/** Приём создан или перенесён на время онлайн-заявки — показать предупреждение (BookingConflictsNotice). */
export function announceBookingConflicts(response: unknown): void {
  const body = (response as { data?: unknown } | null)?.data ?? response;
  const conflicts = (body as { bookingConflicts?: BookingConflict[] } | null)?.bookingConflicts;
  if (!Array.isArray(conflicts) || conflicts.length === 0) return;
  window.dispatchEvent(new CustomEvent<BookingConflict[]>(BOOKING_CONFLICTS_EVENT, { detail: conflicts }));
}

// ── Настройки онлайн-записи (одна запись на филиал) ─────────────────────────

export type SpecialistPrepayment = { employee: string; amount: string };

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
  /** Телефон филиала для гостей (E.164) или "". */
  contactPhone: string;
  /** Суммы онлайн-предоплаты по специалистам; нет строки — без предоплаты. Заменяется целиком. */
  prepayments: SpecialistPrepayment[];
  /** Короткий адрес витрины филиала (/book/<publicSlug>); "" — не задан. */
  publicSlug: string;
  /** Свои ссылки филиала на правила и политику; "" — ссылки организации. */
  termsUrl: string;
  privacyUrl: string;
  branchCountry: "KG" | "UZ";
  branchCurrency: string;
  /** Предоплата через Bakai возможна только в сомах. */
  prepaymentSupported: boolean;
  updatedAt: string;
};

export type BookingSettingsInput = Partial<
  Pick<
    BookingSettings,
    | "isEnabled"
    | "slotStepMinutes"
    | "minLeadMinutes"
    | "horizonDays"
    | "services"
    | "employees"
    | "contactPhone"
    | "prepayments"
    | "publicSlug"
    | "termsUrl"
    | "privacyUrl"
  >
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

// ── Онлайн-оплата организации (Bakai Paylink) ───────────────────────────────

export type BookingPaymentSettings = {
  paymentsEnabled: boolean;
  bakaiTokenSet: boolean;
  bakaiTokenMasked: string;
  /** Задан ли адрес API банка на сервере (BAKAI_BASE_URL). */
  bankConfigured: boolean;
  /** Можно выставлять ссылки: включено, токен есть, банк настроен. */
  paymentsReady: boolean;
  /** URL для кабинета Bakai (содержит секрет) — только при canManage. */
  webhookUrl: string | null;
  prepaymentTtlMinutes: number;
  lastBankError: string;
  lastBankErrorAt: string | null;
  termsUrl: string;
  privacyUrl: string;
  /** Менять может только администратор организации (superadmin, accountant). */
  canManage: boolean;
  updatedAt: string;
};

export type BookingPaymentSettingsInput = Partial<
  Pick<BookingPaymentSettings, "paymentsEnabled" | "termsUrl" | "privacyUrl">
> & {
  /** Не передавать, чтобы не менять; "" — стереть. */
  bakaiToken?: string;
  /** Новый секрет вебхука: старый URL перестаёт работать сразу. */
  rotateWebhookSecret?: boolean;
};

export const getBookingPaymentSettings = async (): Promise<BookingPaymentSettings> =>
  unwrap(await apiFetch<Envelope<BookingPaymentSettings>>("/api/v1/booking-payment-settings/?_noBranch=1"));

export const updateBookingPaymentSettings = async (input: BookingPaymentSettingsInput): Promise<BookingPaymentSettings> =>
  unwrap(
    await apiFetch<Envelope<BookingPaymentSettings>>("/api/v1/booking-payment-settings/?_noBranch=1", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );

import type { BookingStatus, PrepaymentStatus } from "../../services/bookings";

export const capitalizeFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const BOOKING_STATUS_COLOR: Record<BookingStatus, "warning" | "success" | "default" | "info"> = {
  awaiting_payment: "info",
  new: "warning",
  confirmed: "success",
  rejected: "default",
  expired: "default",
};

/** Закрытые статусы — чип контурный, чтобы не спорил с живыми заявками. */
export const isClosedStatus = (status: BookingStatus): boolean => status === "rejected" || status === "expired";

export const PREPAYMENT_STATUS_COLOR: Record<PrepaymentStatus, "info" | "success" | "default" | "error"> = {
  pending: "info",
  paid: "success",
  expired: "default",
  failed: "error",
};

/** Новая заявка, время визита которой уже прошло: её пропустили. */
export const isOverdue = (status: BookingStatus, startAt: string): boolean =>
  status === "new" && new Date(startAt).getTime() < Date.now();

/** «12:34» до конца срока оплаты; null — срок вышел. */
export function paymentCountdown(expiresAt: string | null, now: number): string | null {
  if (!expiresAt) return null;
  const left = Math.floor((new Date(expiresAt).getTime() - now) / 1000);
  if (left <= 0) return null;
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/** Начало заявки в часовом поясе её филиала: «чт, 23 окт., 09:00». */
export function formatBookingStart(startAt: string, timezone: string, lang: string): string {
  const date = new Date(startAt);
  const tz = timezone || "Asia/Bishkek";
  const day = new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(date);
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(date);
  return capitalizeFirst(`${day}, ${time}`);
}

export function formatDateTime(value: string | null | undefined, lang: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

/** "+996555123456" → "+996 555 123 456" (для чтения глазами; tel: ссылка — по E.164). */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+(996|998|7|992|993|994|375|380)(\d+)$/);
  if (!m) return phone;
  return `+${m[1]} ${m[2].replace(/(\d{3})(?=\d)/g, "$1 ").trim()}`;
}

import type { BookingStatus } from "../../services/bookings";

export const capitalizeFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const BOOKING_STATUS_COLOR: Record<BookingStatus, "warning" | "success" | "default"> = {
  new: "warning",
  confirmed: "success",
  rejected: "default",
};

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

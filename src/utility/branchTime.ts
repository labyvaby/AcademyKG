import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const DEFAULT_TIMEZONE = "Asia/Bishkek";

/** Опции таймзоны для селектора в управлении филиалами (IANA-имена). */
export const BRANCH_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Asia/Bishkek", label: "Бишкек (Кыргызстан)" },
  { value: "Asia/Tashkent", label: "Ташкент / Фергана (Узбекистан)" },
  { value: "Asia/Almaty", label: "Алматы (Казахстан)" },
];

export type BranchTimezoneSource = {
  timezone?: string | null;
} | null | undefined;

/**
 * Таймзона филиала. Бэк отдаёт branch.timezone (IANA-имя) везде, где
 * сериализуется филиал; существующим филиалам проставлен Asia/Bishkek.
 * Fallback на Бишкек — только если поле по какой-то причине пустое.
 */
export function resolveBranchTimezone(branch: BranchTimezoneSource): string {
  return branch?.timezone || DEFAULT_TIMEZONE;
}

// ---------------------------------------------------------------------------
// Активная таймзона — таймзона эффективного филиала текущего пользователя.
// Синхронизируется компонентом BranchTimezoneSync; до синхронизации — Бишкек,
// т.е. поведение прежнее.
// ---------------------------------------------------------------------------

let activeTimezone = DEFAULT_TIMEZONE;

export function setActiveTimezone(tz: string | null | undefined): void {
  activeTimezone = tz || DEFAULT_TIMEZONE;
  dayjs.tz.setDefault(activeTimezone);
}

export const getActiveTimezone = (): string => activeTimezone;

/**
 * Парсит дату от бэка и отображает в таймзоне активного филиала.
 * Если строка содержит смещение (+06:00, Z и т.д.) — парсим как есть и конвертируем.
 * Если строка без смещения — интерпретируем как время филиала.
 */
export const dayjsBranch = (val: string): Dayjs => {
  if (!val) return dayjs.tz("", activeTimezone);
  if (/[+-]\d{2}:\d{2}$|Z$/.test(val)) return dayjs(val).tz(activeTimezone);
  return dayjs.tz(val, activeTimezone);
};

/**
 * Wall-clock филиала ("2026-07-16T10:00[:ss]" из datetime-local) → Dayjs
 * с правильным смещением филиала. Использовать при отправке времени на бэк
 * вместо dayjs(...) — тот интерпретирует строку в таймзоне браузера.
 * Строку с явным смещением (+06:00/Z) трактует как готовый момент времени.
 */
export const branchWallTime = (wall: string): Dayjs => {
  if (/[+-]\d{2}:\d{2}$|Z$/.test(wall)) return dayjs(wall).tz(activeTimezone);
  return dayjs.tz(wall, activeTimezone);
};

/** Текущий момент в таймзоне активного филиала. */
export const nowInBranch = (): Dayjs => dayjs().tz(activeTimezone);

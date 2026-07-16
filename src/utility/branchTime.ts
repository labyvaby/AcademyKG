import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const DEFAULT_TIMEZONE = "Asia/Bishkek";

// Таймзона по валюте филиала — рабочий фолбэк, пока бэк не отдаёт branch.timezone.
const CURRENCY_TIMEZONES: Record<string, string> = {
  KGS: "Asia/Bishkek",
  UZS: "Asia/Tashkent",
  KZT: "Asia/Almaty",
};

// Точечные оверрайды по id филиала (прод). Страховка на случай, если у филиала
// не заполнена валюта. Убрать после появления branch.timezone на бэке.
const BRANCH_TIMEZONE_OVERRIDES: Record<string, string> = {
  // «АП Фергана» (Узбекистан, UTC+5)
  "67c1a93f-a5c2-4a45-89d3-409c7a11a483": "Asia/Tashkent",
};

export type BranchTimezoneSource = {
  id?: string | null;
  timezone?: string | null;
  currency?: string | null;
} | null | undefined;

/** Таймзона филиала: branch.timezone → оверрайд по id → валюта → Бишкек. */
export function resolveBranchTimezone(branch: BranchTimezoneSource): string {
  if (branch?.timezone) return branch.timezone;
  if (branch?.id && BRANCH_TIMEZONE_OVERRIDES[branch.id]) {
    return BRANCH_TIMEZONE_OVERRIDES[branch.id];
  }
  const currency = (branch?.currency ?? "").toUpperCase();
  return CURRENCY_TIMEZONES[currency] ?? DEFAULT_TIMEZONE;
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

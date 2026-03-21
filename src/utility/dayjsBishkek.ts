import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Bishkek";

/**
 * Парсит ISO-дату и отображает в часовом поясе Бишкека (UTC+6).
 * Если строка содержит смещение (+06:00, Z и т.д.) — парсим как есть и конвертируем.
 * Если строка без смещения — интерпретируем как Бишкекское время.
 */
export const dayjsBishkek = (val: string) => {
  if (!val) return dayjs.tz("", TZ);
  if (/[+-]\d{2}:\d{2}$|Z$/.test(val)) return dayjs(val).tz(TZ);
  return dayjs.tz(val, TZ);
};

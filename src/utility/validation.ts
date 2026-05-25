/**
 * Утилиты для валидации данных
 */

/**
 * Регулярное выражение для проверки формата UUID
 * Формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (где x - шестнадцатеричная цифра)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Проверяет, является ли строка корректным UUID
 * @param value - значение для проверки
 * @returns true если value - корректный UUID, иначе false
 */
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return UUID_REGEX.test(value.trim());
}

/**
 * Валидирует UUID и выбрасывает ошибку, если формат некорректный
 * @param value - значение для проверки
 * @param fieldName - название поля (для более понятного сообщения об ошибке)
 * @throws Error если value не является корректным UUID
 */
export function validateUUID(value: unknown, fieldName = "ID"): asserts value is string {
  if (!isValidUUID(value)) {
    const valueStr = String(value ?? "");
    throw new Error(
      `Некорректный формат UUID для поля "${fieldName}": получено "${valueStr}". ` +
      `Ожидается формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
    );
  }
}

// ─── ФИО клиента / ответственного лица ──────────────────────────────────────

/**
 * Разрешённые символы для ФИО (имени человека):
 * - кириллица (включая ё, ў и т.п.);
 * - латиница;
 * - пробел, дефис (Анна-Мария);
 * - апостроф (О'Коннор, обычный и типографский);
 * - точка (для инициалов: А.С.).
 *
 * Намеренно НЕ включены: цифры, emoji, математические символы,
 * сердечки/ромбы/квадраты и прочие декоративные знаки.
 */
const PERSON_NAME_ALLOWED_CHARS = /^[\p{Script=Cyrillic}\p{Script=Latin}\s\-'’.]+$/u;

/**
 * Проверяет, что строка похожа на реальное ФИО:
 *  - содержит хотя бы 2 буквы (иначе "А.", "---" и подобное мусорное);
 *  - не содержит запрещённых символов;
 *  - длина в разумном диапазоне.
 */
export function isValidPersonName(value: string): boolean {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length < 2 || trimmed.length > 150) return false;
  if (!PERSON_NAME_ALLOWED_CHARS.test(trimmed)) return false;
  // Минимум 2 буквы — отсеивает "---", "..", "А-Б" из одной буквы и т.п.
  const letters = trimmed.match(/[\p{Script=Cyrillic}\p{Script=Latin}]/gu);
  if (!letters || letters.length < 2) return false;
  return true;
}

// ─── Дата рождения ──────────────────────────────────────────────────────────

const MIN_BIRTH_YEAR = 1900;

export type BirthDateValidationResult =
  | { ok: true }
  | { ok: false; reason: "format" | "future" | "too_old" };

/**
 * Валидирует строку даты рождения в формате YYYY-MM-DD (или пустую/null).
 * - пустое значение — допустимо (поле не обязательно);
 * - не должно быть будущей датой;
 * - год не раньше 1900.
 */
export function validateBirthDate(value: string | null | undefined): BirthDateValidationResult {
  if (value === null || value === undefined) return { ok: true };
  const trimmed = String(value).trim();
  if (trimmed === "") return { ok: true };

  // YYYY-MM-DD как минимальный strict-формат.
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { ok: false, reason: "format" };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, reason: "format" };
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (date.getTime() > todayUtc) return { ok: false, reason: "future" };
  if (year < MIN_BIRTH_YEAR) return { ok: false, reason: "too_old" };

  return { ok: true };
}

/** Человеко-читаемое сообщение об ошибке для UI. */
export function birthDateErrorMessage(reason: "format" | "future" | "too_old"): string {
  if (reason === "future") return "Дата рождения не может быть в будущем";
  if (reason === "too_old") return `Дата рождения не может быть раньше ${MIN_BIRTH_YEAR} года`;
  return "Введите корректную дату рождения";
}

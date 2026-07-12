/**
 * Телефонные коды стран СНГ (постсоветское пространство).
 * Источник истины — таблица PHONE_COUNTRIES: и список кодов, и длины
 * локальной части, и подписи стран для селекта берутся из неё.
 * Порядок = порядок в выпадающем списке (частые сверху).
 */
export interface PhoneCountry {
  code: string;        // международный код с «+», напр. "+996"
  dial: string;        // те же цифры без «+», для парсинга: "996"
  name: string;        // подпись страны в списке
  localLength: number; // число цифр локальной части (без кода страны)
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "+996", dial: "996", name: "Кыргызстан", localLength: 9 },
  { code: "+7", dial: "7", name: "Казахстан / Россия", localLength: 10 },
  { code: "+998", dial: "998", name: "Узбекистан", localLength: 9 },
  { code: "+992", dial: "992", name: "Таджикистан", localLength: 9 },
  { code: "+993", dial: "993", name: "Туркменистан", localLength: 8 },
  { code: "+994", dial: "994", name: "Азербайджан", localLength: 9 },
  { code: "+374", dial: "374", name: "Армения", localLength: 8 },
  { code: "+375", dial: "375", name: "Беларусь", localLength: 9 },
  { code: "+373", dial: "373", name: "Молдова", localLength: 8 },
];

export const PHONE_COUNTRY_CODES = PHONE_COUNTRIES.map((c) => c.code) as readonly string[];

export type PhoneCountryCode = string;

export const DEFAULT_PHONE_COUNTRY_CODE: PhoneCountryCode = "+996";

// Для парсинга: сначала более длинные dial-префиксы (996 раньше 7 не важно,
// т.к. префиксы не пересекаются, но сортировка страхует от будущих кодов).
const COUNTRIES_BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dial.length - a.dial.length,
);

const DEFAULT_LOCAL_MAX_LENGTH = 9;

function findByCode(countryCode: PhoneCountryCode): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.code === countryCode);
}

export interface ParsedPhone {
  countryCode: PhoneCountryCode;
  local: string;
}

/**
 * Возвращает максимальную длину локальной части номера
 * в зависимости от кода страны. (Например, для +7 это 10 цифр)
 */
export function getPhoneLocalMaxLength(countryCode: PhoneCountryCode): number {
  return findByCode(countryCode)?.localLength ?? DEFAULT_LOCAL_MAX_LENGTH;
}

/**
 * Парсит полный номер телефона в формате E.164 (+кодСтраны + локальная часть)
 * в структуру { countryCode, local }. Определяет страну по dial-префиксу из
 * таблицы PHONE_COUNTRIES; для нераспознанного префикса возвращает дефолтный
 * код и все цифры как локальную часть.
 */
export function parsePhone(raw: string | null | undefined): ParsedPhone {
  if (!raw) {
    return { countryCode: DEFAULT_PHONE_COUNTRY_CODE, local: "" };
  }

  const digits = String(raw).replace(/[^0-9]/g, "");

  if (!digits) {
    return { countryCode: DEFAULT_PHONE_COUNTRY_CODE, local: "" };
  }

  for (const country of COUNTRIES_BY_DIAL_LENGTH) {
    if (digits.startsWith(country.dial)) {
      return {
        countryCode: country.code,
        local: digits.slice(country.dial.length),
      };
    }
  }

  // Фоллбек: оставляем все цифры как локальную часть с дефолтным кодом
  return {
    countryCode: DEFAULT_PHONE_COUNTRY_CODE,
    local: digits,
  };
}

/**
 * Собирает полный номер телефона в формате E.164 (+кодСтраны + локальная часть)
 * из кода страны и локальной части (только цифры или с разделителями).
 * Если локальная часть пуста, возвращает null.
 */
export function composePhone(countryCode: PhoneCountryCode, local: string): string | null {
  const normalizedLocal = local.replace(/[^0-9]/g, "");
  if (!normalizedLocal) return null;

  const country = findByCode(countryCode);
  const code = country?.code ?? countryCode;
  return `${code}${normalizedLocal}`;
}

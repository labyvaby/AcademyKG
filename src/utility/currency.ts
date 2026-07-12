/**
 * Валюта филиала. Каждый филиал показывает суммы в своей валюте (подпись/формат);
 * цифры НЕ пересчитываются по курсу — цены и платежи хранятся в валюте того
 * филиала, где совершена операция (решение заказчика 2026-07-08).
 *
 * Источник валюты — поле branch.currency с бэка (см.
 * docs/backend-requests-2026-07-08-branch-currency.md). Пока поле не пришло —
 * fallback на сом (KGS), поэтому филиалы Кыргызстана работают как раньше.
 *
 * ⚠️ Складывать суммы РАЗНЫХ валют (режим «Все филиалы») здесь не поддержано —
 * по договорённости пока не важно; когда понадобится — группировать по валюте.
 */
export type CurrencyCode = "KGS" | "UZS" | "KZT" | "RUB" | "USD";

interface CurrencyMeta {
  /** Подпись после суммы (на текущем языке интерфейса — русском). */
  suffix: string;
  /** Локаль для группировки разрядов. */
  locale: string;
}

const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  KGS: { suffix: "сом", locale: "ru-RU" },
  UZS: { suffix: "сум", locale: "ru-RU" },
  KZT: { suffix: "тг", locale: "ru-RU" },
  RUB: { suffix: "₽", locale: "ru-RU" },
  USD: { suffix: "$", locale: "ru-RU" },
};

export const DEFAULT_CURRENCY: CurrencyCode = "KGS";

/** Список валют для селекта (код + человекочитаемая подпись). */
export const CURRENCY_OPTIONS: { code: CurrencyCode; label: string }[] = [
  { code: "KGS", label: "KGS — сом (Кыргызстан)" },
  { code: "UZS", label: "UZS — сум (Узбекистан)" },
  { code: "KZT", label: "KZT — тенге (Казахстан)" },
  { code: "RUB", label: "RUB — рубль (Россия)" },
  { code: "USD", label: "USD — доллар" },
];

const metaFor = (code?: string | null): CurrencyMeta => {
  const key = (code ?? "").toUpperCase() as CurrencyCode;
  return CURRENCIES[key] ?? CURRENCIES[DEFAULT_CURRENCY];
};

/** Подпись валюты («сом», «сум», …). Для неизвестного кода — валюта по умолчанию. */
export const getCurrencySuffix = (code?: string | null): string => metaFor(code).suffix;

export interface FormatMoneyOptions {
  /** Добавлять подпись валюты (по умолчанию true). */
  withSuffix?: boolean;
  maximumFractionDigits?: number;
}

/**
 * Форматирует сумму в валюте филиала: «100 000 сум».
 * По умолчанию без дробной части и с подписью валюты.
 */
export const formatMoney = (
  value: number | string | null | undefined,
  code?: string | null,
  opts: FormatMoneyOptions = {},
): string => {
  const meta = metaFor(code);
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = new Intl.NumberFormat(meta.locale, {
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
  }).format(safe);
  return opts.withSuffix === false ? formatted : `${formatted} ${meta.suffix}`;
};

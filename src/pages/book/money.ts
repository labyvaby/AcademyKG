import { formatMoney } from "../../utility/currency";
import { bookI18n } from "./i18n";

// Подписи валют на языке витрины: общий formatMoney пишет их по-русски («сум»), а гость
// в Фергане читает витрину латиницей. Нет подписи для языка — как в CRM.
const SUFFIX: Record<string, Record<string, string>> = {
  uz: { KGS: "som", UZS: "so‘m" },
};

/** Сумма в валюте филиала с подписью на текущем языке витрины: «150 000 so‘m». */
export function formatPrice(value: number | string | null | undefined, currency?: string | null): string {
  const suffix = SUFFIX[bookI18n.language]?.[(currency ?? "").toUpperCase()];
  return suffix ? `${formatMoney(value, currency, { withSuffix: false })} ${suffix}` : formatMoney(value, currency);
}

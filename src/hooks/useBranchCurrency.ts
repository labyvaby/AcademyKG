import { useEffectiveBranch } from "./useEffectiveBranch";
import { DEFAULT_CURRENCY, formatMoney, getCurrencySuffix } from "../utility/currency";

/**
 * Валюта эффективного филиала текущего пользователя (см. useEffectiveBranch).
 * Возвращает код валюты и готовые хелперы форматирования, привязанные к нему.
 * Пока бэк не отдаёт branch.currency — код = сом (KGS), поведение как раньше.
 */
export const useBranchCurrency = () => {
  const branch = useEffectiveBranch();
  const currency = branch?.currency || DEFAULT_CURRENCY;

  return {
    /** Код валюты филиала (KGS/UZS/…). */
    currency,
    /** Подпись валюты («сом», «сум», …). */
    suffix: getCurrencySuffix(currency),
    /** Форматирует сумму в валюте филиала: formatMoney(100000) → «100 000 сум». */
    format: (value: number | string | null | undefined, opts?: { withSuffix?: boolean; maximumFractionDigits?: number }) =>
      formatMoney(value, currency, opts),
  };
};

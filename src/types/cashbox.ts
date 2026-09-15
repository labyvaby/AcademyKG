
export type CashboxMethod = 'cash' | 'card';

// Суммы бэк фактически отдаёт числами (проверено 2026-09-15), в спеке — строками.
// Везде читать через Number().
export type CashboxAmount = number | string;

export interface CashboxAppointments {
  cashSum: CashboxAmount;
  cardSum: CashboxAmount;
  balanceSum: CashboxAmount;
  bonusesSum: CashboxAmount;
  totalSum: CashboxAmount;
}

export interface CashboxExpenses {
  cashSum: CashboxAmount;
  cashlessSum: CashboxAmount;
  totalSum: CashboxAmount;
}

export interface CashboxNet {
  cashSum: CashboxAmount;
  cardSum: CashboxAmount;
  totalSum: CashboxAmount;
}

export interface CashboxAdjustments {
  refundsSum: CashboxAmount;
  reversalsSum: CashboxAmount;
  adjustmentsSum: CashboxAmount;
  cashNetSum: CashboxAmount;
  cashlessNetSum: CashboxAmount;
  totalNetSum: CashboxAmount;
}

export interface CashboxCounts {
  appointmentsCount: number;
  expensesCount: number;
  adjustmentsCount: number;
}

export interface CashboxSummaryData {
  method?: CashboxMethod | null;
  /** null, если период не передан — тогда бэк считает за всё время */
  dateFrom: string | null;
  dateTo: string | null;
  appointments: CashboxAppointments;
  expenses: CashboxExpenses;
  adjustments: CashboxAdjustments;
  net: CashboxNet;
  counts: CashboxCounts;
}

export interface CashboxSummaryResponse {
  data: CashboxSummaryData;
  meta: any;
}

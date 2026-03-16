
export type CashboxMethod = 'cash' | 'card';

export interface CashboxAppointments {
  cashSum: string;
  cardSum: string;
  balanceSum: string;
  bonusesSum: string;
  totalSum: string;
}

export interface CashboxExpenses {
  cashSum: string;
  cashlessSum: string;
  totalSum: string;
}

export interface CashboxNet {
  cashSum: string;
  cardSum: string;
  totalSum: string;
}

export interface CashboxCounts {
  appointmentsCount: number;
  expensesCount: number;
}

export interface CashboxSummaryData {
  method?: CashboxMethod;
  dateFrom: string;
  dateTo: string;
  appointments: CashboxAppointments;
  expenses: CashboxExpenses;
  net: CashboxNet;
  counts: CashboxCounts;
}

export interface CashboxSummaryResponse {
  data: CashboxSummaryData;
  meta: any;
}

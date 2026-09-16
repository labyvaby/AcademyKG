export type CashboxMethod = 'cash' | 'card';

// Суммы бэк отдаёт числами (подтверждено ответом бэка 2026-09-15, A3);
// на всякий случай везде читать через Number().
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

/** Удержания ЗП — вне движения денег (не входят в expenses/net). */
export interface CashboxDeductions {
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

/** Внесение / изъятие / инкассация наличных: netSum = cashIn − cashOut − collection. */
export interface CashboxMovementsBlock {
  cashInSum: CashboxAmount;
  cashOutSum: CashboxAmount;
  collectionSum: CashboxAmount;
  netSum: CashboxAmount;
}

/** Остаток по документам (ledger) на начало/конец периода. */
export interface CashboxBalance {
  cash: CashboxAmount;
  card: CashboxAmount;
}

export interface CashboxCounts {
  appointmentsCount: number;
  expensesCount: number;
  adjustmentsCount: number;
  deductionsCount?: number;
  movementsCount?: number;
}

/** Общие блоки сводки — одинаковы для периода, строки byBranch и сводки смены. */
export interface CashboxSummaryBlocks {
  appointments: CashboxAppointments;
  expenses: CashboxExpenses;
  deductions?: CashboxDeductions;
  movements?: CashboxMovementsBlock;
  adjustments: CashboxAdjustments;
  net: CashboxNet;
  openingBalance?: CashboxBalance;
  closingBalance?: CashboxBalance;
  counts: CashboxCounts;
}

export interface CashboxBranchSummary extends CashboxSummaryBlocks {
  branchId: string;
  branchName: string;
  currency: string | null;
  timezone?: string | null;
}

export interface CashboxSummaryData extends CashboxSummaryBlocks {
  method?: CashboxMethod | null;
  /** null, если период не передан — тогда бэк считает за всё время */
  dateFrom: string | null;
  dateTo: string | null;
  organization?: string | null;
  branch?: string | null;
  /** null, если валюты филиалов в выборке различаются — тогда показывать только byBranch */
  currency?: string | null;
  byBranch?: CashboxBranchSummary[];
}

export interface CashboxSummaryResponse {
  data: CashboxSummaryData;
  meta: any;
}

// ---------------------------------------------------------------------------
// Журнал операций (B1)
// ---------------------------------------------------------------------------

export type CashboxEntryType =
  | 'payment'
  | 'balance_topup'
  | 'refund'
  | 'expense'
  | 'payroll_advance'
  | 'payroll_payout'
  | 'cash_in'
  | 'cash_out'
  | 'collection'
  | 'reversal'
  | 'adjustment';

export type CashboxEntryMethod = 'cash' | 'card' | 'balance' | 'bonuses';

export type CashboxEntrySourceKind =
  | 'appointment'
  | 'period_payment'
  | 'balance_transaction'
  | 'expense'
  | 'payroll_transaction'
  | 'cash_movement';

export interface CashboxEntry {
  /** "<kind>:<sourceId>:<method>" — не UUID */
  id: string;
  occurredAt: string;
  type: CashboxEntryType;
  direction: 'in' | 'out';
  method: CashboxEntryMethod;
  amount: CashboxAmount;
  branch: string | null;
  createdBy: { id: string; fullName: string } | null;
  description: string;
  source: { kind: CashboxEntrySourceKind; id: string } | null;
  shift: string | null;
}

export interface CashboxPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ---------------------------------------------------------------------------
// Смены кассы (B2)
// ---------------------------------------------------------------------------

export type CashboxShiftStatus = 'open' | 'closed';

export interface CashboxUserRef {
  id: string;
  fullName: string;
}

export interface CashboxBranchRef {
  id: string;
  name?: string;
  brandName?: string;
  currency?: string | null;
  timezone?: string | null;
}

export interface CashboxShift {
  id: string;
  organization: string | null;
  branch: CashboxBranchRef | string | null;
  status: CashboxShiftStatus;
  openedBy: CashboxUserRef | null;
  openedAt: string;
  openingCash: CashboxAmount;
  closedBy: CashboxUserRef | null;
  closedAt: string | null;
  countedCash: CashboxAmount | null;
  expectedCash: CashboxAmount | null;
  discrepancy: CashboxAmount | null;
  comment: string | null;
  closingComment: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Z-отчёт: те же блоки, что в summary, за окно смены. */
export interface CashboxShiftSummaryData extends CashboxSummaryBlocks {
  shift: CashboxShift;
  periodFrom: string;
  periodTo: string | null;
  openingCash: CashboxAmount;
  /** Для открытой смены — расчёт на текущий момент */
  expectedCash: CashboxAmount;
  countedCash: CashboxAmount | null;
  discrepancy: CashboxAmount | null;
  currency?: string | null;
}

// ---------------------------------------------------------------------------
// Движения наличных (B3)
// ---------------------------------------------------------------------------

export type CashboxMovementType = 'cash_in' | 'cash_out' | 'collection';

export interface CashboxMovement {
  id: string;
  organization: string | null;
  branch: CashboxBranchRef | string | null;
  type: CashboxMovementType;
  direction: 'in' | 'out';
  method: 'cash';
  amount: CashboxAmount;
  occurredAt: string;
  comment: string | null;
  recipient: string | null;
  shift: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: CashboxUserRef | null;
  voidReason: string | null;
  createdBy: CashboxUserRef | null;
  createdAt: string;
  updatedAt: string;
}

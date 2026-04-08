export type UserNested = {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
};

// ── Operational Expense ─────────────────────────────────────────────────────

export type Expense = {
  id: string | number;
  employee_id: string | null;
  employee_name?: string | null;
  name: string;
  cash_amount: number;
  cashless_amount: number;
  total_amount: number;
  comment?: string | null;
  category?: string | null;       // category name
  category_id?: string | null;    // category UUID
  photo?: string | File | null;
  created_at: string;
  updated_at?: string;
  branch?: { id: string; name: string } | null;
  created_by?: UserNested | null;
  updated_by?: UserNested | null;
};

export type ExpenseFormValues = {
  employee_id: string | null;
  name: string;
  cash_amount: number;
  cashless_amount: number;
  total_amount: number;
  comment?: string | null;
  category?: string | null;
  category_id?: string | null;
  photo?: string | File | null;
  photoFile?: File | null;
  created_at?: string;
};

// ── Payroll Transaction ──────────────────────────────────────────────────────

export type PayrollKind = "advance" | "payout" | "deduction";

export const PAYROLL_KIND_OPTIONS: Array<{ value: PayrollKind; label: string }> = [
  { value: "advance", label: "Аванс" },
  { value: "payout", label: "Выплата" },
  { value: "deduction", label: "Удержание" },
];

export type PayrollTransaction = {
  id: string | number;
  employee_id: string;
  employee_name?: string | null;
  name?: string | null;
  kind: PayrollKind;
  affects_month: string; // YYYY-MM
  cash_amount: number;
  cashless_amount: number;
  total_amount: number;
  comment?: string | null;
  branch?: { id: string; name: string } | null;
  created_by?: UserNested | null;
  updated_by?: UserNested | null;
  created_at: string;
  updated_at?: string;
};

export type PayrollFormValues = {
  employee_id: string | null;
  kind: PayrollKind | null;
  affects_month: string;
  name: string;
  cash_amount: number;
  cashless_amount: number;
  comment?: string | null;
};

// ── Shared helpers ───────────────────────────────────────────────────────────

export type EmployeesRow = {
  id: string;
  full_name: string;
  nickname?: string;
  specialization?: string;
  specializationNames?: string[];
  serviceIds?: string[];
  avatar_url?: string;
  user_email?: string | null;
  user_phone_number?: string | null;
  role?: string;
};

export const coerceNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

function mapUserNested(raw: any): UserNested | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: raw.id ?? "",
    fullName: raw.fullName ?? raw.full_name ?? "",
    email: raw.email ?? null,
    phoneNumber: raw.phoneNumber ?? raw.phone_number ?? null,
  };
}

/** Map raw API expense response → flat Expense type */
export function mapApiExpense(raw: any): Expense {
  const emp = raw.employee;
  const cat = raw.category;
  return {
    id: raw.id,
    employee_id: (
      typeof emp === "object"
        ? emp?.id
        : typeof emp === "string"
          ? emp
          : raw.employeeId ?? raw.employee_id
    ) ?? null,
    employee_name: typeof emp === "object"
      ? (emp?.fullName ?? emp?.full_name ?? null)
      : (raw.employeeName ?? raw.employee_name ?? null),
    name: raw.name ?? "",
    cash_amount: coerceNumber(raw.cashAmount ?? raw.cash_amount),
    cashless_amount: coerceNumber(raw.cashlessAmount ?? raw.cashless_amount),
    total_amount: coerceNumber(raw.totalAmount ?? raw.total_amount),
    comment: raw.comment ?? null,
    category: typeof cat === "object" ? (cat?.name ?? null) : (raw.categoryName ?? raw.category_name ?? null),
    category_id: typeof cat === "object"
      ? (String(cat?.id ?? "") || null)
      : (typeof cat === "string" ? cat : (raw.categoryId ?? raw.category_id ?? null)),
    photo: raw.photo ?? null,
    created_at: raw.createdAt ?? raw.created_at ?? "",
    updated_at: raw.updatedAt ?? raw.updated_at ?? undefined,
    branch: raw.branch && typeof raw.branch === "object"
      ? { id: raw.branch.id, name: raw.branch.name ?? "" }
      : typeof raw.branch === "string"
        ? { id: raw.branch, name: raw.branchName ?? raw.branch_name ?? "" }
        : null,
    created_by: mapUserNested(raw.createdBy ?? raw.created_by),
    updated_by: mapUserNested(raw.updatedBy ?? raw.updated_by),
  };
}

/** Map raw API payroll-transaction response → PayrollTransaction type */
export function mapApiPayroll(raw: any): PayrollTransaction {
  const emp = raw.employee;
  return {
    id: raw.id,
    employee_id: (
      typeof emp === "object" ? emp?.id : typeof emp === "string" ? emp : raw.employee_id
    ) ?? "",
    employee_name: typeof emp === "object"
      ? (emp?.fullName ?? emp?.full_name ?? null)
      : null,
    name: raw.name ?? null,
    kind: raw.kind as PayrollKind,
    affects_month: raw.affectsMonth ?? raw.affects_month ?? "",
    cash_amount: coerceNumber(raw.cashAmount ?? raw.cash_amount),
    cashless_amount: coerceNumber(raw.cashlessAmount ?? raw.cashless_amount),
    total_amount: coerceNumber(raw.totalAmount ?? raw.total_amount),
    comment: raw.comment ?? null,
    branch: raw.branch && typeof raw.branch === "object"
      ? { id: raw.branch.id, name: raw.branch.name ?? "" }
      : null,
    created_by: mapUserNested(raw.createdBy ?? raw.created_by),
    updated_by: mapUserNested(raw.updatedBy ?? raw.updated_by),
    created_at: raw.createdAt ?? raw.created_at ?? "",
    updated_at: raw.updatedAt ?? raw.updated_at ?? undefined,
  };
}

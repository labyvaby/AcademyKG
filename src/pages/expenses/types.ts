export type ExpenseKind = "payroll" | "advance" | "operational" | "other";

export const EXPENSE_KIND_OPTIONS: Array<{ value: ExpenseKind; label: string }> = [
  { value: "payroll", label: "Зарплата" },
  { value: "advance", label: "Аванс" },
  { value: "operational", label: "Операционный" },
  { value: "other", label: "Другое" },
];

export const PAYROLL_RELATED_EXPENSE_KINDS = new Set<ExpenseKind>(["payroll", "advance"]);

export function requiresAffectsMonth(kind: ExpenseKind | null | undefined): boolean {
  return Boolean(kind && PAYROLL_RELATED_EXPENSE_KINDS.has(kind));
}

export function inferExpenseKindFromCategory(
  category: { name?: string | null; kind?: ExpenseKind | null } | string | null | undefined,
): ExpenseKind | null {
  if (!category) return null;

  if (typeof category !== "string" && category.kind) {
    return category.kind;
  }

  const normalizedName = String(typeof category === "string" ? category : category.name ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedName) return null;
  if (normalizedName.includes("аванс")) return "advance";
  if (normalizedName.includes("заработ") || normalizedName.includes("зарплат")) return "payroll";

  return null;
}

export type Expense = {
  id: string | number;
  // employee: nested object in read responses, string ID for write
  employee_id: string | null;
  employee_name?: string | null;
  name: string;
  cash_amount: number;
  cashless_amount: number;
  total_amount: number;
  comment?: string | null;
  // category: nested object in read responses, string ID for write
  category?: string | null;       // category name (resolved from nested)
  category_id?: string | null;    // category UUID
  photo?: string | File | null;   // public URL or File for upload
  created_at: string;
  updated_at?: string;
  kind?: ExpenseKind | null;
  affects_month?: string | null;  // YYYY-MM
  branch?: { id: string; name: string } | null;
};

export type ExpenseFormValues = {
  employee_id: string | null;
  name: string;
  cash_amount: number;
  cashless_amount: number;
  total_amount: number;
  comment?: string | null;
  category?: string | null;       // category name (for display/autocomplete)
  category_id?: string | null;    // category UUID (sent to API)
  photo?: string | File | null;
  photoFile?: File | null;
  kind?: ExpenseKind | null;
  created_at?: string;
  affects_month?: string | null;
};

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

/** Map raw API expense response (camelCase nested) → flat Expense type */
export function mapApiExpense(raw: any): Expense {
  const emp = raw.employee;
  const cat = raw.category;
  return {
    id: raw.id ?? raw.id,
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
    kind: raw.kind ?? null,
    affects_month: raw.affectsMonth ?? raw.affects_month ?? null,
    branch: raw.branch && typeof raw.branch === "object"
      ? { id: raw.branch.id, name: raw.branch.name ?? "" }
      : typeof raw.branch === "string"
        ? { id: raw.branch, name: raw.branchName ?? raw.branch_name ?? "" }
        : null,
  };
}

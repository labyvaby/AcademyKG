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
    employee_id: (typeof emp === "object" ? emp?.id : raw.employeeId ?? raw.employee_id) ?? null,
    employee_name: typeof emp === "object" ? (emp?.fullName ?? emp?.full_name ?? null) : null,
    name: raw.name ?? "",
    cash_amount: coerceNumber(raw.cashAmount ?? raw.cash_amount),
    cashless_amount: coerceNumber(raw.cashlessAmount ?? raw.cashless_amount),
    total_amount: coerceNumber(raw.totalAmount ?? raw.total_amount),
    comment: raw.comment ?? null,
    category: typeof cat === "object" ? (cat?.name ?? null) : (raw.categoryName ?? null),
    category_id: typeof cat === "object" ? (String(cat?.id ?? "") || null) : (raw.categoryId ?? raw.category_id ?? null),
    photo: raw.photo ?? null,
    created_at: raw.createdAt ?? raw.created_at ?? "",
    updated_at: raw.updatedAt ?? raw.updated_at ?? undefined,
    affects_month: raw.affectsMonth ?? raw.affects_month ?? null,
    branch: raw.branch && typeof raw.branch === "object"
      ? { id: raw.branch.id, name: raw.branch.name ?? "" }
      : null,
  };
}

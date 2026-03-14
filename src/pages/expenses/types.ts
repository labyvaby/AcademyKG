export type Expense = {
  id: number;
  employee_id: string | null;
  name: string;
  cash_amount: number;
  cashless_amount: number;
  total_amount: number;
  comment?: string | null;
  category?: string | null;
  category_id?: string | null;
  photo?: string | File | null; // public URL or File for upload
  created_at: string;
  updated_at: string;
  affects_month?: string | null; // YYYY-MM, which salary month this expense deducts from
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
  photo?: string | File | null; // existing photo URL or new file during multipart upload
  photoFile?: File | null; // selected file in form
  created_at?: string;
  affects_month?: string | null; // YYYY-MM
};

export type EmployeesRow = {
  id: string;
  full_name: string;
  nickname?: string;
  specialization?: string; // from EmployeesView: "Специализация"
  specializationNames?: string[]; // список специализаций сотрудника
  serviceIds?: string[]; // ID услуг привязанных к сотруднику
  avatar_url?: string; // from EmployeesView: "Фото"
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

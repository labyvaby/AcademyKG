import { apiFetch } from "../utility/apiClient";
import type { EmployeesRow } from "../pages/expenses/types";

type ApiEmployee = {
  id: string;
  fullName?: string;
  full_name?: string;
  nickname?: string;
  photoUrl?: string | null;
  photo_url?: string | null;
  specializations?: { id: string; name: string }[];
  services?: string[];
  role?: string;
  userEmail?: string | null;
  user_email?: string | null;
  userPhoneNumber?: string | null;
  user_phone_number?: string | null;
};

const toRow = (d: ApiEmployee): EmployeesRow => {
  const specializationNames = d.specializations
    ?.map((s) => typeof s === "string" ? s : (s as any)?.name ?? "")
    .filter(Boolean) ?? [];
  const role = typeof d.role === "string" ? d.role : undefined;
  return {
    id: d.id,
    full_name: d.fullName ?? d.full_name ?? "Без имени",
    nickname: d.nickname ?? undefined,
    avatar_url: d.photoUrl ?? d.photo_url ?? undefined,
    specialization: specializationNames[0] ?? role ?? undefined,
    specializationNames,
    serviceIds: d.services ?? [],
    user_email: d.userEmail ?? d.user_email ?? null,
    user_phone_number: d.userPhoneNumber ?? d.user_phone_number ?? null,
    role,
  };
};

const fetchEmployeesBase = async (): Promise<ApiEmployee[]> => {
  try {
    const res: any = await apiFetch("/api/v1/employees/?status=active");
    // Handle nesting if API returns { data: { results: [...] } }
    let results = res?.data?.results ?? res?.results;
    if (!results && res?.data && Array.isArray(res.data)) {
        results = res.data;
    }
    return results ?? [];
  } catch (err) {
    console.error("apiFetch fetchEmployeesBase error:", err);
    throw err;
  }
};

export const fetchEmployees = async (): Promise<EmployeesRow[]> => {
  try {
    const data = await fetchEmployeesBase();
    return data.map(toRow);
  } catch (e) {
    console.error("fetchEmployees failed", e);
    return [];
  }
};

export const fetchMedicalStaff = async (): Promise<EmployeesRow[]> => {
  try {
    const data = await fetchEmployeesBase();
    return data.map(toRow);
  } catch (e) {
    console.error("fetchMedicalStaff failed", e);
    return [];
  }
};


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
  const specializationNames = d.specializations?.map((s) => s.name) ?? [];
  return {
    id: d.id,
    full_name: d.fullName ?? d.full_name ?? "Без имени",
    nickname: d.nickname ?? undefined,
    avatar_url: d.photoUrl ?? d.photo_url ?? undefined,
    specialization: specializationNames[0] ?? d.role ?? undefined,
    specializationNames,
    serviceIds: d.services ?? [],
    user_email: d.userEmail ?? d.user_email ?? null,
    user_phone_number: d.userPhoneNumber ?? d.user_phone_number ?? null,
    role: d.role,
  };
};

const fetchEmployeesBase = async (): Promise<ApiEmployee[]> => {
  try {
    const res: any = await apiFetch("/staff/employees/?page_size=1000");
    const results = res?.data?.results ?? res?.results ?? [];
    if (Array.isArray(results) && results.length > 0) return results;
    // fallback to old endpoint
    const res2: any = await apiFetch("/api/v1/staff/?page_size=1000");
    return res2?.data?.results ?? res2?.results ?? [];
  } catch (err) {
    console.error("apiFetch fetchEmployeesBase error:", err);
    try {
      const res2: any = await apiFetch("/api/v1/staff/?page_size=1000");
      return res2?.data?.results ?? res2?.results ?? [];
    } catch {
      throw err;
    }
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

export const fetchDoctors = async (): Promise<EmployeesRow[]> => {
  try {
    const data = await fetchEmployeesBase();
    return data
      .filter((d) => (d.role || "").toLowerCase() === "doctor")
      .map(toRow);
  } catch (e) {
    console.error("fetchDoctors failed", e);
    return [];
  }
};

export const fetchMedicalStaff = async (): Promise<EmployeesRow[]> => {
  try {
    const data = await fetchEmployeesBase();
    return data
      .filter((emp) => {
        const role = (emp.role || "").toLowerCase();
        return role === "doctor" || role === "nurse";
      })
      .map(toRow);
  } catch (e) {
    console.error("fetchMedicalStaff failed", e);
    return [];
  }
};

export const fetchNurses = async (): Promise<EmployeesRow[]> => {
  try {
    const data = await fetchEmployeesBase();
    return data
      .filter((d) => (d.role || "").toLowerCase() === "nurse")
      .map(toRow);
  } catch (e) {
    console.error("fetchNurses failed", e);
    return [];
  }
};

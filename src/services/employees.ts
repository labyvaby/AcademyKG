import { apiFetch } from "../utility/apiClient";
import type { EmployeesRow } from "../pages/expenses/types";

type ApiEmployee = {
  id: string;
  fullName?: string;
  full_name?: string;
  nickname?: string;
  photoUrl?: string | null;
  photo_url?: string | null;
  roleName?: string;
  specializationName?: string | null;
  specializations?: { id: string; name: string }[];
  services?: { id: string; name: string; sellableItem?: string }[];
};

const toRow = (d: ApiEmployee): EmployeesRow => {
  const specializationNames = d.specializations?.map((s) => s.name) ?? [];
  const serviceIds = (d.services ?? []).map((s) => s.sellableItem ?? s.id);
  return {
    id: d.id,
    full_name: d.fullName ?? d.full_name ?? "Без имени",
    nickname: d.nickname ?? undefined,
    avatar_url: d.photoUrl ?? d.photo_url ?? undefined,
    specialization: specializationNames[0] ?? d.specializationName ?? d.roleName ?? undefined,
    specializationNames,
    serviceIds,
  };
};

const fetchAllPages = async (url: string): Promise<ApiEmployee[]> => {
  const results: ApiEmployee[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res: any = await apiFetch(nextUrl);
    const items: ApiEmployee[] = res?.data?.results ?? res?.results ?? [];
    results.push(...items);
    const next = res?.data?.next ?? res?.next ?? null;
    if (next) {
      try {
        const u = new URL(next);
        nextUrl = u.pathname + u.search;
      } catch {
        nextUrl = null;
      }
    } else {
      nextUrl = null;
    }
  }

  return results;
};

export const fetchEmployees = async (): Promise<EmployeesRow[]> => {
  try {
    const data = await fetchAllPages("/api/v1/employees/?ordering=fullName&page_size=200");
    return data.map(toRow);
  } catch (e) {
    console.error("fetchEmployees failed", e);
    return [];
  }
};

export const fetchDoctors = async (): Promise<EmployeesRow[]> => {
  try {
    const data = await fetchAllPages("/api/v1/employees/?roleName=doctor&ordering=fullName&page_size=200");
    return data.filter((d) => (d.roleName ?? "").toLowerCase() === "doctor").map(toRow);
  } catch (e) {
    console.error("fetchDoctors failed", e);
    return [];
  }
};

export const fetchMedicalStaff = async (): Promise<EmployeesRow[]> => {
  try {
    const [doctors, nurses] = await Promise.all([
      fetchAllPages("/api/v1/employees/?roleName=doctor&ordering=fullName&page_size=200"),
      fetchAllPages("/api/v1/employees/?roleName=nurse&ordering=fullName&page_size=200"),
    ]);
    // Дедупликация: сотрудник может иметь обе роли (doctor + nurse) — убираем дубли по id
    const combined = [...doctors, ...nurses];
    const uniqueMap = new Map<string, ApiEmployee>();
    for (const emp of combined) {
      if (emp.id && !uniqueMap.has(emp.id)) {
        uniqueMap.set(emp.id, emp);
      }
    }
    return Array.from(uniqueMap.values()).map(toRow);
  } catch (e) {
    console.error("fetchMedicalStaff failed", e);
    return [];
  }
};

export const fetchNurses = async (): Promise<EmployeesRow[]> => {
  try {
    const data = await fetchAllPages("/api/v1/employees/?roleName=nurse&ordering=fullName&page_size=200");
    return data.filter((d) => (d.roleName ?? "").toLowerCase() === "nurse").map(toRow);
  } catch (e) {
    console.error("fetchNurses failed", e);
    return [];
  }
};

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "../utility/apiClient";
import { fetchMedicalStaff } from "../services/employees";
import type { PatientOption } from "../pages/home/types";
import { useBranchContext } from "../contexts/branch-context";

// Types
type DictionariesByType = {
  patients: PatientOption[];
  employees: any[];
};


const fetchAllDictionaries = async (): Promise<DictionariesByType> => {
  const patientsPromise = (async () => {
    try {
      const res: any = await apiFetch("/api/v1/clients/?pageSize=1000&ordering=fullName");
      const rawData: any[] = res?.data?.results ?? res?.results ?? [];
      return rawData.map((r: any) => {
        const id = String(r.id ?? "");
        const fio = r.fullName ?? r.full_name ?? r["ФИО клиента"] ?? "";
        const directPhone = r.phone ?? r.contactPhone ?? r.contact_phone ?? r["Телефон"] ?? "";
        const persons = r.responsiblePersons ?? r.responsible_persons;
        const phone = directPhone || (Array.isArray(persons) && persons.length > 0 ? (persons[0]?.phone ?? "") : "");
        const label = [fio, phone].filter(Boolean).join(" — ") || id;
        return { id, label, fio, phone, "ФИО клиента": fio, "Телефон": phone };
      }).filter((p: PatientOption) => p.id) as PatientOption[];
    } catch {
      return [] as PatientOption[];
    }
  })();

  const [patients, employees] = await Promise.all([
    patientsPromise,
    fetchMedicalStaff(),
  ]);

  return { patients, employees };
};

const EMPTY_PATIENTS: PatientOption[] = [];
const EMPTY_EMPLOYEES: any[] = [];

export function useDictionaries(enabled: boolean = true) {
  const { selectedBranch } = useBranchContext();
  const branchId = selectedBranch?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["dictionaries", "all", branchId],
    queryFn: fetchAllDictionaries,
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  });

  return {
    patients: data?.patients ?? EMPTY_PATIENTS,
    employees: data?.employees ?? EMPTY_EMPLOYEES,
    loading: isLoading,
  };
}

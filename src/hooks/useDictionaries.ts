import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../utility/apiClient";
import { fetchMedicalStaff } from "../services/employees";
import { fetchServices, type ServiceRow } from "../services/services";
import type { PatientOption } from "../pages/home/types";

// Types
type DictionariesByType = {
  patients: PatientOption[];
  employees: any[]; // Medical staff + others depending on request
  services: ServiceRow[];
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

  const staffPromise = fetchMedicalStaff();
  const servicesPromise = fetchServices();

  const [patients, employees, services] = await Promise.all([
    patientsPromise,
    staffPromise,
    servicesPromise,
  ]);

  return { patients, employees, services };
};

export function useDictionaries(enabled: boolean = true) {
  const { data, isLoading } = useQuery({
    queryKey: ["dictionaries", "all"],
    queryFn: fetchAllDictionaries,
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - увеличено для уменьшения запросов
    gcTime: 30 * 60 * 1000, // 30 minutes - увеличено для хранения в памяти
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Не перезагружать при монтировании, если данные есть
    refetchOnReconnect: false, // Не перезагружать при восстановлении соединения
  });

  return {
    patients: data?.patients ?? [],
    employees: data?.employees ?? [],
    services: data?.services ?? [],
    loading: isLoading,
  };
}

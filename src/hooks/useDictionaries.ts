import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../utility/apiClient";
import { fetchMedicalStaff } from "../services/employees";
import { fetchServices, type ServiceRow } from "../services/services";
import { getProducts, type Product } from "../services/products";
import type { PatientOption } from "../pages/home/types";

// Types
type DictionariesByType = {
  patients: PatientOption[];
  employees: any[]; // Medical staff + others depending on request
  services: ServiceRow[];
  products: Product[];
};


const fetchAllDictionaries = async (): Promise<DictionariesByType> => {
  const patientsPromise = (async () => {
    try {
      const res: any = await apiFetch("/api/v1/children/?page_size=1000&ordering=full_name");
      const rawData: any[] = res?.data?.results ?? res?.results ?? [];
      return rawData.map((r: any) => {
        const id = String(r.id ?? "");
        const fio = r.full_name ?? r.fullName ?? r["ФИО клиента"] ?? "";
        const phone = r.contact_phone ?? r.contactPhone ?? r.phone ?? r["Телефон"] ?? "";
        const label = [fio, phone].filter(Boolean).join(" — ") || id;
        return { id, label, fio, phone, "ФИО пациента": fio, "Телефон": phone };
      }).filter((p: PatientOption) => p.id) as PatientOption[];
    } catch {
      return [] as PatientOption[];
    }
  })();

  const staffPromise = fetchMedicalStaff();
  const servicesPromise = fetchServices();
  const productsPromise = getProducts();

  const [patients, employees, services, products] = await Promise.all([
    patientsPromise,
    staffPromise,
    servicesPromise,
    productsPromise,
  ]);

  return { patients, employees, services, products };
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
    products: data?.products ?? [],
    loading: isLoading,
  };
}

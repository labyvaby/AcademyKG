/**
 * Хранит привязку "сотрудник → услуги" через /api/v1/settings/
 * Ключ: employee_services
 * Значение: JSON { [employeeId]: string[] }
 */
import { apiFetch } from "../utility/apiClient";

const SETTINGS_KEY = "employee_services";

type ServiceMap = Record<string, string[]>;

export const getEmployeeServicesMap = async (): Promise<ServiceMap> => {
  try {
    const res: any = await apiFetch(`/api/v1/settings/${SETTINGS_KEY}/`);
    const val = res?.data?.value ?? res?.value ?? null;
    if (!val) return {};
    return JSON.parse(val) as ServiceMap;
  } catch {
    return {};
  }
};

export const saveEmployeeServicesMap = async (map: ServiceMap): Promise<void> => {
  await apiFetch(`/api/v1/settings/${SETTINGS_KEY}/`, {
    method: "PATCH",
    body: JSON.stringify({ value: JSON.stringify(map) }),
  });
};

export const getServiceIdsForEmployee = async (employeeId: string): Promise<string[]> => {
  const map = await getEmployeeServicesMap();
  return map[employeeId] ?? [];
};

export const setServiceIdsForEmployee = async (employeeId: string, serviceIds: string[]): Promise<void> => {
  const map = await getEmployeeServicesMap();
  map[employeeId] = serviceIds;
  await saveEmployeeServicesMap(map);
};

import { useQuery } from "@tanstack/react-query";
import { fetchEmployees } from "../services/employees";
import { getBranchFilter } from "../utility/apiClient";

/**
 * Список активных сотрудников.
 * @param branchId — явный филиал (?branch=). Если не передан — глобальный
 * фильтр суперадмина (инжектится apiClient) или серверный скоуп токена.
 */
export function useEmployees(enabled: boolean = true, branchId?: string) {
  const keyBranch = branchId ?? getBranchFilter() ?? "all";
  const { data, isLoading, error } = useQuery({
    queryKey: ["employees", "all", keyBranch],
    queryFn: () => fetchEmployees(branchId),
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    employees: data ?? [],
    loading: isLoading,
    error,
  };
}

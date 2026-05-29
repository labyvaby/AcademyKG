import { useQuery } from "@tanstack/react-query";
import { fetchEmployees } from "../services/employees";
import { getBranchFilter } from "../utility/apiClient";

export function useEmployees(enabled: boolean = true) {
  const branchId = getBranchFilter() ?? "all";
  const { data, isLoading, error } = useQuery({
    queryKey: ["employees", "all", branchId],
    queryFn: fetchEmployees,
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

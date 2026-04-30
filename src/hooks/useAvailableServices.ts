import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "../utility/apiClient";
import type { ServiceRow } from "../services/services";
import { isValidSellableService, mapSellableToServiceRow } from "../utils/sellableServiceFilters";
import { useValidServiceIds } from "./useValidServiceIds";

export const SELLABLE_SERVICES_QUERY_KEY = "sellable-services";

async function fetchSellableServiceItems(employeeId?: string): Promise<any[]> {
  const base = "/api/v1/sellable-items/?type=service&isActive=true&pageSize=200";
  const url = employeeId ? `${base}&employee=${employeeId}` : base;
  const res: any = await apiFetch(url);
  return res?.data?.results ?? res?.results ?? [];
}

/**
 * Единый хук для получения списка услуг, доступных для продажи.
 *
 * - Без employeeId: все доступные услуги (для выбора услуги без врача)
 * - С employeeId: только услуги конкретного врача
 *
 * Фильтрует удалённые сервисы через validServiceIds (из useValidServiceIds).
 * placeholderData: keepPreviousData — нет "мигания" при смене employeeId.
 */
export function useAvailableServices(options?: {
  employeeId?: string;
  enabled?: boolean;
}): { services: ServiceRow[]; isLoading: boolean } {
  const { employeeId, enabled = true } = options ?? {};

  const { validServiceIds } = useValidServiceIds();

  const { data: rawItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: [SELLABLE_SERVICES_QUERY_KEY, { employeeId: employeeId ?? null }],
    queryFn: () => fetchSellableServiceItems(employeeId),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const services = useMemo(
    () =>
      rawItems
        .filter((item) => isValidSellableService(item, validServiceIds))
        .map(mapSellableToServiceRow)
        .filter((s) => s.id && s.name),
    [rawItems, validServiceIds]
  );

  return { services, isLoading: itemsLoading };
}

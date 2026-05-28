import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../utility/apiClient";
import { fetchAllPages } from "../utility/pagination";
import { useBranchContext } from "../contexts/branch-context";

export const VALID_SERVICE_IDS_QUERY_KEY = "valid-service-ids" as const;

// Пустой Set вынесен за пределы компонента — не создаётся заново на каждом рендере,
// что предотвращает лишние срабатывания useMemo в useAvailableServices.
const EMPTY_SET = new Set<string>();

async function fetchValidServiceIds(): Promise<Set<string>> {
  // fetchAllPages обходит все страницы автоматически — защита от >200 сервисов.
  // TODO (backend): запросить добавление поля isDeleted в sellable-items,
  //   чтобы можно было убрать этот дополнительный запрос к /services.
  const results = await fetchAllPages<any>(
    "/api/v1/services/?isActive=true",
    200
  );
  return new Set<string>(
    results.map((s: any) => String(s.id ?? "")).filter(Boolean)
  );
}

/**
 * Возвращает Set ID-ов активных (не удалённых) сервисов из /api/v1/services/.
 *
 * Единственная роль этого хука — валидация: знать какие service.id
 * существуют и не удалены, чтобы отфильтровать их из sellable-items.
 *
 * staleTime: Infinity — данные не устаревают сами по себе.
 * Инвалидация происходит явно: после создания/удаления услуги
 * вызови invalidateValidServiceIds() из useValidServiceIdsInvalidation().
 */
export function useValidServiceIds() {
  const { selectedBranch } = useBranchContext();
  const branchId = selectedBranch?.id ?? null;

  const { data = EMPTY_SET, isLoading } = useQuery({
    queryKey: [VALID_SERVICE_IDS_QUERY_KEY, branchId],
    queryFn: fetchValidServiceIds,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000, // 1 час
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return { validServiceIds: data, isLoading };
}

/**
 * Возвращает функцию для ручной инвалидации кэша validServiceIds.
 * Вызывать после:
 *   - создания новой услуги
 *   - удаления услуги
 *   - logout / смены организации
 */
export function useValidServiceIdsInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: [VALID_SERVICE_IDS_QUERY_KEY] });
}

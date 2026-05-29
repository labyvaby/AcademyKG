import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  BRANCH_FILTER_STORAGE_KEY,
  clearBranchFilter,
  setBranchFilter,
} from "../utility/apiClient";

const BRANCH_DEPENDENT_KEYS = [
  ["appointments"],
  ["group-appointments"],
  ["shifts"],
  ["employees", "medical-staff"],
  ["doctor-appointments-v2"],
  ["doctor-counts"],
  // Clients and services are now branch-scoped
  ["dictionaries"],
  ["sellable-services"],
  ["valid-service-ids"],
] as const;

export type BranchOption = { id: string; name: string };
type BranchApiItem = { id: string | number; name?: string | null };
type BranchListResponse = {
  data?: { results?: BranchApiItem[] };
  results?: BranchApiItem[];
};

type BranchContextValue = {
  branches: BranchOption[];
  selectedBranch: BranchOption | null; // null = все филиалы
  setSelectedBranch: (branch: BranchOption | null) => void;
  loading: boolean;
};

export const BranchContext = React.createContext<BranchContextValue>({
  branches: [],
  selectedBranch: null,
  setSelectedBranch: () => {},
  loading: false,
});

export const useBranchContext = () => React.useContext(BranchContext);

export const BranchProvider: React.FC<{ isSuperAdmin: boolean; children: React.ReactNode }> = ({
  isSuperAdmin,
  children,
}) => {
  const queryClient = useQueryClient();
  const [branches, setBranches] = React.useState<BranchOption[]>([]);

  // Инициализируем selectedBranch И вызываем setBranchFilter синхронно в одном
  // lazy-initializer, до первого рендера. Это гарантирует что _activeBranchId
  // установлен раньше любых API-запросов дочерних компонентов.
  const [selectedBranch, setSelectedBranchState] = React.useState<BranchOption | null>(() => {
    if (!isSuperAdmin) return null;
    try {
      const saved = localStorage.getItem(BRANCH_FILTER_STORAGE_KEY);
      const parsed: BranchOption | null = saved ? JSON.parse(saved) : null;
      // Синхронно ставим глобальный фильтр ДО первого рендера.
      setBranchFilter(parsed?.id ?? null);
      return parsed;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = React.useState(false);

  // Загружаем список филиалов и валидируем сохранённый branch.
  React.useEffect(() => {
    if (!isSuperAdmin) {
      setBranches([]);
      clearBranchFilter();
      setSelectedBranchState(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch<BranchListResponse>("/api/v1/branches/");
        if (cancelled) return;
        const list = res?.data?.results ?? res?.results ?? [];
        const fetched = list.map((b) => ({ id: String(b.id), name: b.name ?? "" }));
        setBranches(fetched);

        // Валидируем сохранённый branch: если он больше не существует — сброс.
        setSelectedBranchState((prev) => {
          if (!prev) return null;
          const stillExists = fetched.some((b) => b.id === prev.id);
          if (stillExists) return prev; // всё ок, оставляем
          // Филиал удалён/недоступен — сбрасываем фильтр и localStorage.
          setBranchFilter(null);
          try { localStorage.removeItem(BRANCH_FILTER_STORAGE_KEY); } catch { /* ignore */ }
          return null;
        });
      } catch {
        /* ignore network errors */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  const setSelectedBranch = React.useCallback((branch: BranchOption | null) => {
    setSelectedBranchState(branch);
    setBranchFilter(branch?.id ?? null);
    try {
      if (branch) localStorage.setItem(BRANCH_FILTER_STORAGE_KEY, JSON.stringify(branch));
      else localStorage.removeItem(BRANCH_FILTER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // Инвалидируем все филиальные кэши при смене филиала.
    for (const key of BRANCH_DEPENDENT_KEYS) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient]);

  return (
    <BranchContext.Provider value={{ branches, selectedBranch, setSelectedBranch, loading }}>
      {children}
    </BranchContext.Provider>
  );
};

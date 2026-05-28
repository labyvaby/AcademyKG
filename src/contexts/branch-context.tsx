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
  const [selectedBranch, setSelectedBranchState] = React.useState<BranchOption | null>(() => {
    if (!isSuperAdmin) return null;
    try {
      const saved = localStorage.getItem(BRANCH_FILTER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isSuperAdmin) {
      setBranches([]);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch<BranchListResponse>("/api/v1/branches/");
        const list = res?.data?.results ?? res?.results ?? [];
        setBranches(list.map((b) => ({ id: String(b.id), name: b.name ?? "" })));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [isSuperAdmin]);

  React.useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedBranchState(null);
      clearBranchFilter();
      return;
    }

    try {
      const saved = localStorage.getItem(BRANCH_FILTER_STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as BranchOption) : null;
      setSelectedBranchState(parsed);
      setBranchFilter(parsed?.id ?? null);
    } catch {
      setSelectedBranchState(null);
      clearBranchFilter();
    }
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
    // Инвалидируем все филиальные кэши, чтобы при смене филиала
    // не показывались stale данные предыдущего филиала.
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

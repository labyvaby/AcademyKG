import React from "react";
import { apiFetch, setBranchFilter } from "../utility/apiClient";

const STORAGE_KEY = "superadmin_selected_branch";

export type BranchOption = { id: string; name: string };

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
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranchState] = React.useState<BranchOption | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      try {
        setLoading(true);
        const res: any = await apiFetch("/api/v1/branches/");
        const list: any[] = res?.data?.results ?? res?.results ?? [];
        setBranches(list.map((b) => ({ id: String(b.id), name: b.name ?? "" })));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [isSuperAdmin]);

  const setSelectedBranch = React.useCallback((branch: BranchOption | null) => {
    setSelectedBranchState(branch);
    setBranchFilter(branch?.id ?? null);
    try {
      if (branch) localStorage.setItem(STORAGE_KEY, JSON.stringify(branch));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Restore filter on mount (localStorage → apiFetch sync)
  React.useEffect(() => {
    setBranchFilter(selectedBranch?.id ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BranchContext.Provider value={{ branches, selectedBranch, setSelectedBranch, loading }}>
      {children}
    </BranchContext.Provider>
  );
};

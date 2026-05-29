import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  BRANCH_FILTER_STORAGE_KEY,
  clearBranchFilter,
  setBranchFilter,
  getBranchFilter,
} from "../utility/apiClient";

const BRANCH_DEPENDENT_KEYS = [
  ["appointments"],
  ["group-appointments"],
  ["shifts"],
  ["employees", "medical-staff"],
  ["employees", "all"],
  ["employeesListAnalytics"],
  ["appointmentsLoad"],
  ["doctor-appointments-v2"],
  ["doctor-counts"],
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
  /** true когда branch уже синхронизирован с localStorage и списком филиалов */
  branchHydrated: boolean;
};

export const BranchContext = React.createContext<BranchContextValue>({
  branches: [],
  selectedBranch: null,
  setSelectedBranch: () => {},
  loading: false,
  branchHydrated: false,
});

export const useBranchContext = () => React.useContext(BranchContext);

// Читаем сохранённый BranchOption из localStorage один раз при загрузке модуля.
// Используется как начальное значение state — до монтирования компонентов.
function _loadSavedBranch(): BranchOption | null {
  try {
    const raw = localStorage.getItem(BRANCH_FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && typeof parsed.name === "string") {
      return parsed as BranchOption;
    }
    return null;
  } catch {
    return null;
  }
}

export const BranchProvider: React.FC<{ isSuperAdmin: boolean; permissionsLoading?: boolean; children: React.ReactNode }> = ({
  isSuperAdmin,
  permissionsLoading = false,
  children,
}) => {
  const queryClient = useQueryClient();
  const [branches, setBranches] = React.useState<BranchOption[]>([]);

  // Читаем сохранённый branch ИЗ МОДУЛЬНОГО уровня (уже прочитан при импорте
  // apiClient и установлен в _activeBranchId). Здесь только синхронизируем state.
  // Не зависим от isSuperAdmin — он может быть false до загрузки auth.
  const [selectedBranch, setSelectedBranchState] = React.useState<BranchOption | null>(() => {
    return _loadSavedBranch();
  });

  // branchHydrated = false пока не загружен список филиалов и не провалидирован
  // сохранённый branch. Компоненты могут использовать этот флаг чтобы отложить
  // запросы, зависящие от branch.
  const [branchHydrated, setBranchHydrated] = React.useState<boolean>(() => {
    // Если в localStorage ничего не было — уже гидратированы (null = «Все филиалы»).
    return _loadSavedBranch() === null;
  });

  const [loading, setLoading] = React.useState(false);

  // При монтировании: убеждаемся что _activeBranchId соответствует state.
  // Это нужно на случай если apiClient был импортирован ДО того как
  // branch-context прочитал localStorage (порядок импортов может меняться).
  React.useLayoutEffect(() => {
    const saved = _loadSavedBranch();
    const activeId = getBranchFilter();
    if (saved && activeId !== saved.id) {
      setBranchFilter(saved.id);
    }
  }, []);

  // Загружаем список филиалов.
  // Если permissions ещё грузятся — ждём, не трогаем branch.
  React.useEffect(() => {
    // Пока роль ещё не загружена — не трогаем состояние.
    // isSuperAdmin=false + permissionsLoading=true означает "ещё грузится".
    if (permissionsLoading) return;

    if (!isSuperAdmin) {
      // Обычный пользователь: branch определяется правами на сервере.
      // Очищаем любой сохранённый superadmin-branch.
      clearBranchFilter();
      setSelectedBranchState(null);
      setBranches([]);
      setBranchHydrated(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch<BranchListResponse>("/api/v1/branches/");
        if (cancelled) return;

        const list = res?.data?.results ?? res?.results ?? [];
        const fetched: BranchOption[] = list.map((b) => ({
          id: String(b.id),
          name: b.name ?? "",
        }));
        setBranches(fetched);

        // Валидируем сохранённый branch против реального списка.
        const saved = _loadSavedBranch();
        if (!saved) {
          // Явно «Все филиалы» — ничего не меняем, уже гидратированы.
          setBranchHydrated(true);
          return;
        }

        const stillExists = fetched.some((b) => b.id === saved.id);
        if (stillExists) {
          // Филиал доступен — устанавливаем (или оставляем) его.
          setSelectedBranchState(saved);
          setBranchFilter(saved.id);
        } else {
          // Филиал удалён или недоступен — сбрасываем на «Все филиалы».
          setSelectedBranchState(null);
          setBranchFilter(null);
          try { localStorage.removeItem(BRANCH_FILTER_STORAGE_KEY); } catch { /* ignore */ }
        }
        setBranchHydrated(true);
      } catch {
        // Сеть недоступна: оставляем сохранённый branch как есть, помечаем гидратированным
        // чтобы не блокировать UI вечно.
        setBranchHydrated(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isSuperAdmin, permissionsLoading]);

  const setSelectedBranch = React.useCallback((branch: BranchOption | null) => {
    setSelectedBranchState(branch);
    setBranchFilter(branch?.id ?? null);
    try {
      if (branch) {
        localStorage.setItem(BRANCH_FILTER_STORAGE_KEY, JSON.stringify(branch));
      } else {
        localStorage.removeItem(BRANCH_FILTER_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    for (const key of BRANCH_DEPENDENT_KEYS) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient]);

  return (
    <BranchContext.Provider value={{ branches, selectedBranch, setSelectedBranch, loading, branchHydrated }}>
      {children}
    </BranchContext.Provider>
  );
};

import React from "react";
import { usePermissions } from "./usePermissions";
import { useBranchContext, type BranchOption } from "../contexts/branch-context";

// Скоуп филиала для страниц отчётов (/reports, /salary-reports и их диалоги).
//
// Суперадмин: используется глобальный переключатель филиалов (branch-context),
// null = «Все филиалы» — поведение не меняется.
//
// Не-суперадмин: глобальный branch-context намеренно пуст, но отчёты должны
// слать явный ?branch= — иначе бэк для сотрудника с несколькими allowedBranches
// агрегирует всю организацию (включая филиалы вне его доступа). Выбор хранится
// в module-store + localStorage, чтобы обе страницы отчётов и диалоги видели
// один и тот же филиал.

const REPORT_BRANCH_STORAGE_KEY = "report_branch_scope";

let _storedId: string | null = (() => {
  try {
    return localStorage.getItem(REPORT_BRANCH_STORAGE_KEY);
  } catch {
    return null;
  }
})();

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const getStoredId = () => _storedId;

const setStoredId = (id: string | null) => {
  _storedId = id;
  try {
    if (id) localStorage.setItem(REPORT_BRANCH_STORAGE_KEY, id);
    else localStorage.removeItem(REPORT_BRANCH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn();
};

const toBranchOption = (raw: unknown): BranchOption | null => {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (!b.id) return null;
  return {
    id: String(b.id),
    name: String(b.name ?? ""),
    brandName: String(b.brandName ?? b.brand_name ?? ""),
    logoUrl: (b.logoUrl ?? b.logo_url ?? null) as string | null,
  };
};

export type ReportBranchScope = {
  /** Профиль загружен (а для суперадмина — и branch-context гидратирован) */
  ready: boolean;
  /** Эффективный филиал; null = «Все филиалы» (только суперадмин) */
  branch: BranchOption | null;
  /** id для ?branch= в запросах отчётов */
  branchId: string | undefined;
  /** Доступные филиалы не-суперадмина (allowedBranches, fallback primaryBranch) */
  options: BranchOption[];
  setBranch: (id: string) => void;
  /** Показывать локальный переключатель: не-суперадмин с >1 филиалом */
  showSwitcher: boolean;
};

export function useReportBranchScope(): ReportBranchScope {
  const { employee, loading: permissionsLoading, isSuperAdmin } = usePermissions();
  const { selectedBranch, branchHydrated } = useBranchContext();
  const storedId = React.useSyncExternalStore(subscribe, getStoredId);

  const isSuper = isSuperAdmin();

  const options = React.useMemo<BranchOption[]>(() => {
    if (isSuper || !employee) return [];
    const allowed: unknown[] = Array.isArray(employee.allowedBranches) ? employee.allowedBranches : [];
    const list = allowed.map(toBranchOption).filter((b): b is BranchOption => b !== null);
    if (list.length > 0) return list;
    const primary = toBranchOption(employee.primaryBranch ?? employee.branch);
    return primary ? [primary] : [];
  }, [isSuper, employee]);

  const branch = React.useMemo<BranchOption | null>(() => {
    if (isSuper) return selectedBranch;
    if (options.length === 0) return null;
    const primaryId = employee?.primaryBranch?.id ? String(employee.primaryBranch.id) : null;
    return (
      options.find((b) => b.id === storedId) ??
      options.find((b) => b.id === primaryId) ??
      options[0]
    );
  }, [isSuper, selectedBranch, options, storedId, employee]);

  const setBranch = React.useCallback((id: string) => {
    setStoredId(id);
  }, []);

  return {
    ready: !permissionsLoading && (!isSuper || branchHydrated),
    branch,
    branchId: branch?.id,
    options,
    setBranch,
    showSwitcher: !isSuper && options.length > 1,
  };
}

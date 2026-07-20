import React from "react";
import { useBranchContext, type BranchOption } from "../contexts/branch-context";
import { usePermissions } from "./usePermissions";

// Эффективный филиал текущего пользователя — для показа названия/лого филиала
// (хэдер сайдбара, чеки и т.п.), которые должны видеть все роли.
//
// У суперадмина — филиал из глобального переключателя (branch-context),
// null = «Все филиалы». У остальных ролей branch-context намеренно пуст
// (филиал определяется правами на сервере), поэтому берём собственный филиал
// сотрудника из профиля: primaryBranch, fallback branch — тот же источник,
// что и у переключателя филиалов в отчётах (useReportBranchScope).
export const useEffectiveBranch = (): BranchOption | null => {
  const { selectedBranch } = useBranchContext();
  const { employee } = usePermissions();

  return React.useMemo(() => {
    if (selectedBranch) return selectedBranch;
    const raw: any = employee?.primaryBranch ?? employee?.branch;
    if (!raw || typeof raw !== "object" || !raw.id) return null;
    return {
      id: String(raw.id),
      name: String(raw.name ?? ""),
      brandName: String(raw.brandName ?? raw.brand_name ?? ""),
      logoUrl: raw.logoUrl ?? raw.logo_url ?? null,
      currency: raw.currency ?? undefined,
      timezone: raw.timezone ?? undefined,
    };
  }, [selectedBranch, employee]);
};

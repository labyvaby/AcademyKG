import { useEffectiveBranch } from "./useEffectiveBranch";
import { resolveBranchTimezone } from "../utility/branchTime";

/**
 * IANA-таймзона эффективного филиала текущего пользователя
 * (см. useEffectiveBranch). Пока бэк не отдаёт branch.timezone —
 * определяется по оверрайду/валюте филиала, fallback Asia/Bishkek.
 */
export const useBranchTimezone = (): string => {
  const branch = useEffectiveBranch();
  return resolveBranchTimezone(branch);
};

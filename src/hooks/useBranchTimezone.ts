import { useEffectiveBranch } from "./useEffectiveBranch";
import { resolveBranchTimezone } from "../utility/branchTime";

/**
 * IANA-таймзона эффективного филиала текущего пользователя
 * (см. useEffectiveBranch). Берётся из branch.timezone, fallback Asia/Bishkek.
 */
export const useBranchTimezone = (): string => {
  const branch = useEffectiveBranch();
  return resolveBranchTimezone(branch);
};

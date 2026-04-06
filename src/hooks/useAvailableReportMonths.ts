import { useEffect, useMemo, useRef, useState } from "react";
import { useBranchContext } from "../contexts/branch-context";
import { getAvailableMonths } from "../services/reports";

export type AvailableMonthsKey = "financialMonths" | "payrollMonths" | "expensesMonths";

export function useAvailableReportMonths(
  key: AvailableMonthsKey,
  enabled = true,
): Set<string> | null {
  const { selectedBranch } = useBranchContext();
  const branchId = selectedBranch?.id ?? null;
  const [payload, setPayload] = useState<Record<AvailableMonthsKey, string[]> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setPayload(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await getAvailableMonths(branchId ?? undefined, undefined, controller.signal);
        if (requestIdRef.current !== currentRequestId) return;
        const data = res?.data ?? { financialMonths: [], payrollMonths: [], expensesMonths: [] };
        setPayload({
          financialMonths: Array.isArray(data.financialMonths) ? data.financialMonths : [],
          payrollMonths: Array.isArray(data.payrollMonths) ? data.payrollMonths : [],
          expensesMonths: Array.isArray(data.expensesMonths) ? data.expensesMonths : [],
        });
      } catch (error) {
        if (controller.signal.aborted || requestIdRef.current !== currentRequestId) return;
        console.error("useAvailableReportMonths error:", error);
        setPayload({
          financialMonths: [],
          payrollMonths: [],
          expensesMonths: [],
        });
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [branchId, enabled]);

  return useMemo(() => {
    if (!payload) return null;
    return new Set(payload[key]);
  }, [key, payload]);
}

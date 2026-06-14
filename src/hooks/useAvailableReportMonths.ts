import { useEffect, useMemo, useRef, useState } from "react";
import { useReportBranchScope } from "./useReportBranchScope";
import { getAvailableMonths } from "../services/reports";

export type AvailableMonthsKey = "financialMonths" | "payrollMonths" | "expensesMonths";

export function useAvailableReportMonths(
  key: AvailableMonthsKey,
  enabled = true,
  /**
   * Явный филиал (string) или явное «без филиала» (null). Если не передан —
   * берётся филиал из useReportBranchScope (страницы отчётов).
   */
  branchOverride?: string | null,
): Set<string> | null {
  const scope = useReportBranchScope();
  const useScope = branchOverride === undefined;
  const branchId = useScope ? scope.branchId : branchOverride ?? undefined;
  const ready = useScope ? scope.ready : true;
  const [payload, setPayload] = useState<Record<AvailableMonthsKey, string[]> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setPayload(null);
      return;
    }
    // Ждём профиль: без него branchId ещё не определён, и запрос без ?branch=
    // у мульти-филиального сотрудника вернёт месяцы всей организации.
    if (!ready) return;

    const currentRequestId = ++requestIdRef.current;
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await getAvailableMonths(branchId, undefined, controller.signal);
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
  }, [branchId, enabled, ready]);

  return useMemo(() => {
    if (!payload) return null;
    return new Set(payload[key]);
  }, [key, payload]);
}

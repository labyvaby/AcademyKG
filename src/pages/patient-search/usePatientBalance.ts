import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../../utility/apiClient";

export type PatientBalance = {
  balance: number;
  cashBalance: number;
  cardBalance: number;
  bonuses: number;
};

export type TopUpType = "balance" | "bonuses";
export type PaymentMethod = "cash" | "card";

export type TopUpPayload = {
  type: TopUpType;
  amount: number;
  payment_method?: PaymentMethod;
  note?: string;
};

export function usePatientBalance(patientId: string | null | undefined) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [balance, setBalance] = useState<PatientBalance | null>(null);

  const reload = useCallback(async () => {
    if (!patientId) { setBalance(null); return; }
    try {
      const res: any = await apiFetch(`/api/v1/clients/${patientId}/`);
      const data = res?.data ?? res;
      console.log("[usePatientBalance] bal:", data?.balance, "| parsed balance:", Number(data?.balance?.balance ?? 0));
      const bal = data?.balance;
      if (bal) {
        setBalance({
          balance: Number(bal.balance ?? 0),
          cashBalance: Number(bal.advance ?? 0),
          cardBalance: 0,
          bonuses: Number(bal.bonuses ?? 0),
        });
      } else {
        setBalance(null);
      }
    } catch {
      setBalance(null);
    }
  }, [patientId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const topUp = useCallback(
    async (payload: TopUpPayload): Promise<boolean> => {
      if (!patientId) return false;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const body: Record<string, any> = {
          patient: patientId,
          txType: payload.type,
          amount: String(payload.amount),
        };
        if (payload.payment_method) {
          body.paymentMethod = payload.payment_method;
        }
        if (payload.note) body.note = payload.note;

        await apiFetch("/api/v1/client-balance-transactions/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        await reload();
        return true;
      } catch (e: any) {
        setSubmitError(e?.message ?? String(e));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [patientId, reload]
  );

  return {
    submitting,
    submitError,
    topUp,
    balance,
    reload,
  };
}

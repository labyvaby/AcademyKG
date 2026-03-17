import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../utility/apiClient";

export type PatientBalance = {
  balance: number;      // общий баланс (сумма нал + безнал)
  cashBalance: number;  // нал
  cardBalance: number;  // безнал
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

type State = {
  data: PatientBalance | null;
  loading: boolean;
  errorMsg: string | null;
};

export function usePatientBalance(patientId: string | null | undefined) {
  const [state, setState] = useState<State>({
    data: null,
    loading: false,
    errorMsg: null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) {
      setState({ data: null, loading: false, errorMsg: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, errorMsg: null }));

    try {
      const res: any = await apiFetch(`/api/v1/clients/${patientId}/`);
      const data = res?.data ?? res;
      const bal = data?.balance;
      setState({
        data: bal
          ? {
              balance: Number(bal.balance) || 0,
              cashBalance: Number(bal.cashBalance ?? bal.cash_balance) || 0,
              cardBalance: Number(bal.cardBalance ?? bal.card_balance) || 0,
              bonuses: Number(bal.bonuses) || 0,
            }
          : { balance: 0, cashBalance: 0, cardBalance: 0, bonuses: 0 },
        loading: false,
        errorMsg: null,
      });
    } catch (e: any) {
      setState({ data: null, loading: false, errorMsg: e?.message ?? String(e) });
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const topUp = useCallback(
    async (payload: TopUpPayload): Promise<boolean> => {
      if (!patientId) return false;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const body: Record<string, any> = {
          patient: patientId,
          txType: payload.type,
          amount: payload.amount < 0 ? String(payload.amount) : String(payload.amount),
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

        // Reload balance from client detail
        await load();
        return true;
      } catch (e: any) {
        setSubmitError(e?.message ?? String(e));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [patientId, load]
  );

  return {
    balance: state.data,
    loading: state.loading,
    errorMsg: state.errorMsg,
    submitting,
    submitError,
    topUp,
    reload: load,
  };
}

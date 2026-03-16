/**
 * usePatientHistory.ts
 * Загружает и кэширует историю приемов выбранного клиента через REST API.
 */

import React from "react";
import { apiFetch } from "../../utility/apiClient";
import type { HistoryRow, Patient } from "../../types/models";

const HISTORY_CACHE_PREFIX = "patientSearch.history.v1.";

type HistoryCache = { ts: number; items: HistoryRow[] };

function mapAppointmentToHistoryRow(r: any): HistoryRow {
  const servicesArr: any[] = Array.isArray(r.services) ? r.services : [];
  const patientNested = r.patient ?? null;
  const patientName =
    r.patientName ??
    r.patient_name ??
    patientNested?.fullName ??
    patientNested?.full_name ??
    "";
  const doctorName =
    r.doctorName ??
    r.doctor_name ??
    servicesArr[0]?.performer?.fullName ??
    servicesArr[0]?.performer?.full_name ??
    "";
  const serviceNames = servicesArr
    .map((s: any) => s.sellableItem?.displayName ?? s.sellableItem?.name ?? "")
    .filter(Boolean)
    .join(", ");

  return {
    ...r,
    ID: String(r.id ?? ""),
    "Дата и время": r.appointmentAt ?? r.appointment_at ?? "",
    "Доктор ФИО": doctorName || undefined,
    "Пациент ФИО": patientName || undefined,
    Услуга: serviceNames || r.serviceNames || r.service_names || undefined,
    "Услуга ID": undefined,
    Статус: r.status ?? undefined,
    Стоимость: r.total != null ? Number(r.total) : r.totalAmount != null ? Number(r.totalAmount) : undefined,
    "Итого, сом": r.total != null ? Number(r.total) : r.totalAmount != null ? Number(r.totalAmount) : undefined,
    "Жалобы при обращении": r.complaints ?? undefined,
    "Жалобы (врач)": undefined,
    "Комментарий администратора": r.adminComment ?? r.admin_comment ?? undefined,
  };
}

export function usePatientHistory(selected: Patient | null) {
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const ctrlRef = React.useRef<AbortController | null>(null);

  const invalidate = React.useCallback(() => {
    if (!selected) return;
    try {
      localStorage.removeItem(HISTORY_CACHE_PREFIX + selected.id);
    } catch {
      // noop
    }
  }, [selected]);

  const reload = React.useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  React.useEffect(() => {
    const prev = ctrlRef.current;
    if (prev) prev.abort();

    if (!selected) {
      setHistory([]);
      setErrorMsg(null);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // Try cache first
        try {
          const raw = localStorage.getItem(HISTORY_CACHE_PREFIX + selected.id);
          if (raw) {
            const parsed = JSON.parse(raw) as HistoryCache;
            // Cache valid for 5 minutes
            if (Date.now() - parsed.ts < 5 * 60 * 1000) {
              setHistory(parsed.items || []);
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore cache errors
        }

        // Load from REST API
        const res: any = await apiFetch(
          `/api/v1/appointments/?client=${selected.id}&ordering=-appointmentAt`
        );

        if (ctrl.signal.aborted) return;

        const rows: any[] = res?.data?.results ?? res?.results ?? [];

        const hist: HistoryRow[] = rows
          .map(mapAppointmentToHistoryRow)
          .filter((r) => r["Дата и время"]);

        setHistory(hist);

        // Cache result
        try {
          const payload: HistoryCache = { ts: Date.now(), items: hist };
          localStorage.setItem(HISTORY_CACHE_PREFIX + selected.id, JSON.stringify(payload));
        } catch {
          // ignore
        }
      } catch (e: any) {
        if (ctrl.signal.aborted || e?.name === "AbortError") return;
        console.error("usePatientHistory error:", e);
        setErrorMsg(e?.message ?? String(e));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      if (ctrlRef.current === ctrl) ctrlRef.current.abort();
    };
  }, [selected, tick]);

  return {
    history,
    loading,
    errorMsg,
    invalidate,
    reload,
  };
}

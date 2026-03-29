import React from "react";
import type { HistoryRow } from "../../types/models";
import { roundDateTimeLocalToStep } from "../../utility/time";

export type VisitEditFormState = {
  open: boolean;
  setOpen: (v: boolean) => void;
  recordId: string | null;
  dateTime: string;
  setDateTime: (v: string) => void;
  doctor: string;
  setDoctor: (v: string) => void;
  service: string;
  setService: (v: string) => void;
  price: number | "";
  setPrice: (v: number | "") => void;
  submitting: boolean;
  startEdit: (row: HistoryRow) => void;
  submit: () => Promise<void>;
  reset: () => void;
};

type Options = { onSuccess?: () => void };

const toInputDateTime = (s: string): string => {
  if (!s) return "";
  const str = String(s).trim();
  const m1 = str.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:[ T])(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}T${m1[4]}:${m1[5]}:${m1[6] ?? "00"}`;
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T])(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}T${m2[4]}:${m2[5]}:${m2[6] ?? "00"}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return str;
  return str.replace(" ", "T");
};

export function useVisitEditForm(_opts?: Options): VisitEditFormState {
  const [open, setOpen] = React.useState(false);
  const [recordId, setRecordId] = React.useState<string | null>(null);
  const [dateTime, setDateTime] = React.useState("");
  const [doctor, setDoctor] = React.useState("");
  const [service, setService] = React.useState("");
  const [price, setPrice] = React.useState<number | "">("");

  const reset = React.useCallback(() => {
    setRecordId(null);
    setDateTime("");
    setDoctor("");
    setService("");
    setPrice("");
  }, []);

  const startEdit = React.useCallback((row: HistoryRow) => {
    try {
      setRecordId(String(row.ID));
      setDateTime(roundDateTimeLocalToStep(toInputDateTime(String(row["Дата и время"] || "")), 5));
      setDoctor(String(row["Доктор ФИО"] || ""));
      const svcId = row["Услуга ID"];
      const svcName = row["Услуга"];
      setService(String((svcId ?? svcName ?? "") || ""));
      const sum = typeof row["Итого, сом"] === "number" ? row["Итого, сом"] : row["Стоимость"];
      setPrice(typeof sum === "number" ? sum : "");
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const submit = React.useCallback(async () => {
    // Not implemented — use appointment edit via API instead
  }, []);

  return { open, setOpen, recordId, dateTime, setDateTime, doctor, setDoctor, service, setService, price, setPrice, submitting: false, startEdit, submit, reset };
}

import React from "react";
import { useNotification } from "@refinedev/core";
import type { Patient } from "../../types/models";
import { createPatientVisit } from "./visitApi";

export type VisitFormState = {
  open: boolean;
  setOpen: (v: boolean) => void;
  dateTime: string;
  setDateTime: (v: string) => void;
  doctor: string;
  setDoctor: (v: string) => void;
  service: string;
  setService: (v: string) => void;
  price: number | "";
  setPrice: (v: number | "") => void;
  submitting: boolean;
  submit: () => Promise<void>;
  reset: () => void;
};

type Options = { onSuccess?: () => void };

export function useVisitForm(selected: Patient | null, opts?: Options): VisitFormState {
  const { open: notify } = useNotification();
  const [open, setOpen] = React.useState(false);
  const [dateTime, setDateTime] = React.useState("");
  const [doctor, setDoctor] = React.useState("");
  const [service, setService] = React.useState("");
  const [price, setPrice] = React.useState<number | "">("");
  const [submitting, setSubmitting] = React.useState(false);

  const reset = React.useCallback(() => {
    setDateTime("");
    setDoctor("");
    setService("");
    setPrice("");
  }, []);

  const submit = React.useCallback(async () => {
    if (!selected?.id) {
      notify?.({ type: "error", message: "Сначала выберите клиента" });
      return;
    }
    if (!dateTime) {
      notify?.({ type: "error", message: "Укажите дату и время приёма" });
      return;
    }
    if (!service.trim()) {
      notify?.({ type: "error", message: "Укажите услугу" });
      return;
    }

    try {
      setSubmitting(true);
      await createPatientVisit({
        patientId: selected.id,
        dateTime,
        doctorInput: doctor,
        serviceInput: service,
      });
      notify?.({ type: "success", message: "Приём создан" });
      setOpen(false);
      reset();
      opts?.onSuccess?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось создать приём";
      notify?.({ type: "error", message: "Ошибка при создании приёма", description: message });
    } finally {
      setSubmitting(false);
    }
  }, [dateTime, doctor, notify, opts, reset, selected, service]);

  return { open, setOpen, dateTime, setDateTime, doctor, setDoctor, service, setService, price, setPrice, submitting, submit, reset };
}

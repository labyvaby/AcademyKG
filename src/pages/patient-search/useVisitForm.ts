import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      notify?.({ type: "error", message: t("patientSearch.selectClientFirst") });
      return;
    }
    if (!dateTime) {
      notify?.({ type: "error", message: t("patientSearch.specifyAppointmentDateTime") });
      return;
    }
    if (!service.trim()) {
      notify?.({ type: "error", message: t("patientSearch.specifyService") });
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
      notify?.({ type: "success", message: t("patientSearch.appointmentCreated") });
      setOpen(false);
      reset();
      opts?.onSuccess?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("patientSearch.createAppointmentError");
      notify?.({ type: "error", message: t("patientSearch.createAppointmentErrorTitle"), description: message });
    } finally {
      setSubmitting(false);
    }
  }, [dateTime, doctor, notify, opts, reset, selected, service, t]);

  return { open, setOpen, dateTime, setDateTime, doctor, setDoctor, service, setService, price, setPrice, submitting, submit, reset };
}

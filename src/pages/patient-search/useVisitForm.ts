import React from "react";
import type { Patient } from "../../types/models";

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

export function useVisitForm(_selected: Patient | null, _opts?: Options): VisitFormState {
  const [open, setOpen] = React.useState(false);
  const [dateTime, setDateTime] = React.useState("");
  const [doctor, setDoctor] = React.useState("");
  const [service, setService] = React.useState("");
  const [price, setPrice] = React.useState<number | "">("");

  const reset = React.useCallback(() => {
    setDateTime("");
    setDoctor("");
    setService("");
    setPrice("");
  }, []);

  const submit = React.useCallback(async () => {
    // Not implemented — use HomeAddAppointmentDrawer instead
  }, []);

  return { open, setOpen, dateTime, setDateTime, doctor, setDoctor, service, setService, price, setPrice, submitting: false, submit, reset };
}

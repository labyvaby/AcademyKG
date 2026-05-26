import React, { useState } from "react";
import AppAutocomplete from "../../../components/ui/AppAutocomplete";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import { CustomDateTimePicker } from "../../../components/ui";
import { useDictionaries } from "../../../hooks/useDictionaries";
import { useAvailableServices } from "../../../hooks/useAvailableServices";
import { createGroup } from "../api/group-appointments.api";
import type { AppointmentGroup } from "../model/types";

type PatientOption = { id: string; label: string; phone?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (group: AppointmentGroup) => void;
  initialDate?: string | null;
};

const CreateGroupAppointmentDrawer: React.FC<Props> = ({ open, onClose, onCreated, initialDate }) => {
  const { employees } = useDictionaries();
  const { services: availableServices } = useAvailableServices({ enabled: open });

  const [appointmentAt, setAppointmentAt] = useState<string>(
    initialDate ?? dayjs().format("YYYY-MM-DDTHH:mm"),
  );
  const [selectedDoctor, setSelectedDoctor] = useState<{ id: string; label: string } | null>(null);
  const [selectedService, setSelectedService] = useState<{ id: string; label: string; price: number } | null>(null);
  const [price, setPrice] = useState("");
  const [participants, setParticipants] = useState<PatientOption[]>([]);
  const [patientInput, setPatientInput] = useState<PatientOption | null>(null);
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setAppointmentAt(initialDate ?? dayjs().format("YYYY-MM-DDTHH:mm"));
      setSelectedDoctor(null);
      setSelectedService(null);
      setPrice("");
      setParticipants([]);
      setPatientInput(null);
      setError(null);
    }
  }, [open, initialDate]);

  React.useEffect(() => {
    if (selectedService?.price) {
      setPrice(String(selectedService.price));
    }
  }, [selectedService]);

  const doctorOptions = (employees ?? []).map((d: any) => ({
    id: String(d.id),
    label: d.full_name ?? d.fullName ?? d.name ?? String(d.id)
}));

  const serviceOptions = availableServices.map((s) => ({
    id: s.id,
    label: s.name,
    price: Number(s.price ?? 0)
}));

  const searchPatients = async (query: string) => {
    if (query.length < 2) return;
    setPatientLoading(true);
    try {
      const { apiFetch } = await import("../../../utility/apiClient");
      const res: any = await apiFetch(`/api/v1/clients/?search=${encodeURIComponent(query)}`);
      const data: any[] = res?.data?.results ?? res?.results ?? [];
      setPatientOptions(
        data.map((c) => ({
          id: String(c.id),
          label: c.fullName ?? c.full_name ?? c.fio ?? String(c.id),
          phone: c.phone ?? c.phoneNumber ?? c.phone_number ?? null
})),
      );
    } catch {
      setPatientOptions([]);
    } finally {
      setPatientLoading(false);
    }
  };

  const addParticipant = () => {
    if (!patientInput) return;
    if (participants.some((p) => p.id === patientInput.id)) return;
    setParticipants((prev) => [...prev, patientInput]);
    setPatientInput(null);
  };

  const removeParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = async () => {
    if (!selectedDoctor) { setError("Выберите тренера/сотрудника"); return; }
    if (!selectedService) { setError("Выберите услугу"); return; }
    if (participants.length === 0) { setError("Добавьте хотя бы одного участника"); return; }
    if (!price || Number(price) <= 0) { setError("Укажите стоимость"); return; }

    setError(null);
    setBusy(true);
    try {
      const group = await createGroup({
        appointmentAt,
        performerId: selectedDoctor.id,
        sellableItemId: selectedService.id,
        price: Number(price),
        patientIds: participants.map((p) => p.id),
        patientNames: participants.map((p) => p.label)
});
      // Patch names from selections since mock doesn't resolve them
      group.performerName = selectedDoctor.label;
      group.sellableItemName = selectedService.label;
      onCreated?.(group);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Ошибка при создании");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{ sx: { width: { xs: 340, sm: 480 }, maxWidth: "100vw", display: "flex", flexDirection: "column" } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1 }}>
        <Typography variant="h6">Групповой приём</Typography>
        <IconButton onClick={busy ? undefined : onClose}><CloseOutlined /></IconButton>
      </Box>
      <Divider />

      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        <Stack spacing={2.5}>
          {/* Date/time */}
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>Дата и время</Typography>
            <CustomDateTimePicker
              value={appointmentAt ? dayjs(appointmentAt) : null}
              onChange={(val) => setAppointmentAt(val ? val.format("YYYY-MM-DDTHH:mm") : "")}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </Stack>

          {/* Trainer/performer */}
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>Тренер / сотрудник</Typography>
            <AppAutocomplete
              options={doctorOptions}
              value={selectedDoctor}
              onChange={(_, v) => setSelectedDoctor(v)}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} size="small" placeholder="Выберите сотрудника" />}
            />
          </Stack>

          {/* Service */}
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>Услуга</Typography>
            <AppAutocomplete
              options={serviceOptions}
              value={selectedService}
              onChange={(_, v) => setSelectedService(v)}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} size="small" placeholder="Выберите услугу" />}
            />
          </Stack>

          {/* Price */}
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>Стоимость (за участника)</Typography>
            <TextField
              size="small"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              inputProps={{ inputMode: "numeric" }}
              placeholder="0"
              fullWidth
            />
          </Stack>

          {/* Participants */}
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>Участники</Typography>
            <Stack direction="row" spacing={1}>
              <AppAutocomplete
                sx={{ flex: 1 }}
                options={patientOptions}
                value={patientInput}
                onChange={(_, v) => setPatientInput(v)}
                getOptionLabel={(o) => `${o.label || "Нет ФИО"} — ${o.phone || "Нет телефона"}`}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    {`${option.label || "Нет ФИО"} — ${option.phone || "Нет телефона"}`}
                  </li>
                )}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                loading={patientLoading}
                onInputChange={(_, val) => searchPatients(val)}
                filterOptions={(x) => x}
                noOptionsText="Введите имя клиента"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Поиск клиента..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {patientLoading && <CircularProgress size={16} />}
                          {params.InputProps.endAdornment}
                        </>
                      )
}}
                  />
                )}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonAddOutlined />}
                onClick={addParticipant}
                disabled={!patientInput}
              >
                Добавить
              </Button>
            </Stack>

            {participants.length > 0 && (
              <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                {participants.map((p, idx) => {
                  const initials = p.label.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                  return (
                    <Box
                      key={p.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper"
}}
                    >
                      <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: "primary.main", flexShrink: 0 }}>
                        {initials}
                      </Avatar>
                      <Typography variant="body2" fontWeight={500} sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {p.label}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                        #{idx + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => removeParticipant(p.id)}
                        sx={{ ml: 0.5, color: "text.disabled", "&:hover": { color: "error.main" }, p: 0.25 }}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Stack>

          {error && (
            <Typography variant="body2" color="error">{error}</Typography>
          )}
        </Stack>
      </Box>

      <Divider />
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} disabled={busy}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={16} /><span>Создание…</span></Stack> : "Создать"}
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
};

export default CreateGroupAppointmentDrawer;

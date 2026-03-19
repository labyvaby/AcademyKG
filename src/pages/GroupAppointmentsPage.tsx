import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress as CP,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import dayjs from "dayjs";
import { PageHeader, DateNavigation } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  fetchGroups,
  addParticipantToGroup,
} from "../features/group-appointments/api/group-appointments.api";
import type { AppointmentGroup } from "../features/group-appointments/model/types";
import GroupAppointmentCard from "../features/group-appointments/ui/GroupAppointmentCard";
import { apiFetch } from "../utility/apiClient";
import type { PatientOption } from "./home/types";
import HomeAddAppointmentDrawer from "./home/components/HomeAddAppointmentDrawer";

const GroupAppointmentsPage: React.FC = () => {
  usePageTitle("Групповые приёмы");

  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [groups, setGroups] = useState<AppointmentGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Добавление участника в существующую группу
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null);
  const [addPatientInput, setAddPatientInput] = useState<PatientOption | null>(null);
  const [addPatientSearch, setAddPatientSearch] = useState("");
  const [addPatientResults, setAddPatientResults] = useState<PatientOption[]>([]);
  const [addPatientLoading, setAddPatientLoading] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGroups(date);
      setGroups(data);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // Поиск клиентов для добавления
  useEffect(() => {
    if (!addToGroupId || addPatientSearch.length < 1) return;
    const t = setTimeout(async () => {
      setAddPatientLoading(true);
      try {
        const res: any = await apiFetch(`/api/v1/clients/?search=${encodeURIComponent(addPatientSearch)}&page_size=30`);
        const data: any[] = res?.data?.results ?? res?.results ?? [];
        setAddPatientResults(data.map((r: any) => {
          const fio = r.fullName ?? r.full_name ?? "";
          const phone = r.phone ?? r.contactPhone ?? "";
          return { id: String(r.id ?? ""), fio, phone, "ФИО клиента": fio, "Телефон": phone, label: `${fio} — ${phone}` };
        }).filter((p: any) => p.id));
      } catch { setAddPatientResults([]); }
      finally { setAddPatientLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [addPatientSearch, addToGroupId]);

  const handleGroupUpdated = (updated: AppointmentGroup) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  const handleCreated = (group: AppointmentGroup) => {
    setGroups((prev) => [...prev, group].sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt)));
  };

  const handleConfirmAddParticipant = async () => {
    if (!addToGroupId || !addPatientInput) return;
    setAddBusy(true);
    try {
      const updatedGroup = await addParticipantToGroup(addToGroupId, {
        patientId: addPatientInput.id,
        patientName: addPatientInput.fio ?? addPatientInput.label ?? "",
      });
      handleGroupUpdated(updatedGroup);
      setAddToGroupId(null);
      setAddPatientInput(null);
      setAddPatientSearch("");
    } catch (e: any) {
      const code = e?.code ?? e?.detail?.code ?? "";
      if (code === "participant_limit_reached") {
        // обновим группу чтобы показать актуальный лимит и закроем диалог
        load();
        setAddToGroupId(null);
      }
    } finally {
      setAddBusy(false);
    }
  };

  const addingGroup = groups.find(g => g.id === addToGroupId);
  const addingGroupIsFull = addingGroup
    ? addingGroup.maxParticipants != null && addingGroup.participants.length >= addingGroup.maxParticipants
    : false;

  return (
    <Box
      sx={(theme) => ({
        height: {
          xs: `calc(100dvh - ${theme.appLayout.viewportOffset.home.mobileOffset}px)`,
          md: `calc(100dvh - ${theme.appLayout.viewportOffset.home.desktopOffset}px)`,
        },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      })}
    >
      <PageHeader
        title="Групповые приёмы"
        showTitle={false}
        dateNavigation={<DateNavigation date={date} setDate={setDate} />}
        actions={
          <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={() => setCreateOpen(true)}>
            Добавить занятие
          </Button>
        }
      />

      <Box sx={(theme) => ({ flex: 1, overflowY: "auto", px: theme.appLayout.page.paddingX, py: 2 })}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: 200 }}>
            <CircularProgress />
          </Stack>
        ) : groups.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: 200 }}>
            <GroupsOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
            <Typography color="text.secondary">Нет групповых занятий на этот день</Typography>
            <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setCreateOpen(true)}>
              Добавить занятие
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {groups.map((group) => (
              <GroupAppointmentCard
                key={group.id}
                group={group}
                onGroupUpdated={handleGroupUpdated}
                onAddParticipant={(id) => {
                  setAddToGroupId(id);
                  setAddPatientInput(null);
                  setAddPatientSearch("");
                  setAddPatientResults([]);
                }}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Форма создания — через HomeAddAppointmentDrawer в групповом режиме */}
      <HomeAddAppointmentDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { load(); setCreateOpen(false); }}
        initialDate={date + "T09:00"}
      />

      {/* Диалог добавления участника в существующую группу */}
      <Dialog open={Boolean(addToGroupId)} onClose={() => setAddToGroupId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Добавить клиента
          {addingGroup && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {addingGroup.sellableItemName} — {dayjs(addingGroup.appointmentAt).format("HH:mm")}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {addingGroupIsFull ? (
            <Typography variant="body2" color="text.secondary">
              Достигнут максимум участников ({addingGroup?.maxParticipants}) для этой услуги. Добавление новых клиентов недоступно.
            </Typography>
          ) : (
            <Autocomplete
              options={addPatientResults}
              value={addPatientInput}
              onChange={(_, v) => setAddPatientInput(v)}
              onInputChange={(_, val) => setAddPatientSearch(val)}
              getOptionLabel={(o: PatientOption) => {
                const fio = o["ФИО клиента"] ?? o.fio ?? "";
                const phone = o["Телефон"] ?? o.phone ?? "";
                return `${fio} — ${phone}`;
              }}
              filterOptions={(x) => x}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              loading={addPatientLoading}
              noOptionsText="Введите имя клиента"
              renderOption={(props, option) => {
                const fio = option["ФИО клиента"] ?? option.fio ?? "";
                const phone = option["Телефон"] ?? option.phone ?? "";
                return <li {...props} key={option.id}>{fio} — {phone}</li>;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  autoFocus
                  label="Поиск клиента"
                  size="small"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: <>{addPatientLoading && <CP size={14} />}{params.InputProps.endAdornment}</>,
                  }}
                />
              )}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddToGroupId(null)} disabled={addBusy}>
            {addingGroupIsFull ? "Закрыть" : "Отмена"}
          </Button>
          {!addingGroupIsFull && (
            <Button
              variant="contained"
              disabled={!addPatientInput || addBusy}
              onClick={handleConfirmAddParticipant}
              startIcon={addBusy ? <CP size={16} color="inherit" /> : undefined}
            >
              {addBusy ? "Добавление..." : "Добавить"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupAppointmentsPage;

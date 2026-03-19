import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  Stack,
  Typography,
  TextField,
  CircularProgress,
  Autocomplete,
  IconButton,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import dayjs from "dayjs";
import type { AppointmentGroup, GroupParticipant } from "../../../features/group-appointments/model/types";
import { addParticipantToGroup } from "../../../features/group-appointments/api/group-appointments.api";
import ParticipantRow from "../../../features/group-appointments/ui/ParticipantRow";
import { updateParticipantStatus, payParticipant } from "../../../features/group-appointments/api/group-appointments.api";
import type { GroupAppointmentStatus } from "../../../features/group-appointments/model/types";
import { apiFetch } from "../../../utility/apiClient";
import type { PatientOption } from "../types";
import type { Appointment } from "../types";
import { PaymentSidebar } from "./PaymentSidebar";
import PatientQuickViewDrawer from "../../../components/patients/PatientQuickViewDrawer";
import DoctorQuickViewDrawer from "../../../components/employees/DoctorQuickViewDrawer";

type Props = {
  group: AppointmentGroup;
  onGroupUpdated: (updated: AppointmentGroup) => void;
  onClose: () => void;
};

/** Converts a group participant into a minimal Appointment for PaymentSidebar */
function participantToAppointment(p: GroupParticipant, group: AppointmentGroup): Appointment {
  return {
    id: p.id,
    appointment_at: group.appointmentAt,
    formatted_date: dayjs(group.appointmentAt).format("HH:mm DD.MM.YYYY"),
    doctor_name: group.performerName,
    doctor_id: group.performerId,
    patient_name: p.patientName,
    patient_id: p.patientId,
    service_names: group.sellableItemName,
    status: p.status,
    is_night: false,
    total_cost: group.price,
    total_amount: group.price,
    paid_cash: p.paidCash,
    paid_card: p.paidCard,
    paid_balance: p.paidBalance,
    paid_bonuses: 0,
    discount: 0,
    debt: p.debt,
    performer_ids: [group.performerId],
  };
}

const GroupAppointmentDetailsCard: React.FC<Props> = ({ group, onGroupUpdated, onClose }) => {
  const isFull = group.maxParticipants != null && group.participants.length >= group.maxParticipants;
  const totalDebt = group.participants.reduce((s, p) => s + p.debt, 0);
  const paidCount = group.participants.filter((p) => p.debt === 0).length;

  // Add participant dialog
  const [addOpen, setAddOpen] = React.useState(false);
  const [addPatientInput, setAddPatientInput] = React.useState<PatientOption | null>(null);
  const [addPatientSearch, setAddPatientSearch] = React.useState("");
  const [addPatientResults, setAddPatientResults] = React.useState<PatientOption[]>([]);
  const [addPatientLoading, setAddPatientLoading] = React.useState(false);
  const [addBusy, setAddBusy] = React.useState(false);

  // Payment sidebar
  const [paymentParticipant, setPaymentParticipant] = React.useState<GroupParticipant | null>(null);

  // Quick view drawers
  const [clientViewId, setClientViewId] = React.useState<string | null>(null);
  const [doctorViewId, setDoctorViewId] = React.useState<string | null>(null);

  // Load clients on drawer open (empty query) and on search input change
  React.useEffect(() => {
    if (!addOpen) return;
    const t = setTimeout(async () => {
      setAddPatientLoading(true);
      try {
        const url = addPatientSearch
          ? `/api/v1/clients/?search=${encodeURIComponent(addPatientSearch)}&page_size=30`
          : `/api/v1/clients/?page_size=30&ordering=fullName`;
        const res: any = await apiFetch(url);
        const data: any[] = res?.data?.results ?? res?.results ?? [];
        setAddPatientResults(data.map((r: any) => {
          const fio = r.fullName ?? r.full_name ?? "";
          const phone = r.phone ?? r.contactPhone ?? "";
          return { id: String(r.id ?? ""), fio, phone, "ФИО клиента": fio, "Телефон": phone, label: `${fio} — ${phone}` };
        }).filter((p: any) => p.id));
      } catch { setAddPatientResults([]); }
      finally { setAddPatientLoading(false); }
    }, addPatientSearch ? 350 : 0);
    return () => clearTimeout(t);
  }, [addPatientSearch, addOpen]);

  const handleAddParticipant = async () => {
    if (!addPatientInput) return;
    setAddBusy(true);
    try {
      const updated = await addParticipantToGroup(group.id, {
        patientId: addPatientInput.id,
        patientName: addPatientInput.fio ?? addPatientInput.label ?? "",
      });
      onGroupUpdated(updated);
      setAddOpen(false);
      setAddPatientInput(null);
      setAddPatientSearch("");
    } catch (e: any) {
      const code = e?.code ?? e?.detail?.code ?? "";
      if (code === "participant_limit_reached") setAddOpen(false);
    } finally {
      setAddBusy(false);
    }
  };

  const handleStatusChange = async (participantId: string, status: GroupAppointmentStatus) => {
    await updateParticipantStatus(group.id, participantId, status);
    onGroupUpdated({
      ...group,
      participants: group.participants.map((p) => p.id === participantId ? { ...p, status } : p),
    });
  };

  const handlePay = async (participantId: string, payment: { paidCash?: number; paidCard?: number; paidBalance?: number }) => {
    const updated = await payParticipant(group.id, participantId, payment);
    onGroupUpdated({
      ...group,
      participants: group.participants.map((p) => p.id === participantId ? updated : p),
    });
    setPaymentParticipant(null);
  };

  // Sync paymentParticipant with latest group data
  const paymentAppointment = React.useMemo(() => {
    if (!paymentParticipant) return null;
    const latest = group.participants.find(p => p.id === paymentParticipant.id) ?? paymentParticipant;
    return participantToAppointment(latest, group);
  }, [paymentParticipant, group]);

  return (
    <>
      <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <Box sx={{ px: 3, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupsOutlined color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={600}>Групповое занятие</Typography>
            {isFull && <Chip label="Группа полная" size="small" color="error" />}
          </Stack>
        </Box>

        <CardContent sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
          <Stack spacing={2.5}>
            {/* Мета */}
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CalendarMonthOutlined fontSize="small" sx={{ color: "primary.main" }} />
                <Typography variant="h6" fontWeight={700}>
                  {dayjs(group.appointmentAt).format("HH:mm DD.MM.YYYY")}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ cursor: "pointer", "&:hover span": { color: "primary.main", textDecoration: "underline" } }}
                onClick={() => setDoctorViewId(group.performerId)}
              >
                <b>Тренер:</b>{" "}
                <span style={{ color: "inherit" }}>{group.performerName}</span>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <b>Занятие:</b> {group.sellableItemName}
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Chip
                  label={`${paidCount}/${group.participants.length} оплачено`}
                  size="small"
                  color={paidCount === group.participants.length && group.participants.length > 0 ? "success" : "warning"}
                />
                {group.maxParticipants != null && (
                  <Typography variant="caption" color="text.secondary">
                    {group.participants.length}/{group.maxParticipants} уч.
                  </Typography>
                )}
                {totalDebt > 0 && (
                  <Typography variant="caption" color="error.main" fontWeight={600}>
                    Долг: {totalDebt.toLocaleString()} с
                  </Typography>
                )}
              </Stack>
            </Stack>

            <Divider />

            {/* Участники */}
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Участники ({group.participants.length})
                </Typography>
                {!isFull && (
                  <Button
                    size="small"
                    startIcon={<PersonAddOutlined />}
                    onClick={() => setAddOpen(true)}
                  >
                    Добавить
                  </Button>
                )}
              </Stack>

              {group.participants.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Нет участников</Typography>
              ) : (
                <Stack spacing={1}>
                  {group.participants.map((p) => (
                    <ParticipantRow
                      key={p.id}
                      participant={p}
                      onStatusChange={(status) => handleStatusChange(p.id, status)}
                      onPayClick={() => setPaymentParticipant(p)}
                      onClientClick={() => setClientViewId(p.patientId)}
                    />
                  ))}
                </Stack>
              )}

              {isFull && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Достигнут лимит участников ({group.maxParticipants})
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>

        {/* Боковая панель добавления участника */}
        <Drawer
          anchor="right"
          open={addOpen}
          onClose={() => { setAddOpen(false); setAddPatientInput(null); setAddPatientSearch(""); }}
          transitionDuration={{ enter: 280, exit: 220 }}
          PaperProps={{
            sx: {
              width: { xs: 340, sm: 420 },
              maxWidth: "100vw",
              p: 0,
              transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1) !important",
            }
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6">Добавить клиента</Typography>
            <IconButton size="small" onClick={() => { setAddOpen(false); setAddPatientInput(null); setAddPatientSearch(""); }}>
              <CloseOutlined />
            </IconButton>
          </Box>

          <Box sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            <Autocomplete
              options={addPatientResults}
              value={addPatientInput}
              onChange={(_, v) => setAddPatientInput(v)}
              onInputChange={(_, val) => setAddPatientSearch(val)}
              getOptionLabel={(o: PatientOption) => `${o["ФИО клиента"] ?? o.fio ?? ""} — ${o["Телефон"] ?? o.phone ?? ""}`}
              filterOptions={(x) => x}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              loading={addPatientLoading}
              noOptionsText="Нет клиентов"
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option["ФИО клиента"] ?? option.fio ?? ""} — {option["Телефон"] ?? option.phone ?? ""}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  autoFocus
                  label="Поиск клиента"
                  size="small"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: <>{addPatientLoading && <CircularProgress size={14} />}{params.InputProps.endAdornment}</>,
                  }}
                />
              )}
            />
          </Box>

          <Box sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => { setAddOpen(false); setAddPatientInput(null); setAddPatientSearch(""); }} disabled={addBusy}>
                Отмена
              </Button>
              <Button
                variant="contained"
                disabled={!addPatientInput || addBusy}
                onClick={handleAddParticipant}
                startIcon={addBusy ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {addBusy ? "Добавление..." : "Добавить"}
              </Button>
            </Stack>
          </Box>
        </Drawer>
      </Card>

      {/* Payment sidebar for participant */}
      <PaymentSidebar
        open={!!paymentParticipant}
        onClose={() => setPaymentParticipant(null)}
        appointment={paymentAppointment}
        onSaved={() => {
          // PaymentSidebar already saved via PATCH — just refetch the group to get updated state
          setPaymentParticipant(null);
          // Trigger group refresh by re-fetching from API
          import("../../../features/group-appointments/api/group-appointments.api").then(({ fetchGroups }) => {
            const date = paymentAppointment?.appointment_at?.split("T")[0] ?? "";
            if (date) fetchGroups(date).then(groups => {
              const updated = groups.find(g => g.id === group.id);
              if (updated) onGroupUpdated(updated);
            });
          });
        }}
      />

      {/* Client quick view */}
      <PatientQuickViewDrawer
        open={!!clientViewId}
        patientId={clientViewId ?? ""}
        onClose={() => setClientViewId(null)}
      />

      {/* Doctor quick view */}
      <DoctorQuickViewDrawer
        open={!!doctorViewId}
        doctorId={doctorViewId ?? ""}
        onClose={() => setDoctorViewId(null)}
      />
    </>
  );
};

export default GroupAppointmentDetailsCard;

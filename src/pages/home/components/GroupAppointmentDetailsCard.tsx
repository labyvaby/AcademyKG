import React from "react";
import { CustomDateTimePicker } from "../../../components/ui";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  Stack,
  Typography,
  TextField,
  CircularProgress,
  Autocomplete,
  IconButton,
} from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import NotificationsPausedOutlined from "@mui/icons-material/NotificationsPausedOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import dayjs from "dayjs";
import { dayjsBishkek } from "../../../utility/dayjsBishkek";
import type { AppointmentGroup, GroupParticipant } from "../../../features/group-appointments/model/types";
import { addParticipantToGroup, updateParticipantStatus, payParticipant, deleteGroup, updateGroup } from "../../../features/group-appointments/api/group-appointments.api";
import ParticipantRow from "../../../features/group-appointments/ui/ParticipantRow";
import type { GroupAppointmentStatus } from "../../../features/group-appointments/model/types";
import { apiFetch } from "../../../utility/apiClient";
import { usePermissions } from "../../../hooks/usePermissions";
import { useNotification } from "@refinedev/core";
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
    formatted_date: dayjsBishkek(group.appointmentAt).format("HH:mm DD.MM.YYYY"),
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
  const { isSuperAdmin } = usePermissions();
  const { open: notify } = useNotification();

  // Delete confirm dialog
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Edit drawer
  const [editOpen, setEditOpen] = React.useState(false);
  const [editDateTime, setEditDateTime] = React.useState("");
  const [editPerformerId, setEditPerformerId] = React.useState("");
  const [editServiceId, setEditServiceId] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editEmployees, setEditEmployees] = React.useState<{ id: string; name: string }[]>([]);
  const [editServices, setEditServices] = React.useState<{ id: string; name: string }[]>([]);
  const [editLoading, setEditLoading] = React.useState(false);

  // Trainer not came
  const [notCameBusy, setNotCameBusy] = React.useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteGroup(group.id);
      setDeleteOpen(false);
      onClose();
    } catch (e: any) {
      const detail = e?.errors?.[0]?.detail ?? e?.message ?? "Ошибка при удалении";
      notify?.({ type: "error", message: detail });
    } finally { setDeleting(false); }
  };

  const openEdit = async () => {
    setEditDateTime(group.appointmentAt ? group.appointmentAt.slice(0, 16) : "");
    setEditPerformerId(group.performerId);
    setEditServiceId(group.sellableItemId);
    setEditOpen(true);
    if (editEmployees.length === 0) {
      setEditLoading(true);
      try {
        const [rolesRes, svcRes]: [any, any] = await Promise.all([
          apiFetch("/api/v1/roles/"),
          apiFetch("/api/v1/sellable-items/?type=service&isActive=true&pageSize=200"),
        ]);
        const rolesArr: any[] = rolesRes?.data ?? rolesRes?.results ?? [];
        const specialistRole = rolesArr.find((r: any) => r.name === "specialist");
        const roleParam = specialistRole?.id ? `?status=active&role=${specialistRole.id}&pageSize=200` : "?status=active&pageSize=200";
        const empRes: any = await apiFetch(`/api/v1/employees/${roleParam}`);
        const svcs: any[] = svcRes?.data?.results ?? svcRes?.results ?? [];
        const emps: any[] = empRes?.data?.results ?? empRes?.results ?? [];
        const specialists = emps.filter((e: any) => {
          const r = (e.role?.name ?? e.roleName ?? "").toLowerCase();
          return r === "specialist";
        });
        setEditEmployees((specialists.length > 0 ? specialists : emps).map((e: any) => ({ id: String(e.id), name: e.fullName ?? e.full_name ?? e.id })));
        setEditServices(svcs.map((s: any) => ({ id: String(s.id), name: s.displayName ?? s.display_name ?? s.name ?? s.id })));
      } catch { /* ignore */ }
      finally { setEditLoading(false); }
    }
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    try {
      const updated = await updateGroup(group.id, {
        appointmentAt: editDateTime ? new Date(editDateTime).toISOString() : undefined,
        performerId: editPerformerId || undefined,
        sellableItemId: editServiceId || undefined,
      });
      onGroupUpdated(updated);
      setEditOpen(false);
    } catch { /* ignore */ }
    finally { setEditSaving(false); }
  };

  const allNotCame = group.participants.length > 0 &&
    group.participants.every((p) => p.status === "not_came" || p.status === "no_show" || p.status === "patient_not_came");

  const handleClientNotCame = async () => {
    setNotCameBusy(true);
    try {
      await Promise.all(
        group.participants.map((p) =>
          updateParticipantStatus(group.id, p.id, "not_came" as GroupAppointmentStatus)
        )
      );
      const updatedParticipants = group.participants.map((p) => ({ ...p, status: "not_came" as GroupAppointmentStatus }));
      const optimistic = { ...group, participants: updatedParticipants };
      onGroupUpdated(optimistic);
      if (updatedParticipants.length > 0) {
        // Открываем сайдбар оплаты для первого участника
        setPaymentParticipant(updatedParticipants[0]);
      }
    } catch { /* ignore */ }
    finally { setNotCameBusy(false); }
  };

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
          ? `/api/v1/clients/?search=${encodeURIComponent(addPatientSearch)}&pageSize=30`
          : `/api/v1/clients/?pageSize=30&ordering=fullName`;
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

  const paymentAppointment = React.useMemo(() => {
    if (!paymentParticipant) return null;
    // Prefer latest from group props, fallback to stored participant
    const latest = group.participants.find(p => p.id === paymentParticipant.id) ?? paymentParticipant;
    return participantToAppointment(latest, group);
  }, [paymentParticipant, group]);

  return (
    <>
      <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <GroupsOutlined color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={600}>Групповое занятие</Typography>
              {isFull && <Chip label="Группа полная" size="small" color="error" />}
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={notCameBusy ? <CircularProgress size={14} color="inherit" /> : <NotificationsPausedOutlined fontSize="small" />}
                disabled={notCameBusy || allNotCame}
                onClick={handleClientNotCame}
                sx={{ whiteSpace: "nowrap", fontSize: 12 }}
              >
                Клиент не пришел
              </Button>
              <IconButton size="small" onClick={openEdit}>
                <EditOutlined fontSize="small" />
              </IconButton>
              {isSuperAdmin() && (
                <IconButton size="small" color="error" onClick={() => setDeleteOpen(true)}>
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Box>

        <CardContent sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
          <Stack spacing={2.5}>
            {/* Мета */}
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CalendarMonthOutlined fontSize="small" sx={{ color: "primary.main" }} />
                <Typography variant="h6" fontWeight={700}>
                  {dayjsBishkek(group.appointmentAt).format("HH:mm DD.MM.YYYY")}
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
                  {group.participants.map((p, idx) => (
                    <ParticipantRow
                      key={p.id}
                      participant={p}
                      index={idx}
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

      {/* Edit drawer */}
      <Drawer
        anchor="right"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 400 }, display: "flex", flexDirection: "column" } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6">Редактировать занятие</Typography>
          <IconButton size="small" onClick={() => setEditOpen(false)}><CloseOutlined /></IconButton>
        </Box>
        <Stack spacing={2.5} sx={{ p: 2, flex: 1, overflowY: "auto" }}>
          {editLoading ? (
            <Stack alignItems="center" py={4}><CircularProgress /></Stack>
          ) : (
            <>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>Дата и время</Typography>
                <CustomDateTimePicker
                  value={editDateTime ? dayjs(editDateTime) : null}
                  onChange={(val) => setEditDateTime(val ? val.format("YYYY-MM-DDTHH:mm") : "")}
                  minutesStep={5}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>Тренер</Typography>
                <Autocomplete
                  options={editEmployees}
                  value={editEmployees.find(e => e.id === editPerformerId) ?? null}
                  onChange={(_, v) => setEditPerformerId(v?.id ?? "")}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder="Выберите тренера" fullWidth />
                  )}
                />
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>Услуга / Занятие</Typography>
                <Autocomplete
                  options={editServices}
                  value={editServices.find(s => s.id === editServiceId) ?? null}
                  onChange={(_, v) => setEditServiceId(v?.id ?? "")}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder="Выберите занятие" fullWidth />
                  )}
                />
              </Stack>
            </>
          )}
        </Stack>
        <Box sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setEditOpen(false)}>Отмена</Button>
            <Button
              variant="contained"
              disabled={editSaving || editLoading || !editDateTime}
              startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
              onClick={handleEditSave}
            >
              {editSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </Stack>
        </Box>
      </Drawer>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить занятие?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Групповое занятие «{group.sellableItemName}» от {dayjsBishkek(group.appointmentAt).format("DD.MM.YYYY HH:mm")} будет удалено безвозвратно.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={handleDelete}
          >
            {deleting ? "Удаление..." : "Удалить"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GroupAppointmentDetailsCard;

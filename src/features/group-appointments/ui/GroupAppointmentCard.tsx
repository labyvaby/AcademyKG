import React, { useState } from "react";
import {
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
  Button,
  Collapse,
} from "@mui/material";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlined from "@mui/icons-material/ExpandLessOutlined";
import dayjs from "dayjs";
import type { AppointmentGroup, GroupAppointmentStatus, GroupParticipant } from "../model/types";
import { updateParticipantStatus, payParticipant, markAttendance } from "../api/group-appointments.api";
import ParticipantRow from "./ParticipantRow";
import type { Appointment } from "../../../pages/home/types";
import { PaymentSidebar } from "../../../pages/home/components/PaymentSidebar";

type Props = {
  group: AppointmentGroup;
  onGroupUpdated: (updated: AppointmentGroup) => void;
  onAddParticipant?: (groupId: string) => void;
};

function participantToAppointment(p: GroupParticipant, group: AppointmentGroup): Appointment {
  return {
    id: p.id,
    appointment_at: group.appointmentAt,
    formatted_date: dayjs.tz(group.appointmentAt, "Asia/Bishkek").format("HH:mm DD.MM.YYYY"),
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

const GroupAppointmentCard: React.FC<Props> = ({ group, onGroupUpdated, onAddParticipant }) => {
  const [expanded, setExpanded] = useState(false);
  const [paymentParticipant, setPaymentParticipant] = useState<GroupParticipant | null>(null);

  const paidCount = group.participants.filter((p) => p.status === "paid" || p.debt === 0).length;
  const totalDebt = group.participants.reduce((sum, p) => sum + p.debt, 0);
  const isFull = group.maxParticipants != null && group.participants.length >= group.maxParticipants;

  const handleStatusChange = async (participantId: string, status: GroupAppointmentStatus) => {
    await updateParticipantStatus(group.id, participantId, status);
    onGroupUpdated({
      ...group,
      participants: group.participants.map((p) =>
        p.id === participantId ? { ...p, status } : p,
      ),
    });
  };

  const handlePay = async (participantId: string, payment: { paidCash?: number; paidCard?: number; paidBalance?: number }) => {
    const updated = await payParticipant(group.id, participantId, payment);
    onGroupUpdated({
      ...group,
      participants: group.participants.map((p) => (p.id === participantId ? updated : p)),
    });
    setPaymentParticipant(null);
  };

  const handleAttendanceToggle = async (participantId: string, attended: boolean) => {
    await markAttendance(participantId, attended);
    onGroupUpdated({
      ...group,
      participants: group.participants.map((p) => p.id === participantId ? { ...p, attended } : p),
    });
  };

  return (
  <>
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      {/* Card header */}
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{ px: 2, py: 1.5, cursor: "pointer", bgcolor: "background.paper", "&:hover": { bgcolor: "action.hover" } }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Тренер — наверху */}
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
              <PersonOutlined sx={{ fontSize: 14, color: "primary.main" }} />
              <Typography variant="caption" color="primary.main" fontWeight={600} noWrap>
                {group.performerName}
              </Typography>
            </Stack>

            {/* Название занятия */}
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {group.sellableItemName}
            </Typography>

            {/* Мета-инфо */}
            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }} flexWrap="wrap">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <AccessTimeOutlined sx={{ fontSize: 13, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">
                  {dayjs.tz(group.appointmentAt, "Asia/Bishkek").format("HH:mm")}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PeopleOutlined sx={{ fontSize: 13, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">
                  {group.participants.length}
                  {group.maxParticipants != null ? `/${group.maxParticipants}` : ""} уч.
                </Typography>
              </Stack>
              {isFull && (
                <Chip label="Группа полная" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
              )}
              {group.participants.length > 0 && group.participants.every((p) =>
                p.status === "not_came" || p.status === "no_show" || p.status === "patient_not_came"
              ) && (
                <Chip label="Клиент не пришел" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
              )}
            </Stack>
          </Box>

          <Stack alignItems="flex-end" spacing={0.5}>
            <Chip
              label={`${paidCount}/${group.participants.length} оплачено`}
              size="small"
              color={paidCount === group.participants.length ? "success" : "warning"}
              sx={{ height: 22, fontSize: 11 }}
            />
            {totalDebt > 0 && (
              <Typography variant="caption" color="error.main" fontWeight={600}>
                Долг: {totalDebt.toLocaleString()} с
              </Typography>
            )}
          </Stack>

          {expanded ? <ExpandLessOutlined sx={{ fontSize: 20, color: "text.secondary", mt: 0.5 }} /> : <ExpandMoreOutlined sx={{ fontSize: 20, color: "text.secondary", mt: 0.5 }} />}
        </Stack>
      </Box>

      {/* Participants list */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          <Stack spacing={1}>
            {group.participants.map((participant, idx) => (
              <ParticipantRow
                key={participant.id}
                participant={participant}
                index={idx}
                onStatusChange={(status) => handleStatusChange(participant.id, status)}
                onPayClick={() => setPaymentParticipant(participant)}
                onAttendanceToggle={(attended) => handleAttendanceToggle(participant.id, attended)}
              />
            ))}
          </Stack>

          {/* Добавить участника — только если группа не полная */}
          {!isFull && onAddParticipant && (
            <Button
              size="small"
              startIcon={<PersonAddOutlined />}
              onClick={(e) => { e.stopPropagation(); onAddParticipant(group.id); }}
              sx={{ mt: 1.5 }}
            >
              Добавить участника
            </Button>
          )}
          {isFull && (
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
              Достигнут лимит участников ({group.maxParticipants})
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>

    {/* Payment sidebar for participant */}
    <PaymentSidebar
      open={!!paymentParticipant}
      onClose={() => setPaymentParticipant(null)}
      appointment={paymentParticipant ? participantToAppointment(paymentParticipant, group) : null}
      onSaved={() => {
        if (paymentParticipant) handlePay(paymentParticipant.id, {});
      }}
    />
  </>
  );
};

export default GroupAppointmentCard;

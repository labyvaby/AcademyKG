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
import type { AppointmentGroup, GroupAppointmentStatus } from "../model/types";
import { updateParticipantStatus, payParticipant } from "../api/group-appointments.api";
import ParticipantRow from "./ParticipantRow";

type Props = {
  group: AppointmentGroup;
  onGroupUpdated: (updated: AppointmentGroup) => void;
  onAddParticipant?: (groupId: string) => void;
};

const GroupAppointmentCard: React.FC<Props> = ({ group, onGroupUpdated, onAddParticipant }) => {
  const [expanded, setExpanded] = useState(false);

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
  };

  return (
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
                  {dayjs(group.appointmentAt).format("HH:mm")}
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
            {group.participants.map((participant) => (
              <ParticipantRow
                key={participant.id}
                participant={participant}
                onStatusChange={(status) => handleStatusChange(participant.id, status)}
                onPay={(payment) => handlePay(participant.id, payment)}
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
  );
};

export default GroupAppointmentCard;

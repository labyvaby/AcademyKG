import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlined from "@mui/icons-material/ExpandLessOutlined";
import dayjs from "dayjs";
import type { AppointmentGroup, GroupAppointmentStatus } from "../model/types";
import { updateParticipantStatus, payParticipant } from "../api/group-appointments.api";
import ParticipantRow from "./ParticipantRow";

type Props = {
  group: AppointmentGroup;
  onGroupUpdated: (updated: AppointmentGroup) => void;
};

const GroupAppointmentCard: React.FC<Props> = ({ group, onGroupUpdated }) => {
  const [expanded, setExpanded] = useState(false);

  const paidCount = group.participants.filter((p) => p.status === "paid" || p.debt === 0).length;
  const totalDebt = group.participants.reduce((sum, p) => sum + p.debt, 0);

  const handleStatusChange = async (participantId: string, status: GroupAppointmentStatus) => {
    await updateParticipantStatus(group.id, participantId, status);
    onGroupUpdated({
      ...group,
      participants: group.participants.map((p) =>
        p.id === participantId ? { ...p, status } : p,
      ),
    });
  };

  const handlePay = async (
    participantId: string,
    payment: { paidCash?: number; paidCard?: number },
  ) => {
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
        sx={{
          px: 2,
          py: 1.5,
          cursor: "pointer",
          bgcolor: "background.paper",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {group.sellableItemName}
            </Typography>

            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }} flexWrap="wrap">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <AccessTimeOutlined sx={{ fontSize: 14, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">
                  {dayjs(group.appointmentAt).format("HH:mm")}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PersonOutlined sx={{ fontSize: 14, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {group.performerName}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PeopleOutlined sx={{ fontSize: 14, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">
                  {group.participants.length} уч.
                </Typography>
              </Stack>
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

          <IconButton size="small" sx={{ mt: -0.5 }}>
            {expanded ? <ExpandLessOutlined fontSize="small" /> : <ExpandMoreOutlined fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>

      {/* Participants list */}
      {expanded && (
        <>
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
          </Box>
        </>
      )}
    </Paper>
  );
};

export default GroupAppointmentCard;

import React from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import type { GroupParticipant, GroupAppointmentStatus } from "../model/types";
import { GROUP_STATUS_LABELS, GROUP_STATUS_COLOR } from "../model/types";

type Props = {
  participant: GroupParticipant;
  onStatusChange: (status: GroupAppointmentStatus) => Promise<void>;
  onPayClick: () => void;
  onClientClick?: () => void;
};

const ParticipantRow: React.FC<Props> = ({ participant: p, onPayClick, onClientClick }) => {
  const initials = p.patientName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1.5, py: 1 }}>
        <Avatar
          sx={{ width: 32, height: 32, fontSize: 12, bgcolor: "primary.light", flexShrink: 0, cursor: onClientClick ? "pointer" : "default" }}
          src={p.patientPhoto ?? undefined}
          onClick={onClientClick}
        >
          {initials}
        </Avatar>

        {/* Name + debt */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ cursor: onClientClick ? "pointer" : "default", "&:hover": onClientClick ? { color: "primary.main" } : {} }}
            onClick={onClientClick}
          >
            {p.patientName}
          </Typography>
          {p.debt > 0
            ? <Typography variant="caption" color="error.main">Долг: {p.debt.toLocaleString()} с</Typography>
            : <Typography variant="caption" color="success.main">Оплачено</Typography>
          }
        </Box>

        {/* Status chip (read-only) */}
        <Chip
          label={GROUP_STATUS_LABELS[p.status as GroupAppointmentStatus] ?? p.status}
          color={GROUP_STATUS_COLOR[p.status as GroupAppointmentStatus] ?? "default"}
          size="small"
          sx={{ height: 22, fontSize: 11 }}
        />

        {/* Pay button */}
        <Button
          size="small"
          variant={p.debt <= 0 ? "text" : "outlined"}
          color={p.debt <= 0 ? "success" : "primary"}
          startIcon={<PaymentsOutlined fontSize="small" />}
          onClick={onPayClick}
          sx={{ whiteSpace: "nowrap", minWidth: 0, px: 1 }}
        >
          {p.debt > 0 ? `${p.debt.toLocaleString()} с` : "Оплата"}
        </Button>
      </Stack>
    </Box>
  );
};

export default ParticipantRow;

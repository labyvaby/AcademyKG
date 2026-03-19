import React, { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  MenuItem,
  Select,
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

const ParticipantRow: React.FC<Props> = ({ participant: p, onStatusChange, onPayClick, onClientClick }) => {
  const [statusLoading, setStatusLoading] = useState(false);

  const handleStatusChange = async (status: GroupAppointmentStatus) => {
    setStatusLoading(true);
    try { await onStatusChange(status); }
    finally { setStatusLoading(false); }
  };

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

        {/* Status chip-select */}
        <Select
          size="small"
          value={p.status}
          disabled={statusLoading}
          onChange={(e) => handleStatusChange(e.target.value as GroupAppointmentStatus)}
          renderValue={(val) => (
            <Chip
              label={GROUP_STATUS_LABELS[val as GroupAppointmentStatus] ?? val}
              color={GROUP_STATUS_COLOR[val as GroupAppointmentStatus] ?? "default"}
              size="small"
              sx={{ height: 20, fontSize: 11, cursor: "pointer" }}
            />
          )}
          sx={{
            "& .MuiSelect-select": { py: "2px", px: "4px !important", pr: "24px !important" },
            "& fieldset": { border: "none" },
            minWidth: 130,
          }}
        >
          {(Object.keys(GROUP_STATUS_LABELS) as GroupAppointmentStatus[]).map((s) => (
            <MenuItem key={s} value={s} dense>
              <Chip label={GROUP_STATUS_LABELS[s]} color={GROUP_STATUS_COLOR[s] ?? "default"} size="small" sx={{ height: 20, fontSize: 11, pointerEvents: "none" }} />
            </MenuItem>
          ))}
        </Select>

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

import React from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import type { GroupParticipant, GroupAppointmentStatus } from "../model/types";
import { GROUP_STATUS_LABELS, GROUP_STATUS_COLOR } from "../model/types";

type Props = {
  participant: GroupParticipant;
  index?: number;
  onStatusChange: (status: GroupAppointmentStatus) => Promise<void>;
  onPayClick: () => void;
  onClientClick?: () => void;
};

const ParticipantRow: React.FC<Props> = ({ participant: p, index, onPayClick, onClientClick }) => {
  const theme = useTheme();
  const initials = p.patientName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const isPaid = p.debt <= 0;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: isPaid ? alpha(theme.palette.success.main, 0.25) : "divider",
        bgcolor: isPaid ? alpha(theme.palette.success.main, 0.03) : "background.paper",
        transition: "border-color 0.2s",
      }}
    >
      {/* Avatar */}
      <Avatar
        src={p.patientPhoto ?? undefined}
        sx={{
          width: 34,
          height: 34,
          fontSize: 12,
          fontWeight: 700,
          bgcolor: alpha(theme.palette.primary.main, 0.15),
          color: "primary.main",
          flexShrink: 0,
          cursor: onClientClick ? "pointer" : "default",
        }}
        onClick={onClientClick}
      >
        {initials}
      </Avatar>

      {/* Name + status */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          noWrap
          sx={{ cursor: onClientClick ? "pointer" : "default", "&:hover": onClientClick ? { color: "primary.main" } : {}, lineHeight: 1.3 }}
          onClick={onClientClick}
        >
          {p.patientName}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
          <Chip
            label={GROUP_STATUS_LABELS[p.status as GroupAppointmentStatus] ?? p.status}
            color={GROUP_STATUS_COLOR[p.status as GroupAppointmentStatus] ?? "default"}
            size="small"
            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 600, "& .MuiChip-label": { px: 0.75 } }}
          />
          {p.debt > 0
            ? <Typography variant="caption" color="error.main" fontWeight={500}>Долг: {p.debt.toLocaleString()} с</Typography>
            : <Typography variant="caption" color="success.main" fontWeight={500}>Оплачено</Typography>
          }
        </Stack>
      </Box>

      {/* Index */}
      {index != null && (
        <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, fontWeight: 500 }}>
          #{index + 1}
        </Typography>
      )}

      {/* Pay button */}
      <Button
        size="small"
        variant={isPaid ? "text" : "contained"}
        color={isPaid ? "success" : "primary"}
        startIcon={<PaymentsOutlined sx={{ fontSize: "14px !important" }} />}
        onClick={onPayClick}
        sx={{ whiteSpace: "nowrap", minWidth: 0, px: 1.25, height: 30, fontSize: "0.72rem", flexShrink: 0 }}
      >
        {p.debt > 0 ? `${p.debt.toLocaleString()} с` : "Оплата"}
      </Button>
    </Box>
  );
};

export default ParticipantRow;

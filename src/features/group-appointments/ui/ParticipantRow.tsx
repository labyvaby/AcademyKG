import React, { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlined from "@mui/icons-material/ExpandLessOutlined";
import type { GroupParticipant, GroupAppointmentStatus } from "../model/types";
import { GROUP_STATUS_LABELS } from "../model/types";

const STATUS_COLOR: Record<GroupAppointmentStatus, "default" | "warning" | "info" | "success" | "error" | "primary"> = {
  scheduled: "warning",
  arrived: "info",
  in_progress: "primary",
  completed: "default",
  paid: "success",
  partially_paid: "info",
  cancelled: "error",
  not_came: "error",
};

type Props = {
  participant: GroupParticipant;
  onStatusChange: (status: GroupAppointmentStatus) => Promise<void>;
  onPay: (payment: { paidCash?: number; paidCard?: number }) => Promise<void>;
};

const ParticipantRow: React.FC<Props> = ({ participant: p, onStatusChange, onPay }) => {
  const [statusLoading, setStatusLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [cardInput, setCardInput] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  const handleStatusChange = async (status: GroupAppointmentStatus) => {
    setStatusLoading(true);
    try {
      await onStatusChange(status);
    } finally {
      setStatusLoading(false);
    }
  };

  const handlePay = async () => {
    const cash = Number(cashInput) || 0;
    const card = Number(cardInput) || 0;
    if (cash + card <= 0) return;
    setPayLoading(true);
    try {
      await onPay({ paidCash: cash, paidCard: card });
      setCashInput("");
      setCardInput("");
      setPayOpen(false);
    } finally {
      setPayLoading(false);
    }
  };

  const initials = p.patientName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      {/* Header row */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1.5, py: 1 }}>
        <Avatar sx={{ width: 34, height: 34, fontSize: 13, bgcolor: "primary.light" }} src={p.patientPhoto ?? undefined}>
          {initials}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {p.patientName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {p.debt > 0 ? `Долг: ${p.debt.toLocaleString()} с` : "Оплачено"}
          </Typography>
        </Box>

        {/* Status selector */}
        <Select
          size="small"
          value={p.status}
          disabled={statusLoading}
          onChange={(e) => handleStatusChange(e.target.value as GroupAppointmentStatus)}
          renderValue={(val) => (
            <Chip
              label={GROUP_STATUS_LABELS[val as GroupAppointmentStatus] ?? val}
              color={STATUS_COLOR[val as GroupAppointmentStatus] ?? "default"}
              size="small"
              sx={{ height: 22, fontSize: 11, cursor: "pointer" }}
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
              <Chip
                label={GROUP_STATUS_LABELS[s]}
                color={STATUS_COLOR[s] ?? "default"}
                size="small"
                sx={{ height: 20, fontSize: 11, pointerEvents: "none" }}
              />
            </MenuItem>
          ))}
        </Select>

        {/* Pay toggle */}
        <Tooltip title="Принять оплату">
          <IconButton
            size="small"
            color={payOpen ? "primary" : "default"}
            onClick={() => setPayOpen((v) => !v)}
            disabled={p.debt <= 0}
          >
            <PaymentsOutlined fontSize="small" />
          </IconButton>
        </Tooltip>

        <IconButton size="small" onClick={() => setPayOpen((v) => !v)}>
          {payOpen ? <ExpandLessOutlined fontSize="small" /> : <ExpandMoreOutlined fontSize="small" />}
        </IconButton>
      </Stack>

      {/* Payment detail summary */}
      {(p.paidCash > 0 || p.paidCard > 0 || p.paidBalance > 0 || p.paidBonuses > 0) && !payOpen && (
        <Box sx={{ px: 1.5, pb: 0.75 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {p.paidCash > 0 && (
              <Typography variant="caption" color="text.secondary">Нал: {p.paidCash.toLocaleString()} с</Typography>
            )}
            {p.paidCard > 0 && (
              <Typography variant="caption" color="text.secondary">Безнал: {p.paidCard.toLocaleString()} с</Typography>
            )}
            {p.paidBalance > 0 && (
              <Typography variant="caption" color="text.secondary">Баланс: {p.paidBalance.toLocaleString()} с</Typography>
            )}
            {p.paidBonuses > 0 && (
              <Typography variant="caption" color="text.secondary">Бонусы: {p.paidBonuses.toLocaleString()} с</Typography>
            )}
          </Stack>
        </Box>
      )}

      {/* Payment form */}
      <Collapse in={payOpen}>
        <Divider />
        <Box sx={{ px: 1.5, py: 1.25, bgcolor: "action.hover" }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block", fontWeight: 600 }}>
            Итого: {p.total.toLocaleString()} с &nbsp;|&nbsp; Остаток: {p.debt.toLocaleString()} с
          </Typography>
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              label="Нал"
              size="small"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value.replace(/[^\d]/g, ""))}
              inputProps={{ inputMode: "numeric" }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Безнал"
              size="small"
              value={cardInput}
              onChange={(e) => setCardInput(e.target.value.replace(/[^\d]/g, ""))}
              inputProps={{ inputMode: "numeric" }}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              size="small"
              disabled={payLoading || (Number(cashInput) + Number(cardInput)) <= 0}
              onClick={handlePay}
              sx={{ whiteSpace: "nowrap" }}
            >
              {payLoading ? "…" : "Принять"}
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ParticipantRow;

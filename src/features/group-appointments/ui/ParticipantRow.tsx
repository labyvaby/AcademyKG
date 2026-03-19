import React, { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import type { GroupParticipant, GroupAppointmentStatus } from "../model/types";
import { GROUP_STATUS_LABELS, GROUP_STATUS_COLOR } from "../model/types";

type Props = {
  participant: GroupParticipant;
  onStatusChange: (status: GroupAppointmentStatus) => Promise<void>;
  onPay: (payment: { paidCash?: number; paidCard?: number; paidBalance?: number }) => Promise<void>;
};

const ParticipantRow: React.FC<Props> = ({ participant: p, onStatusChange, onPay }) => {
  const [statusLoading, setStatusLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [cardInput, setCardInput] = useState("");
  const [balanceInput, setBalanceInput] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  const handleStatusChange = async (status: GroupAppointmentStatus) => {
    setStatusLoading(true);
    try { await onStatusChange(status); }
    finally { setStatusLoading(false); }
  };

  const handlePay = async () => {
    const cash = Number(cashInput) || 0;
    const card = Number(cardInput) || 0;
    const balance = Number(balanceInput) || 0;
    if (cash + card + balance <= 0) return;
    setPayLoading(true);
    try {
      await onPay({ paidCash: cash, paidCard: card, paidBalance: balance });
      setCashInput(""); setCardInput(""); setBalanceInput("");
      setPayOpen(false);
    } finally { setPayLoading(false); }
  };

  const initials = p.patientName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      {/* Main row: avatar + name + status + pay button */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1.5, py: 1 }}>
        <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: "primary.light", flexShrink: 0 }} src={p.patientPhoto ?? undefined}>
          {initials}
        </Avatar>

        {/* Name + debt */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{p.patientName}</Typography>
          {p.debt > 0
            ? <Typography variant="caption" color="error.main">Долг: {p.debt.toLocaleString()} с</Typography>
            : <Typography variant="caption" color="success.main">Оплачено</Typography>
          }
        </Box>

        {/* Status chip-select — рядом с именем */}
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

        {/* Pay toggle */}
        <Button
          size="small"
          variant={payOpen ? "contained" : "outlined"}
          startIcon={<PaymentsOutlined fontSize="small" />}
          onClick={() => setPayOpen((v) => !v)}
          disabled={p.debt <= 0 && !payOpen}
          sx={{ whiteSpace: "nowrap", minWidth: 0, px: 1 }}
        >
          {p.debt > 0 ? `${p.debt.toLocaleString()} с` : "✓"}
        </Button>
      </Stack>

      {/* Payment form */}
      <Collapse in={payOpen}>
        <Divider />
        <Box sx={{ px: 1.5, py: 1.25, bgcolor: "action.hover" }}>
          <Stack direction="row" spacing={1} alignItems="flex-end" flexWrap="wrap">
            <TextField label="Нал" size="small" value={cashInput} onChange={(e) => setCashInput(e.target.value.replace(/[^\d]/g, ""))} inputProps={{ inputMode: "numeric" }} sx={{ flex: 1, minWidth: 70 }} />
            <TextField label="Безнал" size="small" value={cardInput} onChange={(e) => setCardInput(e.target.value.replace(/[^\d]/g, ""))} inputProps={{ inputMode: "numeric" }} sx={{ flex: 1, minWidth: 70 }} />
            <TextField label="Баланс" size="small" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value.replace(/[^\d]/g, ""))} inputProps={{ inputMode: "numeric" }} sx={{ flex: 1, minWidth: 70 }} />
            <Button variant="contained" size="small" disabled={payLoading || (Number(cashInput) + Number(cardInput) + Number(balanceInput)) <= 0} onClick={handlePay} sx={{ whiteSpace: "nowrap" }}>
              {payLoading ? "…" : "Принять"}
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ParticipantRow;

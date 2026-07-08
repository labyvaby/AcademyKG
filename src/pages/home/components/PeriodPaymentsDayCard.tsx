import React from "react";
import {
  Box,
  Card,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CardGiftcardOutlined from "@mui/icons-material/CardGiftcardOutlined";
import EventRepeatOutlined from "@mui/icons-material/EventRepeatOutlined";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import { formatKGS } from "../../../utility/format";
import { fetchPeriodPaymentsForDay } from "../../../services/periodPayments";
import { useBranchContext } from "../../../contexts/branch-context";

type Props = {
  date: string; // YYYY-MM-DD
};

const ddmm = (iso: string | null | undefined) =>
  iso ? dayjs(iso).format("DD.MM") : "";

// Итог оплат за период в день оплаты (Регистратура). Выручка этих оплат
// признаётся в дне оплаты, а сами приёмы стоят на датах сессий — без этого
// блока день оплаты выглядит «пустым» и кассе не с чем сверить сумму.
const PeriodPaymentsDayCard: React.FC<Props> = ({ date }) => {
  const { selectedBranch } = useBranchContext();
  const branchId = selectedBranch?.id ?? null;

  const { data: payments = [] } = useQuery({
    queryKey: ["period-payments", "day", date, branchId],
    queryFn: () => fetchPeriodPaymentsForDay(date),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Эндпоинт может быть недоступен роли (403) — блок просто не показываем.
    retry: false,
  });

  if (!payments.length) return null;

  const total = payments.reduce((s, p) => s + Number(p.totalAmount || 0), 0);

  return (
    <Card variant="outlined" sx={{ mb: 2, flexShrink: 0 }}>
      <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
          <EventRepeatOutlined sx={{ fontSize: 18, color: "primary.main" }} />
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
            Оплаты за период
          </Typography>
          <Chip
            label={payments.length}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
          />
        </Stack>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
          {formatKGS(total)}
        </Typography>
      </Box>
      <Divider />
      <Box>
        {payments.map((p) => {
          const cash = Number(p.paidCash || 0);
          const card = Number(p.paidCard || 0);
          const balance = Number(p.paidBalance || 0);
          const bonuses = Number(p.paidBonuses || 0);
          return (
            <Box
              key={p.id}
              sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: "none" } }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {p.patient?.fullName || "Клиент"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Период {ddmm(p.periodFrom)}–{ddmm(p.periodTo)} · {p.appointmentsCount} зан.
                  </Typography>
                </Stack>
                <Stack alignItems="flex-end" spacing={0.25}>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {formatKGS(Number(p.totalAmount || 0))}
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.25} color="text.secondary">
                    {cash > 0 && <PaymentsOutlined sx={{ fontSize: 16 }} />}
                    {card > 0 && <CreditCardOutlined sx={{ fontSize: 16 }} />}
                    {balance > 0 && <AccountBalanceWalletOutlined sx={{ fontSize: 16 }} />}
                    {bonuses > 0 && <CardGiftcardOutlined sx={{ fontSize: 16 }} />}
                  </Stack>
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Card>
  );
};

export default PeriodPaymentsDayCard;

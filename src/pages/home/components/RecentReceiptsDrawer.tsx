/**
 * «Последние чеки» — боковая панель регистратуры со списком недавно оплаченных
 * приёмов и повторной печатью чека по каждому.
 *
 * Отдельной сущности «чек» на бэке нет: чек строится из полей оплаты приёма.
 * Берём приёмы за выбранный в регистратуре день, оставляем с оплатой и сортируем
 * по updated_at (ближайший доступный признак времени оплаты).
 */
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../utility/apiClient";
import dayjs from "dayjs";
import { dayjsBranch } from "../../../utility/branchTime";
import { hasAppointmentPayment, reprintAppointmentReceipt } from "../../../components/ui/PaymentReceipt";
import { useEffectiveBranch } from "../../../hooks/useEffectiveBranch";
import { useBranchCurrency } from "../../../hooks/useBranchCurrency";
import { useBranchContext } from "../../../contexts/branch-context";
import type { AggregatedAppointmentRow, Appointment } from "../types";
import { mapAggregatedRowToAppointment } from "../types";


type Props = {
  open: boolean;
  onClose: () => void;
  /** Выбранный в регистратуре день (YYYY-MM-DD) */
  date: string;
  /** Открыть приём в карточке регистратуры */
  onOpenAppointment?: (appointment: Appointment) => void;
};

const RecentReceiptsDrawer: React.FC<Props> = ({ open, onClose, date, onOpenAppointment }) => {
  const { t } = useTranslation();
  const branch = useEffectiveBranch();
  const { selectedBranch } = useBranchContext();
  const { format } = useBranchCurrency();

  const { data: receipts = [], isFetching, isError } = useQuery<Appointment[]>({
    queryKey: ["appointments", "recent-receipts", date, selectedBranch?.id ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({
        ordering: "-appointmentAt",
        date,
        pageSize: "500",
      });
      const res: any = await apiFetch(`/api/v1/appointments/?${params.toString()}`);
      const rows: AggregatedAppointmentRow[] = res?.data?.results ?? res?.results ?? [];
      return rows
        .map(mapAggregatedRowToAppointment)
        .filter(hasAppointmentPayment)
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    },
    enabled: open,
    // Панель открывают сразу после оплаты — данные должны быть свежими
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1 }}>
        <Box>
          <Typography variant="h6">{t("receipts.title")}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t("receipts.subtitle", { date: dayjs(date).format("DD.MM.YYYY") })}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label={t("common.close")}>
          <CloseOutlined />
        </IconButton>
      </Box>
      <Divider />

      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {isFetching && receipts.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : isError ? (
          <Typography color="error" sx={{ p: 2 }}>{t("receipts.loadError")}</Typography>
        ) : receipts.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>{t("receipts.empty")}</Typography>
        ) : (
          <Stack divider={<Divider />}>
            {receipts.map((item) => {
              const paid = item.paid_cash + item.paid_card + item.paid_balance + item.paid_bonuses;
              const paidAt = item.updated_at ? dayjsBranch(item.updated_at).format("DD.MM HH:mm") : "";
              const methods = [
                item.paid_cash > 0 && t("payment.cash"),
                item.paid_card > 0 && t("payment.cashless"),
                (item.paid_balance > 0 || item.paid_bonuses > 0) && t("receipts.fromBalance"),
              ].filter(Boolean).join(" · ");

              return (
                <Stack
                  key={item.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    px: 2,
                    py: 1.25,
                    cursor: onOpenAppointment ? "pointer" : "default",
                    "&:hover": onOpenAppointment ? { bgcolor: "action.hover" } : undefined,
                  }}
                  onClick={() => onOpenAppointment?.(item)}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {item.patient_name || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {item.service_names}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {[paidAt, methods, item.updated_by_name ?? item.created_by_name].filter(Boolean).join(" · ")}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {format(paid)}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PrintOutlinedIcon fontSize="small" />}
                      sx={{ textTransform: "none", py: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        reprintAppointmentReceipt(item, branch);
                      }}
                    >
                      {t("receipts.print")}
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
};

export default RecentReceiptsDrawer;

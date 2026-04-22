import React, { useEffect, useState } from "react";
import { Box, Typography, Button, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useNavigate, useLocation } from "react-router";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";
import { fetchShifts, type Shift } from "../../services/shifts";
import dayjs from "dayjs";

const today = () => dayjs().format("YYYY-MM-DD");

/**
 * Глобальный баннер: «Вы не начали свой день, пожалуйста отметьтесь»
 * Показывается вверху страницы (кроме /skud) когда у текущего
 * сотрудника нет активной смены на сегодня.
 */
export const ShiftStartBanner: React.FC = () => {
  const { hasPermission, employeeId } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [shift, setShift] = useState<Shift | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  const hasAccess = hasPermission(PERMISSIONS.WORK_SHIFTS_SELF_CLOCK_IN);
  const onSkudPage = location.pathname === "/skud" || location.pathname.startsWith("/skud/");

  useEffect(() => {
    if (!hasAccess) {
      setShift(null);
      return;
    }

    let cancelled = false;
    // Обычный сотрудник не передаёт employee — бэкенд возвращает только его смены
    fetchShifts({ date: today() })
      .then((data) => {
        if (cancelled) return;
        const todayShift = data.find((s) => s.shiftDate === today()) ?? null;
        setShift(todayShift);
      })
      .catch(() => {
        if (!cancelled) setShift(null);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, employeeId]);

  if (shift === undefined || !hasAccess || dismissed || onSkudPage) return null;

  const hasActiveShift = !!shift?.clockIn;
  if (hasActiveShift) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 12,
        left: 0,
        right: 0,
        zIndex: 1400,
        display: "flex",
        justifyContent: "center",
        px: 2,
        pointerEvents: "none",
      }}
    >
      <Box
        sx={(t) => ({
          pointerEvents: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          background: t.palette.mode === "dark"
            ? alpha(t.palette.warning.dark, 0.92)
            : alpha(t.palette.background.paper, 0.97),
          border: "1px solid",
          borderColor: "warning.light",
          borderRadius: 3,
          px: { xs: 1.5, sm: 2 },
          py: 0.75,
          boxShadow: `0 4px 16px ${alpha(t.palette.warning.main, 0.22)}, 0 1px 4px ${alpha("#000", 0.08)}`,
          maxWidth: 460,
          width: "100%",
        })}
      >
        <AccessTimeOutlined sx={{ color: "warning.main", fontSize: 18, flexShrink: 0 }} />
        <Typography
          variant="body2"
          fontWeight={600}
          color="warning.dark"
          sx={{ flex: 1, fontSize: { xs: "0.78rem", sm: "0.82rem" }, lineHeight: 1.3 }}
        >
          Вы не начали свой день, пожалуйста отметьтесь
        </Typography>
        <Button
          size="small"
          variant="contained"
          color="warning"
          onClick={() => navigate("/skud")}
          sx={{ whiteSpace: "nowrap", py: 0.3, px: 1.5, fontSize: "0.75rem", minWidth: 0, flexShrink: 0 }}
        >
          Отметиться
        </Button>
        <IconButton size="small" onClick={() => setDismissed(true)} sx={{ color: "warning.dark", p: 0.25, flexShrink: 0 }}>
          <CloseOutlined sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
};

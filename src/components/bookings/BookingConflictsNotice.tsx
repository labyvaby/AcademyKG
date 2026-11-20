import React from "react";
import { Alert, AlertTitle, Button, Snackbar, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { formatBookingStart, formatPhone } from "../../pages/bookings/meta";
import { BOOKING_CONFLICTS_EVENT, type BookingConflict } from "../../services/bookings";

/**
 * «На это время есть онлайн-заявка»: приём создан или перенесён поверх заявки, которая
 * держит окно на витрине. Приём не блокируется — заявку нужно разобрать (закрыть этим
 * приёмом или отклонить). Сигнал — announceBookingConflicts() после POST/PATCH приёма.
 */
export const BookingConflictsNotice: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [conflicts, setConflicts] = React.useState<BookingConflict[]>([]);

  React.useEffect(() => {
    const onConflicts = (event: Event) => setConflicts((event as CustomEvent<BookingConflict[]>).detail ?? []);
    window.addEventListener(BOOKING_CONFLICTS_EVENT, onConflicts);
    return () => window.removeEventListener(BOOKING_CONFLICTS_EVENT, onConflicts);
  }, []);

  const close = () => setConflicts([]);
  const openBooking = (id: string) => {
    close();
    navigate(`/bookings?open=${encodeURIComponent(id)}`);
  };

  return (
    // Без автоскрытия: заявку легко потерять, а разобрать её нужно до звонка гостю.
    <Snackbar
      open={conflicts.length > 0}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      onClose={(_, reason) => reason !== "clickaway" && close()}
    >
      <Alert severity="warning" onClose={close} sx={{ width: "100%", maxWidth: 460, boxShadow: 6 }}>
        <AlertTitle sx={{ fontWeight: 800 }}>{t("bookings.conflicts.noticeTitle")}</AlertTitle>
        <Stack spacing={1}>
          {conflicts.map((b) => (
            <Stack key={b.id} direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                <b>{b.code}</b> · {formatBookingStart(b.startAt, b.branch.timezone, i18n.language)} · {b.clientName},{" "}
                {formatPhone(b.contactPhone)}
              </Typography>
              <Button size="small" variant="outlined" color="inherit" onClick={() => openBooking(b.id)}>
                {t("bookings.conflicts.openBooking")}
              </Button>
            </Stack>
          ))}
          <Typography variant="caption">{t("bookings.conflicts.noticeHint")}</Typography>
        </Stack>
      </Alert>
    </Snackbar>
  );
};

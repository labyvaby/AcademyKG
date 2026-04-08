import React from "react";
import { Box } from "@mui/material";
import ClientScheduleCalendar from "../features/client-schedule/ui/ClientScheduleCalendar";
import { PageHeader } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";

const ClientSchedulePage: React.FC = () => {
  usePageTitle("Клиентское расписание");
  const calendarRef = React.useRef<{ openAddShift: () => void }>(null);

  const handleAddShift = () => {
    calendarRef.current?.openAddShift();
  };

  return (
    <Box
      sx={{
        height: { xs: "auto", lg: "100%" },
        minHeight: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
        display: "flex",
        flexDirection: "column",
        overflow: { xs: "visible", lg: "hidden" },
      }}
    >
      <PageHeader
        title="Клиентское расписание"
        showTitle={false}
        addButtonText="Записать клиента"
        onAdd={handleAddShift}
      />

      <Box sx={(theme) => ({ px: theme.appLayout.page.paddingX, pb: 2, flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" })}>
        <ClientScheduleCalendar ref={calendarRef} />
      </Box>
    </Box>
  );
};

export default ClientSchedulePage;

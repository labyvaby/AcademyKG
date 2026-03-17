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
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PageHeader
        title="Клиентское расписание"
        showTitle={false}
        addButtonText="Записать клиента"
        onAdd={handleAddShift}
      />

      <Box sx={(theme) => ({ px: theme.appLayout.page.paddingX, pb: 2, flex: 1, minHeight: 0, overflowY: "auto" })}>
        <ClientScheduleCalendar ref={calendarRef} />
      </Box>
    </Box>
  );
};

export default ClientSchedulePage;

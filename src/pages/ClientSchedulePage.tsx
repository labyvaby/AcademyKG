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
        height: {
          xs: "calc(100dvh - 56px)",
          md: "calc(100dvh - 64px)",
          lg: "100%",
        },
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <PageHeader
        title="Клиентское расписание"
        showTitle={false}
        addButtonText="Записать клиента"
        onAdd={handleAddShift}
      />

      <Box
        sx={(theme) => ({
          px: theme.appLayout.page.paddingX,
          pb: 2,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        })}
      >
        <ClientScheduleCalendar ref={calendarRef} />
      </Box>
    </Box>
  );
};

export default ClientSchedulePage;

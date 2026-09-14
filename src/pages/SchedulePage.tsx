/**
 * SchedulePage.tsx
 * Основная страница графика работы клиники.
 * Отвечает за:
 *  - Заголовок и кнопку "Добавить смену"
 *  - Сборку всех компонентов календаря и боковых панелей
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import ScheduleCalendar from "../components/schedule/ScheduleCalendar";
import { PageHeader } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import { usePermissions } from "../hooks/usePermissions";
import { PERMISSIONS } from "../constants/permissions";

const SchedulePage: React.FC = () => {
  const { t } = useTranslation();
  usePageTitle(t("menu.schedule"));
  const calendarRef = React.useRef<{ openAddShift: () => void }>(null);

  const { hasPermission, employeeId, hasRole } = usePermissions();
  const isAdmin = hasPermission(PERMISSIONS.EMPLOYEE_SCHEDULES_UPDATE);
  const isRegistrator = hasPermission(PERMISSIONS.APPOINTMENTS_CREATE);
  const isSpecialist = hasRole("specialist");
  const canManageSchedule = isAdmin || isRegistrator;

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
        overflow: "hidden"
      }}
    >
      <PageHeader
        title={t("menu.schedule")}
        showTitle={false}
        addButtonText={canManageSchedule ? t("schedule.addShift") : undefined}
        onAdd={canManageSchedule ? handleAddShift : undefined}
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
        {/* Основной календарь */}
        <ScheduleCalendar
          ref={calendarRef}
          isAdmin={isAdmin}
          isRegistrator={isRegistrator}
          isSpecialist={isSpecialist}
          employeeId={employeeId}
        />
      </Box>
    </Box>
  );
};

export default SchedulePage;

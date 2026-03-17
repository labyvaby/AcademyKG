import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import dayjs from "dayjs";
import { PageHeader, DateNavigation } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import { fetchGroups } from "../features/group-appointments/api/group-appointments.api";
import type { AppointmentGroup } from "../features/group-appointments/model/types";
import GroupAppointmentCard from "../features/group-appointments/ui/GroupAppointmentCard";
import CreateGroupAppointmentDrawer from "../features/group-appointments/ui/CreateGroupAppointmentDrawer";

const GroupAppointmentsPage: React.FC = () => {
  usePageTitle("Групповые приёмы");

  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [groups, setGroups] = useState<AppointmentGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGroups(date);
      setGroups(data);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGroupUpdated = (updated: AppointmentGroup) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  const handleCreated = (group: AppointmentGroup) => {
    setGroups((prev) => [...prev, group]);
  };

  return (
    <Box
      sx={(theme) => ({
        height: {
          xs: `calc(100dvh - ${theme.appLayout.viewportOffset.home.mobileOffset}px)`,
          md: `calc(100dvh - ${theme.appLayout.viewportOffset.home.desktopOffset}px)`,
        },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      })}
    >
      <PageHeader
        title="Групповые приёмы"
        showTitle={false}
        dateNavigation={
          <DateNavigation date={date} setDate={setDate} />
        }
        actions={
          <Button
            variant="contained"
            size="small"
            startIcon={<AddOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Создать группу
          </Button>
        }
      />

      <Box
        sx={(theme) => ({
          flex: 1,
          overflowY: "auto",
          px: theme.appLayout.page.paddingX,
          py: 2,
        })}
      >
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: 200 }}>
            <CircularProgress />
          </Stack>
        ) : groups.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: 200 }}>
            <GroupsOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
            <Typography color="text.secondary">Нет групповых приёмов на этот день</Typography>
            <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setCreateOpen(true)}>
              Создать группу
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {groups
              .slice()
              .sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt))
              .map((group) => (
                <GroupAppointmentCard
                  key={group.id}
                  group={group}
                  onGroupUpdated={handleGroupUpdated}
                />
              ))}
          </Stack>
        )}
      </Box>

      <CreateGroupAppointmentDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        initialDate={date + "T09:00"}
      />
    </Box>
  );
};

export default GroupAppointmentsPage;

import React from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Grid2,
  Chip,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Avatar,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
} from "@mui/material";
import BusinessOutlined from "@mui/icons-material/BusinessOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import dayjs from "dayjs";
import { apiFetch } from "../../utility/apiClient";
import { usePageTitle } from "../../hooks/usePageTitle";
import { PageHeader } from "../../components/ui";
import { AppointmentDetailsCard } from "../home/components/AppointmentDetailsCard";
import AppointmentsList from "../home/components/AppointmentsList";
import { mapAggregatedRowToAppointment, type AggregatedAppointmentRow, type Appointment } from "../home/types";
import { useTheme, useMediaQuery } from "@mui/material";
import { AppBottomSheet } from "../../components/ui";
import { formatDateRu } from "../../utility/format";
import { getStatusChipSx, normalizeStatus } from "../../config/appointmentStatuses";

type Branch = { id: string; name: string };

export const BranchesPage: React.FC = () => {
  usePageTitle("Филиалы");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = React.useState(true);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("all");

  // Date filter
  const today = dayjs().format("YYYY-MM-DD");
  const [selectedDate, setSelectedDate] = React.useState<string>(today);

  // Appointments
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [apptLoading, setApptLoading] = React.useState(false);

  // Selected appointment detail
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Stats per branch
  const [stats, setStats] = React.useState<Record<string, { total: number; today: number }>>({});

  // Load branches
  React.useEffect(() => {
    (async () => {
      try {
        setBranchesLoading(true);
        const res: any = await apiFetch("/api/v1/branches/");
        const list: any[] = res?.data?.results ?? res?.results ?? [];
        setBranches(list.map((b) => ({ id: String(b.id), name: b.name ?? "" })));
      } catch {
        /* ignore */
      } finally {
        setBranchesLoading(false);
      }
    })();
  }, []);

  // Load appointments when branch or date changes
  React.useEffect(() => {
    (async () => {
      try {
        setApptLoading(true);
        setSelectedId(null);

        const params = new URLSearchParams({ ordering: "-appointmentAt" });
        if (selectedDate) params.set("date", selectedDate);
        if (selectedBranchId !== "all") params.set("branch", selectedBranchId);

        const res: any = await apiFetch(`/api/v1/appointments/?${params.toString()}`);
        const data: any[] =
          res?.data?.results ?? res?.results ?? (Array.isArray(res?.data) ? res.data : null) ?? (Array.isArray(res) ? res : []);

        const mapped = (data as AggregatedAppointmentRow[]).map(mapAggregatedRowToAppointment);
        setAppointments(mapped);
      } catch {
        /* ignore */
      } finally {
        setApptLoading(false);
      }
    })();
  }, [selectedBranchId, selectedDate]);

  // Compute stats per branch from loaded appointments
  React.useEffect(() => {
    if (branches.length === 0) return;
    (async () => {
      try {
        // Load today's counts per branch
        const todayStr = dayjs().format("YYYY-MM-DD");
        const newStats: Record<string, { total: number; today: number }> = {};

        await Promise.all(
          branches.map(async (b) => {
            try {
              const [totalRes, todayRes]: any[] = await Promise.all([
                apiFetch(`/api/v1/appointments/?branch=${b.id}&pageSize=1`),
                apiFetch(`/api/v1/appointments/?branch=${b.id}&date=${todayStr}&pageSize=1`),
              ]);
              const total = totalRes?.data?.count ?? totalRes?.count ?? 0;
              const todayCount = todayRes?.data?.count ?? todayRes?.count ?? 0;
              newStats[b.id] = { total, today: todayCount };
            } catch {
              newStats[b.id] = { total: 0, today: 0 };
            }
          })
        );

        setStats(newStats);
      } catch {
        /* ignore */
      }
    })();
  }, [branches]);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Филиалы" showTitle={false} showSearch={false} />

      <Box
        sx={(t) => ({
          px: t.appLayout.page.paddingX,
          pb: t.appLayout.page.paddingY,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        })}
      >
        <Grid2 container spacing={2} sx={{ flex: 1, minHeight: 0 }}>

          {/* LEFT: Branch list + filter */}
          <Grid2
            size={{ xs: 12, md: 3 }}
            sx={(t) => ({
              position: { md: "sticky" },
              top: { md: t.spacing(2) },
              alignSelf: "flex-start",
              height: {
                xs: "auto",
                md: `calc(100dvh - ${t.appLayout.viewportOffset.employees.desktopOffset}px)`,
              },
              display: "flex",
              flexDirection: "column",
            })}
          >
            <Paper
              elevation={0}
              variant="outlined"
              sx={{ height: { xs: "auto", md: "100%" }, display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <BusinessOutlined fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={600}>Филиалы</Typography>
                </Stack>
              </Box>

              {/* Date filter */}
              <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Дата</Typography>
                <TextField
                  type="date"
                  size="small"
                  fullWidth
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  sx={{ mt: 0.5 }}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              <Divider />

              <Box sx={{ overflowY: "auto", flex: 1 }}>
                {branchesLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <List dense sx={{ py: 0.5 }}>
                    {/* All branches option */}
                    <ListItemButton
                      selected={selectedBranchId === "all"}
                      onClick={() => setSelectedBranchId("all")}
                      sx={{ borderRadius: 1, mx: 0.5, mb: 0.5 }}
                    >
                      <ListItemAvatar sx={{ minWidth: 36 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main", fontSize: "0.75rem" }}>
                          <BusinessOutlined fontSize="inherit" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary="Все филиалы"
                        primaryTypographyProps={{
                          variant: "body2",
                          fontWeight: selectedBranchId === "all" ? 600 : 400,
                        }}
                      />
                    </ListItemButton>

                    {branches.map((b) => {
                      const s = stats[b.id];
                      return (
                        <ListItemButton
                          key={b.id}
                          selected={selectedBranchId === b.id}
                          onClick={() => setSelectedBranchId(b.id)}
                          sx={{ borderRadius: 1, mx: 0.5, mb: 0.5, alignItems: "flex-start" }}
                        >
                          <ListItemAvatar sx={{ minWidth: 36 }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: "secondary.main", fontSize: "0.75rem" }}>
                              {b.name.charAt(0)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={b.name}
                            primaryTypographyProps={{
                              variant: "body2",
                              fontWeight: selectedBranchId === b.id ? 600 : 400,
                            }}
                            secondary={
                              s ? (
                                <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Сегодня: <b>{s.today}</b>
                                  </Typography>
                                </Stack>
                              ) : null
                            }
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                )}
              </Box>
            </Paper>
          </Grid2>

          {/* MIDDLE: Appointments list */}
          <Grid2
            size={{ xs: 12, md: 4 }}
            sx={(t) => ({
              position: { md: "sticky" },
              top: { md: t.spacing(2) },
              alignSelf: "flex-start",
              height: {
                xs: "auto",
                md: `calc(100dvh - ${t.appLayout.viewportOffset.employees.desktopOffset}px)`,
              },
            })}
          >
            <Paper
              elevation={0}
              variant="outlined"
              sx={{ height: { xs: "auto", md: "100%" }, overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" gap={1}>
                    <CalendarMonthOutlined fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={600}>
                      {selectedBranchId === "all"
                        ? "Все филиалы"
                        : (selectedBranch?.name ?? "Филиал")}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label={appointments.length}
                    sx={{ fontWeight: 600, fontSize: "0.75rem" }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {selectedDate ? formatDateRu(selectedDate) : "Все даты"}
                </Typography>
              </Box>

              <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <Box sx={{ flex: 1, overflowY: "auto" }}>
                  <AppointmentsList
                    titleDate={selectedDate ? formatDateRu(selectedDate) : ""}
                    loading={apptLoading}
                    errorMsg={null}
                    items={appointments}
                    onOpenFilters={() => {}}
                    onItemClick={(id) => setSelectedId(id)}
                    doctors={[]}
                    onAddSlot={undefined}
                    shifts={[]}
                    hideDoctorFilter={true}
                    selectedDoctorName={null}
                  />
                </Box>
              </Box>
            </Paper>
          </Grid2>

          {/* RIGHT: Appointment detail */}
          {!isMobile && (
            <Grid2
              size={{ xs: 12, md: 5 }}
              sx={(t) => ({
                position: { md: "sticky" },
                top: { md: t.spacing(2) },
                alignSelf: "flex-start",
                height: {
                  md: `calc(100dvh - ${t.appLayout.viewportOffset.employees.desktopOffset}px)`,
                },
              })}
            >
              <AppointmentDetailsCard
                appointmentId={selectedId}
                onClose={() => setSelectedId(null)}
                onUpdate={() => {
                  // refresh list
                  setSelectedId((id) => id);
                }}
                showPaymentAction={false}
                readOnly={true}
              />
            </Grid2>
          )}
        </Grid2>
      </Box>

      {/* Mobile: bottom sheet for detail */}
      {isMobile && (
        <AppBottomSheet open={!!selectedId} onClose={() => setSelectedId(null)}>
          <Box sx={{ p: 0, height: "80vh" }}>
            <AppointmentDetailsCard
              appointmentId={selectedId}
              onClose={() => setSelectedId(null)}
              onUpdate={() => {}}
              showPaymentAction={false}
              readOnly={true}
            />
          </Box>
        </AppBottomSheet>
      )}
    </Box>
  );
};

export default BranchesPage;

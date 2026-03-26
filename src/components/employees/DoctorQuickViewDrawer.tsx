import React, { useEffect, useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Stack,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  Avatar,
} from "@mui/material";
import {
  Close as CloseIcon,
  Person as PersonIcon,
  MedicalServices as MedicalServicesIcon,
  CalendarMonth as CalendarIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { apiFetch } from "../../utility/apiClient";
import { getStatusConfig, getStatusChipSx, normalizeStatus } from "../../config/appointmentStatuses";
import { Chip } from "@mui/material";

dayjs.locale("ru");

export interface DoctorDetail {
  id: string;
  fullName: string;
  photoUrl?: string | null;
  role?: string | null;
  specialization?: string | null;
}

interface DoctorService {
  id: string;
  name: string;
  price?: number;
}

interface DoctorAppointment {
  id: string;
  appointment_at: string;
  patient_name: string;
  service_names: string;
  status: string;
}

export interface DoctorQuickViewDrawerProps {
  open: boolean;
  onClose: () => void;
  doctorId: string | null;
}

export const DoctorQuickViewDrawer: React.FC<DoctorQuickViewDrawerProps> = ({ open, onClose, doctorId }) => {
  const [loading, setLoading] = useState(false);
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [services, setServices] = useState<DoctorService[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<DoctorAppointment[]>([]);

  useEffect(() => {
    if (!doctorId || !open) {
      setDoctor(null);
      setServices([]);
      setRecentAppointments([]);
      return;
    }

    let active = true;

    const load = async () => {
      try {
        setLoading(true);

        // 1. Employee details
        const empRes: any = await apiFetch(`/api/v1/employees/${doctorId}/`);
        const emp = empRes?.data ?? empRes;
        if (!emp) return;

        if (active) {
          const roleRaw = emp.role;
          const roleName = typeof roleRaw === "object" ? (roleRaw?.name ?? "") : (roleRaw ?? "");
          const spec = emp.specializations?.[0]?.name ?? emp.specialization ?? null;
          setDoctor({
            id: String(emp.id),
            fullName: emp.fullName ?? emp.full_name ?? "Без имени",
            photoUrl: emp.photoUrl ?? emp.photo_url ?? null,
            role: roleName || null,
            specialization: spec,
          });
        }

        // 2. Services
        const svcRes: any = await apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&employee=${doctorId}&pageSize=100`);
        const svcItems: any[] = svcRes?.data?.results ?? svcRes?.results ?? [];
        if (active) {
          setServices(svcItems.map((s: any) => ({
            id: String(s.id),
            name: s.displayName ?? s.display_name ?? s.name ?? "Услуга",
            price: s.price ? Number(s.price) : undefined,
          })));
        }

        // 3. Recent appointments
        const apptRes: any = await apiFetch(`/api/v1/appointments/?specialist=${doctorId}&ordering=-appointmentAt&pageSize=5`);
        const appts: any[] = apptRes?.data?.results ?? apptRes?.results ?? [];
        if (active) {
          setRecentAppointments(appts.map((a: any) => {
            const patNested = a.patient ?? null;
            return {
              id: String(a.id),
              appointment_at: a.appointmentAt ?? a.appointment_at ?? "",
              patient_name: a.patientName ?? a.patient_name ?? patNested?.fullName ?? patNested?.full_name ?? "Не указан",
              service_names: a.serviceNames ?? a.service_names ?? "",
              status: normalizeStatus(a.status ?? ""),
            };
          }));
        }
      } catch (e) {
        console.error("DoctorQuickViewDrawer load error:", e);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [doctorId, open]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: 320, sm: 480, md: 520 }, maxWidth: "100vw" } }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={600}>Информация о сотруднике</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 2, overflowY: "auto", flex: 1, "&::-webkit-scrollbar": { display: "none" } }}>
        {loading ? (
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={80} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="rectangular" height={200} />
          </Stack>
        ) : doctor ? (
          <Stack spacing={3}>
            {/* Основная информация */}
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Avatar src={doctor.photoUrl || undefined} sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={600}>{doctor.fullName}</Typography>
                {doctor.role && <Typography variant="body2" color="text.secondary">{doctor.role}</Typography>}
                {doctor.specialization && <Typography variant="body2" color="text.secondary">{doctor.specialization}</Typography>}
              </Box>
            </Stack>

            <Divider />

            {/* Услуги */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <MedicalServicesIcon fontSize="small" color="success" />
                <Typography variant="subtitle2" fontWeight={600}>Оказываемые услуги</Typography>
              </Stack>
              {services.length > 0 ? (
                <List disablePadding>
                  {services.map((s) => (
                    <ListItem key={s.id} sx={{ px: 0, py: 1, borderBottom: 1, borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={500}>{s.name}</Typography>}
                        secondary={s.price !== undefined ? <Typography variant="caption" color="text.secondary">{s.price} сом</Typography> : null}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>Услуги не назначены</Typography>
              )}
            </Box>

            <Divider />

            {/* Последние приёмы */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <CalendarIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>Последние приемы</Typography>
              </Stack>
              {recentAppointments.length > 0 ? (
                <List disablePadding>
                  {recentAppointments.map((a) => (
                    <ListItem key={a.id} sx={{ px: 0, py: 1.5, borderBottom: 1, borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {a.appointment_at ? dayjs(a.appointment_at).format("DD.MM.YYYY HH:mm") : "—"}
                            </Typography>
                            <Chip label={getStatusConfig(a.status).label} size="small" sx={{ ...getStatusChipSx(a.status), height: 20 }} />
                          </Stack>
                        }
                        secondary={
                          <>
                            <Typography variant="caption" display="block" color="text.secondary">Пациент: {a.patient_name}</Typography>
                            {a.service_names && <Typography variant="caption" display="block" color="text.secondary">Услуги: {a.service_names}</Typography>}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>Нет записей о приемах</Typography>
              )}
            </Box>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>Сотрудник не найден</Typography>
        )}
      </Box>
    </Drawer>
  );
};

export default DoctorQuickViewDrawer;

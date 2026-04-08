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
  Chip,
  Avatar,
  Button,
} from "@mui/material";
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  CalendarMonth as CalendarIcon,
  MedicalServices as MedicalServicesIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { apiFetch, resolveApiUrl } from "../../utility/apiClient";
import { getStatusChipStyles, getStatusConfig } from "../../config/appointmentStatuses";
import { calculateAgeWithMonths } from "../../utility/format";

dayjs.locale("ru");

// Интерфейс детальной информации о клиенте
export interface PatientDetail {
  id: string;
  fio: string; 
  phone?: string | null;
  birthDate?: string | null;
  inn?: string | null;
  photo_url?: string | null;
  comment?: string | null;
  latestWeight?: number | null;
  latestHeight?: number | null;
  latestTemperature?: number | null;
}

// Интерфейс для последних приемов клиента
interface RecentAppointment {
  id: string;
  appointment_at: string;
  doctor_name: string;
  service_names: string;
  status: string;
}

export interface PatientQuickViewDrawerProps {
  open: boolean;
  onClose: () => void;
  patientId: string | null;
  onStartAppointment?: (patientId: string) => void;
}

function resolveUrl(url: string | null | undefined): string | null {
  return resolveApiUrl(url);
}

export const PatientQuickViewDrawer: React.FC<PatientQuickViewDrawerProps> = ({
  open,
  onClose,
  patientId,
  onStartAppointment,
}) => {
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);

  useEffect(() => {
    if (!patientId || !open) {
      setPatient(null);
      setRecentAppointments([]);
      return;
    }

    let active = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Данные клиента
        const resPatient: any = await apiFetch(`/api/v1/clients/${patientId}/`);
        const data = resPatient?.data ?? resPatient;

        // 2. Приемы (фильтрация по клиенту)
        const resApts: any = await apiFetch(`/api/v1/appointments/?patient=${patientId}&pageSize=5&ordering=-appointment_at`);
        const aptsData = resApts?.data?.results || resApts?.results || [];

        if (active && data) {
          const lastApt = Array.isArray(data.appointments) ? data.appointments[0] : null;
          setPatient({
            id: String(data.id),
            fio: data.fullName || data.full_name || "Не указано",
            phone: data.phone || null,
            birthDate: data.birthDate || data.birth_date || null,
            inn: data.inn || null,
            photo_url: resolveUrl(data.photoUrl || data.photo_url),
            comment: data.comment || null,
            latestWeight: lastApt?.weight || null,
            latestHeight: lastApt?.height || null,
            latestTemperature: lastApt?.temperature || null,
          });
        }

        if (active && aptsData) {
          setRecentAppointments(
            aptsData.map((apt: any) => ({
              id: String(apt.id),
              appointment_at: apt.appointmentAt || apt.appointment_at || "",
              doctor_name: apt.doctor?.fullName || apt.doctor_name || "Не указан",
              service_names: Array.isArray(apt.procedures) 
                ? apt.procedures.map((p: any) => p.service?.name).filter(Boolean).join(", ")
                : apt.service_names || "Не указаны",
              status: apt.status || "planned",
            }))
          );
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных клиента:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => { active = false; };
  }, [patientId, open]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: 320, sm: 480 }, maxWidth: "100vw" } }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={600}>Информация о клиенте</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 2, overflowY: "auto", flex: 1 }}>
        {loading ? (
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={80} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="rectangular" height={200} />
          </Stack>
        ) : patient ? (
          <Stack spacing={3}>
            <Box>
              <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
                <Avatar src={patient.photo_url || undefined} sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>
                  {patient.fio?.charAt(0) || <PersonIcon />}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>{patient.fio}</Typography>
                  <Chip label="Клиент" size="small" color="primary" variant="outlined" />
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Телефон:</Typography>
                  <Typography variant="body2" fontWeight={500}>{patient.phone || "Не указано"}</Typography>
                </Stack>

                {patient.birthDate && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <CalendarIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">Дата рождения:</Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {dayjs(patient.birthDate).format("DD.MM.YYYY")}
                      <Box component="span" sx={{ ml: 1, color: "text.secondary" }}>
                        ({calculateAgeWithMonths(patient.birthDate)})
                      </Box>
                    </Typography>
                  </Stack>
                )}

                {(patient.latestWeight || patient.latestHeight || patient.latestTemperature) && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                      {patient.latestHeight && <Chip label={`Рост: ${patient.latestHeight} см`} size="small" variant="outlined" />}
                      {patient.latestWeight && <Chip label={`Вес: ${patient.latestWeight} кг`} size="small" variant="outlined" />}
                      {patient.latestTemperature && <Chip label={`Темп: ${patient.latestTemperature} °C`} size="small" variant="outlined" color={patient.latestTemperature > 37 ? "warning" : "default"} />}
                    </Stack>
                  </>
                )}
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <MedicalServicesIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>Последние приемы</Typography>
              </Stack>

              {recentAppointments.length > 0 ? (
                <List disablePadding>
                  {recentAppointments.map((appointment) => (
                    <ListItem key={appointment.id} sx={{ px: 0, py: 1.5, borderBottom: 1, borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={500}>{dayjs(appointment.appointment_at).format("DD.MM.YYYY HH:mm")}</Typography>
                            <Chip
                              label={getStatusConfig(appointment.status).label}
                              icon={getStatusConfig(appointment.status).icon}
                              size="small"
                              sx={(theme) => ({ ...getStatusChipStyles(appointment.status, theme), height: 20 })}
                            />
                          </Stack>
                        }
                        secondary={
                          <>
                            <Typography variant="caption" display="block" color="text.secondary">Врач: {appointment.doctor_name}</Typography>
                            <Typography variant="caption" display="block" color="text.secondary">Услуги: {appointment.service_names}</Typography>
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
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>Клиент не найден</Typography>
        )}
      </Box>

      {onStartAppointment && patient && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            startIcon={<AddIcon />}
            onClick={() => {
              onStartAppointment(patient.id);
              onClose();
            }}
          >
            Начать прием
          </Button>
        </Box>
      )}
    </Drawer>
  );
};

export default PatientQuickViewDrawer;

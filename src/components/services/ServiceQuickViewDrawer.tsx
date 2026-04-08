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
} from "@mui/material";
import {
  Close as CloseIcon,
  MedicalServices as MedicalServicesIcon,
  AttachMoney as AttachMoneyIcon,
  Person as PersonIcon,
  CalendarMonth as CalendarIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { apiFetch, resolveApiUrl } from "../../utility/apiClient";
import { formatKGS } from "../../utility/format";
import { getStatusChipStyles, getStatusConfig } from "../../config/appointmentStatuses";

dayjs.locale("ru");

function resolveUrl(url: string | null | undefined): string | undefined {
  return resolveApiUrl(url) ?? undefined;
}

// Интерфейс детальной информации об услуге
export interface ServiceDetail {
  id: string;
  name: string;
  price?: number | null;
  photoUrl?: string | null;
  employeeIds?: string[];
  description?: string | null;
  isActive?: boolean;
}

// Интерфейс для сотрудников, выполняющих услугу
interface ServiceEmployee {
  id: string;
  full_name: string;
  specialization?: string;
}

// Интерфейс для истории оказания услуги
interface ServiceHistory {
  id: string;
  appointment_at: string;
  formatted_date: string;
  patient_name: string;
  doctor_name: string;
  status: string;
}

export interface ServiceQuickViewDrawerProps {
  open: boolean;
  onClose: () => void;
  serviceId: string | null;
}

export const ServiceQuickViewDrawer: React.FC<ServiceQuickViewDrawerProps> = ({
  open,
  onClose,
  serviceId,
}) => {
  const [loading, setLoading] = useState(false);
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [employees, setEmployees] = useState<ServiceEmployee[]>([]);
  const [recentHistory, setRecentHistory] = useState<ServiceHistory[]>([]);

  useEffect(() => {
    if (!serviceId || !open) {
      setService(null);
      setEmployees([]);
      setRecentHistory([]);
      return;
    }

    let active = true;

    const fetchServiceData = async () => {
      try {
        setLoading(true);

        // Загружаем данные услуги из REST API
        const res: any = await apiFetch(`/api/v1/services/${serviceId}/`);
        const item = res?.data ?? res;

        if (!active) return;

        if (item) {
          setService({
            id: String(item.id ?? item.sellableItem ?? serviceId),
            name: item.name ?? "Не указано",
            price: item.price ?? item.priceSom ?? null,
            photoUrl: resolveUrl(item.imageUrl ?? item.image_url) ?? null,
            employeeIds: item.employeeIds ?? [],
            description: item.description ?? null,
            isActive: item.isActive ?? item.is_active ?? true,
          });

          // Загружаем сотрудников если есть
          const empIds: string[] = item.employeeIds ?? [];
          if (empIds.length > 0) {
            try {
              const empsRes: any = await apiFetch(`/api/v1/employees/?status=active`);
              const allEmps: any[] = empsRes?.data?.results ?? empsRes?.results ?? [];
              const filtered = allEmps.filter((e: any) =>
                empIds.includes(String(e.id))
              );
              if (active) {
                setEmployees(
                  filtered.map((e: any) => ({
                    id: String(e.id),
                    full_name: e.fullName ?? e.full_name ?? "Не указано",
                    specialization: e.role?.name ?? e.roleName ?? undefined,
                  }))
                );
              }
            } catch {
              // ignore employee load errors
            }
          }
        }

        // Загружаем последние приёмы с этой услугой
        try {
          const aptsRes: any = await apiFetch(
            `/api/v1/appointments/?ordering=-appointmentAt`
          );
          const apts: any[] = aptsRes?.data?.results ?? aptsRes?.results ?? [];

          // Фильтруем по serviceId в массиве services
          const filtered = apts
            .filter((apt: any) => {
              const services: any[] = Array.isArray(apt.services) ? apt.services : [];
              return services.some(
                (s: any) =>
                  String(s.sellableItem ?? s.sellable_item ?? s.id) === String(serviceId)
              );
            })
            .slice(0, 5);

          if (active) {
            setRecentHistory(
              filtered.map((apt: any) => {
                const patientNested = apt.patient ?? null;
                const patientName =
                  apt.patientName ??
                  apt.patient_name ??
                  patientNested?.fullName ??
                  patientNested?.full_name ??
                  "Не указан";
                const servicesArr: any[] = Array.isArray(apt.services) ? apt.services : [];
                const doctorName =
                  apt.doctorName ??
                  apt.doctor_name ??
                  servicesArr[0]?.performer?.fullName ??
                  "Не указан";
                return {
                  id: String(apt.id),
                  appointment_at: apt.appointmentAt ?? apt.appointment_at ?? "",
                  formatted_date: apt.appointmentAt
                    ? dayjs(apt.appointmentAt).format("DD.MM.YYYY HH:mm")
                    : "",
                  patient_name: patientName,
                  doctor_name: doctorName,
                  status: apt.status ?? "unknown",
                };
              })
            );
          }
        } catch {
          // ignore history load errors
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных услуги:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchServiceData();

    return () => {
      active = false;
    };
  }, [serviceId, open]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: 320, sm: 480, md: 520 },
          maxWidth: "100vw",
          overscrollBehavior: "contain",
        },
      }}
    >
      {/* Заголовок */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Информация об услуге
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Содержимое */}
      <Box
        sx={{
          p: 2,
          overflowY: "auto",
          flex: 1,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        }}
      >
        {loading ? (
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={80} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="rectangular" height={200} />
          </Stack>
        ) : service ? (
          <Stack spacing={3}>
            {/* Основная информация */}
            <Box>
              <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
                <Avatar
                  src={service.photoUrl || undefined}
                  sx={{
                    bgcolor: "success.main",
                    width: 56,
                    height: 56,
                  }}
                >
                  <MedicalServicesIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {service.name}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip label="Услуга" size="small" color="primary" variant="outlined" />
                    <Chip
                      label={service.isActive ? "Активна" : "Неактивна"}
                      size="small"
                      color={service.isActive ? "success" : "default"}
                      variant="filled"
                    />
                  </Stack>
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Стоимость */}
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <AttachMoneyIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Стоимость:
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {service.price ? formatKGS(service.price) : "Не указано"}
                  </Typography>
                </Stack>
              </Stack>

              {service.description && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Описание
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                      {service.description}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>

            <Divider />

            {/* Сотрудники, выполняющие услугу */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <PersonIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Сотрудники
                </Typography>
              </Stack>

              {employees.length > 0 ? (
                <List disablePadding>
                  {employees.map((employee) => (
                    <ListItem
                      key={employee.id}
                      sx={{
                        px: 0,
                        py: 1,
                        borderBottom: 1,
                        borderColor: "divider",
                        "&:last-child": {
                          borderBottom: 0,
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={500}>
                            {employee.full_name}
                          </Typography>
                        }
                        secondary={
                          employee.specialization && (
                            <Typography variant="caption" color="text.secondary">
                              {employee.specialization}
                            </Typography>
                          )
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                  Сотрудники не назначены
                </Typography>
              )}
            </Box>

            <Divider />

            {/* История оказания услуги */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <CalendarIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Последние приемы
                </Typography>
              </Stack>

              {recentHistory.length > 0 ? (
                <List disablePadding>
                  {recentHistory.map((appointment) => (
                    <ListItem
                      key={appointment.id}
                      sx={{
                        px: 0,
                        py: 1.5,
                        borderBottom: 1,
                        borderColor: "divider",
                        "&:last-child": {
                          borderBottom: 0,
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {appointment.formatted_date ||
                                dayjs(appointment.appointment_at).format("DD.MM.YYYY HH:mm")}
                            </Typography>
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
                            <Typography variant="caption" display="block" color="text.secondary">
                              Пациент: {appointment.patient_name}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                              Врач: {appointment.doctor_name}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                  Нет записей об оказании услуги
                </Typography>
              )}
            </Box>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            Услуга не найдена
          </Typography>
        )}
      </Box>
    </Drawer>
  );
};

export default ServiceQuickViewDrawer;

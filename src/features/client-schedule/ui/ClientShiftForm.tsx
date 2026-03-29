import React, { useState, useEffect } from "react";
import {
  Stack,
  TextField,
  Button,
  Typography,
  Box,
  CardContent,
  Chip,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { Save, Delete } from "@mui/icons-material";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ru";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CustomTimePicker, CustomDatePicker, AppCard } from "../../../components/ui";
import Autocomplete from "@mui/material/Autocomplete";
import { Client, ClientShift } from "../model/types";
import { fetchGroups, addParticipantToGroup } from "../../group-appointments/api/group-appointments.api";
import type { AppointmentGroup } from "../../group-appointments/model/types";
import { apiFetch } from "../../../utility/apiClient";

const WEEKDAYS = [
  { label: "ПН", value: "monday", dayOfWeek: 1 },
  { label: "ВТ", value: "tuesday", dayOfWeek: 2 },
  { label: "СР", value: "wednesday", dayOfWeek: 3 },
  { label: "ЧТ", value: "thursday", dayOfWeek: 4 },
  { label: "ПТ", value: "friday", dayOfWeek: 5 },
  { label: "СБ", value: "saturday", dayOfWeek: 6 },
  { label: "ВС", value: "sunday", dayOfWeek: 0 },
];

type ServiceOption = {
  id: string;
  label: string;
  maxParticipants?: number | null;
};

type Props = {
  initialDate: Dayjs | null;
  shiftToEdit?: ClientShift | null;
  allClients: Client[];
  onSuccess: (data: Omit<ClientShift, "id" | "client"> | Omit<ClientShift, "id" | "client">[]) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
};

const ClientShiftForm: React.FC<Props> = ({
  initialDate,
  shiftToEdit,
  allClients,
  onSuccess,
  onCancel,
  onDelete,
}) => {
  const [appointmentMode, setAppointmentMode] = useState<"single" | "group">("single");
  const [client, setClient] = useState<Client | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  // Услуга
  const [service, setService] = useState<ServiceOption | null>(null);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Групповые занятия
  const [groupSessions, setGroupSessions] = useState<AppointmentGroup[]>([]);
  const [groupSessionsLoading, setGroupSessionsLoading] = useState(false);
  // Карта: groupId -> состояние записи ("loading" | "done" | null)
  const [enrollState, setEnrollState] = useState<Record<string, "loading" | "done">>({});

  const mode = shiftToEdit ? "edit" : "create";
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Загрузка услуг
  useEffect(() => {
    setServicesLoading(true);
    apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&pageSize=200`)
      .then((res: any) => {
        const results: any[] = res?.data?.results ?? res?.results ?? [];
        setServiceOptions(
          results
            .map((r: any) => ({
              id: String(r.id ?? r.uuid ?? ""),
              label: r.displayName ?? r.display_name ?? r.name ?? "",
              maxParticipants: r.maxParticipants ?? r.max_participants ?? null,
            }))
            .filter((s: ServiceOption) => s.id)
        );
      })
      .catch(() => setServiceOptions([]))
      .finally(() => setServicesLoading(false));
  }, []);

  // Загрузка групповых занятий когда выбраны дни + услуга + групповой режим
  useEffect(() => {
    if (appointmentMode !== "group" || !service) {
      setGroupSessions([]);
      return;
    }

    const datesToFetch: string[] = [];

    if (selectedWeekdays.length > 0 && startDate && endDate) {
      // Режим диапазона — собираем даты по выбранным дням недели
      let cur = dayjs(startDate);
      const end = dayjs(endDate);
      while ((cur.isBefore(end) || cur.isSame(end, "day")) && datesToFetch.length < 60) {
        const isSelected = selectedWeekdays.some(
          (wd) => WEEKDAYS.find((w) => w.value === wd)?.dayOfWeek === cur.day()
        );
        if (isSelected) datesToFetch.push(cur.format("YYYY-MM-DD"));
        cur = cur.add(1, "day");
      }
    } else if (startDate) {
      // Один день
      datesToFetch.push(startDate);
    }

    if (datesToFetch.length === 0) {
      setGroupSessions([]);
      return;
    }

    setGroupSessionsLoading(true);
    Promise.all(datesToFetch.map((d) => fetchGroups(d)))
      .then((results) => {
        const all = results.flat();
        const filtered = all.filter((g) => {
          const matchesService = g.sellableItemId === service.id;
          const hasFreeSpots =
            g.maxParticipants == null || g.participants.length < g.maxParticipants;
          return matchesService && hasFreeSpots;
        });
        setGroupSessions(filtered);
        setEnrollState({});
      })
      .catch(() => setGroupSessions([]))
      .finally(() => setGroupSessionsLoading(false));
  }, [appointmentMode, selectedWeekdays, startDate, endDate, service]);

  useEffect(() => {
    if (shiftToEdit) {
      const c = allClients.find((item) => item.id === shiftToEdit.clientId);
      setClient(c || null);
      const sd = dayjs(shiftToEdit.date).format("YYYY-MM-DD");
      setStartDate(sd);
      setEndDate(sd);
      setStartTime(shiftToEdit.startTime);
      setEndTime(shiftToEdit.endTime);
      setSelectedWeekdays([]);
    } else if (initialDate) {
      setClient(null);
      setStartDate(initialDate.format("YYYY-MM-DD"));
      setEndDate(initialDate.format("YYYY-MM-DD"));
      setStartTime("09:00");
      setEndTime("18:00");
      setSelectedWeekdays([]);
      setTouched(false);
    }
  }, [shiftToEdit, initialDate, allClients]);

  const handleWeekdayToggle = (value: string) => {
    if (selectedWeekdays.length === 0 && startDate && endDate === startDate) {
      setEndDate(dayjs(startDate).add(1, "month").format("YYYY-MM-DD"));
    }
    setSelectedWeekdays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  };

  // Вычислить список дат
  const weekdayDates = React.useMemo(() => {
    if (selectedWeekdays.length === 0 || !startDate || !endDate) return [];
    const dates: string[] = [];
    let cur = dayjs(startDate);
    const end = dayjs(endDate);
    while ((cur.isBefore(end) || cur.isSame(end, "day")) && dates.length < 60) {
      const isSelected = selectedWeekdays.some(
        (wd) => WEEKDAYS.find((w) => w.value === wd)?.dayOfWeek === cur.day()
      );
      if (isSelected) dates.push(cur.format("YYYY-MM-DD"));
      cur = cur.add(1, "day");
    }
    return dates;
  }, [selectedWeekdays, startDate, endDate]);

  // Записать клиента в групповой приём
  const handleEnroll = async (group: AppointmentGroup) => {
    if (!client) return;
    setEnrollState((prev) => ({ ...prev, [group.id]: "loading" }));
    try {
      await addParticipantToGroup(group.id, {
        patientId: client.id,
        patientName: client.fullName,
      });
      setEnrollState((prev) => ({ ...prev, [group.id]: "done" }));
      // Убираем эту группу из списка (клиент уже записан)
      setGroupSessions((prev) => prev.filter((g) => g.id !== group.id));
    } catch {
      setEnrollState((prev) => {
        const next = { ...prev };
        delete next[group.id];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!client || !startDate) return;

    if (selectedWeekdays.length > 0) {
      const shifts: Omit<ClientShift, "id" | "client">[] = [];
      let current = dayjs(startDate);
      const end = dayjs(endDate);

      while (current.isBefore(end) || current.isSame(end, "day")) {
        const dayOfWeek = current.day();
        const isSelected = selectedWeekdays.some((wd) => {
          const weekday = WEEKDAYS.find((w) => w.value === wd);
          return weekday?.dayOfWeek === dayOfWeek;
        });
        if (isSelected) {
          shifts.push({
            clientId: client.id,
            date: current.format("YYYY-MM-DD"),
            startTime,
            endTime,
            isNextWeekEnd: false,
          });
        }
        current = current.add(1, "day");
      }

      if (shifts.length === 0) return;
      onSuccess(shifts);
    } else {
      onSuccess({
        clientId: client.id,
        date: startDate,
        startTime,
        endTime,
        isNextWeekEnd: false,
      });
    }
  };

  const isGroupMode = appointmentMode === "group";

  return (
    <Box px={2} py={2} sx={{ width: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
      <Stack spacing={3}>
        <Typography variant="h6" fontWeight={600}>
          {mode === "edit" ? "Редактировать смену" : "Новая смена клиента"}
        </Typography>

        {/* Тип приема */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Тип
          </Typography>
          <ToggleButtonGroup
            value={appointmentMode}
            exclusive
            onChange={(_, v) => {
              if (v) setAppointmentMode(v);
            }}
            size="small"
            fullWidth
          >
            <ToggleButton value="single">
              <PersonOutlined sx={{ fontSize: 16, mr: 0.5 }} />
              Обычный
            </ToggleButton>
            <ToggleButton value="group">
              <GroupsOutlined sx={{ fontSize: 16, mr: 0.5 }} />
              Групповой
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Клиент */}
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Клиент *
          </Typography>
          <Autocomplete
            options={allClients}
            value={client}
            onChange={(_, v) => setClient(v)}
            getOptionLabel={(o) => o.fullName}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Выберите клиента"
                fullWidth
                size="small"
                error={touched && !client}
                helperText={touched && !client ? "Выберите клиента" : ""}
              />
            )}
          />
        </Stack>

        {/* Услуга */}
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Услуга
          </Typography>
          <Autocomplete
            options={serviceOptions}
            value={service}
            onChange={(_, v) => setService(v)}
            loading={servicesLoading}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Выберите услугу"
                fullWidth
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {servicesLoading && <CircularProgress size={14} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Stack>

        {/* Дни недели — теперь ДО поля даты */}
        {!shiftToEdit && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Повтор по дням недели (не обязательно)
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {WEEKDAYS.map((day) => (
                <Chip
                  key={day.value}
                  label={day.label}
                  onClick={() => handleWeekdayToggle(day.value)}
                  color={selectedWeekdays.includes(day.value) ? "primary" : "default"}
                  variant={selectedWeekdays.includes(day.value) ? "filled" : "outlined"}
                  sx={{
                    fontWeight: selectedWeekdays.includes(day.value) ? 600 : 400,
                    cursor: "pointer",
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Дата начала */}
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            {selectedWeekdays.length > 0 ? "Дата начала *" : "Дата *"}
          </Typography>
          <CustomDatePicker
            value={startDate ? dayjs(startDate) : null}
            onChange={(val) => {
              const newDate = val ? val.format("YYYY-MM-DD") : "";
              setStartDate(newDate);
              if (selectedWeekdays.length === 0) {
                setEndDate(newDate);
              } else if (!endDate || endDate < newDate) {
                setEndDate(newDate);
              }
            }}
            slotProps={{ textField: { fullWidth: true, size: "small" } }}
          />
        </Stack>

        {/* Дата окончания диапазона */}
        {selectedWeekdays.length > 0 && (
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Дата окончания диапазона
            </Typography>
            <CustomDatePicker
              value={endDate ? dayjs(endDate) : null}
              onChange={(val) => setEndDate(val ? val.format("YYYY-MM-DD") : "")}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </Stack>
        )}

        {/* Время — только для обычного режима */}
        {!isGroupMode && (
          <AppCard variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  Время приема
                </Typography>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <Stack direction="row" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{ mb: 0.5, display: "block", color: "text.secondary" }}
                      >
                        Начало
                      </Typography>
                      <CustomTimePicker
                        value={dayjs(`2000-01-01T${startTime}`)}
                        onChange={(val) => setStartTime(val ? val.format("HH:mm") : "")}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{ mb: 0.5, display: "block", color: "text.secondary" }}
                      >
                        Конец
                      </Typography>
                      <CustomTimePicker
                        value={dayjs(`2000-01-01T${endTime}`)}
                        onChange={(val) => setEndTime(val ? val.format("HH:mm") : "")}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </Box>
                  </Stack>
                </LocalizationProvider>
              </Stack>
            </CardContent>
          </AppCard>
        )}

        {/* Сводка по диапазону дат */}
        {selectedWeekdays.length > 0 && startDate && endDate && (
          <Box>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              Смены на{" "}
              {WEEKDAYS
                .filter((w) => selectedWeekdays.includes(w.value))
                .map((w) => w.label)
                .join(", ")}{" "}
              с {dayjs(startDate).format("DD.MM.YYYY")} по {dayjs(endDate).format("DD.MM.YYYY")} (
              {weekdayDates.length} дней)
            </Alert>
            {weekdayDates.length > 0 && (
              <Box sx={{ mt: 1, maxHeight: 140, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 0.5, p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
                {weekdayDates.map((dateStr) => (
                  <Chip
                    key={dateStr}
                    label={dayjs(dateStr).locale("ru").format("dd D MMM")}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: 11, height: 22 }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Групповые занятия */}
        {isGroupMode && (startDate || selectedWeekdays.length > 0) && (
          <Box>
            <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
              Доступные групповые занятия
            </Typography>

            {!service ? (
              <Alert severity="info" sx={{ fontSize: 13 }}>
                Выберите услугу чтобы увидеть доступные занятия
              </Alert>
            ) : groupSessionsLoading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                <CircularProgress size={24} />
              </Stack>
            ) : groupSessions.length === 0 ? (
              <Alert severity="warning" sx={{ fontSize: 13 }}>
                Нет доступных групповых занятий по выбранной услуге
              </Alert>
            ) : (
              <Stack spacing={1}>
                {groupSessions.map((g) => {
                  const state = enrollState[g.id];
                  const alreadyIn = g.participants.some((p) => p.patientId === client?.id);
                  return (
                    <Paper key={g.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                      <Stack direction="row" alignItems="flex-start" spacing={1}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight={700} noWrap>
                            {g.sellableItemName}
                          </Typography>
                          <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <AccessTimeOutlined sx={{ fontSize: 13, color: "text.secondary" }} />
                              <Typography variant="caption" color="text.secondary">
                                {dayjs(g.appointmentAt).format("DD.MM, HH:mm")}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <PeopleOutlined sx={{ fontSize: 13, color: "text.secondary" }} />
                              <Typography variant="caption" color="text.secondary">
                                {g.participants.length}
                                {g.maxParticipants != null ? `/${g.maxParticipants}` : ""} уч.
                              </Typography>
                            </Stack>
                          </Stack>
                          <Typography
                            variant="caption"
                            color="primary.main"
                            fontWeight={600}
                            noWrap
                          >
                            {g.performerName}
                          </Typography>
                        </Box>

                        <Stack alignItems="flex-end" spacing={0.75}>
                          {g.maxParticipants != null && (
                            <Chip
                              label={`${g.maxParticipants - g.participants.length} мест`}
                              size="small"
                              color="success"
                              sx={{ height: 22, fontSize: 11 }}
                            />
                          )}
                          {alreadyIn ? (
                            <Chip
                              icon={<CheckCircleOutlined sx={{ fontSize: 14 }} />}
                              label="Уже записан"
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ height: 24, fontSize: 11 }}
                            />
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={
                                state === "loading" ? (
                                  <CircularProgress size={12} color="inherit" />
                                ) : (
                                  <PersonAddOutlined sx={{ fontSize: 14 }} />
                                )
                              }
                              disabled={!client || state === "loading"}
                              onClick={() => handleEnroll(g)}
                              sx={{ fontSize: 12, py: 0.25, px: 1, minWidth: 0 }}
                            >
                              {state === "loading" ? "..." : "Записать"}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}

        {/* Кнопки */}
        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
          <Button onClick={onCancel} sx={{ minWidth: 0 }}>
            Отмена
          </Button>
          {/* В групповом режиме основная кнопка — только создать расписание (запись идёт через «Записать») */}
          <Button
            variant={isGroupMode ? "outlined" : "contained"}
            onClick={handleSubmit}
            disabled={!client || !startDate}
            startIcon={mode === "edit" ? <Save /> : undefined}
            sx={{ minWidth: 0 }}
          >
            {isGroupMode
              ? "Создать расписание"
              : mode === "edit"
              ? "Сохранить"
              : "Добавить"}
          </Button>
          {mode === "edit" && onDelete && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setDeleteConfirmOpen(true)}
              startIcon={<Delete />}
              sx={{ minWidth: 0 }}
            >
              Удалить
            </Button>
          )}
        </Stack>
      </Stack>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Удалить клиента из расписания?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Запись клиента будет удалена из расписания. Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setDeleteConfirmOpen(false);
              if (shiftToEdit) onDelete!(shiftToEdit.id);
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientShiftForm;

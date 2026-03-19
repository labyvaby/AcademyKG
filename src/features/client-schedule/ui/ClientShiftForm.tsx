import React, { useState, useEffect } from "react";
import {
  Stack,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  CardContent,
  Chip,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Paper,
  Divider,
} from "@mui/material";
import { Save, Delete } from "@mui/icons-material";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import dayjs, { Dayjs } from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CustomTimePicker, CustomDatePicker, AppCard } from "../../../components/ui";
import Autocomplete from "@mui/material/Autocomplete";
import { Client, ClientShift } from "../model/types";
import { fetchGroups } from "../../group-appointments/api/group-appointments.api";
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
  onSuccess: (data: Omit<ClientShift, 'id' | 'client'> | Omit<ClientShift, 'id' | 'client'>[]) => void;
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  // Услуга
  const [service, setService] = useState<ServiceOption | null>(null);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Групповые занятия по выбранным дням
  const [groupSessions, setGroupSessions] = useState<AppointmentGroup[]>([]);
  const [groupSessionsLoading, setGroupSessionsLoading] = useState(false);

  const mode = shiftToEdit ? 'edit' : 'create';

  // Загрузка услуг
  useEffect(() => {
    setServicesLoading(true);
    apiFetch(`/api/v1/sellable-items/?type=service&isActive=true&page_size=200`)
      .then((res: any) => {
        const results: any[] = res?.data?.results ?? res?.results ?? [];
        setServiceOptions(results.map((r: any) => ({
          id: String(r.id ?? r.uuid ?? ''),
          label: r.displayName ?? r.display_name ?? r.name ?? '',
          maxParticipants: r.maxParticipants ?? r.max_participants ?? null,
        })).filter((s: ServiceOption) => s.id));
      })
      .catch(() => setServiceOptions([]))
      .finally(() => setServicesLoading(false));
  }, []);

  // Загрузка групповых занятий когда выбраны дни + услуга + групповой режим
  useEffect(() => {
    if (appointmentMode !== "group" || selectedWeekdays.length === 0 || !startDate || !endDate || !service) {
      setGroupSessions([]);
      return;
    }

    setGroupSessionsLoading(true);

    // Собираем все даты в диапазоне, которые попадают на выбранные дни недели
    const dates: string[] = [];
    let cur = dayjs(startDate);
    const end = dayjs(endDate);
    while ((cur.isBefore(end) || cur.isSame(end, 'day')) && dates.length < 60) {
      const isSelected = selectedWeekdays.some(wd =>
        WEEKDAYS.find(w => w.value === wd)?.dayOfWeek === cur.day()
      );
      if (isSelected) dates.push(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }

    // Загружаем группы для каждой даты
    Promise.all(dates.map(d => fetchGroups(d)))
      .then((results) => {
        const all = results.flat();
        // Фильтр: под нужную услугу + есть свободные места
        const filtered = all.filter(g => {
          const matchesService = g.sellableItemId === service.id;
          const hasFreeSpots = g.maxParticipants == null || g.participants.length < g.maxParticipants;
          return matchesService && hasFreeSpots;
        });
        setGroupSessions(filtered);
      })
      .catch(() => setGroupSessions([]))
      .finally(() => setGroupSessionsLoading(false));
  }, [appointmentMode, selectedWeekdays, startDate, endDate, service]);

  useEffect(() => {
    if (shiftToEdit) {
      const c = allClients.find(item => item.id === shiftToEdit.clientId);
      setClient(c || null);
      const sd = dayjs(shiftToEdit.date).format('YYYY-MM-DD');
      setStartDate(sd);
      setEndDate(sd);
      setStartTime(shiftToEdit.startTime);
      setEndTime(shiftToEdit.endTime);
      setSelectedWeekdays([]);
    } else if (initialDate) {
      setClient(null);
      setStartDate(initialDate.format('YYYY-MM-DD'));
      setEndDate(initialDate.format('YYYY-MM-DD'));
      setStartTime('09:00');
      setEndTime('18:00');
      setSelectedWeekdays([]);
      setTouched(false);
    }
  }, [shiftToEdit, initialDate, allClients]);

  const handleWeekdayToggle = (value: string) => {
    if (selectedWeekdays.length === 0 && startDate && endDate === startDate) {
      setEndDate(dayjs(startDate).add(1, 'month').format('YYYY-MM-DD'));
    }
    setSelectedWeekdays(prev =>
      prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]
    );
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!client || !startDate) return;

    if (selectedWeekdays.length > 0) {
      const shifts: Omit<ClientShift, 'id' | 'client'>[] = [];
      let current = dayjs(startDate);
      const end = dayjs(endDate);

      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dayOfWeek = current.day();
        const isSelected = selectedWeekdays.some(wd => {
          const weekday = WEEKDAYS.find(w => w.value === wd);
          return weekday?.dayOfWeek === dayOfWeek;
        });
        if (isSelected) {
          shifts.push({
            clientId: client.id,
            date: current.format('YYYY-MM-DD'),
            startTime,
            endTime,
            isNextWeekEnd: false,
          });
        }
        current = current.add(1, 'day');
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

  // Вычислить список дат, попадающих на выбранные дни недели
  const weekdayDates = React.useMemo(() => {
    if (selectedWeekdays.length === 0 || !startDate || !endDate) return [];
    const dates: string[] = [];
    let cur = dayjs(startDate);
    const end = dayjs(endDate);
    while ((cur.isBefore(end) || cur.isSame(end, 'day')) && dates.length < 60) {
      const isSelected = selectedWeekdays.some(wd =>
        WEEKDAYS.find(w => w.value === wd)?.dayOfWeek === cur.day()
      );
      if (isSelected) dates.push(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }
    return dates;
  }, [selectedWeekdays, startDate, endDate]);

  return (
    <Box px={2} py={2} sx={{ width: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
      <Stack spacing={3}>
        <Typography variant="h6" fontWeight={600}>
          {mode === 'edit' ? 'Редактировать смену' : 'Новая смена клиента'}
        </Typography>

        {/* Тип приема */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Тип</Typography>
          <ToggleButtonGroup
            value={appointmentMode}
            exclusive
            onChange={(_, v) => { if (v) setAppointmentMode(v); }}
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
          <Typography variant="body2" color="text.secondary">Клиент *</Typography>
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
          <Typography variant="body2" color="text.secondary">Услуга</Typography>
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
                    <>{servicesLoading && <CircularProgress size={14} />}{params.InputProps.endAdornment}</>
                  ),
                }}
              />
            )}
          />
        </Stack>

        {/* Дата */}
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">Дата *</Typography>
          <CustomDatePicker
            value={startDate ? dayjs(startDate) : null}
            onChange={(val) => {
              const newDate = val ? val.format('YYYY-MM-DD') : '';
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

        {/* Дата окончания диапазона (только при выбранных днях недели) */}
        {selectedWeekdays.length > 0 && (
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">Дата окончания диапазона</Typography>
            <CustomDatePicker
              value={endDate ? dayjs(endDate) : null}
              onChange={(val) => setEndDate(val ? val.format('YYYY-MM-DD') : '')}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </Stack>
        )}

        {/* Время */}
        <AppCard variant="outlined">
          <CardContent sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Время приема
              </Typography>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>Начало</Typography>
                    <CustomTimePicker
                      value={dayjs(`2000-01-01T${startTime}`)}
                      onChange={(val) => setStartTime(val ? val.format("HH:mm") : "")}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>Конец</Typography>
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

        {/* Дни недели */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Рабочие дни недели (не обязательно)
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {WEEKDAYS.map((day) => (
              <Chip
                key={day.value}
                label={day.label}
                onClick={() => handleWeekdayToggle(day.value)}
                color={selectedWeekdays.includes(day.value) ? "primary" : "default"}
                variant={selectedWeekdays.includes(day.value) ? "filled" : "outlined"}
                sx={{ fontWeight: selectedWeekdays.includes(day.value) ? 600 : 400, cursor: 'pointer' }}
              />
            ))}
          </Stack>

          {selectedWeekdays.length > 0 && startDate && endDate && (
            <>
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                Будут созданы смены на {selectedWeekdays.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')}
                {' '}с {dayjs(startDate).format('DD.MM.YYYY')} по {dayjs(endDate).format('DD.MM.YYYY')}
              </Alert>

              {/* Список конкретных дат */}
              {weekdayDates.length > 0 && (
                <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pt: 1, pb: 0.5, fontWeight: 600 }}>
                    Будет создано {weekdayDates.length} смен{weekdayDates.length === 1 ? 'а' : weekdayDates.length < 5 ? 'ы' : ''}:
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ px: 1.5, pb: 1 }}>
                    {weekdayDates.map(d => (
                      <Chip
                        key={d}
                        label={dayjs(d).format('dd, DD MMM')}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: 11, height: 22 }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Групповые занятия (только в групповом режиме) */}
              {appointmentMode === "group" && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
                    Доступные групповые занятия
                  </Typography>

                  {!service ? (
                    <Alert severity="info" sx={{ fontSize: 13 }}>
                      Выберите услугу, чтобы увидеть подходящие групповые занятия
                    </Alert>
                  ) : groupSessionsLoading ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                      <CircularProgress size={24} />
                    </Stack>
                  ) : groupSessions.length === 0 ? (
                    <Alert severity="warning" sx={{ fontSize: 13 }}>
                      Нет доступных групповых занятий по выбранной услуге на эти дни
                    </Alert>
                  ) : (
                    <Stack spacing={1}>
                      {groupSessions.map((g) => (
                        <Paper
                          key={g.id}
                          variant="outlined"
                          sx={{ p: 1.5, borderRadius: 1.5 }}
                        >
                          <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle2" fontWeight={700} noWrap>
                                {g.sellableItemName}
                              </Typography>
                              <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <AccessTimeOutlined sx={{ fontSize: 13, color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {dayjs(g.appointmentAt).format('DD.MM, HH:mm')}
                                  </Typography>
                                </Stack>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <PeopleOutlined sx={{ fontSize: 13, color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {g.participants.length}
                                    {g.maxParticipants != null ? `/${g.maxParticipants}` : ''} уч.
                                  </Typography>
                                </Stack>
                              </Stack>
                              <Typography variant="caption" color="primary.main" fontWeight={600} noWrap>
                                {g.performerName}
                              </Typography>
                            </Box>
                            {g.maxParticipants != null && (
                              <Chip
                                label={`${g.maxParticipants - g.participants.length} мест`}
                                size="small"
                                color="success"
                                sx={{ height: 22, fontSize: 11 }}
                              />
                            )}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Кнопки */}
        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
          <Button onClick={onCancel} sx={{ minWidth: 0 }}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!client || !startDate}
            startIcon={mode === 'edit' ? <Save /> : undefined}
            sx={{ minWidth: 0 }}
          >
            {mode === 'edit' ? 'Сохранить' : 'Добавить'}
          </Button>
          {mode === 'edit' && onDelete && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => shiftToEdit && onDelete(shiftToEdit.id)}
              startIcon={<Delete />}
              sx={{ minWidth: 0 }}
            >
              Удалить
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default ClientShiftForm;

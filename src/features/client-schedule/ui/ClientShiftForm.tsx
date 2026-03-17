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
} from "@mui/material";
import { Save, Delete } from "@mui/icons-material";
import dayjs, { Dayjs } from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CustomTimePicker, CustomDatePicker, AppCard } from "../../../components/ui";
import Autocomplete from "@mui/material/Autocomplete";
import { Client, ClientShift } from "../model/types";

const WEEKDAYS = [
  { label: "ПН", value: "monday", dayOfWeek: 1 },
  { label: "ВТ", value: "tuesday", dayOfWeek: 2 },
  { label: "СР", value: "wednesday", dayOfWeek: 3 },
  { label: "ЧТ", value: "thursday", dayOfWeek: 4 },
  { label: "ПТ", value: "friday", dayOfWeek: 5 },
  { label: "СБ", value: "saturday", dayOfWeek: 6 },
  { label: "ВС", value: "sunday", dayOfWeek: 0 },
];

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
  const [client, setClient] = useState<Client | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const mode = shiftToEdit ? 'edit' : 'create';

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

  return (
    <Box px={2} py={2} sx={{ width: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
      <Stack spacing={3}>
        <Typography variant="h6" fontWeight={600}>
          {mode === 'edit' ? 'Редактировать смену' : 'Новая смена клиента'}
        </Typography>

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
          {selectedWeekdays.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              Будут созданы смены на {selectedWeekdays.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')}
              {' '}с {dayjs(startDate).format('DD.MM.YYYY')} по {dayjs(endDate).format('DD.MM.YYYY')}
            </Alert>
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

import React, { useState, useEffect } from "react";
import {
  Stack,
  TextField,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
  Divider,
} from "@mui/material";
import { Save, RestaurantMenu, Close, Delete } from "@mui/icons-material";
import dayjs, { Dayjs } from "dayjs";
import { roundMinutesToStep } from "../../utility/time";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CustomTimePicker, CustomDatePicker } from "../ui";
import { useNotification } from "@refinedev/core";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";

type Employee = {
  id: string;
  full_name: string;
  specialization?: string;
};

type Shift = {
  id: string;
  employes_id: string;
  startDate: string;
  endDate: string;
  start_time?: string;
  end_time?: string;
  is_night_shift?: boolean;
  lunch_start?: string;
  lunch_end?: string;
  weekdays?: string[];
  employee?: Employee | null;
};

type Props = {
  initialDate: Dayjs | null;
  shiftToEdit?: Shift | null;
  allEmployees: Employee[];
  onSuccess: (data: Omit<Shift, 'id' | 'employee'> | Omit<Shift, 'id' | 'employee'>[]) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  isDoctor?: boolean;
  currentEmployeeId?: string | null;
};

const WEEKDAYS = [
  { label: "ПН", value: "monday", dayOfWeek: 1 },
  { label: "ВТ", value: "tuesday", dayOfWeek: 2 },
  { label: "СР", value: "wednesday", dayOfWeek: 3 },
  { label: "ЧТ", value: "thursday", dayOfWeek: 4 },
  { label: "ПТ", value: "friday", dayOfWeek: 5 },
  { label: "СБ", value: "saturday", dayOfWeek: 6 },
  { label: "ВС", value: "sunday", dayOfWeek: 0 },
];

const employeeFilter = createFilterOptions<Employee>({
  matchFrom: "start",
  stringify: (o) => `${o.full_name ?? ""} ${o.specialization ?? ""}`.trim(),
});

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
    {children}
  </Typography>
);

const ShiftForm: React.FC<Props> = ({
  initialDate,
  shiftToEdit,
  allEmployees,
  onSuccess,
  onCancel,
  onDelete,
  isDoctor,
  currentEmployeeId,
}) => {
  const { open: notify } = useNotification();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [hasLunch, setHasLunch] = useState(false);
  const [lunchStart, setLunchStart] = useState('13:00');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const mode = shiftToEdit ? 'edit' : 'create';

  const lunchEnd = React.useMemo(() => {
    if (!lunchStart) return '';
    const [h, m] = lunchStart.split(':').map(Number);
    return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [lunchStart]);

  useEffect(() => {
    if (shiftToEdit) {
      const emp = allEmployees.find(e => e.id === shiftToEdit.employes_id);
      setEmployee(emp || null);
      const sd = dayjs(shiftToEdit.startDate).format('YYYY-MM-DD');
      const ed = dayjs(shiftToEdit.endDate).format('YYYY-MM-DD');
      setStartDate(sd);
      setEndDate(ed);
      setStartTime(roundMinutesToStep(shiftToEdit.start_time?.slice(0, 5) || '09:00', 15));
      setEndTime(roundMinutesToStep(shiftToEdit.end_time?.slice(0, 5) || '18:00', 15));
      const hasLunchTime = !!(shiftToEdit.lunch_start && shiftToEdit.lunch_end);
      setHasLunch(hasLunchTime);
      if (hasLunchTime) setLunchStart(shiftToEdit.lunch_start?.slice(0, 5) || '13:00');
      setSelectedWeekdays(shiftToEdit.weekdays || []);
    } else if (initialDate) {
      if (isDoctor && currentEmployeeId) {
        setEmployee(allEmployees.find(e => e.id === currentEmployeeId) || null);
      } else {
        setEmployee(null);
      }
      setStartDate(initialDate.format('YYYY-MM-DD'));
      setEndDate(initialDate.format('YYYY-MM-DD'));
      setStartTime('09:00');
      setEndTime('18:00');
      setHasLunch(false);
      setLunchStart('13:00');
      setSelectedWeekdays([]);
      setTouched(false);
    }
  }, [shiftToEdit, initialDate, allEmployees]);

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
    if (!employee || !startDate || !endDate) return;

    if (selectedWeekdays.length > 0) {
      const shifts: Omit<Shift, 'id' | 'employee'>[] = [];
      let current = dayjs(startDate);
      const end = dayjs(endDate);
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const isSelected = selectedWeekdays.some(wd =>
          WEEKDAYS.find(w => w.value === wd)?.dayOfWeek === current.day()
        );
        if (isSelected) {
          shifts.push({
            employes_id: employee.id,
            startDate: current.format('YYYY-MM-DD'),
            endDate: current.format('YYYY-MM-DD'),
            start_time: startTime,
            end_time: endTime,
            is_night_shift: false,
            lunch_start: hasLunch ? lunchStart : undefined,
            lunch_end: hasLunch ? lunchEnd : undefined,
            weekdays: selectedWeekdays,
          });
        }
        current = current.add(1, 'day');
      }
      if (shifts.length === 0) {
        notify?.({ type: "error", message: "В указанном диапазоне нет выбранных дней недели!" });
        return;
      }
      onSuccess(shifts);
    } else {
      onSuccess({
        employes_id: employee.id,
        startDate,
        endDate,
        start_time: startTime,
        end_time: endTime,
        is_night_shift: false,
        lunch_start: hasLunch ? lunchStart : undefined,
        lunch_end: hasLunch ? lunchEnd : undefined,
        weekdays: selectedWeekdays,
      });
    }
  };

  return (
    <Box
      px={2.5}
      py={2.5}
      sx={{ width: "100%", boxSizing: "border-box", overflowX: "hidden", overflowY: "auto" }}
    >
      <Stack spacing={2.5}>
        <Typography variant="h6" fontWeight={600}>
          {mode === 'edit' ? 'Редактировать смену' : 'Новая смена'}
        </Typography>

        {/* Сотрудник */}
        <Box>
          <Label>Сотрудник *</Label>
          <Autocomplete
            options={allEmployees}
            value={employee}
            disabled={isDoctor}
            onChange={(_, v) => setEmployee(v)}
            getOptionLabel={(o) =>
              `${o.full_name || o.id}${o.specialization ? ` — ${o.specialization}` : ""}`
            }
            filterOptions={employeeFilter}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Выберите сотрудника"
                fullWidth
                size="small"
                error={touched && !employee}
                helperText={touched && !employee ? "Выберите сотрудника" : ""}
              />
            )}
          />
        </Box>

        {employee && (
          <>
            <Divider />

            {/* Дата начала */}
            <Box>
              <Label>Дата *</Label>
              <CustomDatePicker
                value={startDate ? dayjs(startDate) : null}
                onChange={(val) => {
                  const d = val ? val.format('YYYY-MM-DD') : '';
                  setStartDate(d);
                  if (selectedWeekdays.length === 0) {
                    setEndDate(d);
                  } else if (!endDate || endDate < d) {
                    setEndDate(d);
                  }
                }}
                slotProps={{ textField: { fullWidth: true, size: "small" } }}
              />
            </Box>

            {/* Дата окончания диапазона (только при выбранных днях) */}
            {selectedWeekdays.length > 0 && (
              <Box>
                <Label>Дата окончания диапазона</Label>
                <CustomDatePicker
                  value={endDate ? dayjs(endDate) : null}
                  onChange={(val) => setEndDate(val ? val.format('YYYY-MM-DD') : '')}
                  slotProps={{ textField: { fullWidth: true, size: "small" } }}
                />
              </Box>
            )}

            {/* Время начала и конца */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Stack direction="row" spacing={1.5}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Label>Начало</Label>
                  <CustomTimePicker
                    value={dayjs(`2000-01-01T${startTime}`)}
                    onChange={(val) => setStartTime(val ? val.format("HH:mm") : "")}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Label>Конец</Label>
                  <CustomTimePicker
                    value={dayjs(`2000-01-01T${endTime}`)}
                    onChange={(val) => setEndTime(val ? val.format("HH:mm") : "")}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                  />
                </Box>
              </Stack>


              {/* Обед */}
              {!hasLunch ? (
                <Box>
                  <Button
                    variant="outlined"
                    startIcon={<RestaurantMenu />}
                    onClick={() => setHasLunch(true)}
                    size="small"
                  >
                    Добавить обед
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Label>Обеденный перерыв (1 час)</Label>
                    <Button
                      size="small"
                      startIcon={<Close />}
                      onClick={() => setHasLunch(false)}
                      color="error"
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      Убрать
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1.5}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Label>Начало обеда</Label>
                      <CustomTimePicker
                        value={dayjs(`2000-01-01T${lunchStart}`)}
                        onChange={(val) => setLunchStart(val ? val.format("HH:mm") : "")}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Label>Конец обеда</Label>
                      <TextField value={lunchEnd} size="small" fullWidth disabled />
                    </Box>
                  </Stack>
                </Box>
              )}
            </LocalizationProvider>

            <Divider />

            {/* Дни недели */}
            <Box>
              <Label>Рабочие дни недели (не обязательно)</Label>
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
                    Смены на {selectedWeekdays.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')}
                    {' '}с {dayjs(startDate).format('DD.MM.YYYY')} по {dayjs(endDate).format('DD.MM.YYYY')}
                  </Alert>

                  {/* Список конкретных дат, которые попадают под выбранные дни недели */}
                  {(() => {
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
                    if (dates.length === 0) return null;
                    return (
                      <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pt: 1, pb: 0.5, fontWeight: 600 }}>
                          Будет создано {dates.length} смен{dates.length === 1 ? 'а' : dates.length < 5 ? 'ы' : ''}:
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ px: 1.5, pb: 1 }}>
                          {dates.map(d => (
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
                    );
                  })()}
                </>
              )}
            </Box>
          </>
        )}

        {/* Кнопки */}
        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
          <Button onClick={onCancel} color="inherit" sx={{ minWidth: 0 }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            startIcon={mode === 'edit' ? <Save /> : undefined}
            disableElevation
            disabled={!employee || !startDate || !endDate}
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

export default ShiftForm;

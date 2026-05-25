import * as React from "react";
import TextField from "@mui/material/TextField";
import dayjs, { Dayjs } from "dayjs";

/**
 * CustomTimePicker — простой ввод времени HH:mm.
 *
 * Раньше использовался MUI X TimePicker с круговым clock — он сложен для
 * пользователей на телефоне. Заменили на нативный <input type="time">
 * (через MUI TextField), который:
 *  - открывает системный time-picker на мобильных;
 *  - на десктопе показывает обычное поле с up/down;
 *  - 24-часовой формат HH:mm (нативно);
 *  - валидирует часы 00-23 и минуты 00-59 средствами браузера.
 *
 * Тип пропсов оставлен совместимым с прежней оболочкой (Dayjs value/onChange,
 * minutesStep, slotProps.textField, label, disabled).
 */
type CustomTimePickerProps = {
  value?: Dayjs | null;
  onChange?: (value: Dayjs | null) => void;
  minutesStep?: number;
  disabled?: boolean;
  label?: React.ReactNode;
  slotProps?: { textField?: Record<string, any> };
};

function dayjsToHHmm(value: Dayjs | null | undefined): string {
  if (!value || !value.isValid?.()) return "";
  return value.format("HH:mm");
}

function hhmmToDayjs(text: string, base: Dayjs | null | undefined): Dayjs | null {
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const baseDate = base && base.isValid?.() ? base : dayjs();
  return baseDate.hour(hours).minute(minutes).second(0).millisecond(0);
}

export function CustomTimePicker(props: CustomTimePickerProps) {
  const { value, onChange, minutesStep, slotProps, disabled, label } = props;
  const textFieldProps = (slotProps?.textField as Record<string, any> | undefined) ?? {};

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    if (!text) {
      onChange?.(null);
      return;
    }
    const parsed = hhmmToDayjs(text, value ?? null);
    if (parsed) onChange?.(parsed);
  };

  return (
    <TextField
      {...textFieldProps}
      type="time"
      label={label ?? textFieldProps.label}
      value={dayjsToHHmm(value)}
      onChange={handleChange}
      disabled={disabled ?? textFieldProps.disabled}
      inputProps={{
        step: (minutesStep ?? 15) * 60,
        ...(textFieldProps.inputProps ?? {}),
      }}
      InputLabelProps={{
        shrink: true,
        ...(textFieldProps.InputLabelProps ?? {}),
      }}
    />
  );
}

export type { CustomTimePickerProps };

export default CustomTimePicker;
export type { TimePickerProps } from "@mui/x-date-pickers/TimePicker";

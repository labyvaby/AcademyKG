import * as React from "react";
import { MobileDateTimePicker } from "@mui/x-date-pickers/MobileDateTimePicker";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

/**
 * Обёртка над MUI X DateTimePicker.
 *
 * На мобиле — MobileDateTimePicker (диалог, тап по полю открывает picker,
 * не ломается при быстрых кликах next month). На десктопе — обычный DateTimePicker.
 *
 * `reduceAnimations: true` устраняет визуальный сбой "месяц уезжает наверх"
 * при быстрых последовательных кликах по стрелке месяца.
 *
 * Контекст локализации (LocalizationProvider + AdapterDayjs + ruRU) задаётся
 * на уровне App.tsx; здесь его не пересоздаём.
 */
export type CustomDateTimePickerProps = React.ComponentProps<typeof DateTimePicker>;

export function CustomDateTimePicker(props: CustomDateTimePickerProps) {
  const { minutesStep, slotProps, ...rest } = props;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const commonProps = {
    minutesStep: minutesStep ?? 15,
    shouldDisableTime: (value: any, view: string) =>
      view === "minutes" && value.minute() % (minutesStep ?? 15) !== 0,
    reduceAnimations: true,
    slotProps: {
      ...slotProps,
      textField: {
        ...slotProps?.textField,
      },
      digitalClock: { skipDisabled: true } as any,
      multiSectionDigitalClock: { skipDisabled: true } as any,
    },
  } as const;

  return isMobile ? (
    <MobileDateTimePicker {...rest} {...commonProps} />
  ) : (
    <DateTimePicker skipDisabled={true} {...rest} {...commonProps} />
  );
}

export default CustomDateTimePicker;

import * as React from "react";
import { MobileDatePicker } from "@mui/x-date-pickers/MobileDatePicker";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

/**
 * Обёртка над MUI X DatePicker.
 *
 * На мобиле используется MobileDatePicker (открывается обычным тапом по полю,
 * рендерится в диалоге — устойчив к быстрым кликам по стрелке месяца).
 * На десктопе остаётся DatePicker (popper).
 *
 * `reduceAnimations` подавляет переходный CSS-transition между месяцами —
 * именно он "уезжал" наверх при быстрых последовательных кликах по стрелке.
 *
 * Контекст локализации (LocalizationProvider + AdapterDayjs + ruRU) задаётся
 * на уровне App.tsx; здесь его не пересоздаём.
 */
export type CustomDatePickerProps = React.ComponentProps<typeof DatePicker>;

export function CustomDatePicker(props: CustomDatePickerProps) {
  const { slotProps, ...rest } = props;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const textFieldProps = slotProps?.textField as Record<string, any> | undefined;
  const isFullWidth = textFieldProps?.fullWidth;

  const commonProps = {
    reduceAnimations: true,
    slotProps: {
      ...slotProps,
      textField: {
        ...slotProps?.textField,
        ...(isFullWidth ? { sx: { ...(textFieldProps?.sx ?? {}), width: "100%" } } : {}),
      },
    },
  } as const;

  const picker = isMobile ? (
    <MobileDatePicker {...rest} {...commonProps} />
  ) : (
    <DatePicker {...rest} {...commonProps} />
  );

  if (isFullWidth) {
    return <Box sx={{ width: "100%" }}>{picker}</Box>;
  }
  return picker;
}

export default CustomDatePicker;

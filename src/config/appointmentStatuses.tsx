import React from "react";
import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Done as DoneIcon,
  Build as BuildIcon,
  Paid as PaidIcon,
  PieChart as PieChartIcon,
  PrintOutlined as PrintIcon,
  CardGiftcard as CardGiftcardIcon,
} from "@mui/icons-material";
import type { SxProps, Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * Константы статусов
 */
export const APPOINTMENT_STATUSES = {
  CANCELLED: "Отменено",
  CANCELLED_PAID: "Отменено (оплачено)",
  PATIENT_ARRIVED: "Клиент здесь",
  EXPECTED: "Ожидаем",
  COMPLETED: "Завершено",
  IN_PROGRESS: "В работе",
  PAID: "Оплачено",
  PARTIALLY_PAID: "Частично оплачено",
  PATIENT_NOT_CAME: "Клиент не пришел",
  DISCOUNTED: "Со скидкой",
  FREE: "Бесплатно",
} as const;

/**
 * Возвращает статус для отображения с учётом факта оплаты.
 * Если приём отменён, но оплата принята — показываем "Отменено (оплачено)".
 */
export const getDisplayStatus = (appointment: {
  status?: string;
  paid_cash?: number | string | null;
  paid_card?: number | string | null;
  paid_balance?: number | string | null;
  paid_bonuses?: number | string | null;
  paidCash?: number | string | null;
  paidCard?: number | string | null;
  paidBalance?: number | string | null;
  paidBonuses?: number | string | null;
}): string => {
  const status = appointment.status ?? "";
  const normalized = normalizeStatus(status).toLowerCase();
  const isCancelled = normalized === APPOINTMENT_STATUSES.CANCELLED.toLowerCase() || normalized === "отменен";
  if (isCancelled) {
    const totalPaid =
      Number(appointment.paid_cash ?? appointment.paidCash ?? 0) +
      Number(appointment.paid_card ?? appointment.paidCard ?? 0) +
      Number(appointment.paid_balance ?? appointment.paidBalance ?? 0) +
      Number(appointment.paid_bonuses ?? appointment.paidBonuses ?? 0);
    if (totalPaid > 0) return APPOINTMENT_STATUSES.CANCELLED_PAID;
  }
  return status;
};

/**
 * Тип для статусов приемов
 * Основан на реальных значениях из таблицы Appointments
 */
export type AppointmentStatus =
  | typeof APPOINTMENT_STATUSES.CANCELLED
  | typeof APPOINTMENT_STATUSES.PATIENT_ARRIVED
  | typeof APPOINTMENT_STATUSES.EXPECTED
  | typeof APPOINTMENT_STATUSES.COMPLETED
  | typeof APPOINTMENT_STATUSES.IN_PROGRESS
  | typeof APPOINTMENT_STATUSES.PAID
  | typeof APPOINTMENT_STATUSES.DISCOUNTED
  | string; // fallback для неизвестных статусов

/**
 * Конфигурация цветов и иконок для каждого статуса
 */
export interface StatusConfig {
  color: "error" | "success" | "info" | "warning" | "default" | "secondary";
  icon: React.ReactElement;
  label: string;
}

/**
 * Базовая конфигурация статуса (без цветов, т.к. они зависят от темы)
 */
const EN_TO_RU: Record<string, string> = {
  scheduled: "Ожидаем",
  waiting: "Ожидаем",
  arrived: "Клиент здесь",
  client_here: "Клиент здесь",
  in_progress: "В работе",
  completed: "Завершено",
  paid: "Оплачено",
  partially_paid: "Частично оплачено",
  discounted: "Со скидкой",
  cancelled: "Отменено",
  canceled: "Отменено",
  not_came: "Клиент не пришел",
  no_show: "Клиент не пришел",
  patient_not_came: "Клиент не пришел",
  free: "Бесплатно",
  trainer_not_came: "Клиент не пришел",
};

export const normalizeStatus = (status: string): string =>
  EN_TO_RU[status?.trim?.().toLowerCase?.()] ?? status;

export const getStatusConfig = (status: any): StatusConfig => {
  if (typeof status !== 'string') {
    return {
      color: "warning",
      icon: <HourglassEmptyIcon fontSize="small" />,
      label: status ? String(status) : "Ожидаем",
    };
  }
  const normalized = normalizeStatus(status);
  const statusLower = normalized.trim().toLowerCase();

  // Отменено (оплачено) - оранжевый
  if (statusLower === APPOINTMENT_STATUSES.CANCELLED_PAID.toLowerCase()) {
    return {
      color: "warning",
      icon: <PaidIcon fontSize="small" />,
      label: normalized,
    };
  }

  // Отменено - красный
  if (statusLower === APPOINTMENT_STATUSES.CANCELLED.toLowerCase() || statusLower === "отменен") {
    return {
      color: "error",
      icon: <CancelIcon fontSize="small" />,
      label: normalized,
    };
  }

  // Клиент здесь - зеленый
  if (
    statusLower === APPOINTMENT_STATUSES.PATIENT_ARRIVED.toLowerCase() ||
    statusLower === "в очереди" ||
    statusLower === "прибыл"
  ) {
    return {
      color: "success",
      icon: <CheckCircleIcon fontSize="small" />,
      label: normalized,
    };
  }

  // Оплачено - темно-зеленый
  if (statusLower === APPOINTMENT_STATUSES.PAID.toLowerCase()) {
    return {
      color: "success",
      icon: <DoneIcon fontSize="small" />, // Заменяем значок доллара на галочку
      label: normalized,
    };
  }

  // Со скидкой (100%) - фиолетовый
  if (statusLower === APPOINTMENT_STATUSES.DISCOUNTED.toLowerCase()) {
    return {
      color: "secondary",
      icon: <DoneIcon fontSize="small" />,
      label: normalized,
    };
  }

  // В работе - желтый/оранжевый
  if (statusLower === APPOINTMENT_STATUSES.IN_PROGRESS.toLowerCase() || statusLower === "в процессе") {
    return {
      color: "warning",
      icon: <BuildIcon fontSize="small" />,
      label: normalized,
    };
  }

  // Завершено - серый/спокойный синий
  if (statusLower === APPOINTMENT_STATUSES.COMPLETED.toLowerCase() || statusLower === "завершён") {
    return {
      color: "default",
      icon: <DoneIcon fontSize="small" />,
      label: normalized,
    };
  }

  // Частично оплачено - синий (info)
  if (statusLower === APPOINTMENT_STATUSES.PARTIALLY_PAID.toLowerCase() || statusLower === "частично") {
    return {
      color: "info",
      icon: <PieChartIcon fontSize="small" />,
      label: normalized,
    };
  }

  // Оплачено безналом - синий (info)
  if (statusLower === "оплачено безналом") {
    return {
      color: "info",
      icon: <DoneIcon fontSize="small" />,
      label: "Оплачено",
    };
  }

  // Бесплатно - зелёный с иконкой подарка
  if (statusLower === APPOINTMENT_STATUSES.FREE.toLowerCase()) {
    return {
      color: "success",
      icon: <CardGiftcardIcon fontSize="small" />,
      label: normalized,
    };
  }

  // Клиент не пришел - красный
  if (
    statusLower === APPOINTMENT_STATUSES.PATIENT_NOT_CAME.toLowerCase() ||
    statusLower === "не пришёл" ||
    statusLower === "не пришел"
  ) {
    return {
      color: "error",
      icon: <CancelIcon fontSize="small" />,
      label: normalized,
    };
  }

  // Ожидаем (дефолт) - жёлтый
  return {
    color: "warning",
    icon: <HourglassEmptyIcon fontSize="small" />,
    label: normalized,
  };
};

/**
 * Получить цвета для статуса с учётом темы
 */
const getStatusColors = (status: string, theme: Theme): { backgroundColor: string; textColor: string } => {
  const config = getStatusConfig(status);
  const isDark = theme.palette.mode === 'dark';

  switch (config.color) {
    case "error":
      return {
        backgroundColor: alpha(theme.palette.error.main, isDark ? 0.2 : 0.12),
        textColor: isDark ? theme.palette.error.light : theme.palette.error.dark,
      };
    case "success":
      return {
        backgroundColor: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
        textColor: isDark ? theme.palette.success.light : theme.palette.success.dark,
      };
    case "warning":
      return {
        backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12),
        textColor: isDark ? theme.palette.warning.light : theme.palette.warning.dark,
      };
    case "info":
      return {
        backgroundColor: alpha(theme.palette.info.main, isDark ? 0.2 : 0.12),
        textColor: isDark ? theme.palette.info.light : theme.palette.info.dark,
      };
    case "secondary":
      return {
        backgroundColor: alpha(theme.palette.secondary.main, isDark ? 0.2 : 0.12),
        textColor: isDark ? theme.palette.secondary.light : theme.palette.secondary.dark,
      };
    case "default":
    default:
      return {
        backgroundColor: alpha(theme.palette.grey[500], isDark ? 0.2 : 0.12),
        textColor: isDark ? theme.palette.grey[300] : theme.palette.grey[700],
      };
  }
};

/**
 * Получить sx prop для Chip компонента с кастомными цветами
 * Использует функцию от темы для поддержки светлой/тёмной темы
 */
export const getStatusChipSx = (status: string): SxProps<Theme> => {
  return (theme: Theme) => {
    const { backgroundColor, textColor } = getStatusColors(status, theme);

    return {
      backgroundColor,
      color: textColor,
      fontWeight: 500,
      fontSize: "0.75rem",
      height: "22px",
      "& .MuiChip-icon": {
        color: textColor,
      },
      // Hover effect для лучшей интерактивности
      "&:hover": {
        backgroundColor,
        opacity: 0.9,
      },
    };
  };
};

/**
 * Получить sx prop для Badge компонента
 */
export const getStatusBadgeSx = (status: string): SxProps<Theme> => {
  return (theme: Theme) => {
    const { textColor } = getStatusColors(status, theme);

    return {
      "& .MuiBadge-badge": {
        backgroundColor: textColor,
        color: theme.palette.getContrastText(textColor),
      },
    };
  };
};

import React from 'react';
import { Navigate } from 'react-router';
import { useNotification } from "@refinedev/core";
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_HOME_PAGES, type RoleName } from '../../types/rbac';
import { CircularProgress, Box, Typography } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Разрешенные роли для доступа к маршруту */
  allowedRoles?: RoleName[];
  /** Запрещенные роли для доступа к маршруту */
  deniedRoles?: RoleName[];
  /** Требуемые разрешения для доступа */
  requiredPermissions?: string[];
  /** Требовать все разрешения (по умолчанию false - хотя бы одно) */
  requireAll?: boolean;
  /** Куда редиректить при отсутствии доступа */
  redirectTo?: string;
}

/**
 * Компонент для защиты маршрутов на основе ролей и разрешений
 *
 * @example
 * <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
 *   <ExpensesPage />
 * </ProtectedRoute>
 *
 * @example
 * <ProtectedRoute requiredPermissions={['patients.create', 'patients.update']}>
 *   <AddPatientPage />
 * </ProtectedRoute>
 *
 * @example
 * <ProtectedRoute
 *   allowedRoles={['doctor']}
 *   requiredPermissions={['appointments.read']}
 *   redirectTo="/access-denied"
 * >
 *   <DoctorDashboard />
 * </ProtectedRoute>
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  deniedRoles,
  requiredPermissions,
  requireAll = false,
  redirectTo = '/home',
}) => {
  const { hasRole, hasPermission, hasAllPermissions, loading, role: userRole } = usePermissions();
  const { open } = useNotification();

  // 0) Супер-админ всегда имеет доступ ко всему
  // Проверяем как по объекту роли, так и через hasRole (всемогущество)
  const isSuper = userRole?.name === 'superadmin';

  if (isSuper) {
    return <>{children}</>;
  }

  // Показываем загрузку пока проверяем права (но не блокируем полностью)
  if (loading) {
    // Показываем контент сразу, не ждём прав — иначе бесконечный спиннер
    // если employee-auth-links не нашёл запись
    return <>{children}</>;
  }

  // Функция для определения куда редиректить
  const getRedirectPath = () => {
    // Если явно передан redirectTo, используем его
    if (redirectTo !== '/home') return redirectTo;

    // Иначе пытаемся определить домашнюю страницу роли
    if (userRole?.name && ROLE_HOME_PAGES[userRole.name]) {
      return ROLE_HOME_PAGES[userRole.name];
    }

    // Фолбэк
    return '/home';
  };

  const handleAccessDenied = () => {
    // Не показываем уведомление если это просто редирект неавторизованного юзера
    if (userRole) {
      open?.({
        type: "error",
        message: "Доступ запрещен",
        description: "У вас нет прав доступа к этому разделу",
      });
    }

    return <Navigate to={getRedirectPath()} replace />;
  };

  // Проверка запрещенных ролей (Супер-админ игнорирует запреты)
  if (!isSuper && deniedRoles && deniedRoles.length > 0) {
    if (hasRole(deniedRoles)) {
      return handleAccessDenied();
    }
  }

  // Проверка ролей — если роль ещё не загружена, пропускаем (не блокируем)
  if (allowedRoles && allowedRoles.length > 0 && userRole !== null) {
    if (!hasRole(allowedRoles)) {
      return handleAccessDenied();
    }
  }

  // Проверка разрешений
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (requireAll) {
      // Требуем все разрешения
      if (!hasAllPermissions(requiredPermissions)) {
        return handleAccessDenied();
      }
    } else {
      // Требуем хотя бы одно разрешение
      if (!hasPermission(requiredPermissions)) {
        return handleAccessDenied();
      }
    }
  }

  // Доступ разрешен
  return <>{children}</>;
};

import React from 'react';
import { Navigate } from 'react-router';
import { useNotification } from "@refinedev/core";
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_HOME_PAGES, type RoleName } from '../../types/rbac';
import type { Permission } from '../../constants/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Требуемые разрешения. Пользователь должен иметь ВСЕ указанные права.
   * Предпочтительный способ защиты маршрутов.
   *
   * @example
   * <ProtectedRoute requiredPermissions={['patients.read']}>
   */
  requiredPermissions?: Permission[];

  /**
   * @deprecated Использовать requiredPermissions вместо ролей.
   * Оставлено для обратной совместимости на период миграции.
   */
  allowedRoles?: RoleName[];
  /**
   * @deprecated Использовать requiredPermissions вместо ролей.
   */
  deniedRoles?: RoleName[];
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions,
  allowedRoles,
  deniedRoles,
  redirectTo = '/home',
}) => {
  const { hasAllPermissions, hasRole, loading, role: userRole, isSuperAdmin } = usePermissions();
  const { open } = useNotification();

  // Superadmin обходит все проверки
  if (isSuperAdmin()) {
    return <>{children}</>;
  }

  // Ждём загрузки — не блокируем контент
  if (loading) {
    return <>{children}</>;
  }

  const getRedirectPath = () => {
    if (redirectTo !== '/home') return redirectTo;
    if (userRole?.name && ROLE_HOME_PAGES[userRole.name]) {
      return ROLE_HOME_PAGES[userRole.name];
    }
    return '/home';
  };

  const deny = () => {
    if (userRole) {
      open?.({
        type: 'error',
        message: 'Доступ запрещён',
        description: 'У вас нет прав доступа к этому разделу',
      });
    }
    return <Navigate to={getRedirectPath()} replace />;
  };

  // --- Новый permission-based путь ---
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!hasAllPermissions(requiredPermissions)) {
      return deny();
    }
    return <>{children}</>;
  }

  // --- Legacy role-based (deprecated, временно) ---
  if (deniedRoles && deniedRoles.length > 0 && hasRole(deniedRoles)) {
    return deny();
  }
  if (allowedRoles && allowedRoles.length > 0 && userRole !== null) {
    if (!hasRole(allowedRoles)) {
      return deny();
    }
  }

  return <>{children}</>;
};

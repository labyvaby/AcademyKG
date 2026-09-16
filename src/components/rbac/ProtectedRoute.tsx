import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { useNotification } from "@refinedev/core";
import LinearProgress from "@mui/material/LinearProgress";
import Box from "@mui/material/Box";
import { usePermissions } from '../../hooks/usePermissions';
import { type RoleName } from '../../types/rbac';
import type { Permission } from '../../constants/permissions';
import { getDefaultAuthorizedRoute } from '../../utils/permissionHelpers';

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
   * Доступ, если у пользователя есть ХОТЯ БЫ ОДНО из указанных прав (OR).
   * Используется, когда раздел открывают разные роли с разными правами,
   * например СКУД: просмотр смен (work_shifts.read) ИЛИ самоотметка
   * (work_shifts.self_clock_in).
   */
  anyOfPermissions?: Permission[];

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
  anyOfPermissions,
  allowedRoles,
  deniedRoles,
  redirectTo = '/home',
}) => {
  const { t } = useTranslation();
  const { hasAllPermissions, hasAnyPermission, hasRole, hasPermission, loading, role: userRole, isSuperAdmin } = usePermissions();
  const { open } = useNotification();

  // Superadmin обходит все проверки
  if (isSuperAdmin()) {
    return <>{children}</>;
  }

  // Пока права загружаются, защищенный контент не рендерим.
  if (loading) {
    return (
      <Box sx={{ width: "100%" }}>
        <LinearProgress />
      </Box>
    );
  }

  const getRedirectPath = () => {
    if (redirectTo !== '/home') {
      return redirectTo;
    }
    return getDefaultAuthorizedRoute({
      hasPermission,
      roleName: userRole?.name ?? null,
    });
  };

  const deny = () => {
    if (userRole) {
      open?.({
        type: 'error',
        message: t('rbac.accessDenied'),
        description: t('rbac.noPermissionForSection'),
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

  // --- Доступ по любому из прав (OR) ---
  if (anyOfPermissions && anyOfPermissions.length > 0) {
    if (!hasAnyPermission(anyOfPermissions)) {
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

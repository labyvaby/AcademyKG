import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import type { Permission } from '../../constants/permissions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PermissionGuardProps {
  /**
   * Одно или несколько permissions (логика: хотя бы одно).
   * Если передан массив — достаточно любого одного права.
   */
  permission?: Permission | Permission[];
  /**
   * Альтернативный способ: ресурс + действие (эквивалент `resource.action`).
   * Используется вместо `permission` если удобнее строить динамически.
   */
  resource?: string;
  action?: string;
  /**
   * Что отрендерить если доступа нет.
   * По умолчанию: null (элемент полностью отсутствует в DOM).
   * НЕ disabled, НЕ серый — только полное скрытие.
   */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// PermissionGuard
// ---------------------------------------------------------------------------

/**
 * Скрывает children если у текущего пользователя нет нужного права.
 *
 * Правила:
 * - Superadmin всегда проходит (isSuperAdmin() === true).
 * - Пока loading → null (не мигать, не показывать fallback).
 * - Нет права → fallback (default: null). Полное скрытие из DOM.
 *
 * @example
 * // Скрыть кнопку если нет права создавать сотрудников
 * <PermissionGuard permission={PERMISSIONS.EMPLOYEES.CREATE}>
 *   <Button>Добавить сотрудника</Button>
 * </PermissionGuard>
 *
 * @example
 * // Несколько прав (хотя бы одно)
 * <PermissionGuard permission={[PERMISSIONS.SALES.READ, PERMISSIONS.REPORTS.READ]}>
 *   <SalesWidget />
 * </PermissionGuard>
 *
 * @example
 * // Через resource + action
 * <PermissionGuard resource="employees" action="delete" fallback={<span>Нет доступа</span>}>
 *   <DeleteButton />
 * </PermissionGuard>
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  resource,
  action,
  fallback = null,
  children,
}) => {
  const { hasPermission, isSuperAdmin, loading, can } = usePermissions();

  // Пока загружаются права — не мигать, возвращаем null
  if (loading) {
    return null;
  }

  // Superadmin всегда проходит
  if (isSuperAdmin()) {
    return <>{children}</>;
  }

  // Проверяем право через resource + action
  if (resource && action) {
    if (!can(resource, action)) {
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Проверяем через permission (одно или массив)
  if (permission !== undefined) {
    const permsArray = Array.isArray(permission) ? permission : [permission];
    if (!hasPermission(permsArray)) {
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Если ни permission ни resource/action не переданы — пропускаем
  return <>{children}</>;
};

// ---------------------------------------------------------------------------
// withPermission HOC
// ---------------------------------------------------------------------------

/**
 * Higher-Order Component для оборачивания компонента в PermissionGuard.
 *
 * @example
 * const ProtectedDeleteButton = withPermission(PERMISSIONS.EMPLOYEES.DELETE)(DeleteButton);
 * // или
 * const ProtectedDeleteButton = withPermission([PERMISSIONS.EMPLOYEES.DELETE])(DeleteButton);
 *
 * @example
 * // С fallback
 * const SafeAdminPanel = withPermission(PERMISSIONS.ROLES.READ, <div>No access</div>)(AdminPanel);
 */
export function withPermission<P extends object>(
  permission: Permission | Permission[],
  fallback?: React.ReactNode
) {
  return function withPermissionWrapper(
    WrappedComponent: React.ComponentType<P>
  ): React.FC<P> {
    const displayName =
      (WrappedComponent as any).displayName ||
      (WrappedComponent as any).name ||
      'Component';

    const WithPermissionComponent: React.FC<P> = (props) => (
      <PermissionGuard permission={permission} fallback={fallback ?? null}>
        <WrappedComponent {...props} />
      </PermissionGuard>
    );

    WithPermissionComponent.displayName = `withPermission(${displayName})`;
    return WithPermissionComponent;
  };
}

export default PermissionGuard;

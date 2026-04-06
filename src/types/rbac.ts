/**
 * Типы для системы RBAC (Role-Based Access Control)
 */

// Типы ролей в системе
export type RoleName = 'superadmin' | 'admin' | 'receptionist' | 'registrator' | 'accountant' | 'manager' | 'cashier' | 'specialist' | 'owner';

// Интерфейс роли
export interface Role {
  id: string;
  name: RoleName;
  display_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Домашние страницы для каждой роли
export const ROLE_HOME_PAGES: Record<RoleName, string> = {
  superadmin: '/home',
  admin: '/home',
  manager: '/home',
  specialist: '/specialist',
  receptionist: '/home',
  registrator: '/home',
  accountant: '/home',
  cashier: '/home',
  owner: '/home',
};

// Типы ресурсов системы
export type ResourceType =
  | 'patients'
  | 'appointments'
  | 'employees'
  | 'expenses'
  | 'services'
  | 'schedule'
  | 'settings'
  | 'reports';

// Типы действий
export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'list' | 'manage' | 'view' | 'own';

// Интерфейс разрешения
export interface Permission {
  id: string;
  name: string; // например: "patients.create"
  display_name: string;
  description?: string;
  resource: ResourceType;
  action: ActionType;
  created_at: string;
}

// Связь роли и разрешения
export interface RolePermission {
  role_id: string;
  permission_id: string;
  created_at: string;
}

// Контекст пользователя с правами
export interface UserPermissions {
  role: Role | null;
  permissions: Permission[];
  loading: boolean;
  employeeId?: string | null;
  employee?: any | null;
  isSuperAdmin?: () => boolean;
  /** @deprecated Использовать hasPermission() или can() вместо ролевых хелперов */
  isAdmin: () => boolean;
  /** @deprecated Использовать hasRole(['receptionist', 'registrator']) */
  isRegistrator: () => boolean;
  /** @deprecated Использовать hasPermission для точных проверок */
  canManageEmployees: () => boolean;
  /** @deprecated Использовать hasPermission для точных проверок */
  canManageExpenses: () => boolean;
}

// Конфигурация защищенного маршрута
export interface ProtectedRouteConfig {
  path: string;
  allowedRoles?: RoleName[];
  requiredPermissions?: string[];
  requireAll?: boolean; // Требовать все разрешения или хотя бы одно
}

// Реэкспорт из единственного источника истины
export { PERMISSIONS } from '../constants/permissions';
export type { Permission as PermissionKey } from '../constants/permissions';

import type { Permission as PermissionString } from '../constants/permissions';

// Проверка разрешения
export interface PermissionCheck {
  hasPermission: (permission: PermissionString | PermissionString[]) => boolean;
  /** @deprecated Использовать can() или hasPermission() вместо проверки ролей */
  hasRole: (role: RoleName | RoleName[]) => boolean;
  hasAnyPermission: (permissions: PermissionString[]) => boolean;
  hasAllPermissions: (permissions: PermissionString[]) => boolean;
  /** Короткий хелпер: can('appointments', 'read') → проверяет 'appointments.read' */
  can: (resource: string, action: string) => boolean;
  isSuperAdmin: () => boolean;
}

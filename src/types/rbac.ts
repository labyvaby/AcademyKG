/**
 * Типы для системы RBAC (Role-Based Access Control)
 */

// Типы ролей в системе
export type RoleName = 'superadmin' | 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'registrator' | 'accountant' | 'manager' | 'cashier' | 'specialist' | 'owner';

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
  doctor: '/doctor',
  specialist: '/doctor',
  nurse: '/nurse',
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
}

// Конфигурация защищенного маршрута
export interface ProtectedRouteConfig {
  path: string;
  allowedRoles?: RoleName[];
  requiredPermissions?: string[];
  requireAll?: boolean; // Требовать все разрешения или хотя бы одно
}

// Предопределенные разрешения (для удобства использования)
export const PERMISSIONS = {
  // Пациенты
  PATIENTS_CREATE: 'patients.create',
  PATIENTS_READ: 'patients.read',
  PATIENTS_UPDATE: 'patients.update',
  PATIENTS_DELETE: 'patients.delete',
  PATIENTS_LIST: 'patients.list',

  // Назначения
  APPOINTMENTS_CREATE: 'appointments.create',
  APPOINTMENTS_READ: 'appointments.read',
  APPOINTMENTS_UPDATE: 'appointments.update',
  APPOINTMENTS_DELETE: 'appointments.delete',
  APPOINTMENTS_LIST: 'appointments.list',
  APPOINTMENTS_OWN: 'appointments.own',

  // Сотрудники
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_DELETE: 'employees.delete',
  EMPLOYEES_LIST: 'employees.list',

  // Расходы
  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_READ: 'expenses.read',
  EXPENSES_UPDATE: 'expenses.update',
  EXPENSES_DELETE: 'expenses.delete',
  EXPENSES_LIST: 'expenses.list',

  // Услуги
  SERVICES_CREATE: 'services.create',
  SERVICES_READ: 'services.read',
  SERVICES_UPDATE: 'services.update',
  SERVICES_DELETE: 'services.delete',
  SERVICES_LIST: 'services.list',

  // График
  SCHEDULE_CREATE: 'schedule.create',
  SCHEDULE_READ: 'schedule.read',
  SCHEDULE_UPDATE: 'schedule.update',
  SCHEDULE_DELETE: 'schedule.delete',
  SCHEDULE_LIST: 'schedule.list',

  // Настройки и отчеты
  SETTINGS_MANAGE: 'settings.manage',
  REPORTS_VIEW: 'reports.view',
} as const;

// Тип для ключей разрешений
export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Проверка разрешения
export interface PermissionCheck {
  hasPermission: (permission: string | string[]) => boolean;
  hasRole: (role: RoleName | RoleName[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Короткий хелпер: can('appointments', 'read') → проверяет 'appointments.read' */
  can: (resource: string, action: string) => boolean;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  isDoctor: () => boolean;
  isNurse: () => boolean;
  /** Пользователь с ролью регистратор */
  isRegistrator: () => boolean;
  /** Может управлять сотрудниками (создание/редактирование/удаление) */
  canManageEmployees: () => boolean;
  /** Может управлять расходами (создание/редактирование) и видеть все расходы */
  canManageExpenses: () => boolean;
}

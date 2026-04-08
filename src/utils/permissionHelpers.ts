import { PERMISSIONS, type Permission } from '../constants/permissions';
import { ROLE_HOME_PAGES, type RoleName } from '../types/rbac';

type HasPermFn = (permission: Permission | Permission[]) => boolean;


/**
 * Пользователь может работать только со своими приёмами,
 * но не создавать произвольные (медсестра, процедурный).
 */
export const isOwnOnlySpecialist = (hasPermission: HasPermFn): boolean =>
  hasPermission(PERMISSIONS.APPOINTMENTS_READ) && !hasPermission(PERMISSIONS.APPOINTMENTS_CREATE);

/**
 * Пользователь может видеть заключение и внутренний комментарий
 * (specialist или кто-либо с appointments.read).
 */
export const canViewSpecialistContent = (hasPermission: HasPermFn): boolean =>
  hasPermission(PERMISSIONS.APPOINTMENTS_READ);

/**
 * Пользователь может редактировать чужое заключение
 * (appointments.update — receptionist / admin уровень).
 */
export const canEditAnyConclusion = (hasPermission: HasPermFn): boolean =>
  hasPermission(PERMISSIONS.APPOINTMENTS_UPDATE);

/**
 * Пользователь может видеть все приёмы без фильтрации по себе.
 */
export const canViewAllAppointments = (hasPermission: HasPermFn): boolean =>
  hasPermission(PERMISSIONS.APPOINTMENTS_READ);

/**
 * Пользователь видит баланс пациента.
 */
export const canSeePatientBalance = (hasPermission: HasPermFn): boolean =>
  hasPermission(PERMISSIONS.APPOINTMENTS_READ);

const DEFAULT_ROUTE_FALLBACKS = [
  "/home",
  "/specialist",
  "/cashbox",
  "/expenses",
  "/reports",
  "/patient-search",
  "/schedule",
  "/client-schedule",
  "/employees",
  "/services",
  "/products",
  "/roles",
  "/branches",
] as const;

export const canAccessAppRoute = (
  path: string,
  hasPermission: HasPermFn,
): boolean => {
  switch (path) {
    case "/home":
      return (
        hasPermission(PERMISSIONS.APPOINTMENTS_READ) &&
        hasPermission(PERMISSIONS.RECEPTION_READ)
      );
    case "/specialist":
      return hasPermission(PERMISSIONS.APPOINTMENTS_READ);
    case "/patient-search":
      return hasPermission(PERMISSIONS.CLIENTS_READ);
    case "/expenses":
      return hasPermission(PERMISSIONS.EXPENSES_READ);
    case "/employees":
      return hasPermission(PERMISSIONS.EMPLOYEES_READ);
    case "/services":
      return hasPermission(PERMISSIONS.SERVICES_READ);
    case "/products":
      return hasPermission(PERMISSIONS.PRODUCTS_READ);
    case "/schedule":
      return hasPermission(PERMISSIONS.EMPLOYEE_SCHEDULES_READ);
    case "/client-schedule":
      return hasPermission(PERMISSIONS.CLIENT_SCHEDULES_READ);
    case "/cashbox":
      return hasPermission(PERMISSIONS.CASHBOX_READ);
    case "/reports":
      return hasPermission(PERMISSIONS.REPORTS_READ);
    case "/roles":
    case "/branches":
      return hasPermission(PERMISSIONS.APP_SETTINGS_UPDATE);
    case "/access-denied":
      return true;
    default:
      return false;
  }
};

export const getDefaultAuthorizedRoute = (options: {
  hasPermission: HasPermFn;
  roleName?: RoleName | null;
}): string => {
  const { hasPermission, roleName = null } = options;
  const preferredPath = roleName ? ROLE_HOME_PAGES[roleName] : null;

  if (preferredPath && canAccessAppRoute(preferredPath, hasPermission)) {
    return preferredPath;
  }

  for (const path of DEFAULT_ROUTE_FALLBACKS) {
    if (canAccessAppRoute(path, hasPermission)) {
      return path;
    }
  }

  return "/access-denied";
};

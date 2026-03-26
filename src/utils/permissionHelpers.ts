import { PERMISSIONS, type Permission } from '../constants/permissions';

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

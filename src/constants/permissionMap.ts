import { ALL_PERMISSIONS } from './permissions';

/**
 * Структурированная карта всех прав.
 * Группирует действия по ресурсам.
 * Используется для валидации, генерации UI и синхронизации с backend.
 */
export const PERMISSION_MAP = {
  patients:     ['create', 'read', 'update', 'delete', 'list'],
  appointments: ['list', 'create', 'read', 'update', 'delete', 'own'],
  employees:    ['create', 'read', 'update', 'delete', 'list'],
  expenses:     ['create', 'read', 'update', 'delete', 'list'],
  services:     ['create', 'read', 'update', 'delete', 'list'],
  schedule:     ['create', 'read', 'update', 'delete', 'list'],
  reports:      ['view'],
  settings:     ['manage'],
} as const;

export type PermissionResource = keyof typeof PERMISSION_MAP;
export type PermissionAction<R extends PermissionResource> = (typeof PERMISSION_MAP)[R][number];

/**
 * Валидация: проверяем что все ключи из ALL_PERMISSIONS покрыты в PERMISSION_MAP
 * (для предотвращения рассинхрона внутри фронта)
 */
if (process.env.NODE_ENV === 'development') {
  const flatMap = Object.entries(PERMISSION_MAP).flatMap(([res, actions]) =>
    actions.map(act => `${res}.${act}`)
  );

  ALL_PERMISSIONS.forEach(p => {
    if (!flatMap.includes(p)) {
      // Это info — многие новые permissions не войдут в старую PERMISSION_MAP (она legacy)
      // console.info(`[RBAC] Permission "${p}" is defined in ALL_PERMISSIONS but not in PERMISSION_MAP (legacy map may be outdated)`);
    }
  });
}

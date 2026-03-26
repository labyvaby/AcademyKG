/**
 * Экспорт всех RBAC компонентов
 * Для удобного импорта: import { CanAccess, ProtectedRoute } from '@/components/rbac'
 */

export { CanAccess } from './CanAccess';
export { ProtectedRoute } from './ProtectedRoute';
export { PermissionGuard, withPermission } from './PermissionGuard';
export type { PermissionGuardProps } from './PermissionGuard';

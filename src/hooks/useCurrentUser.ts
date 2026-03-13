import { usePermissions } from './usePermissions';

export interface CurrentUser {
  id: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  roleName: string;
  roleDisplayName: string;
  employeeId: string | null;
  loading: boolean;
}

/**
 * Возвращает данные текущего авторизованного пользователя.
 * Данные берутся из кэша usePermissions — без лишних запросов.
 */
export function useCurrentUser(): CurrentUser {
  const { employee, role, loading, employeeId } = usePermissions();

  return {
    id: employee?.user?.id ?? null,
    fullName: employee?.fullName ?? employee?.user?.fullName ?? '',
    phone: employee?.phone ?? employee?.user?.phoneNumber ?? '',
    email: employee?.email ?? employee?.user?.email ?? null,
    photoUrl: employee?.photoUrl ?? null,
    roleName: role?.name ?? '',
    roleDisplayName: role?.display_name ?? role?.name ?? '',
    employeeId: employeeId ?? null,
    loading,
  };
}

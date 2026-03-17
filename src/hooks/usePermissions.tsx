import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utility/apiClient';
import { isAuthenticated } from '../services/auth';
import { tokenStorage } from '../utility/apiClient';
import type { Role, Permission, UserPermissions, RoleName, PermissionCheck } from '../types/rbac';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

type GlobalState = {
  role: Role | null;
  employee: any | null;
  permissions: Permission[];
  loading: boolean;
  loaded: boolean;
  lastFetchedAt: number;
  employeeId?: string | null;
  currentUserId?: string | null;
};

// ---------------------------------------------------------------------------
// Глобальный кэш (один на всё приложение)
// ---------------------------------------------------------------------------

let globalState: GlobalState = {
  role: null,
  employee: null,
  permissions: [],
  loading: true,
  loaded: false,
  lastFetchedAt: 0,
  employeeId: null,
  currentUserId: null,
};

let inFlight: Promise<void> | null = null;
let globalFetchVersion = 0;

const listeners = new Set<(s: GlobalState) => void>();
const COOLDOWN_MS = 10_000;

const notify = () => { for (const fn of listeners) fn(globalState); };
const setGlobal = (patch: Partial<GlobalState>, version?: number) => {
  // Если пришла версия и она устарела — игнорируем
  if (version !== undefined && version < globalFetchVersion) return;
  globalState = { ...globalState, ...patch };
  notify();
};

// ---------------------------------------------------------------------------
// Получение профиля через REST API
// ---------------------------------------------------------------------------

async function fetchPermissions(opts: { force?: boolean } = {}): Promise<void> {
  const { force = false } = opts;

  const now = Date.now();
  if (!force && globalState.loaded && (now - globalState.lastFetchedAt < COOLDOWN_MS)) return;

  // Если уже грузится — ждем завершения, но если force — игнорируем текущий и запускаем новый
  if (inFlight && !force) return inFlight;

  // Новая версия запроса
  const version = ++globalFetchVersion;

  // Не авторизован — сбрасываем
  if (!isAuthenticated()) {
    setGlobal({ role: null, employee: null, permissions: [], loading: false, loaded: true, currentUserId: null }, version);
    return;
  }

  inFlight = (async () => {
    try {
      const showLoading = !globalState.loaded || force;
      setGlobal({ loading: showLoading, lastFetchedAt: Date.now() }, version);

      // 1. Текущий пользователь (может содержать вложенный employee по новому API)
      const meRes: any = await apiFetch('/api/v1/users/me/');
      const user = meRes?.data ?? meRes;

      if (!user?.id) {
        setGlobal({ role: null, employee: null, permissions: [], loading: false, loaded: true, currentUserId: null }, version);
        return;
      }

      // Уже загружено для того же userId — не перезагружаем
      if (!force && globalState.loaded && globalState.currentUserId === user.id) {
        setGlobal({ loading: false }, version);
        return;
      }

      // 2. Получаем employee: сначала из вложенного поля users/me, затем fallbacks
      let emp: any = null;

      // Новый API: users/me возвращает nested employee
      if (user.employee?.id) {
        emp = user.employee;
      }

      // Fallback: поиск по authUser
      if (!emp) {
        try {
          const empByAuthRes: any = await apiFetch(`/api/v1/employees/?authUser=${user.id}`);
          const empByAuth = empByAuthRes?.data?.results ?? empByAuthRes?.results ?? [];
          if (Array.isArray(empByAuth) && empByAuth.length > 0) {
            emp = empByAuth[0];
          }
        } catch {
          // ignore — may return 403 for non-admins
        }
      }

      // Fallback: поиск по телефону
      if (!emp && user.phoneNumber) {
        try {
          const phone = user.phoneNumber.replace(/[^0-9]/g, '').slice(-9);
          const empListRes: any = await apiFetch(`/api/v1/employees/?search=${phone}`);
          const empList = empListRes?.data?.results ?? empListRes?.results ?? [];
          if (Array.isArray(empList) && empList.length > 0) {
            emp = empList[0];
          }
        } catch {
          // ignore
        }
      }

      if (!emp?.id) {
        // Нет привязки к сотруднику — показываем базовый профиль без роли
        setGlobal({
          role: null,
          employee: { ...user, fullName: user.fullName ?? user.phoneNumber ?? 'Пользователь' },
          permissions: [],
          loading: false,
          loaded: true,
          currentUserId: user.id,
          employeeId: null,
        }, version);
        return;
      }

      // 4. Если получаем employee, нужно убедиться, что у нас есть все поля профиля.
      // /api/v1/users/me/ может возвращать неполный объект сотрудника.
      const hasFullInfo = !!(emp.phone || emp.email || emp.telegram_id || emp.telegramId);

      if (emp.id && !hasFullInfo) {
        try {
          const empRes: any = await apiFetch(`/api/v1/employees/${emp.id}/`);
          const fullEmp = empRes?.data ?? empRes;
          if (fullEmp?.id) emp = fullEmp;
        } catch (error) {
          console.warn('[usePermissions] Не удалось загрузить полные данные сотрудника:', error);
          // Продолжаем с тем, что есть
        }
      }

      // 4. Формируем объект роли из roleName
      // Новый API: employee.role = { id, name } где name — slug роли
      // Старый API: employee.roleName = строка с display-именем
      const roleFromNested = typeof emp.role === 'object' ? emp.role?.name : null;
      const rawRoleName = (roleFromNested ?? emp.roleName ?? emp.role_name ?? '').toLowerCase().trim();
      console.log('[usePermissions] employee:', emp.id, 'roleFromNested:', roleFromNested, 'roleName:', emp.roleName, 'rawRoleName:', rawRoleName);
      // Slug-и ролей из бэкенда: superadmin, accountant, cashier, manager, receptionist, specialist
      const ROLE_ALIAS: Record<string, string> = {
        // superadmin — slug из бэкенда уже "superadmin", алиасы для надёжности
        'супер-администратор': 'superadmin',
        'супер администратор': 'superadmin',
        'супер админ': 'superadmin',
        'суперадмин': 'superadmin',
        'super admin': 'superadmin',
        'super_admin': 'superadmin',
        'superuser': 'superadmin',
        'super_user': 'superadmin',
        // manager (управляющий) — slug "manager"
        'управляющий': 'manager',
        'administrator': 'manager',
        'администратор': 'manager',
        'admin': 'manager',
        // receptionist (ресепшн) — slug "receptionist"
        'регистратор': 'receptionist',
        'registrator': 'receptionist',
        'ресепшн': 'receptionist',
        // accountant (бухгалтер) — slug "accountant"
        'бухгалтер': 'accountant',
        // cashier (кассир) — slug "cashier"
        'кассир': 'cashier',
        // specialist (специалист/тренер) — slug "specialist"
        'специалист': 'specialist',
        'специалист (тренер)': 'specialist',
        'врач': 'specialist',
        'doctor': 'specialist',
        'сотрудник': 'specialist',
        // nurse — slug "nurse"
        'медсестра': 'nurse',
        'процедурный': 'nurse',
      };
      // Slug из API может совпасть напрямую — ROLE_ALIAS используется только для display-имён
      let roleName = ROLE_ALIAS[rawRoleName] ?? rawRoleName;
      // Если slug содержит "super" — принудительно superadmin
      if (roleName !== 'superadmin' && rawRoleName.includes('super')) {
        roleName = 'superadmin';
      }
      const roleId = typeof emp.role === 'object' ? (emp.role?.id ?? '') : (emp.role ?? '');
      const role: Role = {
        id: roleId,
        name: roleName as RoleName,
        display_name: emp.roleName ?? roleFromNested ?? roleName,
        description: '',
        created_at: '',
        updated_at: '',
      };

      setGlobal({
        role,
        employee: { ...emp, user },
        permissions: [],
        loading: false,
        loaded: true,
        employeeId: emp.id,
        currentUserId: user.id,
      }, version);
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      setGlobal({ role: null, employee: null, permissions: [], loading: false, loaded: true }, version);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

// ---------------------------------------------------------------------------
// Хук
// ---------------------------------------------------------------------------

export const usePermissions = (): UserPermissions & PermissionCheck => {
  const [state, setState] = useState<GlobalState>(globalState);

  useEffect(() => {
    listeners.add(setState);

    if (!globalState.loaded) {
      void fetchPermissions();
    }

    // Сброс при logout (токен исчез)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'academy_access_token' && !e.newValue) {
        setGlobal({ role: null, employee: null, permissions: [], loading: false, loaded: true, currentUserId: null });
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      listeners.delete(setState);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Хелперы
  // ---------------------------------------------------------------------------

  const hasRole = useCallback(
    (roleName: RoleName | RoleName[]): boolean => {
      if (state.loading || !state.role) return false;
      const rolesToCheck = Array.isArray(roleName) ? roleName : [roleName];
      const currentRole = state.role.name?.toLowerCase().trim();
      return rolesToCheck.some(r => r.toLowerCase() === currentRole);
    },
    [state.loading, state.role]
  );

  const hasPermission = useCallback(
    (permission: string | string[]): boolean => {
      if (state.loading) return false;
      if (state.role?.name === 'superadmin') return true;
      if (!state.permissions.length) return false;
      const toCheck = Array.isArray(permission) ? permission : [permission];
      return toCheck.some(p => state.permissions.some(sp => sp.name === p));
    },
    [state.loading, state.permissions, state.role]
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (state.loading) return false;
      if (state.role?.name === 'superadmin') return true;
      return perms.some(p => state.permissions.some(sp => sp.name === p));
    },
    [state.loading, state.permissions, state.role]
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (state.loading) return false;
      if (state.role?.name === 'superadmin') return true;
      return perms.every(p => state.permissions.some(sp => sp.name === p));
    },
    [state.loading, state.permissions, state.role]
  );

  // Актуальные slug-и: superadmin, manager, receptionist, accountant, cashier, specialist, nurse
  const isSuperAdmin = useCallback(() => state.role?.name === 'superadmin', [state.role]);
  const isAdmin = useCallback(() => hasRole(['superadmin', 'admin', 'manager']), [hasRole]);
  const isRegistrator = useCallback(() => hasRole(['receptionist', 'registrator']), [hasRole]);
  const isDoctor = useCallback(() => hasRole(['doctor', 'specialist']), [hasRole]);
  const isNurse = useCallback(() => hasRole('nurse'), [hasRole]);
  const canManageEmployees = useCallback(() => hasRole(['superadmin', 'admin', 'manager', 'receptionist', 'registrator']), [hasRole]);
  const canManageExpenses = useCallback(() => hasRole(['superadmin', 'admin', 'manager', 'registrator', 'receptionist', 'accountant', 'cashier']), [hasRole]);

  return {
    role: state.role,
    permissions: state.permissions,
    loading: state.loading,
    employeeId: state.employeeId,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isRegistrator,
    isDoctor,
    isNurse,
    canManageEmployees,
    canManageExpenses,
    employee: state.employee,
  };
};

/** Быстрые хелперы */
export const useHasPermission = (permission: string | string[]): boolean => {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
};

export const useHasRole = (roleName: RoleName | RoleName[]): boolean => {
  const { hasRole } = usePermissions();
  return hasRole(roleName);
};

/** Принудительный сброс всех данных (при Logout) */
export const clearPermissions = () => {
  inFlight = null;
  globalFetchVersion++;
  globalState = {
    role: null,
    employee: null,
    permissions: [],
    loading: false,
    loaded: false,
    currentUserId: null,
    employeeId: null,
    lastFetchedAt: 0,
  };
  notify();
};

/** Принудительная перезагрузка профиля (например после смены роли или логина) */
export const refetchPermissions = (): Promise<void> => {
  inFlight = null;
  globalFetchVersion++;
  globalState = {
    ...globalState,
    loaded: false,
    loading: true,
    currentUserId: null,
    employeeId: null,
    employee: null,
    role: null,
    lastFetchedAt: 0,
  };
  notify();
  return fetchPermissions({ force: true });
};

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../utility/apiClient';
import { isAuthenticated } from '../services/auth';
import { tokenStorage } from '../utility/apiClient';
import type { Role, Permission, UserPermissions, RoleName, PermissionCheck } from '../types/rbac';
import { type Permission as PermissionString, ALL_PERMISSIONS } from '../constants/permissions';
import { validatePermissions, auditPermissions, fixSuggestions, type PermissionAuditResult } from '../utils/validatePermissions';

/** Режим строгого RBAC: ошибка вместо предупреждения при неизвестном пермишене */
const STRICT_RBAC = true;


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

      // Данные employee из users/me содержат всё необходимое (role, permissions, id)

      // 4. Формируем объект роли из roleName
      // Новый API: employee.role = { id, name } где name — slug роли
      // Старый API: employee.roleName = строка с display-именем
      const roleFromNested = typeof emp.role === 'object' ? emp.role?.name : null;
      const rawRoleName = (roleFromNested ?? emp.roleName ?? emp.role_name ?? '').toLowerCase().trim();

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
        'сотрудник': 'specialist',
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

      // Permissions: бек возвращает массив строк вида "resource.action"
      // Аудит: алиасы + фильтр unknown→deny + dev-логирование
      const rawPerms: any[] = emp.permissions ?? user.permissions ?? [];
      const audit = auditPermissions(rawPerms);
      if (process.env.NODE_ENV === 'development' && audit.aliased.length > 0) {
        console.info('[RBAC] Aliased permissions:', audit.aliased);
      }
      const parsedPermissions: Permission[] = audit.granted.map(name => ({ name } as any));


      // Синхронизация с Backend: получаем список активных прав в системе
      if (process.env.NODE_ENV === 'development') {
        void (async () => {
          try {
            const allBackendPermsRes: any = await apiFetch('/api/v1/permissions/');
            // GET /permissions/ возвращает { data: { "resource.action": {...}, ... } } — объект, не массив
            const raw = allBackendPermsRes?.data;
            const backendNames = new Set<string>(
              Array.isArray(raw) ? raw.map((p: any) => p.name)
              : raw && typeof raw === 'object' ? Object.keys(raw)
              : []
            );
            const frontendNames = new Set<string>(ALL_PERMISSIONS as readonly string[]);


            // Ищем то что есть на фронте, но нет на беке
            frontendNames.forEach(name => {
              if (!backendNames.has(name)) {
                console.warn(`[RBAC Sync] Permission "${name}" exists on Frontend but missing on Backend!`);
              }
            });
            // Ищем то что есть на беке, но нет на фронте
            backendNames.forEach(name => {
              if (!frontendNames.has(name)) {
                console.info(`[RBAC Sync] New permission found on Backend: "${name}". You should add it to src/constants/permissions.ts`);
              }
            });
          } catch {
            console.error('[RBAC Sync] Failed to fetch system permissions from /api/v1/permissions/');
          }
        })();
      }


      // isSuperuser — Django superuser обходит все проверки
      const isSuperuser = Boolean(user.isSuperuser ?? user.is_superuser ?? false);

      setGlobal({
        role: isSuperuser ? { ...role, name: 'superadmin' as RoleName } : role,
        employee: { ...emp, user, isSuperuser },
        permissions: parsedPermissions,
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

  // Глобальный объект для дебага в консоли
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const __names = () => new Set(globalState.permissions.map(p => p.name));

      (window as any).__RBAC__ = {
        state: globalState,
        role: globalState.role?.name,
        permissions: Array.from(__names()),

        /** Быстрая проверка: check('appointments', 'read') */
        check: (resource: string, action: string) => __names().has(`${resource}.${action}`),

        /** Быстрая проверка по полной строке: hasPermission('appointments.read') */
        hasPermission: (p: string) => __names().has(p),

        /**
         * Показывает расхождения между правами пользователя и реестром фронта.
         * unknown_from_api — права из API которых нет в constants/permissions.ts
         * not_granted — права которые есть во фронте, но не выданы пользователю
         */
        diff: () => {
          const userPerms = __names();
          const known = new Set(ALL_PERMISSIONS as readonly string[]);
          return {
            unknown_from_api: [...userPerms].filter(p => !known.has(p)),
            not_granted:      [...known].filter(p => !userPerms.has(p)),
          };
        },

        /**
         * Генерирует готовый TypeScript-код для добавления неизвестных прав.
         * Скопируй вывод в src/constants/permissions.ts
         */
        fixSuggestions: () => {
          const rawPerms = globalState.employee?.permissions ?? [];
          const audit = auditPermissions(rawPerms);
          const result = fixSuggestions(audit);
          console.log(result);
          return result;
        },

        /**
         * Полный аудит: возвращает granted/unknown/aliased/issues.
         * Issues содержат severity (critical/warning/info) и suggestedFix.
         */
        auditFull: (): PermissionAuditResult => {
          const rawPerms = globalState.employee?.permissions ?? [];
          const result = auditPermissions(rawPerms);
          const criticals = result.issues.filter(i => i.severity === 'critical');
          const warnings  = result.issues.filter(i => i.severity === 'warning');
          const infos     = result.issues.filter(i => i.severity === 'info');

          console.group('[RBAC] Full Audit Report');
          console.log(`Role: ${globalState.role?.name ?? '(none)'}`);
          console.log(`Granted: ${result.granted.length} permissions`);
          console.log(`Unknown (DENIED): ${result.unknown.length}`);
          console.log(`Aliased: ${result.aliased.length}`);
          if (criticals.length > 0) {
            console.group(`🔴 Critical (${criticals.length})`);
            criticals.forEach(i => console.error(`  ${i.permission}: ${i.message}`, i.suggestedFix ?? ''));
            console.groupEnd();
          }
          if (warnings.length > 0) {
            console.group(`🟡 Warnings (${warnings.length})`);
            warnings.forEach(i => console.warn(`  ${i.permission}: ${i.message}`));
            console.groupEnd();
          }
          if (infos.length > 0) {
            console.group(`🔵 Info (${infos.length})`);
            infos.forEach(i => console.info(`  ${i.permission}: ${i.message}`));
            console.groupEnd();
          }
          console.groupEnd();
          return result;
        },

        /**
         * Печатает матрицу прав текущего пользователя по модулям.
         * console.table с колонками: resource | create | read | update | delete
         */
        printMatrix: () => {
          const names = __names();
          const resources = new Set<string>();
          for (const p of names) {
            const [res] = p.split('.');
            if (res) resources.add(res);
          }
          // Добавляем ресурсы из ALL_PERMISSIONS для полноты матрицы
          for (const p of ALL_PERMISSIONS as readonly string[]) {
            const [res] = p.split('.');
            if (res) resources.add(res);
          }
          const ACTIONS = ['create', 'read', 'update', 'delete'] as const;
          const matrix: Record<string, Record<string, string>> = {};
          for (const res of Array.from(resources).sort()) {
            matrix[res] = {};
            for (const act of ACTIONS) {
              matrix[res][act] = names.has(`${res}.${act}`) ? '✅' : '❌';
            }
          }
          console.log(`[RBAC] Permission matrix for role: ${globalState.role?.name ?? '(none)'}`);
          console.table(matrix);
          return matrix;
        },

        /** Принудительная перезагрузка профиля и прав */
        reload: () => refetchPermissions(),
      };
    }
  }, [state]);


  // ---------------------------------------------------------------------------
  // Хелперы
  // ---------------------------------------------------------------------------

  /** Set строк для O(1) поиска вместо .some() */
  const permissionNames = useMemo(
    () => new Set(state.permissions.map(p => p.name)),
    [state.permissions]
  );

  const isSuperuser = state.role?.name === 'superadmin';

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
    (permission: PermissionString | PermissionString[]): boolean => {
      const isDev = process.env.NODE_ENV === 'development';
      
      if (state.loading) return false;
      if (isSuperuser) return true;
      if (permissionNames.size === 0) return false;
      
      const toCheck = Array.isArray(permission) ? permission : [permission];

      if (isDev) {
        toCheck.forEach(p => {
          if (!(ALL_PERMISSIONS as readonly string[]).includes(p)) {
            const msg = `[RBAC] Unknown permission: "${p}". Check src/constants/permissions.ts`;
            // Никогда не throw в render — только error/warn (throw роняет весь UI)
            if (STRICT_RBAC) console.error(msg);
            else console.warn(msg);
          }
        });
      }

      const result = toCheck.some(p => permissionNames.has(p));

      if (isDev && !result) {
        // Логируем только если прав нет (потенциальный интерес для отладки UI)
        // console.debug(`[RBAC] Access denied for: ${JSON.stringify(toCheck)}`);
      }

      return result;
    },

    [state.loading, permissionNames, isSuperuser]
  );

  const hasAnyPermission = useCallback(
    (perms: PermissionString[]): boolean => {
      if (state.loading) return false;
      if (isSuperuser) return true;
      return perms.some(p => permissionNames.has(p));
    },
    [state.loading, permissionNames, isSuperuser]
  );

  const hasAllPermissions = useCallback(
    (perms: PermissionString[]): boolean => {
      if (state.loading) return false;
      if (isSuperuser) return true;
      return perms.every(p => permissionNames.has(p));
    },
    [state.loading, permissionNames, isSuperuser]
  );

  // can('appointments', 'read') → проверяет 'appointments.read'
  const can = useCallback(
    (resource: string, action: string): boolean => {
      if (state.loading) return false;
      if (isSuperuser) return true;
      const key = `${resource}.${action}`;
      if (process.env.NODE_ENV === 'development') {
        if (!(ALL_PERMISSIONS as readonly string[]).includes(key)) {
          console.warn(`[usePermissions] Unknown permission: "${key}". Check src/constants/permissions.ts`);
        }
      }
      return permissionNames.has(key);
    },
    [state.loading, permissionNames, isSuperuser]
  );

  const isSuperAdmin = useCallback(() => isSuperuser, [isSuperuser]);

  // ---------------------------------------------------------------------------
  // Legacy role-helper shorthands (deprecated — используй hasPermission/can)
  // ---------------------------------------------------------------------------
  /** @deprecated Использовать hasPermission() или can() */
  const isAdmin = useCallback(
    () => hasRole(['superadmin', 'admin', 'manager']),
    [hasRole]
  );
  /** @deprecated Использовать hasRole(['receptionist', 'registrator']) */
  const isRegistrator = useCallback(
    () => hasRole(['receptionist', 'registrator']),
    [hasRole]
  );
  /** @deprecated */
  const canManageEmployees = useCallback(
    () => hasRole(['superadmin', 'admin', 'manager', 'receptionist', 'registrator']),
    [hasRole]
  );
  /** @deprecated */
  const canManageExpenses = useCallback(
    () => hasRole(['superadmin', 'admin', 'manager', 'registrator', 'receptionist', 'accountant', 'cashier']),
    [hasRole]
  );

  return {
    role: state.role,
    permissions: state.permissions,
    loading: state.loading,
    employeeId: state.employeeId,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    can,
    isSuperAdmin,
    isAdmin,
    isRegistrator,
    canManageEmployees,
    canManageExpenses,
    employee: state.employee,
  };
};

/** Быстрый хелпер */
export const useHasPermission = (permission: PermissionString | PermissionString[]): boolean => {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
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

/** Быстрый хелпер для ролей */
export const useHasRole = (role: RoleName | RoleName[]): boolean => {
  const { hasRole } = usePermissions();
  return hasRole(role);
};

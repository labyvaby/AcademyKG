import { ALL_PERMISSIONS } from '../constants/permissions';

// ---------------------------------------------------------------------------
// Централизованный реестр алиасов
// Бэкенд может называть ресурс иначе чем фронт.
// Единственное место где живут все маппинги backend_name → frontend_name.
// ---------------------------------------------------------------------------
export const PERMISSION_ALIASES: Record<string, string> = {
  // Бэкенд исторически называет клиентов "children"
  'children.create': 'clients.create',
  'children.read':   'clients.read',
  'children.update': 'clients.update',
  'children.delete': 'clients.delete',
  // Legacy resource names after cashbox/services permission unification
  'payments.create': 'cashbox.create',
  'payments.read': 'cashbox.read',
  'payments.update': 'cashbox.update',
  'payments.delete': 'cashbox.delete',
  'sale_lines.create': 'cashbox.create',
  'sale_lines.read': 'cashbox.read',
  'sale_lines.update': 'cashbox.update',
  'sale_lines.delete': 'cashbox.delete',
  'sales.create': 'cashbox.create',
  'sales.read': 'cashbox.read',
  'sales.update': 'cashbox.update',
  'sales.delete': 'cashbox.delete',
  'sellable_items.create': 'services.read',
  'sellable_items.read': 'services.read',
  'sellable_items.update': 'services.read',
  'sellable_items.delete': 'services.read',
};

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export type PermissionSeverity = 'critical' | 'warning' | 'info';

export interface AuditIssue {
  permission: string;
  severity: PermissionSeverity;
  message: string;
  suggestedFix?: string;
}

// ---------------------------------------------------------------------------
// Вспомогательные типы
// ---------------------------------------------------------------------------

export interface PermissionAuditResult {
  /** Права которые пришли из API, применились успешно */
  granted: string[];
  /** Права из API которые не найдены ни в PERMISSIONS ни в ALIASES → deny */
  unknown: string[];
  /** Права которые были замаплены через алиас */
  aliased: Array<{ from: string; to: string }>;
  /** Диагностические проблемы с severity */
  issues: AuditIssue[];
}

// ---------------------------------------------------------------------------
// Основная функция валидации
// ---------------------------------------------------------------------------

/**
 * Валидирует массив прав из API:
 * 1. Применяет PERMISSION_ALIASES (централизованный маппинг)
 * 2. Фильтрует неизвестные → они получают DENY (не попадают в результат)
 * 3. В dev логирует все подозрительные случаи
 *
 * @returns Массив валидных строк прав (только known permissions)
 */
export function validatePermissions(rawPermissions: any[]): string[] {
  return auditPermissions(rawPermissions).granted;
}

/**
 * Расширенная версия validatePermissions — возвращает полный отчёт с issues.
 * Используется в window.__RBAC__.auditFull(), fixSuggestions() и dev-логировании.
 *
 * Strict mode (dev): если unknown.length > 0 → console.error (не throw — не роняем UI).
 */
export function auditPermissions(rawPermissions: any[]): PermissionAuditResult {
  const known = new Set(ALL_PERMISSIONS as readonly string[]);
  const granted: string[] = [];
  const unknown: string[] = [];
  const aliased: Array<{ from: string; to: string }> = [];
  const issues: AuditIssue[] = [];

  for (const p of rawPermissions) {
    const raw = typeof p === 'string' ? p : p?.name;
    if (typeof raw !== 'string') {
      issues.push({
        permission: String(raw ?? '[non-string]'),
        severity: 'warning',
        message: `Permission value is not a string: ${JSON.stringify(p)}`,
        suggestedFix: 'Проверьте формат ответа API /api/v1/permissions/ — ожидается массив строк или {name: string}[]',
      });
      continue;
    }

    const resolved = PERMISSION_ALIASES[raw];

    if (resolved) {
      // Алиас нашёлся
      aliased.push({ from: raw, to: resolved });
      granted.push(resolved);
      issues.push({
        permission: raw,
        severity: 'info',
        message: `Permission "${raw}" mapped via alias → "${resolved}"`,
      });
    } else if (known.has(raw)) {
      // Прямое совпадение
      granted.push(raw);
    } else {
      // UNKNOWN → DENY
      unknown.push(raw);
      issues.push({
        permission: raw,
        severity: 'critical',
        message: `Unknown permission from API: "${raw}" → DENY`,
        suggestedFix: `Add to PERMISSIONS in src/constants/permissions.ts:\n  ${_suggestConstantEntry(raw)}`,
      });

      if (process.env.NODE_ENV === 'development') {
        // Strict mode: console.error в dev — НЕ throw (не роняем UI)
        console.error(
          `[RBAC] Unknown permission from API: "${raw}" → DENY.\n` +
          `  Fix: add to PERMISSION_ALIASES or ALL_PERMISSIONS in src/constants/permissions.ts`
        );
      }
    }
  }

  // Dev-only: проверяем что массив не пустой и предупреждаем
  if (process.env.NODE_ENV === 'development') {
    if (rawPermissions.length === 0) {
      issues.push({
        permission: '*',
        severity: 'warning',
        message: 'Empty permissions array received from API — user may have no role assigned',
      });
    }
    if (unknown.length > 0) {
      // Уже залогировано выше для каждого unknown, но добавим summary
      console.warn(
        `[RBAC] ${unknown.length} unknown permission(s) from API will be DENIED. ` +
        `Run window.__RBAC__.auditFull() for details and fix suggestions.`
      );
    }
  }

  return { granted, unknown, aliased, issues };
}

// ---------------------------------------------------------------------------
// Вспомогательная функция генерации строки константы
// ---------------------------------------------------------------------------

function _suggestConstantEntry(perm: string): string {
  const [resource, action] = perm.split('.');
  if (!resource || !action) return `'${perm}'`;
  const groupKey = resource.toUpperCase();
  const actionKey = action.toUpperCase();
  return `PERMISSIONS.${groupKey}.${actionKey} = '${perm}'`;
}

// ---------------------------------------------------------------------------
// fixSuggestions — генерирует готовый TypeScript-код для добавления неизвестных прав
// ---------------------------------------------------------------------------

/**
 * Принимает результат auditPermissions и генерирует готовые строки TypeScript-кода
 * которые можно скопировать в constants/permissions.ts или PERMISSION_ALIASES.
 *
 * Используется в window.__RBAC__.fixSuggestions().
 */
export function fixSuggestions(audit: PermissionAuditResult): string {
  if (audit.unknown.length === 0) {
    return '✅ No unknown permissions — everything is in sync.';
  }

  // Группируем по ресурсу
  const byResource: Record<string, string[]> = {};
  for (const perm of audit.unknown) {
    const [resource, action] = perm.split('.');
    const res = resource ?? perm;
    if (!byResource[res]) byResource[res] = [];
    byResource[res].push(action ?? perm);
  }

  const lines: string[] = [];
  lines.push(`// ============================================================`);
  lines.push(`// Found ${audit.unknown.length} unknown permission(s) from API.`);
  lines.push(`// Copy the relevant block into src/constants/permissions.ts`);
  lines.push(`// ============================================================\n`);

  lines.push(`// Option A — add new groups to PERMISSIONS object:`);
  lines.push(`// (inside the \`export const PERMISSIONS = { ... } as const;\` block)\n`);

  for (const [resource, actions] of Object.entries(byResource)) {
    const groupKey = resource.toUpperCase();
    lines.push(`  // ${resource}`);
    lines.push(`  ${groupKey}: {`);
    for (const action of actions) {
      const actionKey = action.toUpperCase();
      lines.push(`    ${actionKey.padEnd(6)}: '${resource}.${action}',`);
    }
    lines.push(`  },\n`);
  }

  lines.push(`\n// Option B — add flat aliases to P object:`);
  lines.push(`// (inside the \`export const P = { ... } as const;\` block)\n`);

  for (const [resource, actions] of Object.entries(byResource)) {
    const groupKey = resource.toUpperCase();
    lines.push(`  // ${resource}`);
    for (const action of actions) {
      const actionKey = action.toUpperCase();
      const flatKey = `${groupKey}_${actionKey}`;
      lines.push(`  ${flatKey.padEnd(36)}: PERMISSIONS.${groupKey}.${actionKey},`);
    }
    lines.push(``);
  }

  lines.push(`\n// Option C — add to PERMISSION_ALIASES (if it's just a rename):`);
  lines.push(`// (in src/utils/validatePermissions.ts)\n`);
  lines.push(`export const PERMISSION_ALIASES = {`);
  lines.push(`  // ... existing ...`);

  for (const perm of audit.unknown) {
    lines.push(`  '${perm}': 'REPLACE_WITH_KNOWN_PERMISSION',`);
  }
  lines.push(`};\n`);

  return lines.join('\n');
}

#!/usr/bin/env node
/**
 * sync-permissions.mjs
 *
 * Синхронизирует список permissions между бэкендом и фронтендом.
 *
 * Usage:
 *   node scripts/sync-permissions.mjs [options]
 *
 * Options:
 *   --url <url>      Base URL бэкенда (default: https://academy.operator.kg)
 *   --token <token>  Bearer token для авторизации
 *   --write          Перезаписать src/constants/permissions.ts
 *   --help           Показать справку
 *
 * Exit codes:
 *   0 — всё в порядке (или только extra на фронте, не breaking)
 *   1 — есть breaking changes (permissions есть на бэке, но нет на фронте)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let baseUrl = 'https://academy.operator.kg';
let token = '';
let writeMode = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--url' && args[i + 1]) {
    baseUrl = args[++i].replace(/\/$/, '');
  } else if (arg === '--token' && args[i + 1]) {
    token = args[++i];
  } else if (arg === '--write') {
    writeMode = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
sync-permissions.mjs — синхронизирует permissions между API и фронтендом

Usage:
  node scripts/sync-permissions.mjs [--url URL] [--token TOKEN] [--write]

Options:
  --url <url>      Base URL бэкенда (default: https://academy.operator.kg)
  --token <token>  Bearer token для авторизации
  --write          Перезаписать src/constants/permissions.ts
  --help           Показать справку

Exit codes:
  0 — всё в порядке (или breaking changes отсутствуют)
  1 — есть breaking changes (permissions есть на бэке, но нет на фронте)
`);
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Читаем ALL_PERMISSIONS из permissions.ts (статический парсинг)
// ---------------------------------------------------------------------------

const PERMISSIONS_FILE = resolve(ROOT, 'src/constants/permissions.ts');

function parseFrontendPermissions(filePath) {
  if (!existsSync(filePath)) {
    console.error(`[sync] File not found: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  // Ищем все строки вида 'resource.action'
  const regex = /['"]([a-z_]+\.(create|read|update|delete|view|list|manage|own))['"]/g;
  const found = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    found.add(match[1]);
  }
  return [...found].sort();
}

const frontendPerms = parseFrontendPermissions(PERMISSIONS_FILE);
console.log(`\n[sync] Frontend permissions: ${frontendPerms.length}`);

// ---------------------------------------------------------------------------
// Читаем PERMISSION_ALIASES из validatePermissions.ts
// ---------------------------------------------------------------------------

const ALIASES_FILE = resolve(ROOT, 'src/utils/validatePermissions.ts');

function parseAliases(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  const aliases = {};
  // Парсим строки вида 'children.create': 'clients.create',
  const aliasRegex = /['"]([a-z_]+\.[a-z_]+)['"]\s*:\s*['"]([a-z_]+\.[a-z_]+)['"]/g;
  let m;
  while ((m = aliasRegex.exec(content)) !== null) {
    aliases[m[1]] = m[2];
  }
  return aliases;
}

const aliases = parseAliases(ALIASES_FILE);
const aliasKeys = Object.keys(aliases);
console.log(`[sync] Aliases defined: ${aliasKeys.length}`);
if (aliasKeys.length > 0) {
  aliasKeys.forEach(k => console.log(`  ${k} → ${aliases[k]}`));
}

// ---------------------------------------------------------------------------
// Запрос к API
// ---------------------------------------------------------------------------

async function fetchBackendPermissions(url, authToken) {
  const endpoint = `${url}/api/v1/permissions/`;
  console.log(`\n[sync] Fetching: ${endpoint}`);

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(endpoint, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[sync] HTTP ${res.status}: ${text.slice(0, 200)}`);
      if (res.status === 401) {
        console.error('[sync] Unauthorized — pass --token <token> to authenticate');
      }
      process.exit(1);
    }
    const json = await res.json();
    // Нормализуем разные форматы ответа
    const items = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)    ? json.data
      : Array.isArray(json?.results) ? json.results
      : Array.isArray(json?.data?.results) ? json.data.results
      : [];

    return items
      .map(p => (typeof p === 'string' ? p : p?.name))
      .filter(Boolean)
      .sort();
  } catch (err) {
    console.error(`[sync] Failed to fetch: ${err.message}`);
    process.exit(1);
  }
}

const backendPerms = await fetchBackendPermissions(baseUrl, token);
console.log(`[sync] Backend permissions: ${backendPerms.length}`);

// ---------------------------------------------------------------------------
// Вычисляем diff
// ---------------------------------------------------------------------------

const frontendSet = new Set(frontendPerms);
const backendSet  = new Set(backendPerms);

// Permissions которые есть на бэке но нет на фронте (breaking — фронт их не знает)
const missingOnFrontend = backendPerms.filter(p => !frontendSet.has(p) && !aliasKeys.includes(p));

// Permissions которые есть на фронте но нет на бэке (extra — безопасно)
const extraOnFrontend = frontendPerms.filter(p => !backendSet.has(p));

// Permissions которые идут через алиасы
const aliasedOnBackend = backendPerms.filter(p => aliasKeys.includes(p));

// ---------------------------------------------------------------------------
// Вывод diff
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('SYNC DIFF REPORT');
console.log('='.repeat(60));

if (missingOnFrontend.length === 0 && extraOnFrontend.length === 0) {
  console.log('\n✅ Frontend and Backend are in sync!\n');
} else {
  if (missingOnFrontend.length > 0) {
    console.log(`\n🔴 MISSING on Frontend (${missingOnFrontend.length}) — BREAKING CHANGES:`);
    console.log('   These permissions exist on Backend but Frontend does NOT know about them.');
    console.log('   Add them to src/constants/permissions.ts\n');

    // Группируем по ресурсу
    const byResource = {};
    for (const p of missingOnFrontend) {
      const [res, act] = p.split('.');
      if (!byResource[res]) byResource[res] = [];
      byResource[res].push(act);
    }
    for (const [res, actions] of Object.entries(byResource)) {
      console.log(`  ${res.toUpperCase()}: {`);
      for (const act of actions) {
        console.log(`    ${act.toUpperCase().padEnd(6)}: '${res}.${act}',`);
      }
      console.log(`  },`);
    }
  }

  if (extraOnFrontend.length > 0) {
    console.log(`\n🟡 EXTRA on Frontend (${extraOnFrontend.length}) — non-breaking:`);
    console.log('   These permissions exist on Frontend but NOT on Backend.\n');
    extraOnFrontend.forEach(p => console.log(`   - ${p}`));
  }
}

if (aliasedOnBackend.length > 0) {
  console.log(`\n🔵 ALIASED (${aliasedOnBackend.length}) — handled via PERMISSION_ALIASES:`);
  aliasedOnBackend.forEach(p => console.log(`   ${p} → ${aliases[p]}`));
}

console.log('\n' + '='.repeat(60) + '\n');

// ---------------------------------------------------------------------------
// --write: перезаписываем permissions.ts
// ---------------------------------------------------------------------------

if (writeMode && missingOnFrontend.length > 0) {
  console.log('[sync] --write mode: generating updated permissions.ts...\n');

  // Читаем текущий файл
  const currentContent = readFileSync(PERMISSIONS_FILE, 'utf-8');

  // Группируем новые permissions по ресурсу
  const newByResource = {};
  for (const p of missingOnFrontend) {
    const [res, act] = p.split('.');
    if (!newByResource[res]) newByResource[res] = [];
    newByResource[res].push(act);
  }

  // Генерируем блоки для вставки в PERMISSIONS
  const permBlocks = [];
  for (const [res, actions] of Object.entries(newByResource)) {
    const groupKey = res.toUpperCase();
    const lines = [
      `  // ${res} (auto-generated by sync-permissions.mjs)`,
      `  ${groupKey}: {`,
      ...actions.map(act => `    ${act.toUpperCase().padEnd(6)}: '${res}.${act}',`),
      `  },`,
      '',
    ];
    permBlocks.push(lines.join('\n'));
  }

  // Вставляем перед `} as const;` в PERMISSIONS
  const insertMarker = '} as const;\n\n// ---------------------------------------------------------------------------\n// Backward-compatible flat P aliases';
  const newContent = currentContent.replace(
    insertMarker,
    `\n${permBlocks.join('\n')}${insertMarker}`
  );

  // Также генерируем P aliases
  const pAliasLines = [];
  for (const [res, actions] of Object.entries(newByResource)) {
    const groupKey = res.toUpperCase();
    pAliasLines.push(`  // ${res} (auto-generated)`);
    for (const act of actions) {
      const flatKey = `${groupKey}_${act.toUpperCase()}`;
      pAliasLines.push(`  ${flatKey.padEnd(36)}: PERMISSIONS.${groupKey}.${act.toUpperCase()},`);
    }
    pAliasLines.push('');
  }

  // Вставляем перед `} as const;\n\n// ---------------------------------------------------------------------------\n// Utility types`
  const pMarker = '} as const;\n\n// ---------------------------------------------------------------------------\n// Utility types';
  const finalContent = newContent.replace(
    pMarker,
    `\n${pAliasLines.join('\n')}${pMarker}`
  );

  writeFileSync(PERMISSIONS_FILE, finalContent, 'utf-8');
  console.log(`✅ Written: ${PERMISSIONS_FILE}`);
  console.log('   Run: npx tsc --noEmit  to verify TypeScript\n');
} else if (writeMode && missingOnFrontend.length === 0) {
  console.log('[sync] --write: nothing to write, frontend is up-to-date.\n');
}

// ---------------------------------------------------------------------------
// Exit code
// ---------------------------------------------------------------------------

if (missingOnFrontend.length > 0) {
  console.error(`[sync] Exit 1: ${missingOnFrontend.length} breaking change(s) found.\n`);
  process.exit(1);
}

process.exit(0);

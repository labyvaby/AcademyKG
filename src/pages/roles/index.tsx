import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Divider,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Switch,
  Tooltip,
  alpha,
} from "@mui/material";
import { AdminPanelSettingsOutlined, SaveOutlined } from "@mui/icons-material";
import { useNotification } from "@refinedev/core";
import { PageHeader } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiFetch } from "../../utility/apiClient";

type Role = {
  id: string;
  name: string;
  displayName: string;
  permissions: string[];
};

type PermissionEntry = {
  name: string;
  displayName: string;
};

const RESOURCE_LABELS: Record<string, string> = {
  app_settings: "Настройки приложения",
  appointment_groups: "Групповые приёмы",
  appointments: "Приёмы",
  branches: "Филиалы",
  children: "Клиенты",
  clients: "Клиенты",
  conclusions: "Заключения",
  employees: "Сотрудники",
  expenses: "Расходы",
  incoming_calls: "Входящие звонки",
  organizations: "Организации",
  payments: "Касса, продажи и платежи",
  products: "Товары",
  reports: "Отчёты",
  roles: "Роли",
  salary_rules: "Правила зарплаты",
  sale_lines: "Касса, продажи и платежи",
  sales: "Касса, продажи и платежи",
  sellable_items: "Услуги и номенклатура",
  service_salary_rules: "Зарплата по услугам",
  services: "Услуги и номенклатура",
  specializations: "Специализации",
  users: "Пользователи",
  work_shifts: "Рабочие смены",
  schedules: "Расписание",
  client_schedules: "Расписание клиентов",
  client_balance_transactions: "Транзакции баланса",
  diagnoses: "Диагнозы",
  notifications: "Уведомления",
  patient_documents: "Документы клиентов",
  procedure_rooms: "Процедурные кабинеты",
  sellable_item_categories: "Категории услуг",
  service_categories: "Категории услуг",
  shifts: "Смены",
  work_schedule: "График работы",
  balance_transactions: "Транзакции баланса",
  cashbox: "Касса, продажи и платежи",
  client_documents: "Документы клиентов",
  employee_documents: "Документы сотрудников",
  employee_schedules: "Расписание сотрудников",
  expense_categories: "Категории расходов",
  salary_payments: "Выплаты зарплат",
  bonus_rules: "Правила бонусов",
  discount_rules: "Правила скидок",
  referral_sources: "Источники привлечения",
  sms_templates: "SMS шаблоны",
  tags: "Теги",
  tasks: "Задачи",
  permissions: "Права доступа",
  reception: "Ресепшн",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Создание",
  read: "Просмотр",
  update: "Редактирование",
  delete: "Удаление",
};

const ACTION_ORDER = ["read", "create", "update", "delete"];

/** Нормализует permissions из ответа API в массив строк.
 * Бэкенд может вернуть строки ["res.action"] или объекты [{ name: "res.action" }] */
const normalizePermissions = (raw: any[]): string[] =>
  raw.map((p) => (typeof p === "string" ? p : (p?.name ?? ""))).filter(Boolean);

const RolesPage: React.FC = () => {
  usePageTitle("Роли и права");
  const { open: notify } = useNotification();

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionEntry[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes]: [any, any] = await Promise.all([
        apiFetch("/api/v1/roles/"),
        apiFetch("/api/v1/permissions/").catch(() => null),
      ]);

      const rawRolesData = rolesRes?.data ?? rolesRes ?? [];
      const rolesListData: Role[] = Array.isArray(rawRolesData)
        ? rawRolesData
        : (rawRolesData?.results ?? []);

      // Грузим detail всех ролей параллельно чтобы получить permissions[]
      const rolesWithDetails = await Promise.all(
        rolesListData.map(async (role) => {
          try {
            const detail: any = await apiFetch(`/api/v1/roles/${role.id}/`);
            const r: Role = detail?.data ?? role;
            return { ...r, permissions: normalizePermissions(r.permissions ?? []) } as Role;
          } catch {
            return { ...role, permissions: normalizePermissions(role.permissions ?? []) } as Role;
          }
        })
      );
      const rolesData = rolesWithDetails;
      setRoles(rolesData);

      // GET /permissions/ может вернуть:
      //   - { data: [...] }            — массив напрямую
      //   - { data: { results: [...] } } — пагинированный
      //   - { "resource.action": {...} } — объект-словарь
      //   - null (403) — нет прав
      const rawPermsOuter = permsRes?.data ?? permsRes ?? null;
      const rawPerms = Array.isArray(rawPermsOuter)
        ? rawPermsOuter
        : (rawPermsOuter?.results ?? rawPermsOuter ?? null);
      let entries: PermissionEntry[] = [];
      if (Array.isArray(rawPerms)) {
        entries = rawPerms.map((p: any) => {
          const name = p?.name ?? "";
          const [resource, action] = name.split(".");
          const displayName = p?.displayName ?? p?.display_name
            ?? `${RESOURCE_LABELS[resource] ?? resource}: ${ACTION_LABELS[action] ?? action}`;
          return { name, displayName };
        });
      } else if (rawPerms && typeof rawPerms === "object") {
        entries = Object.keys(rawPerms).map((name) => {
          const p = rawPerms[name];
          const [resource, action] = name.split(".");
          const displayName = p?.displayName ?? p?.display_name
            ?? `${RESOURCE_LABELS[resource] ?? resource}: ${ACTION_LABELS[action] ?? action}`;
          return { name, displayName };
        });
      }
      setAllPermissions(entries);

      if (rolesData.length > 0) {
        // Грузим detail первой роли чтобы получить permissions
        const firstDetail: any = await apiFetch(`/api/v1/roles/${rolesData[0].id}/`);
        const firstRole: Role = firstDetail?.data ?? rolesData[0];
        const firstPerms = normalizePermissions(firstRole.permissions ?? []);
        setSelectedRole({ ...firstRole, permissions: firstPerms });
        setEditedPermissions(new Set(firstPerms));
      }
    } catch (e: any) {
      notify?.({ type: "error", message: e?.message ?? "Ошибка загрузки" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectRole = async (role: Role) => {
    const initialPerms = normalizePermissions(role.permissions ?? []);
    setSelectedRole({ ...role, permissions: initialPerms });
    setEditedPermissions(new Set(initialPerms));
    setDirty(false);
    try {
      const detail: any = await apiFetch(`/api/v1/roles/${role.id}/`);
      const fullRole: Role = detail?.data ?? role;
      const fullPerms = normalizePermissions(fullRole.permissions ?? []);
      setSelectedRole({ ...fullRole, permissions: fullPerms });
      setEditedPermissions(new Set(fullPerms));
    } catch { /* оставляем то что есть в list */ }
  };

  const handleToggle = (permName: string) => {
    setEditedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permName)) {
        next.delete(permName);
      } else {
        next.add(permName);
      }
      return next;
    });
    setDirty(true);
  };

  const handleToggleRow = (resource: string) => {
    const perms = grouped[resource] ?? [];
    const names = perms.map((p) => p.name);
    const allChecked = names.every((n) => editedPermissions.has(n));
    setEditedPermissions((prev) => {
      const next = new Set(prev);
      names.forEach((n) => allChecked ? next.delete(n) : next.add(n));
      return next;
    });
    setDirty(true);
  };

  const handleToggleAction = (action: string) => {
    const names = Object.values(grouped).flat().filter((p) => p.name.endsWith(`.${action}`)).map((p) => p.name);
    const allChecked = names.every((n) => editedPermissions.has(n));
    setEditedPermissions((prev) => {
      const next = new Set(prev);
      names.forEach((n) => allChecked ? next.delete(n) : next.add(n));
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/roles/${selectedRole.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: Array.from(editedPermissions) }),
      });
      // Перезагружаем роль с сервера чтобы получить актуальные права
      const detail: any = await apiFetch(`/api/v1/roles/${selectedRole.id}/`);
      const rawUpdated: Role = detail?.data ?? { ...selectedRole, permissions: Array.from(editedPermissions) };
      const updatedPerms = normalizePermissions(rawUpdated.permissions ?? []);
      const updatedRole: Role = { ...rawUpdated, permissions: updatedPerms };
      setRoles((prev) => prev.map((r) => r.id === selectedRole.id ? updatedRole : r));
      setSelectedRole(updatedRole);
      setEditedPermissions(new Set(updatedPerms));
      setDirty(false);
      notify?.({ type: "success", message: "Права сохранены" });
    } catch (e: any) {
      notify?.({ type: "error", message: e?.message ?? "Ошибка сохранения" });
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, PermissionEntry[]> = {};
    allPermissions.forEach((p) => {
      const [resource] = p.name.split(".");
      if (!map[resource]) map[resource] = [];
      map[resource].push(p);
    });
    Object.keys(map).forEach((r) => {
      map[r].sort((a, b) => {
        const ai = ACTION_ORDER.indexOf(a.name.split(".")[1]);
        const bi = ACTION_ORDER.indexOf(b.name.split(".")[1]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    });
    return map;
  }, [allPermissions]);

  // Название ресурса из displayName бэкенда — берём из read-права, иначе из первого
  const resourceLabel = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(grouped).forEach(([resource, perms]) => {
      const readPerm = perms.find((p) => p.name.endsWith(".read")) ?? perms[0];
      if (readPerm?.displayName) {
        // displayName приходит как "Просмотр клиентов" — убираем слово действия если есть
        const actionWords: Record<string, string> = {
          "Просмотр ": "", "Создание ": "", "Редактирование ": "", "Удаление ": "",
        };
        let label = readPerm.displayName;
        for (const [word, replace] of Object.entries(actionWords)) {
          if (label.startsWith(word)) { label = label.replace(word, replace); break; }
        }
        map[resource] = label || RESOURCE_LABELS[resource] || resource;
      } else {
        map[resource] = RESOURCE_LABELS[resource] ?? resource;
      }
    });
    return map;
  }, [grouped]);

  const allActions = useMemo(() => {
    const set = new Set<string>();
    allPermissions.forEach((p) => set.add(p.name.split(".")[1]));
    return ACTION_ORDER.filter((a) => set.has(a));
  }, [allPermissions]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: {
          xs: "calc(100dvh - 56px)",
          md: "calc(100dvh - 64px)",
          lg: "100%",
        },
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <PageHeader title="Роли и права доступа" />
      <Box sx={{ flex: 1, display: "flex", flexDirection: { xs: "column", lg: "row" }, overflow: "hidden", minHeight: 0 }}>

        {/* Левая панель */}
        <Box sx={{ width: { xs: "100%", lg: 210 }, maxHeight: { xs: 240, lg: "none" }, flexShrink: 0, borderRight: { xs: "none", lg: "1px solid" }, borderBottom: { xs: "1px solid", lg: "none" }, borderColor: "divider", overflowY: "auto", WebkitOverflowScrolling: "touch", bgcolor: "background.paper" }}>
          <Typography variant="caption" sx={{ px: 2, pt: 1.5, pb: 0.5, display: "block", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.8, fontSize: "0.65rem" }}>
            Роли
          </Typography>
          <Divider />
          {roles.map((role) => {
            const active = selectedRole?.id === role.id;
            return (
              <Box
                key={role.id}
                onClick={() => handleSelectRole(role)}
                sx={{
                  px: 2, py: 1.5, cursor: "pointer",
                  borderLeft: "3px solid",
                  borderLeftColor: active ? "primary.main" : "transparent",
                  bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.08) : "transparent",
                  borderBottom: "1px solid", borderColor: "divider",
                  "&:hover": { bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.1) : "action.hover" },
                  transition: "all 0.15s",
                }}
              >
                <Typography variant="body2" fontWeight={active ? 700 : 500} color={active ? "primary.main" : "text.primary"} noWrap>
                  {role.displayName}
                </Typography>
                <Chip
                  label={`${(role.permissions ?? []).length} прав`}
                  size="small"
                  sx={{ mt: 0.5, height: 18, fontSize: "0.62rem", fontWeight: 600, bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.15) : "action.selected", color: active ? "primary.main" : "text.secondary" }}
                />
              </Box>
            );
          })}
        </Box>

        {/* Правая панель */}
        {selectedRole && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <AdminPanelSettingsOutlined color="primary" fontSize="small" />
                <Typography variant="h6" fontWeight={700}>{selectedRole.displayName}</Typography>
                <Typography variant="body2" color="text.disabled">({selectedRole.name})</Typography>
                {dirty && <Chip label="Не сохранено" size="small" color="warning" sx={{ height: 20, fontSize: "0.68rem" }} />}
              </Stack>
              <Button
                variant="contained"
                size="small"
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlined />}
                onClick={handleSave}
                disabled={!dirty || saving}
                sx={{ textTransform: "none", boxShadow: "none", borderRadius: 2 }}
              >
                Сохранить
              </Button>
            </Stack>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2, WebkitOverflowScrolling: "touch" }}>
              <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: 220, bgcolor: (t) => alpha(t.palette.primary.main, 0.06), borderBottom: "2px solid", borderColor: "primary.light" }}>
                        Раздел
                      </TableCell>
                      {allActions.map((action) => {
                        const names = Object.values(grouped).flat().filter((p) => p.name.endsWith(`.${action}`)).map((p) => p.name);
                        const allChecked = names.length > 0 && names.every((n) => editedPermissions.has(n));
                        return (
                          <TableCell key={action} align="center" sx={{ fontWeight: 700, bgcolor: (t) => alpha(t.palette.primary.main, 0.06), borderBottom: "2px solid", borderColor: "primary.light", minWidth: 120 }}>
                            <Stack alignItems="center" spacing={0.5}>
                              <Typography variant="caption" fontWeight={700} color="text.primary">{ACTION_LABELS[action] ?? action}</Typography>
                              <Switch
                                size="small"
                                checked={allChecked}
                                onChange={() => handleToggleAction(action)}
                                color="primary"
                              />
                            </Stack>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(grouped).map(([resource, perms]) => {
                      const names = perms.map((p) => p.name);
                      const allChecked = names.every((n) => editedPermissions.has(n));
                      const label = resourceLabel[resource] ?? RESOURCE_LABELS[resource] ?? resource;
                      return (
                        <TableRow
                          key={resource}
                          sx={{ "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.03) } }}
                        >
                          <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Switch
                                size="small"
                                checked={allChecked}
                                onChange={() => handleToggleRow(resource)}
                                color="primary"
                              />
                              <Typography variant="body2" fontWeight={500}>
                                {label}
                              </Typography>
                            </Stack>
                          </TableCell>
                          {allActions.map((action) => {
                            const perm = perms.find((p) => p.name === `${resource}.${action}`);
                            if (!perm) {
                              return (
                                <TableCell key={action} align="center" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                                  <Typography variant="caption" color="text.disabled">—</Typography>
                                </TableCell>
                              );
                            }
                            const checked = editedPermissions.has(perm.name);
                            return (
                              <TableCell key={action} align="center" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                                <Tooltip title={perm.displayName} placement="top" arrow>
                                  <Switch
                                    size="small"
                                    checked={checked}
                                    onChange={() => handleToggle(perm.name)}
                                    color="primary"
                                  />
                                </Tooltip>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default RolesPage;

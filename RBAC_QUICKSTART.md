# RBAC Quick Start Guide

## 🚀 Быстрый старт (5 минут)

### Шаг 1: Применить SQL миграции

Откройте Supabase Dashboard → SQL Editor и выполните по очереди:

1. `supabase/migrations/20251210_rbac_setup.sql` - создание таблиц
2. `supabase/migrations/20251210_rls_policies.sql` - настройка безопасности

### Шаг 2: Проверить, что роли назначены

```sql
SELECT e.full_name, r.display_name as role
FROM "Employes" e
JOIN roles r ON e.role_id = r.id;
```

Если у кого-то нет роли:
```sql
UPDATE "Employes"
SET role_id = (SELECT id FROM roles WHERE name = 'doctor')
WHERE id = 'user-uuid-here';
```

### Шаг 3: Использовать в коде

#### Условный рендеринг кнопки:

```tsx
import { CanAccess } from '@/components/rbac';
import { PERMISSIONS } from '@/types/rbac';

<CanAccess permissions={PERMISSIONS.PATIENTS_CREATE}>
  <button>Добавить пациента</button>
</CanAccess>
```

#### Защита маршрута:

```tsx
import { ProtectedRoute } from '@/components/rbac';

<Route
  path="/expenses"
  element={
    <ProtectedRoute allowedRoles={['admin', 'superadmin', 'accountant']}>
      <ExpensesPage />
    </ProtectedRoute>
  }
/>
```

#### Проверка в логике:

```tsx
import { usePermissions } from '@/hooks/usePermissions';

const { hasPermission, isAdmin } = usePermissions();

if (hasPermission('patients.delete')) {
  // Удалить пациента
}
```

---

## 📋 Доступные роли

- **superadmin** - Полный доступ ко всему
- **admin** - Управление клиникой
- **doctor** - Работа с пациентами
- **receptionist** - Регистрация и запись
- **accountant** - Финансы и расходы

---

## 🔑 Часто используемые разрешения

```typescript
import { PERMISSIONS } from '@/types/rbac';

PERMISSIONS.PATIENTS_CREATE      // Создание пациентов
PERMISSIONS.PATIENTS_READ        // Чтение данных пациентов
PERMISSIONS.APPOINTMENTS_CREATE  // Создание записей
PERMISSIONS.EXPENSES_LIST        // Просмотр расходов
PERMISSIONS.EMPLOYEES_UPDATE     // Редактирование сотрудников
```

---

## 🛠️ Полезные SQL команды

### Посмотреть все роли:
```sql
SELECT * FROM roles;
```

### Посмотреть разрешения роли:
```sql
SELECT p.name, p.display_name
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
JOIN roles r ON rp.role_id = r.id
WHERE r.name = 'doctor';
```

### Добавить разрешение роли:
```sql
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.name = 'expenses.read';
```

### Изменить роль пользователя:
```sql
UPDATE "Employes"
SET role_id = (SELECT id FROM roles WHERE name = 'admin')
WHERE full_name = 'Иван Иванов';
```

---

## 📖 Полная документация

Для детального руководства смотрите [RBAC_SETUP.md](./RBAC_SETUP.md)

---

## ❓ Проблемы?

**Пользователь не видит данные:**
```sql
-- Проверьте роль
SELECT e.full_name, r.name
FROM "Employes" e
LEFT JOIN roles r ON e.role_id = r.id
WHERE e.full_name LIKE '%имя%';

-- Если роль пустая, назначьте
UPDATE "Employes" SET role_id = (SELECT id FROM roles WHERE name = 'doctor') WHERE id = 'uuid';
```

**Элементы не скрываются:**
- Проверьте правильность названия разрешения (например, `patients.create`, а не `patient.create`)
- Убедитесь, что используете компонент `<CanAccess>` или хук `usePermissions()`

**Страница доступна всем:**
- Оберните маршрут в `<ProtectedRoute>`
- Проверьте конфигурацию в `src/config/routeConfig.ts`

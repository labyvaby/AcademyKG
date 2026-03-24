# Управление ролями и правами доступа — нужно реализовать на бэкенде

> Фронт готов реализовать страницу управления ролями для супер-админа.
> Права уже приходят в `employee.permissions` через `/users/me/` — нужно только управление ими.

Base URL: `https://academy.operator.kg/api/v1`

---

## Что уже есть

- `GET /api/v1/roles/` — список ролей (поля: `id`, `name`, `displayName`, `description`) ✅
- `GET /api/v1/users/me/` — возвращает `employee.permissions` (массив строк `resource.action`) ✅

---

## Что нужно добавить

### 1. Расширить схему `Role` полем `permissions`

В ответе `GET /api/v1/roles/` каждая роль должна содержать список назначенных прав:

```json
{
  "id": "uuid",
  "name": "receptionist",
  "displayName": "Регистратура",
  "permissions": [
    "appointments.create",
    "appointments.read",
    "appointments.update"
  ]
}
```

---

### 2. PATCH /api/v1/roles/{id}/ — обновить права роли

```
PATCH /api/v1/roles/{id}/
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**
```json
{
  "permissions": [
    "appointments.create",
    "appointments.read",
    "appointments.update",
    "services.read"
  ]
}
```

**Response 200:** обновлённый объект роли с новым списком `permissions`.

**Важно:** после сохранения все сотрудники с этой ролью должны получать обновлённый список при следующем `GET /users/me/`.

---

### 3. GET /api/v1/permissions/ — реестр всех доступных прав

Фронту нужен список **всех возможных прав** чтобы показать чекбоксы на странице.

```
GET /api/v1/permissions/
```

**Response 200:**
```json
{
  "data": [
    { "name": "appointments.create", "displayName": "Приёмы: создание" },
    { "name": "appointments.read",   "displayName": "Приёмы: просмотр" },
    { "name": "appointments.update", "displayName": "Приёмы: редактирование" },
    { "name": "appointments.delete", "displayName": "Приёмы: удаление" },
    { "name": "employees.create",    "displayName": "Сотрудники: создание" },
    { "name": "employees.read",      "displayName": "Сотрудники: просмотр" },
    { "name": "employees.update",    "displayName": "Сотрудники: редактирование" },
    { "name": "employees.delete",    "displayName": "Сотрудники: удаление" },
    { "name": "services.create",     "displayName": "Услуги: создание" },
    { "name": "services.read",       "displayName": "Услуги: просмотр" },
    { "name": "services.update",     "displayName": "Услуги: редактирование" },
    { "name": "services.delete",     "displayName": "Услуги: удаление" },
    { "name": "expenses.create",     "displayName": "Расходы: создание" },
    { "name": "expenses.read",       "displayName": "Расходы: просмотр" },
    { "name": "expenses.update",     "displayName": "Расходы: редактирование" },
    { "name": "expenses.delete",     "displayName": "Расходы: удаление" },
    { "name": "reports.read",        "displayName": "Отчёты: просмотр" },
    { "name": "sales.create",        "displayName": "Продажи: создание" },
    { "name": "sales.read",          "displayName": "Продажи: просмотр" },
    { "name": "sales.update",        "displayName": "Продажи: редактирование" },
    { "name": "sales.delete",        "displayName": "Продажи: удаление" },
    { "name": "products.create",     "displayName": "Товары: создание" },
    { "name": "products.read",       "displayName": "Товары: просмотр" },
    { "name": "products.update",     "displayName": "Товары: редактирование" },
    { "name": "products.delete",     "displayName": "Товары: удаление" },
    { "name": "warehouses.read",     "displayName": "Склад: просмотр" },
    { "name": "warehouses.update",   "displayName": "Склад: редактирование" },
    { "name": "conclusions.create",  "displayName": "Заключения: создание" },
    { "name": "conclusions.read",    "displayName": "Заключения: просмотр" },
    { "name": "conclusions.update",  "displayName": "Заключения: редактирование" },
    { "name": "conclusions.delete",  "displayName": "Заключения: удаление" },
    { "name": "children.create",     "displayName": "Клиенты (дети): создание" },
    { "name": "children.read",       "displayName": "Клиенты (дети): просмотр" },
    { "name": "children.update",     "displayName": "Клиенты (дети): редактирование" },
    { "name": "children.delete",     "displayName": "Клиенты (дети): удаление" }
  ]
}
```

---

## Сводка

| Метод | Эндпоинт | Статус |
|---|---|---|
| GET | `/api/v1/roles/` | ✅ Есть — **расширить полем `permissions[]`** |
| PATCH | `/api/v1/roles/{id}/` | ❌ Нет — добавить |
| GET | `/api/v1/permissions/` | ❌ Нет — добавить |

Как только эти эндпоинты появятся — фронт реализует страницу управления ролями.

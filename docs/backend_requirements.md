# Что нужно от бэкенда

Base URL: `https://academy.operator.kg/api/v1`
Auth: `Authorization: Bearer <token>`
camelCase ↔ snake_case поддерживается с обеих сторон.

---

## 1. Клиентское расписание

Фронт уже вызывает эти эндпоинты — нужно реализовать на бэкенде.

### GET /client-schedules/

```
GET /api/v1/client-schedules/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&page_size=500
```

Ожидаемый ответ:
```json
{
  "results": [
    {
      "id": "uuid",
      "patient": { "id": "uuid", "fullName": "Иванов Иван", "photo": null },
      "date": "2026-03-21",
      "startTime": "09:00",
      "endTime": "18:00"
    }
  ]
}
```

### POST /client-schedules/

```json
{ "patient": "uuid", "date": "2026-03-21", "startTime": "09:00", "endTime": "18:00" }
```

Ответ: объект записи, `201 Created`

### POST /client-schedules/bulk/

Тело — массив:
```json
[
  { "patient": "uuid", "date": "2026-03-20", "startTime": "09:00", "endTime": "18:00" },
  { "patient": "uuid", "date": "2026-03-21", "startTime": "09:00", "endTime": "18:00" }
]
```

Ответ — стратегия `partial_success_skip_duplicates`:
```json
{
  "mode": "partial_success_skip_duplicates",
  "summary": { "received": 2, "created": 1, "skipped": 1 },
  "results": [
    { "index": 0, "status": "skipped", "code": "duplicate_schedule" },
    { "index": 1, "status": "created", "id": "uuid" }
  ],
  "created": [ "...объекты созданных записей..." ]
}
```

Дубликат = та же дата + тот же клиент. Пропускается без ошибки.

### PATCH /client-schedules/{id}/

```json
{ "startTime": "10:00", "endTime": "19:00" }
```

### DELETE /client-schedules/{id}/

---

## 2. Групповые приёмы

Фронт уже вызывает эти эндпоинты — нужно реализовать на бэкенде.

### GET /appointment-groups/

```
GET /api/v1/appointment-groups/?date=YYYY-MM-DD
```

Ожидаемый ответ:
```json
{
  "results": [
    {
      "id": "uuid",
      "appointmentAt": "2026-03-20T10:00:00Z",
      "performerId": "uuid",
      "performerName": "Иванов Алексей",
      "sellableItemId": "uuid",
      "sellableItemName": "Групповое занятие (Йога)",
      "price": 500,
      "maxParticipants": 10,
      "participants": [
        {
          "id": "uuid",
          "patientId": "uuid",
          "patientName": "Смирнова Анна",
          "patientPhoto": null,
          "status": "scheduled",
          "total": 500,
          "paidCash": 0,
          "paidCard": 0,
          "paidBalance": 0,
          "debt": 500
        }
      ]
    }
  ]
}
```

### POST /appointment-groups/

```json
{
  "appointmentAt": "2026-03-20T10:00:00Z",
  "performer": "employee-uuid",
  "sellableItem": "sellable-item-uuid",
  "patients": ["patient-uuid-1"],
  "adminComment": ""
}
```

- `patients` может быть пустым массивом — группа создаётся без участников
- `sellableItem` должна иметь `isGroup=true`, иначе `400`
- Ответ: объект группы (как в GET), `201 Created`

### POST /appointment-groups/{id}/add-participant/

```json
{ "patient": "patient-uuid" }
```

Ответ: обновлённый объект группы, `200 OK`

Ошибки:
- `duplicate_participant` — клиент уже в группе
- `participant_limit_reached` — превышен `maxParticipants`

### PATCH /appointments/{id}/ — статус участника

```json
{ "status": "arrived" }
```

Статусы: `scheduled`, `arrived`, `in_progress`, `completed`, `paid`, `partially_paid`, `cancelled`, `not_came`

Этот эндпоинт уже есть для обычных приёмов — нужно убедиться что работает и для участников группы.

### PATCH /appointments/{id}/ — оплата участника

```json
{ "paidCash": 500, "paidCard": 0, "paidBalance": 0 }
```

- `paidBonuses` не используется, только `paidBalance`
- Бэкенд пересчитывает `debt = total - paidCash - paidCard - paidBalance`
- При `debt === 0` автоматически выставляет статус `paid`
- Ответ: обновлённый объект участника или `200 OK`

---

## 3. Поля услуг — новые

Фронт уже читает эти поля из `/api/v1/sellable-items/` и `/api/v1/services/` — нужно добавить на бэкенде.

### Поля в /sellable-items/ и /services/

| Поле | Тип | Описание |
|---|---|---|
| `isGroup` | bool | `true` = групповая услуга, `false` = индивидуальная |
| `maxParticipants` | int / null | Макс. участников. Только если `isGroup=true`. `null` = без ограничений |
| `durationMinutes` | int / null | Длительность в минутах. `null` → фронт использует дефолт 30 мин |

Пример ответа `GET /api/v1/sellable-items/`:
```json
{
  "id": "uuid",
  "displayName": "Групповое занятие (Йога)",
  "displayPrice": "500.00",
  "isGroup": true,
  "maxParticipants": 10,
  "durationMinutes": 60,
  "isActive": true
}
```

### Приём этих полей в POST/PATCH /services/

Фронт отправляет через `multipart/form-data`:
```
isGroup           bool    true = групповая
maxParticipants   int     обязательно если isGroup=true
durationMinutes   int     необязательно
```

### Фильтр ?isGroup=true в /sellable-items/

```
GET /api/v1/sellable-items/?type=service&isActive=true&isGroup=true&page_size=200
```

Нужен для фильтрации только групповых услуг в клиентском расписании.

### Поле duration в ответе /appointments/

Фронт в регистратуре (`AppointmentsList`) использует `appointment.duration` для расчёта конца приёма и показа свободного окна («Есть окно на HH:mm»). Без этого поля используется дефолт 30 мин.

Нужно: при создании/возврате appointment передавать `duration = sellableItem.durationMinutes`.

---

## 4. Управление групповым приёмом — CRUD

Фронт вызывает эти эндпоинты — **нужно реализовать на бэкенде**. В текущей схеме их нет.

### PATCH /appointment-groups/{id}/

Редактирование группового занятия (дата, тренер, услуга).

```
PATCH /api/v1/appointment-groups/{id}/
Content-Type: application/json
```

Тело (все поля опциональны):
```json
{
  "appointmentAt": "2026-03-21T10:00:00Z",
  "performer": "employee-uuid",
  "sellableItem": "sellable-item-uuid"
}
```

Ответ `200 OK` — обновлённый объект группы (та же структура что и `GET /appointment-groups/`):
```json
{
  "id": "uuid",
  "appointmentAt": "2026-03-21T10:00:00Z",
  "performerId": "uuid",
  "performerName": "Иванов Алексей",
  "sellableItemId": "uuid",
  "sellableItemName": "Групповое занятие (Йога)",
  "price": 500,
  "maxParticipants": 10,
  "participants": [ ... ]
}
```

Права доступа: `isAdmin`, `isRegistrator`, `isSuperAdmin`.

---

### DELETE /appointment-groups/{id}/

Удаление группового занятия вместе со всеми участниками.

```
DELETE /api/v1/appointment-groups/{id}/
```

Ответ `204 No Content`.

Права доступа: **только `isSuperAdmin`**. Остальные роли — `403 Forbidden`.

---

### POST /appointment-groups/{id}/trainer-not-came/

Отметить что тренер не пришёл — ставит статус `not_came` всем участникам группы.

```
POST /api/v1/appointment-groups/{id}/trainer-not-came/
```

Тело: пустое `{}`.

Ответ `200 OK` — обновлённый объект группы со всеми участниками в статусе `not_came`.

Альтернатива (если проще): принимать через `PATCH /appointment-groups/{id}/` поле `status: "not_came"` и применять ко всем участникам.

Права доступа: `isAdmin`, `isRegistrator`, `isDoctor`, `isSuperAdmin`.

---

## 5. Итоговая таблица — что реализовать

| Эндпоинт / Поле | Нужно |
|---|---|
| `GET /client-schedules/?start_date=&end_date=` | ✅ реализовать |
| `POST /client-schedules/` | ✅ реализовать |
| `PATCH /client-schedules/{id}/` | ✅ реализовать |
| `DELETE /client-schedules/{id}/` | ✅ реализовать |
| `POST /client-schedules/bulk/` | ✅ реализовать |
| `GET /appointment-groups/?date=` | ✅ реализовать |
| `POST /appointment-groups/` | ✅ реализовать |
| `PATCH /appointment-groups/{id}/` — редактировать дату/тренера/услугу | ✅ **реализовать** |
| `DELETE /appointment-groups/{id}/` — только superadmin | ✅ **реализовать** |
| `POST /appointment-groups/{id}/trainer-not-came/` | ✅ **реализовать** |
| `POST /appointment-groups/{id}/add-participant/` | ✅ реализовать |
| `PATCH /appointments/{id}/` — статус и оплата для участников группы | проверить совместимость |
| Поле `isGroup` в `/services/` и `/sellable-items/` | ✅ добавить |
| Поле `maxParticipants` в `/services/` и `/sellable-items/` | ✅ добавить |
| Поле `durationMinutes` в `/services/` и `/sellable-items/` | ✅ добавить |
| Фильтр `?isGroup=true` в `/sellable-items/` | ✅ добавить |
| Поле `duration` в ответе `/appointments/` (из `sellableItem.durationMinutes`) | ✅ добавить |

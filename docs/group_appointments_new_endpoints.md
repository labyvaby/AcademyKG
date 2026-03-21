# Новые эндпоинты — Групповые приёмы

> **Статус:** Не реализованы на бэкенде. Фронтенд готов — ждёт реализации.
>
> Base URL: `https://academy.operator.kg/api/v1`
> Auth: `Authorization: Bearer <token>`

---

## 1. PATCH /appointment-groups/{id}/

Редактирование группового занятия — дата/время, тренер, услуга.

```
PATCH /api/v1/appointment-groups/{id}/
Content-Type: application/json
```

### Request body (все поля опциональны)

```json
{
  "appointmentAt": "2026-03-21T10:00:00Z",
  "performer": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "sellableItem": "8ab12c34-1234-5678-abcd-ef0123456789"
}
```

| Поле | Тип | Описание |
|---|---|---|
| `appointmentAt` | `datetime` (ISO 8601) | Новая дата и время занятия |
| `performer` | `uuid` | ID сотрудника (тренера) |
| `sellableItem` | `uuid` | ID услуги/занятия |

### Response `200 OK`

Возвращает полный обновлённый объект группы (та же структура что `GET /appointment-groups/`):

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "appointmentAt": "2026-03-21T10:00:00Z",
  "performerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "performerName": "Иванов Алексей",
  "sellableItemId": "8ab12c34-1234-5678-abcd-ef0123456789",
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
```

### Права доступа

| Роль | Доступ |
|---|---|
| `superadmin` | ✅ |
| `admin` | ✅ |
| `registrator` | ✅ |
| `doctor` / `nurse` | ❌ |

### Ошибки

| Код | Описание |
|---|---|
| `400` | Невалидные данные |
| `403` | Нет прав |
| `404` | Группа не найдена |

---

## 2. DELETE /appointment-groups/{id}/

Удаление группового занятия вместе со всеми участниками.

```
DELETE /api/v1/appointment-groups/{id}/
```

### Response `204 No Content`

Тело ответа пустое.

### Права доступа

| Роль | Доступ |
|---|---|
| `superadmin` | ✅ |
| все остальные | ❌ `403 Forbidden` |

### Поведение

- Удаляет группу и все связанные приёмы участников (`appointments`)
- Если у участников были оплаты — остаётся на усмотрение бэкенда (рекомендуется логировать или возвращать `400` с предупреждением)

### Ошибки

| Код | Описание |
|---|---|
| `403` | Нет прав (не superadmin) |
| `404` | Группа не найдена |

---

## 3. POST /appointment-groups/{id}/trainer-not-came/

Отметить что тренер не пришёл — ставит статус `not_came` всем участникам группы разом.

```
POST /api/v1/appointment-groups/{id}/trainer-not-came/
Content-Type: application/json
```

### Request body

Пустой объект:

```json
{}
```

### Response `200 OK`

Возвращает обновлённый объект группы со всеми участниками в статусе `not_came`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "appointmentAt": "2026-03-21T10:00:00Z",
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
      "status": "not_came",
      "total": 500,
      "paidCash": 0,
      "paidCard": 0,
      "paidBalance": 0,
      "debt": 500
    }
  ]
}
```

### Права доступа

| Роль | Доступ |
|---|---|
| `superadmin` | ✅ |
| `admin` | ✅ |
| `registrator` | ✅ |
| `doctor` | ✅ |
| `nurse` | ❌ |

### Поведение

- Применяет `status = "not_came"` ко **всем** участникам группы одной операцией
- Участники с уже финальным статусом (`paid`, `cancelled`) — **не трогать**
- Долги не пересчитываются

### Ошибки

| Код | Описание |
|---|---|
| `403` | Нет прав |
| `404` | Группа не найдена |

---

## Итого

| Эндпоинт | Метод | Приоритет |
|---|---|---|
| `/api/v1/appointment-groups/{id}/` | `PATCH` | 🔴 Высокий |
| `/api/v1/appointment-groups/{id}/` | `DELETE` | 🔴 Высокий |
| `/api/v1/appointment-groups/{id}/trainer-not-came/` | `POST` | 🟡 Средний |

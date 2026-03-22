# Что нужно от бэкенда

Base URL: `https://academy.operator.kg/api/v1`
Auth: `Authorization: Bearer <token>`
camelCase ↔ snake_case поддерживается с обеих сторон.

---

## 1. Клиентское расписание

> Все базовые эндпоинты (`GET`, `POST`, `PATCH`, `DELETE`, `bulk`) — **реализованы в схеме**.

### Единственное что нужно исправить: POST /client-schedules/bulk/ — формат ответа

Текущий ответ схемы возвращает просто `ClientScheduleRead`. Нужен формат `partial_success_skip_duplicates`:

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

Дубликат = та же дата + тот же клиент. Пропускается без ошибки `400`.

---

## 2. Групповые приёмы — поведение оплаты

> `GET`, `POST`, `PATCH`, `DELETE`, `add-participant`, `trainer-not-came` — **реализованы в схеме**.

### Статус при оплате участника — автоматический расчёт

`PATCH /appointments/{id}/` при изменении оплаты должен **автоматически** выставлять статус:

| Условие | Статус |
|---|---|
| `debt === 0` | `paid` |
| `paidCash + paidCard + paidBalance > 0` и `debt > 0` | `partially_paid` |
| ничего не оплачено | `scheduled` |

Фронт **не передаёт** статус явно при оплате — бэкенд считает сам.

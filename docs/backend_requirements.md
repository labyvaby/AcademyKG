# Требования к бэкенду — статус

Актуальные открытые задачи — в [rbac_backend_contract.md](rbac_backend_contract.md).

| # | Задача | Статус |
|---|---|---|
| 1 | `POST /client-schedules/bulk/` — формат `partial_success_skip_duplicates` | ⚠️ Уточнить у бэкенда |
| 2 | Автоматический расчёт статуса при оплате участника группы (`paid`/`partially_paid`/`scheduled`) | ⚠️ Уточнить у бэкенда |

---

## POST /client-schedules/bulk/ — формат ответа

Нужен формат `partial_success_skip_duplicates` (дубликат = та же дата + тот же клиент, пропускается без 400):

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

---

## Автоматический статус при оплате участника группы

`PATCH /appointments/{id}/` при изменении оплаты должен **автоматически** выставлять статус:

| Условие | Статус |
|---|---|
| `debt === 0` | `paid` |
| `paidCash + paidCard + paidBalance > 0` и `debt > 0` | `partially_paid` |
| ничего не оплачено | `scheduled` |

Фронт **не передаёт** статус явно при оплате — бэкенд считает сам.

# Групповые приёмы — изменение поведения

> `PATCH /appointment-groups/{id}/` и `DELETE /appointment-groups/{id}/` — **полностью реализованы**, без изменений.

---

## POST /appointment-groups/{id}/trainer-not-came/ — нужно изменить поведение

**Текущее поведение (неверное):** ставит `not_came` всем участникам кроме `paid` и `cancelled`.

**Требуемое поведение:** статусы клиентов **не трогать**. Фиксировать только факт отсутствия тренера.

### Что нужно изменить на бэкенде

1. Добавить поле `trainerNotCame` (boolean) в модель `AppointmentGroup`
2. При вызове эндпоинта — только выставить `trainerNotCame = true`, статусы участников не менять
3. Вернуть обновлённый объект группы с полем `trainerNotCame: true`

### Обновлённая схема ответа

Добавить поле в `AppointmentGroupList`:

```yaml
trainerNotCame:
  type: boolean
  readOnly: true
  default: false
  title: Тренер не пришёл
```

### Пример ответа

```json
{
  "data": {
    "id": "uuid",
    "appointmentAt": "2026-03-21T10:00:00Z",
    "performerId": "uuid",
    "performerName": "Иванов Алексей",
    "trainerNotCame": true,
    "sellableItemId": "uuid",
    "sellableItemName": "Групповое занятие (Йога)",
    "price": "1000.00",
    "maxParticipants": 10,
    "participants": [
      {
        "id": "uuid",
        "patientId": "uuid",
        "patientName": "Смирнова Анна",
        "status": "scheduled",
        "debt": "1000.00"
      }
    ]
  }
}
```

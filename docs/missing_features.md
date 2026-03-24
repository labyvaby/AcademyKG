# Недостающий функционал — нужно реализовать

> Всё что перечислено здесь **отсутствует в схеме** или **работает неверно**.
> Фронтенд уже готов и ждёт этих изменений.

Base URL: `https://academy.operator.kg/api/v1`

---

## 1. PATCH /appointments/{id}/ — не принимает `discount` и `debt`

**Проблема:** фронт передаёт `discount` и `debt` при сохранении оплаты, но схема (`PatchedAppointmentUpdateRequest`) их не принимает.

**Что фронт отправляет:**
```json
{
  "paidCash": 500,
  "paidCard": 0,
  "paidBalance": 0,
  "paidBonuses": 0,
  "discount": 100,
  "debt": 400,
  "adminComment": "..."
}
```

**Нужно добавить в схему `PatchedAppointmentUpdateRequest`:**
```yaml
discount:
  type: string
  format: decimal
  title: Скидка
debt:
  type: string
  format: decimal
  title: Долг
```

**Дополнительно:** бэкенд должен **автоматически** пересчитывать статус при изменении оплаты:

| Условие | Статус |
|---|---|
| `paidCash + paidCard + paidBalance + paidBonuses >= total` | `paid` |
| сумма > 0, но < total | `partially_paid` |
| ничего не оплачено | `scheduled` |

Фронт **не передаёт** `status` при оплате — бэкенд считает сам.

---

## 2. GET /appointments/ — фильтр `employee` не существует, нужен `specialist`

**Проблема:** в `src/pages/home/index.tsx` фронт фильтрует приёмы тренера через `?employee=uuid`, но схема принимает только `specialist`.

**Фронт отправляет (неверно):**
```
GET /api/v1/appointments/?employee=uuid
```

**Схема ожидает:**
```
GET /api/v1/appointments/?specialist=uuid
```

**Решение:** бэкенд принимает оба параметра как алиасы (`employee` = `specialist`), **или** мы правим фронт — сообщите что предпочтительнее.

---

## 3. PATCH /appointment-groups/{id}/ — не принимает `maxParticipants`

**Проблема:** при редактировании группового занятия фронт хочет позволить менять лимит участников, но схема `PatchedAppointmentGroupPartialUpdateRequest` принимает только `appointmentAt`, `performer`, `sellableItem`.

**Нужно добавить:**
```yaml
maxParticipants:
  type: integer
  nullable: true
  title: Лимит участников
```

---

## 4. GET /appointment-groups/ — нет фильтра по тренеру

**Проблема:** нельзя получить групповые приёмы конкретного тренера.

**Нужно добавить параметр:**
```
GET /api/v1/appointment-groups/?date=2026-03-21&performer=uuid
```

```yaml
- in: query
  name: performer
  schema:
    type: string
    format: uuid
  description: Фильтр по тренеру (исполнителю)
```

---

## 5. POST /appointment-groups/{id}/trainer-not-came/ — неверное поведение

**Проблема:** сейчас ставит `not_came` всем участникам кроме `paid`/`cancelled`. Это неверно.

**Нужное поведение:**
- Статусы участников **не трогать**
- Добавить поле `trainerNotCame: true` в модель группы
- Вернуть обновлённую группу с этим полем

**Добавить в `AppointmentGroupList`:**
```yaml
trainerNotCame:
  type: boolean
  readOnly: true
  default: false
  title: Тренер не пришёл
```

---

## 6. POST /client-schedules/bulk/ — неверный формат ответа

**Проблема:** схема возвращает просто `ClientScheduleRead`, фронт ожидает детальный ответ по каждой записи.

**Нужный ответ:**
```json
{
  "mode": "partial_success_skip_duplicates",
  "summary": { "received": 3, "created": 2, "skipped": 1 },
  "results": [
    { "index": 0, "status": "created", "id": "uuid" },
    { "index": 1, "status": "skipped", "code": "duplicate_schedule" },
    { "index": 2, "status": "created", "id": "uuid" }
  ],
  "created": [
    { "id": "uuid", "patient": "uuid", "date": "2026-03-10", "startTime": "09:00", "endTime": "18:00" }
  ]
}
```

Дубликат = та же дата + тот же клиент → пропускать без ошибки `400`.

---

## 7. Списание баллов при оплате — двойной вызов

**Проблема:** фронт вручную создаёт транзакцию баллов после `PATCH /appointments/{id}/`. Если бэкенд будет делать это автоматически при `paidBonuses > 0` — сообщить, чтобы убрать дублирующий вызов.

**Сейчас фронт делает:**
```json
POST /api/v1/client-balance-transactions/
{
  "patient": "uuid",
  "txType": "bonuses",
  "amount": "-500",
  "note": "Оплата приёма #uuid"
}
```

Если бэкенд берёт это на себя — убрать с фронта.

---

## 8. GET /appointments/ — нет поля `group` в ответе (счётчик дней считает неверно)

**Проблема:** навбар с количеством приёмов по дням считает каждого участника группового приёма как отдельный приём. 5 участников в группе = 5 в счётчике, а должно быть 1.

**Причина:** `AppointmentList` (ответ `/appointments/`) не содержит поля `group` — фронт не знает какие записи относятся к группе и не может их схлопнуть.

**Нужно:** добавить поле `group` в `AppointmentList`:

```yaml
group:
  type: string
  format: uuid
  nullable: true
  readOnly: true
  title: ID группового приёма (если участник группы)
```

Тогда фронт при подсчёте будет считать все записи с одинаковым `group` как **один** приём.

**Альтернатива (лучше):** добавить отдельный эндпоинт или параметр `?excludeGroupParticipants=true` для `/appointments/` чтобы участники групп не попадали в список вообще — они отображаются через `/appointment-groups/`.

---


## 9. GET /cashbox/summary/ — не учитывает отменённые приёмы с оплатой

**Проблема:** если приём отменён (`status = cancelled`), но оплата была принята (`paidCash > 0` или `paidCard > 0`), касса эту сумму не считает.

**Нужное поведение:** в сводку кассы включать **все** приёмы где фактически получены деньги, независимо от статуса приёма.

**Условие включения в кассу:**
```
paidCash + paidCard + paidBalance + paidBonuses > 0
```

Статус `cancelled` не должен исключать приём из кассы если деньги были приняты.

---

## Итого

| # | Проблема | Приоритет |
|---|---|---|
| 1 | `PATCH /appointments/{id}/` не принимает `discount`, `debt` + нет автостатуса | 🔴 Высокий |
| 2 | `GET /appointments/` — параметр `employee` vs `specialist` | 🔴 Высокий |
| 3 | `GET /appointments/` — нет поля `group`, счётчик дней считает участников как отдельные приёмы | 🔴 Высокий |
| 4 | `trainer-not-came` меняет статусы клиентов — не должен | 🔴 Высокий |
| 5 | `GET /cashbox/summary/` не учитывает отменённые приёмы с оплатой | 🔴 Высокий |
| 6 | `PATCH /appointment-groups/{id}/` не принимает `maxParticipants` | 🟡 Средний |
| 7 | `GET /appointment-groups/` нет фильтра по тренеру | 🟡 Средний |
| 8 | `POST /client-schedules/bulk/` неверный формат ответа | 🟡 Средний |
| 9 | Двойное списание баллов (фронт + возможно бэкенд) | 🟢 Низкий |

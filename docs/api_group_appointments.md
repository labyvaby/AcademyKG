# API — Групповые приёмы, Клиентское расписание, Услуги

## Общие правила

- Base URL: `https://academy.operator.kg/api/v1`
- Auth: `Authorization: Bearer <token>`
- Форматы дат:
  - дата: `YYYY-MM-DD`
  - время: `HH:mm`
  - datetime: ISO (`2026-03-20T10:00:00Z`)
- Сервер поддерживает camelCase ⇄ snake_case, поэтому можно использовать `startTime`, `endTime`, `appointmentAt`, `sellableItem`, `maxParticipants`, `durationMinutes` как при отправке, так и при чтении

---

## Страницы, использующие эти данные

| Страница | Путь | Что делает |
|---|---|---|
| Регистратура | `/home` | Создаёт обычный или групповой приём через дровер |
| Групповые приёмы | `/group-appointments` | Просматривает, добавляет участников, меняет статусы, принимает оплату |
| Клиентское расписание | `/client-schedule` | Записывает клиента на разовые/повторяющиеся сеансы, в том числе групповые |
| Услуги | (настройки) | Добавление и редактирование услуг с типом (группа/индивидуальная) |

---

## 1. Клиентское расписание

### 1.1 Получить расписание

```
GET /client-schedules/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&patient_id=<uuid?>
```

| Параметр   | Обязателен | Описание |
|------------|-----------|---------|
| start_date | ✅        | Начало диапазона |
| end_date   | ✅        | Конец диапазона |
| patient_id | ❌        | Фильтр по клиенту |

**Ответ (DRF пагинированный envelope):**
```json
{
  "results": [
    {
      "id": "uuid",
      "patient": { "id": "uuid", "full_name": "Иванов Иван", "photo": null },
      "date": "2026-03-21",
      "start_time": "09:00",
      "end_time": "18:00"
    }
  ]
}
```

---

### 1.2 Создать одну запись

```
POST /client-schedules/
```

```json
{
  "patient": "uuid",
  "date": "2026-03-21",
  "startTime": "09:00",
  "endTime": "18:00"
}
```

**Ответ:** `201 Created`, объект записи

---

### 1.3 Обновить запись

```
PATCH /client-schedules/{id}/
```

```json
{
  "startTime": "10:00",
  "endTime": "19:00"
}
```

---

### 1.4 Удалить

```
DELETE /client-schedules/{id}/
```

---

### 1.5 Bulk создание (несколько дат сразу)

**Используется:** когда в форме выбраны дни недели → создаётся несколько записей одним запросом

```
POST /client-schedules/bulk/
```

**Тело — массив объектов:**
```json
[
  { "patient": "uuid", "date": "2026-03-20", "startTime": "09:00", "endTime": "18:00" },
  { "patient": "uuid", "date": "2026-03-21", "startTime": "09:00", "endTime": "18:00" }
]
```

**Ответ (partial_success_skip_duplicates):**
```json
{
  "mode": "partial_success_skip_duplicates",
  "summary": { "received": 2, "created": 1, "skipped": 1 },
  "results": [
    { "index": 0, "status": "skipped", "code": "duplicate_schedule" },
    { "index": 1, "status": "created", "id": "uuid" }
  ],
  "created": [ "...созданные объекты..." ]
}
```

**Как фронт обрабатывает ответ:**
- Показывает итог через `summary` (toast или Alert)
- По `results[index]` подсвечивает строку формы (создана / пропущена)
- Дубликаты игнорируются без ошибки — это ожидаемое поведение

---

## 2. Групповые приёмы

### 2.1 Получить список групп на дату

**Используется:** `/group-appointments` (просмотр по дате), `/client-schedule` (поиск доступных занятий)

```
GET /appointment-groups/?date=YYYY-MM-DD
```

**Ответ `results[]`:**
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

**Фронт фильтрует на клиенте (в `/client-schedule`):**
- Только группы, где `sellableItemId === выбранная услуга`
- И `participants.length < maxParticipants` (есть свободные места)

---

### 2.2 Создать группу

**Используется:** `/home` (дровер, режим «Групповой»), `/group-appointments` (кнопка «Добавить занятие»)

```
POST /appointment-groups/
```

```json
{
  "appointmentAt": "2026-03-20T10:00:00Z",
  "performer": "employee-uuid",
  "sellableItem": "sellable-item-uuid",
  "patients": ["patient-uuid-1", "patient-uuid-2"],
  "adminComment": ""
}
```

**Важно:**
- `patients` может быть пустым — создаётся группа без участников, добавляются позже
- `sellableItem` должна иметь `isGroup=true`, иначе бэкенд вернёт `400`

**Ответ:** объект `AppointmentGroup` (см. 2.1), `201 Created`

---

### 2.3 Добавить участника в существующую группу

**Используется:** `/group-appointments` — кнопка «Добавить участника» внутри карточки занятия

```
POST /appointment-groups/{groupId}/add-participant/
```

```json
{ "patient": "patient-uuid" }
```

**Возможные ошибки:**
| Код | Описание |
|-----|---------|
| `duplicate_participant` | Клиент уже в группе |
| `participant_limit_reached` | Лимит `maxParticipants` достигнут |

**Логика на фронте:**
- Кнопка «Добавить участника» **скрыта**, если `participants.length >= maxParticipants`
- При достижении лимита показывается chip «Группа полная» и текст «Достигнут лимит участников»

**Ответ:** обновлённый объект `AppointmentGroup`, `200 OK`

---

## 3. Статусы и оплата участников группы

Участник группы — это отдельный `Appointment`, обновляется через:

```
PATCH /appointments/{appointmentId}/
```

### 3.1 Обновить статус

```json
{ "status": "arrived" }
```

| Код              | Отображение на UI  |
|------------------|--------------------|
| `scheduled`      | Ожидаем            |
| `arrived`        | Клиент здесь       |
| `in_progress`    | В работе           |
| `completed`      | Завершено          |
| `paid`           | Оплачено           |
| `partially_paid` | Частично оплачено  |
| `cancelled`      | Отменено           |
| `not_came`       | Не пришёл          |

### 3.2 Принять оплату

```json
{
  "paidCash": 500,
  "paidCard": 0,
  "paidBalance": 0
}
```

| Поле          | Тип | Описание |
|---------------|-----|---------|
| `paidCash`    | int | Оплата наличными |
| `paidCard`    | int | Оплата картой |
| `paidBalance` | int | Оплата с баланса клиента (не бонусы) |

> `paidBonuses` **не используется** — только `paidBalance`.

**Что делает бэкенд автоматически:**
- Пересчитывает `debt = total - paidCash - paidCard - paidBalance`
- Выставляет `paid` если `debt === 0`
- Выставляет `partially_paid` если есть частичная оплата

**Ответ:** `200 OK`

---

## 4. Услуги

### 4.1 Получить услуги сотрудника

**Используется:** `/home` (дровер, поле «Услуга», загружается после выбора тренера)

```
GET /sellable-items/?type=service&isActive=true&employee={performerId}&page_size=200
```

### 4.2 Получить все групповые услуги

**Используется:** `/client-schedule` (форма, поле «Услуга» в групповом режиме)

```
GET /sellable-items/?type=service&isActive=true&isGroup=true&page_size=200
```

### 4.3 Получить все услуги

**Используется:** `/client-schedule` (поле «Услуга» в обычном режиме)

```
GET /sellable-items/?type=service&isActive=true&page_size=200
```

**Используемые поля ответа:**
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

| Поле              | Тип       | Описание |
|-------------------|-----------|---------|
| `isGroup`         | bool      | `true` = групповая, `false` = индивидуальная |
| `maxParticipants` | int/null  | Макс. участников. Только для `isGroup=true`. `null` = без ограничений |
| `durationMinutes` | int/null  | Длительность в минутах. `null` → фронт использует дефолт **30 мин** |

**Как фронт использует поля:**
- `isGroup` — в дровере `/home`: в групповом режиме показывает счётчик `X/N уч.`
- `maxParticipants` — блокирует добавление клиентов при достижении лимита, показывает синий текст «Для услуги «...» уже набрано максимальное кол-во клиентов (N)»
- `durationMinutes` — передаётся в appointment как поле `duration`. Используется в `AppointmentsList` для расчёта конца приёма (`appointmentAt + duration`) и отображения свободных окон («Есть окно на HH:mm»)

---

### 4.4 Создать / обновить услугу

```
POST /services/          — создание
PATCH /services/{id}/    — обновление
```

**Тело запроса (multipart/form-data):**
```
name              string   Название *
priceSom          number   Цена в сомах *
isActive          bool     Статус активности
isGroup           bool     true = групповая услуга
maxParticipants   number   Макс. участников (обязательно если isGroup=true)
durationMinutes   number   Длительность в минутах (необязательно)
description       string   Описание (необязательно)
imageUrl          File     Фото (необязательно)
```

**Валидация на фронте:**
- Если `isGroup=true` → поле `maxParticipants` обязательно (> 0)
- `durationMinutes` необязательно, но рекомендуется — без него расписание использует дефолт 30 мин

**Ответ:** объект услуги с теми же полями, `201 Created` / `200 OK`

---

## 5. Поиск клиентов

```
GET /clients/?search={query}&page_size=30
GET /clients/?page_size=50&ordering=fullName
```

**Поля ответа:**
| Поле           | Алиасы       | Описание |
|----------------|--------------|---------|
| `id`           | —            | ID клиента |
| `fullName`     | `full_name`  | ФИО |
| `phone`        | `contactPhone` | Телефон |

---

## 6. Сотрудники по дате

**Используется:** `/home` (поле «Тренер» — только те, у кого смена в этот день)

```
GET /appointments/employees-by-date/?date=YYYY-MM-DD
```

Если вернёт пустой массив — фронт делает фоллбэк:
```
GET /employees/?status=active&page_size=200
```

---

## 7. Что нужно реализовать на бэкенде

| # | Эндпоинт / Поле | Статус | Описание |
|---|---|---|---|
| 1 | `GET /appointment-groups/?date=` | ⚠️ Нужен | Список групп по дате |
| 2 | `POST /appointment-groups/` | ⚠️ Нужен | Создание группы |
| 3 | `POST /appointment-groups/{id}/add-participant/` | ⚠️ Нужен | Добавить клиента в группу. Ошибки: `duplicate_participant`, `participant_limit_reached` |
| 4 | `PATCH /appointments/{id}/` — статус и оплата | ✅ Есть | Уже используется для обычных приёмов |
| 5 | `POST /client-schedules/bulk/` | ⚠️ Нужен | Bulk создание. Стратегия: `partial_success_skip_duplicates` |
| 6 | Поле `isGroup` в `/services/` и в `sellable-items` | ⚠️ Нужно | Тип услуги |
| 7 | Поле `maxParticipants` в `/services/` и в `sellable-items` | ⚠️ Нужно | Обязательно при `isGroup=true` |
| 8 | Поле `durationMinutes` в `/services/` и в `sellable-items` | ⚠️ Нужно | Длительность → влияет на окна в расписании |
| 9 | Поле `duration` в ответе `GET /appointments/` (aggregated) | ⚠️ Нужно | Берётся из `sellableItem.durationMinutes` |
| 10 | Фильтр `?isGroup=true` в `/sellable-items/` | ⚠️ Нужен | Для фильтрации только групповых услуг |

---

## 8. Структуры данных (Frontend Types)

```typescript
// Услуга
type ServiceRow = {
  id: string;
  name: string;
  price?: number;
  photoUrl?: string;
  employee_ids?: string[];
  is_active?: boolean;
  isGroup?: boolean;              // true = групповая
  maxParticipants?: number | null; // null = без ограничений (только для isGroup=true)
  durationMinutes?: number | null; // null = фронт использует дефолт 30 мин
};

// Статус участника группы
type GroupAppointmentStatus =
  | "scheduled"
  | "arrived"
  | "in_progress"
  | "completed"
  | "paid"
  | "partially_paid"
  | "cancelled"
  | "not_came";

// Участник группового занятия
type GroupParticipant = {
  id: string;           // ID отдельного appointment
  patientId: string;
  patientName: string;
  patientPhoto?: string | null;
  status: GroupAppointmentStatus;
  total: number;
  paidCash: number;
  paidCard: number;
  paidBalance: number;  // оплата с баланса (не бонусы)
  debt: number;
};

// Групповое занятие
type AppointmentGroup = {
  id: string;
  appointmentAt: string;           // ISO datetime
  performerId: string;
  performerName: string;
  sellableItemId: string;
  sellableItemName: string;
  price: number;                   // Цена за одного участника
  maxParticipants?: number | null; // null = без ограничений
  participants: GroupParticipant[];
};
```

---

## 9. Потоки данных по страницам

### `/home` — Регистратура, дровер «Добавить прием»

**Режим «Обычный»:**
1. «Дата и время» → DateTimePicker
2. «Тренер» → `GET /appointments/employees-by-date/?date=` → сотрудники по смене
3. «Услуга» → `GET /sellable-items/?employee={id}` → услуги выбранного тренера
4. «Клиент» → `GET /clients/?search=` → поиск с debounce 400ms
5. Переключатель «Бронирование (без клиента)» → клиент необязателен, комментарий обязателен
6. Кнопка «Добавить прием» → `POST /appointments/`

**Режим «Групповой»:**
1. «Дата и время» → DateTimePicker
2. «Тренер» → `GET /appointments/employees-by-date/?date=`
3. «Услуга» → `GET /sellable-items/?employee={id}` (содержит `isGroup`, `maxParticipants`, `durationMinutes`)
4. «Клиенты» → `GET /clients/?search=` → список участников (несколько)
5. **Лимит участников:** фронт читает `maxParticipants` из выбранной услуги
   - Показывает счётчик `X/N уч.` рядом с заголовком «Клиенты»
   - При достижении лимита: скрывает поле поиска, синий текст «Для услуги «...» уже набрано максимальное кол-во клиентов (N)»
6. Кнопка «Добавить занятие» → `POST /appointment-groups/` (передаёт `maxParticipants` из услуги)

---

### `/group-appointments` — Страница групповых приёмов

1. Навигация по дате → `GET /appointment-groups/?date=`
2. Карточка группы → клик раскрывает список участников (Collapse)
3. Каждый участник: dropdown статуса → `PATCH /appointments/{id}/` `{ status }`
4. Каждый участник: кнопка с суммой долга → форма оплаты → `PATCH /appointments/{id}/` `{ paidCash, paidCard, paidBalance }`
5. Кнопка «Добавить участника» (скрыта если группа полная) → диалог поиска → `POST /appointment-groups/{id}/add-participant/`
6. Кнопка «Добавить занятие» (header) → открывает `HomeAddAppointmentDrawer` в групповом режиме

---

### `/client-schedule` — Клиентское расписание

**Форма `ClientShiftForm`:**
1. Переключатель «Тип» (Обычный / Групповой)
2. «Клиент» → из предзагруженного списка клиентов
3. «Услуга» → `GET /sellable-items/?type=service&isActive=true` (при групповом режиме добавлять `&isGroup=true`)
4. «Дата» → CustomDatePicker
5. Дни недели (необязательно) → при выборе:
   - Показывается поле «Дата окончания диапазона»
   - Жёлтый alert с диапазоном дат
   - Список чипов с конкретными датами, попадающими на выбранные дни
   - **Только в групповом режиме** — список доступных групповых занятий:
     - Для каждой даты: `fetchGroups(date)` → `GET /appointment-groups/?date=`
     - Фильтр: `sellableItemId === выбранная услуга` И `participants.length < maxParticipants`
     - Если услуга не выбрана → info alert «Выберите услугу»
     - Если нет подходящих занятий → warning alert
6. При сабмите с днями недели → `POST /client-schedules/bulk/` (массив дат)
7. При сабмите без дней → `POST /client-schedules/` (одна запись)

---

## 10. Бизнес-правила (важно для бэкенда)

1. **Лимит участников** — `AppointmentGroup.maxParticipants` фиксируется из `sellableItem.maxParticipants` в момент создания группы. Если `null` — без ограничений. Бэкенд должен отклонять `add-participant/` если лимит достигнут (`participant_limit_reached`).

2. **Длительность** — `sellableItem.durationMinutes` передаётся в appointment как `duration`. В регистратуре: `конец приёма = appointmentAt + duration минут`. Если `null` → фронт использует дефолт **30 минут**. Точная длительность обеспечивает правильный показ свободных окон.

3. **Тип услуги** — `isGroup=true` только для групповых. `maxParticipants` имеет смысл только при `isGroup=true`. При `isGroup=false` → `maxParticipants` должен быть `null`.

4. **Цена участника** — `price` фиксируется из `sellableItem.displayPrice` в момент создания группы. `GroupParticipant.total = group.price` для каждого участника.

5. **Оплата** — по каждому участнику отдельно через `PATCH /appointments/{participantId}/`. `debt = total - paidCash - paidCard - paidBalance`.

6. **Статус `paid`** — выставляется автоматически когда `debt === 0` (фронт делает это сам, бэкенд тоже должен проверять).

7. **Изоляция клиента** — когда клиент заходит под своим аккаунтом и входит в группу, он видит **только свою запись** (`GroupParticipant`), не весь список группы.

8. **Создание без участников** — групповое занятие можно создать пустым, участников добавляют позже.

9. **Bulk schedule дубликаты** — стратегия `partial_success_skip_duplicates`: если запись на дату+клиент уже существует — пропускается без ошибки, остальные создаются.

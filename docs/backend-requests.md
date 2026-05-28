# Запросы к бэкенду

## 1. Фильтрация удалённых услуг в sellable-items [ПРИОРИТЕТ: ВЫСОКИЙ]

### Проблема

Эндпоинт `GET /api/v1/sellable-items/?type=service&isActive=true` возвращает
sellable-items для удалённых сервисов (у которых `is_deleted=true` в БД).

Схема OpenAPI (`SellableItem`) не содержит полей `isDeleted` / `deletedAt`,
поэтому фронтенд не может определить удалённую запись только через этот эндпоинт.

### Текущий обходной путь

Фронтенд делает **два параллельных запроса**:

1. `GET /api/v1/sellable-items/?type=service&isActive=true` — получает данные
2. `GET /api/v1/services/?isActive=true` — получает ID реально существующих сервисов

Затем фильтрует: оставляет только те sellable-items, у которых `service.id`
присутствует в ответе `/services/`.

Это добавляет лишний сетевой запрос и создаёт риск рассинхрона кэшей.

### Что нужно от бэкенда (один из вариантов)

**Вариант A (предпочтительный):** Автоматически исключать soft-deleted сервисы
из выдачи `sellable-items` при фильтре `isActive=true`.

```
GET /api/v1/sellable-items/?type=service&isActive=true
→ не возвращает записи где service.is_deleted = true
```

**Вариант B:** Добавить поле `isDeleted` в схему ответа `SellableItem`:

```yaml
SellableItem:
  properties:
    isDeleted:
      type: boolean
      readOnly: true
```

И добавить query-параметр фильтрации:

```
GET /api/v1/sellable-items/?type=service&isActive=true&isDeleted=false
```

**Вариант C:** При удалении сервиса (`DELETE /api/v1/services/{id}/`) автоматически
выставлять `isActive=false` на связанном `sellable_item`.

### Что можно будет убрать на фронте после фикса

- Хук `useValidServiceIds` (`src/hooks/useValidServiceIds.ts`)
- Запрос к `/api/v1/services/?isActive=true` при каждом открытии формы
- Параметр `validServiceIds` из функции `isValidSellableService`

---

## 2. Пагинация в sellable-items [ПРИОРИТЕТ: СРЕДНИЙ]

### Проблема

Запросы к `sellable-items` используют `pageSize=200`. Если услуг станет больше —
часть не попадёт в список.

### Что нужно

Подтвердить: есть ли реальный лимит на количество услуг в системе?
Если нет — фронтенд перейдёт на постраничную загрузку через `fetchAllPages`.

---

## 3. Связь service.id и sellable_item.id [ПРИОРИТЕТ: НИЗКИЙ]

### Проблема

В ответе `GET /api/v1/services/` нет поля `sellableItem` / `sellable_item_id`,
хотя в коде есть попытки его прочитать (`s.sellableItem ?? s.sellable_item`).

Схема `Service` (OpenAPI) не документирует это поле.

### Что нужно

Подтвердить или опровергнуть: возвращает ли `GET /api/v1/services/{id}/`
поле `sellableItem` (ID связанного sellable-item)?

Если да — добавить в схему OpenAPI.
Если нет — фронтенд уберёт попытки его читать.

---

## 4. Абонементские услуги и автоматическое покрытие приёмов [ПРИОРИТЕТ: ВЫСОКИЙ]

### Бизнес-требование

Нужен тип услуги "абонементская услуга":

- в начале месяца клиент платит полную месячную стоимость;
- если абонемент покупают не с первого числа, цена уменьшается пропорционально
  количеству оставшихся дней до конца месяца;
- если у клиента есть активный абонемент на услугу, приём по этой услуге должен
  автоматически закрываться оплатой абонементом.

### Почему это должно быть на бэкенде

Фронтенд не может безопасно сам решать, покрыт ли приём абонементом:

- несколько регистраторов могут одновременно создать/оплатить приёмы;
- нужно атомарно проверить активный абонемент и привязать его к приёму;
- статус оплаты, долг, отчёты, касса и история клиента должны сходиться на сервере;
- нельзя создавать "оплачено" только в UI без серверного источника правды.

### Расчёт цены абонемента

Предпочтительная формула для месячного абонемента:

```ts
daysInMonth = количество дней в месяце покупки
remainingDaysInclusive = daysInMonth - dayOfMonth(purchaseDate) + 1
priceToPay = round(monthlyPrice * remainingDaysInclusive / daysInMonth)
```

Пример для месяца на 30 дней и полной цены 9000 сом:

- покупка 1 числа: `9000 * 30 / 30 = 9000`;
- покупка 15 числа: `9000 * 16 / 30 = 4800`;
- покупка 30 числа: `9000 * 1 / 30 = 300`.

Важно: расчёт должен учитывать таймзону клиники (`Asia/Bishkek`) и календарный
месяц покупки.

### Поля услуги

Добавить в `Service` / `SellableItem` признаки абонемента:

```yaml
isSubscription:
  type: boolean
  default: false
subscriptionPeriod:
  type: string
  enum: [calendar_month]
subscriptionAutoPayAppointments:
  type: boolean
  default: true
```

Для текущего требования достаточно `calendar_month`. Лимит количества посещений
не указан, поэтому по умолчанию считаем абонемент безлимитным в рамках месяца.
Если нужен лимит, лучше сразу добавить `subscriptionVisitLimit`.

### Клиентский абонемент

Нужна сущность клиентского абонемента, например `ClientSubscription`:

```yaml
id: uuid
patient: uuid
service: uuid # sellable_item_id услуги
periodStart: date
periodEnd: date
monthlyPrice: decimal
paidAmount: decimal
status:
  type: string
  enum: [active, expired, cancelled]
createdFromPaymentId:
  type: uuid
  nullable: true
createdAt: datetime
updatedAt: datetime
```

### Эндпоинты

Минимально нужны:

```http
GET /api/v1/client-subscriptions/?patient={id}&status=active
POST /api/v1/client-subscriptions/
GET /api/v1/client-subscriptions/quote/?service={sellable_item_id}&date=YYYY-MM-DD
```

`quote` должен вернуть рассчитанную стоимость покупки:

```json
{
  "service": "uuid",
  "date": "2026-05-15",
  "periodStart": "2026-05-15",
  "periodEnd": "2026-05-31",
  "monthlyPrice": "9000.00",
  "paidAmount": "4800.00",
  "daysInMonth": 31,
  "remainingDaysInclusive": 17
}
```

### Автоматическая оплата приёма

При создании или обновлении приёма сервер должен:

1. проверить, есть ли у клиента активный абонемент на каждую услугу приёма;
2. если услуга покрыта абонементом, выставить по этой услуге стоимость к оплате `0`;
3. записать связь приёма с абонементом, чтобы было видно, чем покрыт приём;
4. вернуть в ответе приёма поля покрытия.

Рекомендуемые поля в ответе приёма / services:

```yaml
subscriptionCoverage:
  type: object
  nullable: true
  properties:
    subscriptionId:
      type: string
      format: uuid
    coveredAmount:
      type: string
      format: decimal
    label:
      type: string
      example: "Покрыто абонементом до 31.05.2026"
```

Для агрегированного списка приёмов желательно вернуть:

```yaml
paidBySubscription:
  type: number
subscriptionCoverageLabel:
  type: string
  nullable: true
```

### Влияние на кассу и отчёты

Покупка абонемента должна попадать в кассу как обычная продажа на сумму
`paidAmount`.

Приёмы, покрытые абонементом, не должны повторно увеличивать выручку наличными /
безналом. В отчётах их лучше показывать отдельной колонкой:

- оплачено наличными;
- оплачено безналом;
- оплачено со счёта/баллами;
- покрыто абонементом.

### Что будет сделать на фронте после бэкенда

- добавить переключатель "Абонементская услуга" в форму услуги;
- показывать рассчитанную цену абонемента при продаже клиенту;
- показывать активные абонементы в карточке клиента;
- в карточке приёма показывать бейдж "Покрыто абонементом";
- при оплате скрывать/блокировать ручной платёж за уже покрытую часть.

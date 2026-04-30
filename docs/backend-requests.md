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

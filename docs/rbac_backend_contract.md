# Задачи для бэкенда — открытые вопросы

> Всё что ниже **не работает** и ждёт исправления на бэкенде.
> Фронт готов и ждёт.

Base URL: `https://academy.operator.kg/api/v1`

---

## 1. GET /appointments/?specialist= — не фильтрует по performer

❌ **Не реализовано.**

### Зачем
Страница "Кабинет специалиста" показывает тренеру только его приёмы.
Фронт отправляет `?specialist=<employeeId>` для фильтрации.

### Почему не работает
Бэкенд возвращает пустой список, хотя приёмы с этим специалистом существуют.

**Проверено:**
- Приём содержит `services[0].performer.id = 20c9fe7a-3972-4906-a93f-b77ec96ece20` (Тренер авто тест)
- `GET /appointments/?specialist=20c9fe7a-...` → `0 результатов`
- `GET /appointments/?employee=20c9fe7a-...` → `0 результатов`

### Причина
`AppointmentFilterSet` фильтрует `specialist` не по `services[].performer`, а по прямому FK на модели приёма, который `null` для приёмов где специалист задан только через `services[].performer`.

### Нужно
```python
# AppointmentFilterSet
specialist = UUIDFilter(field_name="services__performer", lookup_expr="exact")
```
Приёмы где указанный сотрудник — исполнитель хотя бы одной услуги.

---

## 2. GET /clients/ — specialist видит пустой список

❌ **Не реализовано.**

### Зачем
Страница "Поиск клиентов" должна показывать всех клиентов для специалиста с правом `clients.read`.

### Почему не работает
Для роли `specialist` `GET /clients/` возвращает пустой список — бэкенд фильтрует клиентов по привязке к специалисту через приёмы.

### Нужно
Если у пользователя есть право `clients.read` — возвращать всех клиентов без фильтрации по роли.

---

## 3. GET /cashbox/summary/ — не учитывает отменённые с оплатой

❌ **Не реализовано.**

### Зачем
Если приём отменён но деньги уже приняты — они должны отражаться в кассе.

### Нужно
Включать в сводку все приёмы где:
```
paidCash + paidCard + paidBalance + paidBonuses > 0
```
Независимо от `status`.

---

## 4. Расходы не привязаны к филиалу

❌ **Не реализовано.**

### Зачем
Страница расходов и касса должны показывать данные только по выбранному филиалу.

### Почему не работает
Модель `Expense` не имеет поля `branch`. При создании расход не привязывается к филиалу. `GET /api/v1/expenses/` не принимает `?branch=` для фильтрации.

### Нужно
1. Добавить FK `branch` в модель `Expense`
2. При создании автоматически проставлять `branch` из контекста пользователя
3. Добавить фильтрацию `?branch=<uuid>` в `GET /api/v1/expenses/`
4. Добавить `branch` в `ExpenseRead` и `ExpenseCreateRequest` схемы

---

## 5. GET /cashbox/summary/ — `net` не вычитает расходы

❌ **Не реализовано.**

### Зачем
Страница "Касса" показывает чистый остаток: доходы минус расходы.

### Почему не работает
`net.cashSum` и `net.cardSum` содержат только сумму приёмов, расходы не вычитаются.

### Временное решение (фронт)
Фронт считает самостоятельно: `appointments.cashSum - expenses.cashSum` и `appointments.cardSum - expenses.cashlessSum`.

### Нужно
```
net.cashSum = appointments.cashSum - expenses.cashSum
net.cardSum = appointments.cardSum - expenses.cashlessSum
net.totalSum = net.cashSum + net.cardSum
```

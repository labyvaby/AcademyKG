# Расчётный лист специалиста за период (PDF)

[ПРИОРИТЕТ: СРЕДНИЙ]

## Контекст

На странице «Отчёт по ЗП» (`/salary-reports`) у каждой строки сотрудника
есть кнопка генерации PDF расчётного листа. PDF собирается на фронте по
ответу этого эндпоинта. Файлы фронта:

- `src/pages/salary-reports/components/SpecialistPayslipDialog.tsx`
- `src/utility/specialistPayslipPdf.ts`
- `src/utility/specialistPayslipMock.ts` (dev-only кнопка «Тест (mock)»)

В PDF: каждая страница = одна ISO-неделя выбранного периода, в неделе
показываются только рабочие дни Пн–Пт (Сб/Вс — выходные). В каждом дне
фиксированная сетка слотов 08:00–18:00 (11 строк). На последней странице
в 6-й ячейке — сводка.

## Эндпоинт

```
GET /api/v1/reports/specialist-payslip/
```

## Query-параметры

| Параметр       | Тип    | Обязательный | Описание                                                                                              |
|----------------|--------|--------------|-------------------------------------------------------------------------------------------------------|
| `employee`     | UUID   | да           | ID сотрудника                                                                                         |
| `month`        | string | да           | Календарный месяц, `YYYY-MM`. По нему всегда считается `summary`.                                     |
| `periodHalf`   | enum   | нет          | `first` (1–15) / `second` (16–конец). Если пусто — детализация за весь месяц.                         |
| `branch`       | UUID   | нет          | Фильтр по филиалу. Если опущен — все филиалы (как в `payroll-monthly`).                               |
| `organization` | UUID   | нет          | Если применимо в проекте.                                                                             |

## Права доступа

Те же, что у `/payroll-monthly/`: `reports.read` (через `R.reports`).
Если пользователь видит страницу `/salary-reports`, у него уже есть это право.
Дополнительный permission под payslip не вводим.

## Response shape

`200 OK` — `Envelope<SpecialistPayslipResponse>`:

```ts
{
  data: {
    employee: {
      id: string;          // UUID сотрудника
      fullName: string;
      roleName: string;
    },
    period: {
      month: string;             // "YYYY-MM" — месяц, по которому считается summary
      dateFrom: string;          // YYYY-MM-DD — начало детализации
      dateTo: string;            // YYYY-MM-DD — конец детализации
      label: string;             // "с 01.05 - 15.05.2026" — готовая русская подпись
      summaryScope: "month";     // ВСЕГДА "month"
      detailScope: "month" | "first" | "second";
    },
    summary: {                   // ВСЕГДА за календарный месяц (period.month)
      grossEarnings: string;     // decimal-строка
      netSalary: string;
      percentSum: string;
      fixedSum: string;
      advancesSum: string;
      payoutsSum: string;
      deductionsSum: string;
      expensesSum: string;
      dayHours: string;
      nightHours: string;
      paidAppointmentsCount: number;
    },
    days: [
      {
        date: string;            // YYYY-MM-DD
        weekdayLabel: string;    // "Пятница" / "Понедельник" — на русском
        slots: [                 // ВСЕГДА 11 элементов, 08:00..18:00 шаг 1ч
          {
            time: string;             // "08:00"
            patientName: string | null;
            lessonType: "individual" | "pair" | null;
            // null            — слот пустой
            // "individual"    — индивидуальное занятие
            // "pair"          — парное занятие
            sum: string;              // decimal-строка, "Поступила"
            earned: string;           // decimal-строка, доля специалиста
          }
        ],
        totals: {
          count: number;          // кол-во НЕпустых слотов за день
          sumTotal: string;       // сумма slot.sum по непустым слотам
          sumEarned: string;      // сумма slot.earned по непустым слотам
        }
      }
    ]
  },
  meta: { ... }
}
```

> Поле `appointments[]` (плоская детализация) фронту **не нужно** —
> PDF собирается только из `days[].slots[]`. Не отдавать.

## Бизнес-правила

### 1. Сетка слотов

`days[]` содержит **все** дни выбранного периода (`dateFrom..dateTo`),
включая дни без приёмов и выходные. Для каждого дня — ровно 11 слотов
`08:00, 09:00, ..., 18:00`. Если в слот не назначен приём:

```json
{ "time": "09:00", "patientName": null, "lessonType": null, "sum": "0.00", "earned": "0.00" }
```

### 2. Привязка приёмов к слотам

Приём попадает в слот по часу его начала (`appointmentAt.hour()`):
- `09:30` → слот `09:00`;
- `07:00`, `19:00`, `20:00` → **не попадают в `days[].slots[]`** (вне сетки 08–18).

Приёмы вне сетки в детализации не показываются, но **участвуют в месячном
`summary`** (так что `sum(days[].slots[].earned)` может быть меньше
`summary.percentSum` — фронт это не сверяет, см. пункт 6).

### 3. `lessonType`

- `individual` — `sellableItem.maxParticipants <= 1` и `appointment.group == null`;
- `pair` — `appointment.group != null` (участник `AppointmentGroup`);
- `window` — **не возвращается**. Колонка «окно» из PDF убрана.

### 4. `sum` («Поступила»)

Фактически поступившая сумма от клиента за приём:

```
sum = paid_cash + paid_card + paid_balance + paid_bonuses
```

**Бонусы входят** в `sum`. Неоплаченный приём → `sum = "0.00"`.

### 5. `earned` (доля специалиста за слот)

Через ту же payroll-формулу, что используется в `/payroll-monthly`:

```
paymentFactor = (paid_cash + paid_card + paid_balance) / total_cost    # БЕЗ paid_bonuses
earned        = service_price * paymentFactor * percent
```

где `percent` — действующая ставка специалиста для этой услуги на дату приёма.

Важно:
- **`paid_bonuses` в `earned` не входит**, хотя в `sum` входит.
  Это сознательное расхождение — соответствует поведению `PayrollRow.percentSum`.
- Неоплаченный приём → `earned = "0.00"`.
- Если у специалиста несколько услуг в одном слоте — суммировать `earned`
  по всем услугам этого слота.
- Оклад / фикс (`PayrollRow.fixedSum`) в `slot.earned` **не входит** —
  это начисление за период, не за слот.

### 6. `summary` — только за месяц

`summary` **всегда** за календарный месяц (`period.month`), независимо от
`periodHalf`. Поля повторяют `PayrollRow` за тот же месяц:

```
summary.grossEarnings  == PayrollRow.grossEarnings
summary.netSalary      == PayrollRow.netSalary
summary.percentSum     == PayrollRow.percentSum
summary.fixedSum       == PayrollRow.fixedSum
...
```

Фронт **не сверяет** `sum(days[].slots[].earned)` с `summary.percentSum` —
их расхождение допустимо (приёмы вне сетки 08–18, см. п. 2).

В PDF за полумесяц месячный `summary` **не рисуется** — вместо него фронт
сам считает локальные итоги по таблице (`sum(days[].totals.sumTotal)`,
`sum(days[].totals.sumEarned)`). Месячный `summary` рисуется только если
`detailScope === "month"`.

Поля `socialFundSum`, `netToPay_half` и т.п. на этом этапе **не нужны** —
бухгалтерия пока не зафиксировала формулу. Когда зафиксируют, добавим
отдельные поля и фронт нарисует строки.

### 7. Сортировка

`days[]` — по `date` ASC. `slots[]` — по `time` ASC.

### 8. Таймзона

`date` / `time` — в TZ Asia/Bishkek (как `dayjsBishkek` в проекте), без UTC.

## Edge cases

- `employee` не существует или удалён → `404`.
- У специалиста нет ни одного приёма за месяц → валидный ответ, все слоты
  пустые, `summary` с нулями (кроме `fixedSum`, если оклад есть).
- `month` некорректный (`2026-13`, `abc-de`) → `400 Bad Request`.
- `periodHalf` не из `{first, second}` → `400 Bad Request`.

## Кэш / производительность

Эндпоинт вызывается по клику на кнопку (не на загрузке страницы), кэш не
требуется. Приемлемо до ~1.5 сек на запрос.

## Пример ответа (сокращённый, полумесяц 1–15.05.2026)

```json
{
  "data": {
    "employee": { "id": "8e2b...", "fullName": "Арзыбек Керимкулович", "roleName": "Специалист" },
    "period": {
      "month": "2026-05",
      "dateFrom": "2026-05-01",
      "dateTo": "2026-05-15",
      "label": "с 01.05 - 15.05.2026",
      "summaryScope": "month",
      "detailScope": "first"
    },
    "summary": {
      "grossEarnings": "32000.00",
      "netSalary": "24500.00",
      "percentSum": "32000.00",
      "fixedSum": "0.00",
      "advancesSum": "5000.00",
      "payoutsSum": "0.00",
      "deductionsSum": "2500.00",
      "expensesSum": "0.00",
      "dayHours": "120.00",
      "nightHours": "0.00",
      "paidAppointmentsCount": 64
    },
    "days": [
      {
        "date": "2026-05-01",
        "weekdayLabel": "Пятница",
        "slots": [
          { "time": "08:00", "patientName": null,      "lessonType": null,         "sum": "0.00",    "earned": "0.00"   },
          { "time": "09:00", "patientName": "Ибрагим", "lessonType": "individual", "sum": "1000.00", "earned": "500.00" },
          { "time": "10:00", "patientName": "Сейид",   "lessonType": "pair",       "sum": "1000.00", "earned": "500.00" }
          /* ... ещё 8 слотов до 18:00 ... */
        ],
        "totals": { "count": 2, "sumTotal": "2000.00", "sumEarned": "1000.00" }
      }
      /* ... остальные дни периода ... */
    ]
  },
  "meta": {}
}
```

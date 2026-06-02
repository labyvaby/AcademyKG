# СКУД — Спецификация бэкенда

## Общее описание

СКУД (Система контроля и управления доступом) — модуль учёта рабочего времени сотрудников.
Позволяет фиксировать приход/уход, настраивать разрешённые сети (IP/SSID) для отметки по каждому филиалу.

---

## Права доступа (Permissions)

| Permission              | Кто имеет                              | Что разрешает                                      |
|-------------------------|----------------------------------------|----------------------------------------------------|
| `work_shifts.read`      | **Все** аутентифицированные пользователи | Чтение своих смен (обычный) / всех смен (manager+) |
| `work_shifts.create`    | `manager`, `superadmin`                | Создание смены за любого сотрудника                |
| `work_shifts.update`    | `manager`, `superadmin`               | Редактирование любой смены (время, clock_in/out)   |
| `work_shifts.delete`    | `manager`, `superadmin`               | Удаление смены                                     |
| `skud_settings.read`    | `manager`, `superadmin`               | Просмотр настроек сети по филиалам                 |
| `skud_settings.create`  | `manager`, `superadmin`               | Создание настроек сети для филиала                 |
| `skud_settings.update`  | `manager`, `superadmin`               | Изменение настроек сети                            |
| `skud_settings.delete`  | `manager`, `superadmin`               | Удаление настроек сети                             |

### Логика фильтрации смен на бэкенде

```
GET /api/v1/work-shifts/?date=...
```

- Если у пользователя только `work_shifts.read` (нет create/update/delete):
  → возвращать **только свои смены** (`employee = request.user.employee`)
- Если у пользователя `work_shifts.create` или `work_shifts.update` (manager/superadmin):
  → возвращать **все смены** (с возможностью фильтра `?employee=<id>`)

---

## Эндпоинты: Рабочие смены

### GET /api/v1/work-shifts/

Параметры запроса:

| Параметр    | Тип    | Описание                                  |
|-------------|--------|-------------------------------------------|
| `date`      | string | Фильтр по дате смены (YYYY-MM-DD)         |
| `employee`  | string | Фильтр по ID сотрудника (только manager+) |
| `pageSize`  | int    | Количество записей (по умолчанию 20)      |

Пример ответа:
```json
{
  "results": [
    {
      "id": "1",
      "employee": { "id": "42", "full_name": "Иванов Иван" },
      "shift_date": "2026-04-09",
      "start_time": "09:00",
      "end_time": "18:00",
      "is_night_shift": false,
      "clock_in": "2026-04-09T09:03:12Z",
      "clock_out": null
    }
  ],
  "count": 1
}
```

---

### POST /api/v1/work-shifts/

**Требуется:** `work_shifts.create`

Тело запроса:
```json
{
  "employee": "42",
  "shift_date": "2026-04-09",
  "start_time": "09:00",
  "end_time": "18:00",
  "is_night_shift": false
}
```

**Специальный случай — самоотметка (clock-in при создании):**

Если сотрудник сам себе создаёт смену через кнопку «Отметиться», то вместе с созданием записи
нужно принять дополнительное поле:
```json
{
  "employee": "42",
  "shift_date": "2026-04-09",
  "start_time": "09:03",
  "end_time": "17:03",
  "clock_in": "2026-04-09T09:03:12Z"
}
```
→ Проверить разрешение сети (см. раздел "Проверка IP на бэкенде").

---

### PATCH /api/v1/work-shifts/{id}/

**Требуется:** `work_shifts.update`

Допустимые поля:
```json
{
  "clock_in":   "2026-04-09T09:03:12Z",   // отметка прихода
  "clock_out":  "2026-04-09T18:01:44Z",   // отметка ухода
  "start_time": "09:00",
  "end_time":   "18:00",
  "shift_date": "2026-04-09"
}
```

**Автоматическое закрытие (12 часов):**

Если при очередном обновлении (cron или celery beat) `clock_in` установлен,
а `clock_out` равен null и разница `now - clock_in >= 12 часов`:
→ установить `clock_out = clock_in + 12h`

---

### DELETE /api/v1/work-shifts/{id}/

**Требуется:** `work_shifts.delete`

Ответ: `204 No Content`

---

## Эндпоинты: Настройки СКУД (сетевые ограничения)

### GET /api/v1/skud-settings/

**Требуется:** `skud_settings.read`

Параметры: `?branch=<id>`

Пример ответа:
```json
{
  "results": [
    {
      "id": "1",
      "branch": "10",
      "branch_name": "Главный офис",
      "allowed_ip": "192.168.1.0/24",
      "allowed_ssid": "Office_WiFi",
      "enabled": true,
      "created_by": { "id": "1", "full_name": "Администратор" },
      "updated_by": { "id": "1", "full_name": "Администратор" },
      "created_at": "2026-04-01T10:00:00Z",
      "updated_at": "2026-04-09T09:00:00Z"
    }
  ]
}
```

---

### POST /api/v1/skud-settings/

**Требуется:** `skud_settings.create`

```json
{
  "branch": "10",
  "allowed_ip": "192.168.1.0/24",
  "allowed_ssid": "Office_WiFi",
  "enabled": true
}
```

Ограничение: **один объект на филиал** (unique_together: branch).
При попытке создать второй — вернуть `400 Bad Request`.

---

### PATCH /api/v1/skud-settings/{id}/

**Требуется:** `skud_settings.update`

```json
{
  "allowed_ip": "10.0.0.0/8",
  "enabled": false
}
```

---

### DELETE /api/v1/skud-settings/{id}/

**Требуется:** `skud_settings.delete`

Ответ: `204 No Content`

---

## Проверка IP на бэкенде (рекомендация)

При отметке (`POST /api/v1/work-shifts/` с `clock_in` или `PATCH` с `clock_in`):

1. Получить `request.META.get("HTTP_X_FORWARDED_FOR") или REMOTE_ADDR` → `client_ip`
2. Найти настройку `SkudSetting` для текущего филиала сотрудника
3. Если `setting.enabled = True`:
   - Если `client_ip` не входит в `setting.allowed_ip` → вернуть `403 Forbidden`:
     ```json
     { "detail": "Отметка запрещена с вашего IP-адреса. Подключитесь к рабочей сети." }
     ```
4. Если `setting.enabled = False` или настройки нет → пропустить проверку

```python
# Пример реализации Django
import ipaddress

def check_ip_allowed(client_ip: str, allowed_pattern: str) -> bool:
    if not allowed_pattern:
        return True
    try:
        network = ipaddress.ip_network(allowed_pattern, strict=False)
        return ipaddress.ip_address(client_ip) in network
    except ValueError:
        # Точное совпадение
        return client_ip == allowed_pattern
```

---

## Django модели (пример)

```python
class WorkShift(models.Model):
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='work_shifts')
    shift_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_night_shift = models.BooleanField(default=False)
    clock_in = models.DateTimeField(null=True, blank=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey('Employee', null=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey('Employee', null=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-shift_date', 'start_time']


class SkudSetting(models.Model):
    branch = models.OneToOneField('Branch', on_delete=models.CASCADE, related_name='skud_setting')
    allowed_ip = models.CharField(max_length=50, blank=True, help_text="IP или CIDR, напр. 192.168.1.0/24")
    allowed_ssid = models.CharField(max_length=100, blank=True, help_text="Название Wi-Fi сети")
    enabled = models.BooleanField(default=False, help_text="Включить проверку сети")
    created_by = models.ForeignKey('Employee', null=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey('Employee', null=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

---

## Требования к фронтенду (уже реализовано)

- Фронт получает публичный IP через `https://api.ipify.org?format=json`
- Сравнивает с `allowed_ip` из `SkudSetting` для текущего филиала
- Если не совпадает и `enabled=true` — блокирует кнопку «Отметиться»
- Показывает подсказку с текущим IP и причиной блокировки
- Двойная защита: бэкенд также проверяет IP (см. выше)

---

## Celery задача для авто-закрытия смен

```python
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

@shared_task
def auto_close_shifts():
    """Закрывает смены, которые длятся > 12 часов."""
    threshold = timezone.now() - timedelta(hours=12)
    shifts = WorkShift.objects.filter(clock_in__lte=threshold, clock_out__isnull=True)
    for shift in shifts:
        shift.clock_out = shift.clock_in + timedelta(hours=12)
        shift.save(update_fields=['clock_out'])
```

Запускать каждые 5 минут через `celery beat`.

# Статус задач бэкенда

Base URL: `https://academy.operator.kg/api/v1`

| # | Задача | Статус |
|---|---|---|
| 1 | `AppointmentList` — добавить `services[]` | ✅ Готово |
| 2 | `pageSize` параметр пагинации | ✅ Готово |
| 3 | `/appointment-groups/` — `dateFrom`/`dateTo` | ✅ Готово |
| 4 | `excludeGroupParticipants` camelCase | ✅ Готово |
| 5 | `/cashbox/summary/` — отменённые с оплатой | ❌ Не сделано |
| 6 | `/permissions/` — формат ответа | ✅ Готово |
| 7 | `children.*` → `clients.*` | ✅ Готово |
| 8 | `isSuperuser` обходит permission checks | ✅ Готово |
| 9 | `GET /roles/{id}/` + `PATCH /roles/{id}/` | ✅ Готово |
| 10 | `GET /permissions/` доступен superadmin/manager | ✅ Готово |
| 11 | `GET /appointments/?specialist=` фильтр по performer | ❌ Не сделано |
| 12 | `GET /clients/` — не фильтровать по роли specialist | ❌ Не сделано |

Открытые задачи подробно описаны в [rbac_backend_contract.md](rbac_backend_contract.md).

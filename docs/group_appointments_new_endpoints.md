# Групповые приёмы — статус эндпоинтов

| Эндпоинт | Статус |
|---|---|
| `GET /appointment-groups/` | ✅ Готово |
| `POST /appointment-groups/` | ✅ Готово |
| `PATCH /appointment-groups/{id}/` | ✅ Готово |
| `DELETE /appointment-groups/{id}/` | ✅ Готово |
| `POST /appointment-groups/{id}/add-participant/` | ✅ Готово |
| `POST /appointment-groups/{id}/trainer-not-came/` | ⚠️ Нужно изменить поведение (см. ниже) |

---

## trainer-not-came — нужно изменить поведение

**Текущее (неверное):** ставит `not_came` всем участникам кроме `paid` и `cancelled`.

**Нужное:** статусы клиентов **не трогать**. Только фиксировать факт отсутствия тренера.

### Изменения на бэкенде

1. Добавить поле `trainerNotCame` (boolean) в модель `AppointmentGroup`
2. При вызове — только выставить `trainerNotCame = true`, статусы участников не менять
3. Вернуть обновлённый объект с полем `trainerNotCame: true`

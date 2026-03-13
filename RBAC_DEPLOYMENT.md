# Инструкция по развертыванию RBAC системы

## ✅ Чеклист развертывания

Используйте этот чеклист для безопасного развертывания RBAC в production.

### Подготовка (Dev/Staging)

- [ ] Создан бэкап базы данных Supabase
- [ ] Проверены все SQL миграции на синтаксис
- [ ] TypeScript код компилируется без ошибок
- [ ] Протестированы все роли и разрешения

### Применение миграций

- [ ] **Шаг 1:** Применена миграция `20251210_rbac_setup.sql`
  ```sql
  -- Проверка: таблицы созданы
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('roles', 'permissions', 'role_permissions');
  ```

- [ ] **Шаг 2:** Применена миграция `20251210_rls_policies.sql`
  ```sql
  -- Проверка: RLS включен
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('Employes', 'Patients', 'Appointments', 'expenses');
  ```

- [ ] **Шаг 3:** Все сотрудники имеют назначенные роли
  ```sql
  -- Проверка: нет сотрудников без роли
  SELECT COUNT(*) FROM "Employes" WHERE role_id IS NULL;
  -- Должно быть 0
  ```

### Проверка безопасности

- [ ] Протестирован доступ для каждой роли:
  - [ ] superadmin - полный доступ
  - [ ] admin - доступ к управлению
  - [ ] doctor - доступ к пациентам и своим назначениям
  - [ ] receptionist - доступ к регистрации
  - [ ] accountant - доступ к расходам

- [ ] RLS политики работают корректно:
  ```sql
  -- Тест: врач видит только свои назначения
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claim.sub = 'doctor-uuid';
  SELECT * FROM "Appointments"; -- Должны быть только назначения этого врача
  ```

- [ ] Функции безопасности работают:
  ```sql
  SELECT is_admin();           -- true для админов
  SELECT is_doctor();          -- true для врачей
  SELECT has_permission('user-uuid', 'patients.create');
  ```

### Интеграция в код

- [ ] Обновлен `App.tsx` с `ProtectedRoute`
- [ ] Обновлен `Sidebar` с условным рендерингом
- [ ] Добавлен маршрут `/access-denied`
- [ ] Протестированы все защищенные страницы

### Тестирование

- [ ] **Тест 1:** Вход под разными ролями
  - [ ] Врач видит только свои разделы
  - [ ] Администратор видит все разделы
  - [ ] Бухгалтер видит только финансы

- [ ] **Тест 2:** Попытка доступа к запрещенным страницам
  - [ ] Врач не может зайти на страницу расходов
  - [ ] Регистратор не может зайти на страницу сотрудников

- [ ] **Тест 3:** Условные элементы интерфейса
  - [ ] Кнопки показываются/скрываются правильно
  - [ ] Формы отображают нужные поля

- [ ] **Тест 4:** API запросы блокируются RLS
  - [ ] Нельзя получить чужие данные через API
  - [ ] Нельзя изменить данные без прав

### Production Deployment

- [ ] Все тесты пройдены успешно
- [ ] Код задеплоен на production
- [ ] Миграции применены на production базе
- [ ] Все пользователи уведомлены об изменениях
- [ ] Мониторинг настроен на ошибки доступа

### Post-Deployment

- [ ] Проверен доступ ключевых пользователей
- [ ] Мониторинг логов на ошибки RLS
- [ ] Обратная связь от пользователей собрана
- [ ] Документация обновлена

---

## 🔧 Скрипты для развертывания

### 1. Проверка готовности к развертыванию

```sql
-- Проверить, что все таблицы созданы
DO $$
DECLARE
    missing_tables TEXT[];
BEGIN
    SELECT ARRAY_AGG(table_name)
    INTO missing_tables
    FROM (
        SELECT unnest(ARRAY['roles', 'permissions', 'role_permissions']) AS table_name
    ) expected
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = expected.table_name
    );

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE 'Отсутствуют таблицы: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'Все таблицы RBAC созданы ✓';
    END IF;
END $$;

-- Проверить, что роли созданы
SELECT
    CASE
        WHEN COUNT(*) = 5 THEN 'Все роли созданы ✓'
        ELSE 'Отсутствуют роли! Найдено: ' || COUNT(*)
    END as status
FROM roles;

-- Проверить, что у всех сотрудников есть роли
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 'У всех сотрудников есть роли ✓'
        ELSE 'Сотрудников без роли: ' || COUNT(*)
    END as status
FROM "Employes"
WHERE role_id IS NULL;
```

### 2. Назначение ролей пакетно

```sql
-- Назначить роль "doctor" всем врачам (по старому полю role)
UPDATE "Employes"
SET role_id = (SELECT id FROM roles WHERE name = 'doctor')
WHERE LOWER(role) = 'doctor' AND role_id IS NULL;

-- Назначить роль "admin" всем администраторам
UPDATE "Employes"
SET role_id = (SELECT id FROM roles WHERE name = 'admin')
WHERE LOWER(role) = 'admin' AND role_id IS NULL;

-- Назначить роль по умолчанию оставшимся
UPDATE "Employes"
SET role_id = (SELECT id FROM roles WHERE name = 'receptionist')
WHERE role_id IS NULL;
```

### 3. Откат изменений (в случае проблем)

```sql
-- ВНИМАНИЕ: Используйте только в крайнем случае!

-- Отключить RLS на всех таблицах
ALTER TABLE "Employes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Patients" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Services" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "shifts" DISABLE ROW LEVEL SECURITY;

-- Удалить RBAC таблицы (ОСТОРОЖНО!)
-- DROP TABLE IF EXISTS role_permissions CASCADE;
-- DROP TABLE IF EXISTS permissions CASCADE;
-- DROP TABLE IF EXISTS roles CASCADE;

-- Удалить колонку role_id из Employes
-- ALTER TABLE "Employes" DROP COLUMN IF EXISTS role_id;
```

---

## 📊 Мониторинг после развертывания

### Запросы для мониторинга

```sql
-- Количество пользователей по ролям
SELECT r.display_name, COUNT(e.id) as count
FROM roles r
LEFT JOIN "Employes" e ON e.role_id = r.id
GROUP BY r.display_name
ORDER BY count DESC;

-- Проверка активности по ролям (если есть логи)
SELECT
    r.display_name,
    COUNT(DISTINCT e.id) as active_users
FROM "Employes" e
JOIN roles r ON e.role_id = r.id
WHERE e.last_sign_in_at > NOW() - INTERVAL '7 days'
GROUP BY r.display_name;

-- Самые используемые разрешения (требует логирование)
-- SELECT permission_name, COUNT(*) as usage_count
-- FROM permission_usage_log
-- WHERE created_at > NOW() - INTERVAL '7 days'
-- GROUP BY permission_name
-- ORDER BY usage_count DESC;
```

### Метрики для отслеживания

1. **Количество ошибок доступа** - должно снизиться после адаптации пользователей
2. **Время отклика запросов** - RLS может замедлить запросы
3. **Количество обращений в поддержку** - могут быть вопросы о доступе
4. **Активность пользователей** - убедитесь, что пользователи могут работать

---

## 🚨 Частые проблемы и решения

### Проблема 1: "Permission denied for table"

**Причина:** RLS блокирует запрос

**Решение:**
```sql
-- Проверить политики для таблицы
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Временно отключить RLS для отладки
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

### Проблема 2: Пользователь не видит свои данные

**Причина:** У пользователя нет роли или разрешений

**Решение:**
```sql
-- Проверить роль
SELECT e.full_name, r.name
FROM "Employes" e
LEFT JOIN roles r ON e.role_id = r.id
WHERE e.id = 'user-uuid';

-- Назначить роль
UPDATE "Employes"
SET role_id = (SELECT id FROM roles WHERE name = 'doctor')
WHERE id = 'user-uuid';
```

### Проблема 3: Медленные запросы после RLS

**Причина:** RLS добавляет дополнительные проверки

**Решение:**
```sql
-- Добавить индексы
CREATE INDEX IF NOT EXISTS idx_employes_role_id ON "Employes"(role_id);
CREATE INDEX IF NOT EXISTS idx_appointments_employee ON "Appointments"(employee_id);

-- Проанализировать производительность
EXPLAIN ANALYZE
SELECT * FROM "Appointments" WHERE employee_id = 'doctor-uuid';
```

### Проблема 4: Функция auth.user_id() возвращает NULL

**Причина:** Контекст JWT не установлен

**Решение:**
```sql
-- Убедитесь, что используется правильный JWT
-- Проверьте настройки Supabase Auth

-- Для тестирования вручную:
SET LOCAL request.jwt.claim.sub = 'user-uuid';
```

---

## 📝 Документация для команды

После развертывания предоставьте команде:

1. **[RBAC_QUICKSTART.md](./RBAC_QUICKSTART.md)** - быстрый старт для разработчиков
2. **[RBAC_SETUP.md](./RBAC_SETUP.md)** - полная документация
3. **[RBAC_INTEGRATION_EXAMPLE.tsx](./RBAC_INTEGRATION_EXAMPLE.tsx)** - примеры кода

---

## ✉️ Шаблон уведомления пользователей

```
Уважаемые коллеги!

С [ДАТА] в системе Academy KG внедрена новая система контроля доступа (RBAC).

Что изменилось:
- Теперь каждый пользователь имеет определенную роль (Врач, Администратор и т.д.)
- Доступ к разделам системы зависит от вашей роли
- Это повышает безопасность данных пациентов

Что нужно сделать:
1. Войдите в систему как обычно
2. Проверьте, что у вас есть доступ к нужным разделам
3. Если чего-то не хватает - обратитесь к администратору

Ваша роль: [РОЛЬ]
Доступные разделы: [СПИСОК]

По вопросам обращайтесь к [КОНТАКТ]

С уважением,
Команда разработки
```

---

## 🎯 Критерии успешного развертывания

- ✅ Все пользователи могут войти в систему
- ✅ Каждый пользователь видит свои разделы
- ✅ Нет ошибок в консоли браузера
- ✅ Нет ошибок в логах Supabase
- ✅ Время отклика приемлемое
- ✅ Пользователи довольны новой системой

---

**Важно:** Всегда имейте план отката на случай критических проблем!

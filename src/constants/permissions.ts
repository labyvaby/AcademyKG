/**
 * Все permission-строки системы — точно соответствуют значениям бэкенда.
 * Единственное место где живут строковые значения.
 * В UI используйте ТОЛЬКО эти константы — никаких строк напрямую.
 *
 * PERMISSIONS поддерживает два стиля:
 *  - PERMISSIONS.APPOINTMENTS.CREATE  — nested (рекомендуемый новый стиль)
 *  - PERMISSIONS.APPOINTMENTS_CREATE  — flat (backward-compat, сохранён)
 *  - P.APPOINTMENTS_CREATE            — дублирует flat (для явного импорта P)
 */

// ---------------------------------------------------------------------------
// Nested group definitions (internal — используются только для сборки PERMISSIONS)
// ---------------------------------------------------------------------------

const _APPOINTMENTS = {
  CREATE: 'appointments.create',
  READ:   'appointments.read',
  UPDATE: 'appointments.update',
  DELETE: 'appointments.delete',
} as const;

const _APPOINTMENT_GROUPS = {
  CREATE: 'appointment_groups.create',
  READ:   'appointment_groups.read',
  UPDATE: 'appointment_groups.update',
  DELETE: 'appointment_groups.delete',
} as const;

const _APP_SETTINGS = {
  CREATE: 'app_settings.create',
  READ:   'app_settings.read',
  UPDATE: 'app_settings.update',
  DELETE: 'app_settings.delete',
} as const;

const _BALANCE_TRANSACTIONS = {
  CREATE: 'balance_transactions.create',
  READ:   'balance_transactions.read',
  UPDATE: 'balance_transactions.update',
  DELETE: 'balance_transactions.delete',
} as const;

const _BRANCHES = {
  CREATE: 'branches.create',
  READ:   'branches.read',
  UPDATE: 'branches.update',
  DELETE: 'branches.delete',
} as const;

const _CASHBOX = {
  CREATE: 'cashbox.create',
  READ:   'cashbox.read',
  UPDATE: 'cashbox.update',
  DELETE: 'cashbox.delete',
} as const;

const _CLIENT_DOCUMENTS = {
  CREATE: 'client_documents.create',
  READ:   'client_documents.read',
  UPDATE: 'client_documents.update',
  DELETE: 'client_documents.delete',
} as const;

const _CLIENT_SCHEDULES = {
  CREATE: 'client_schedules.create',
  READ:   'client_schedules.read',
  UPDATE: 'client_schedules.update',
  DELETE: 'client_schedules.delete',
} as const;

/** Клиенты (backend slug: "children" → алиас в validatePermissions) */
const _CLIENTS = {
  CREATE: 'clients.create',
  READ:   'clients.read',
  UPDATE: 'clients.update',
  DELETE: 'clients.delete',
} as const;

const _EMPLOYEE_DOCUMENTS = {
  CREATE: 'employee_documents.create',
  READ:   'employee_documents.read',
  UPDATE: 'employee_documents.update',
  DELETE: 'employee_documents.delete',
} as const;

const _EMPLOYEE_SCHEDULES = {
  CREATE: 'employee_schedules.create',
  READ:   'employee_schedules.read',
  UPDATE: 'employee_schedules.update',
  DELETE: 'employee_schedules.delete',
} as const;

const _EMPLOYEES = {
  CREATE:          'employees.create',
  READ:            'employees.read',
  UPDATE:          'employees.update',
  DELETE:          'employees.delete',
  /** Право менять sensitive-поля сотрудника (role/branch/status/organization/authUser). */
  MANAGE_SENSITIVE: 'employees.manage_sensitive',
} as const;

const _EXPENSE_CATEGORIES = {
  CREATE: 'expense_categories.create',
  READ:   'expense_categories.read',
  UPDATE: 'expense_categories.update',
  DELETE: 'expense_categories.delete',
} as const;

const _EXPENSES = {
  CREATE: 'expenses.create',
  READ:   'expenses.read',
  UPDATE: 'expenses.update',
  DELETE: 'expenses.delete',
} as const;

const _ORGANIZATIONS = {
  CREATE: 'organizations.create',
  READ:   'organizations.read',
  UPDATE: 'organizations.update',
  DELETE: 'organizations.delete',
} as const;

const _PAYMENTS = {
  CREATE: 'cashbox.create',
  READ:   'cashbox.read',
  UPDATE: 'cashbox.update',
  DELETE: 'cashbox.delete',
} as const;

const _PRODUCTS = {
  CREATE: 'products.create',
  READ:   'products.read',
  UPDATE: 'products.update',
  DELETE: 'products.delete',
} as const;

const _RECEPTION = {
  CREATE: 'reception.create',
  READ:   'reception.read',
  UPDATE: 'reception.update',
  DELETE: 'reception.delete',
} as const;

const _REPORTS = {
  CREATE: 'reports.create',
  READ:   'reports.read',
  UPDATE: 'reports.update',
  DELETE: 'reports.delete',
} as const;

const _ROLES = {
  CREATE: 'roles.create',
  READ:   'roles.read',
  UPDATE: 'roles.update',
  DELETE: 'roles.delete',
} as const;

const _SALE_LINES = {
  CREATE: 'cashbox.create',
  READ:   'cashbox.read',
  UPDATE: 'cashbox.update',
  DELETE: 'cashbox.delete',
} as const;

const _SALARY_RULES = {
  CREATE: 'salary_rules.create',
  READ:   'salary_rules.read',
  UPDATE: 'salary_rules.update',
  DELETE: 'salary_rules.delete',
} as const;

const _SALES = {
  CREATE: 'cashbox.create',
  READ:   'cashbox.read',
  UPDATE: 'cashbox.update',
  DELETE: 'cashbox.delete',
} as const;

const _SELLABLE_ITEMS = {
  CREATE: 'services.read',
  READ:   'services.read',
  UPDATE: 'services.read',
  DELETE: 'services.read',
} as const;

const _SERVICE_SALARY_RULES = {
  CREATE: 'service_salary_rules.create',
  READ:   'service_salary_rules.read',
  UPDATE: 'service_salary_rules.update',
  DELETE: 'service_salary_rules.delete',
} as const;

const _SERVICES = {
  CREATE: 'services.create',
  READ:   'services.read',
  UPDATE: 'services.update',
  DELETE: 'services.delete',
} as const;

const _SPECIALIZATIONS = {
  CREATE: 'specializations.create',
  READ:   'specializations.read',
  UPDATE: 'specializations.update',
  DELETE: 'specializations.delete',
} as const;

const _USERS = {
  CREATE: 'users.create',
  READ:   'users.read',
  UPDATE: 'users.update',
  DELETE: 'users.delete',
} as const;

const _SKUD_SETTINGS = {
  CREATE: 'skud_settings.create',
  READ:   'skud_settings.read',
  UPDATE: 'skud_settings.update',
  DELETE: 'skud_settings.delete',
} as const;

const _WORK_SHIFTS = {
  CREATE:         'work_shifts.create',
  READ:           'work_shifts.read',
  UPDATE:         'work_shifts.update',
  DELETE:         'work_shifts.delete',
  SELF_CLOCK_IN:  'work_shifts.self_clock_in',
} as const;

// ---------------------------------------------------------------------------
// PERMISSIONS — единый объект с вложенными группами И плоскими ключами.
// Плоские ключи сохранены для обратной совместимости.
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  // ---- Nested groups (новый стиль) ----------------------------------------
  APPOINTMENTS:            _APPOINTMENTS,
  APPOINTMENT_GROUPS:      _APPOINTMENT_GROUPS,
  APP_SETTINGS:            _APP_SETTINGS,
  BALANCE_TRANSACTIONS:    _BALANCE_TRANSACTIONS,
  BRANCHES:                _BRANCHES,
  CASHBOX:                 _CASHBOX,
  CLIENT_DOCUMENTS:        _CLIENT_DOCUMENTS,
  CLIENT_SCHEDULES:        _CLIENT_SCHEDULES,
  CLIENTS:                 _CLIENTS,
  EMPLOYEE_DOCUMENTS:      _EMPLOYEE_DOCUMENTS,
  EMPLOYEE_SCHEDULES:      _EMPLOYEE_SCHEDULES,
  EMPLOYEES:               _EMPLOYEES,
  EXPENSE_CATEGORIES:      _EXPENSE_CATEGORIES,
  EXPENSES:                _EXPENSES,
  ORGANIZATIONS:           _ORGANIZATIONS,
  PAYMENTS:                _PAYMENTS,
  PRODUCTS:                _PRODUCTS,
  RECEPTION:               _RECEPTION,
  REPORTS:                 _REPORTS,
  ROLES:                   _ROLES,
  SALE_LINES:              _SALE_LINES,
  SALARY_RULES:            _SALARY_RULES,
  SALES:                   _SALES,
  SELLABLE_ITEMS:          _SELLABLE_ITEMS,
  SERVICE_SALARY_RULES:    _SERVICE_SALARY_RULES,
  SERVICES:                _SERVICES,
  SKUD_SETTINGS:           _SKUD_SETTINGS,
  SPECIALIZATIONS:         _SPECIALIZATIONS,
  USERS:                   _USERS,
  WORK_SHIFTS:             _WORK_SHIFTS,

  // ---- Flat keys (backward-compat, deprecated — используй вложенные группы) --
  // Приёмы
  APPOINTMENTS_CREATE:               _APPOINTMENTS.CREATE,
  APPOINTMENTS_READ:                 _APPOINTMENTS.READ,
  APPOINTMENTS_UPDATE:               _APPOINTMENTS.UPDATE,
  APPOINTMENTS_DELETE:               _APPOINTMENTS.DELETE,
  // Группы приёмов
  APPOINTMENT_GROUPS_CREATE:         _APPOINTMENT_GROUPS.CREATE,
  APPOINTMENT_GROUPS_READ:           _APPOINTMENT_GROUPS.READ,
  APPOINTMENT_GROUPS_UPDATE:         _APPOINTMENT_GROUPS.UPDATE,
  APPOINTMENT_GROUPS_DELETE:         _APPOINTMENT_GROUPS.DELETE,
  // Настройки приложения
  APP_SETTINGS_CREATE:               _APP_SETTINGS.CREATE,
  APP_SETTINGS_READ:                 _APP_SETTINGS.READ,
  APP_SETTINGS_UPDATE:               _APP_SETTINGS.UPDATE,
  APP_SETTINGS_DELETE:               _APP_SETTINGS.DELETE,
  // Транзакции баланса
  BALANCE_TRANSACTIONS_CREATE:       _BALANCE_TRANSACTIONS.CREATE,
  BALANCE_TRANSACTIONS_READ:         _BALANCE_TRANSACTIONS.READ,
  BALANCE_TRANSACTIONS_UPDATE:       _BALANCE_TRANSACTIONS.UPDATE,
  BALANCE_TRANSACTIONS_DELETE:       _BALANCE_TRANSACTIONS.DELETE,
  // Филиалы
  BRANCHES_CREATE:                   _BRANCHES.CREATE,
  BRANCHES_READ:                     _BRANCHES.READ,
  BRANCHES_UPDATE:                   _BRANCHES.UPDATE,
  BRANCHES_DELETE:                   _BRANCHES.DELETE,
  // Касса
  CASHBOX_CREATE:                    _CASHBOX.CREATE,
  CASHBOX_READ:                      _CASHBOX.READ,
  CASHBOX_UPDATE:                    _CASHBOX.UPDATE,
  CASHBOX_DELETE:                    _CASHBOX.DELETE,
  // Документы клиентов
  CLIENT_DOCUMENTS_CREATE:           _CLIENT_DOCUMENTS.CREATE,
  CLIENT_DOCUMENTS_READ:             _CLIENT_DOCUMENTS.READ,
  CLIENT_DOCUMENTS_UPDATE:           _CLIENT_DOCUMENTS.UPDATE,
  CLIENT_DOCUMENTS_DELETE:           _CLIENT_DOCUMENTS.DELETE,
  // Расписание клиентов
  CLIENT_SCHEDULES_CREATE:           _CLIENT_SCHEDULES.CREATE,
  CLIENT_SCHEDULES_READ:             _CLIENT_SCHEDULES.READ,
  CLIENT_SCHEDULES_UPDATE:           _CLIENT_SCHEDULES.UPDATE,
  CLIENT_SCHEDULES_DELETE:           _CLIENT_SCHEDULES.DELETE,
  // Клиенты
  CLIENTS_CREATE:                    _CLIENTS.CREATE,
  CLIENTS_READ:                      _CLIENTS.READ,
  CLIENTS_UPDATE:                    _CLIENTS.UPDATE,
  CLIENTS_DELETE:                    _CLIENTS.DELETE,
  // Документы сотрудников
  EMPLOYEE_DOCUMENTS_CREATE:         _EMPLOYEE_DOCUMENTS.CREATE,
  EMPLOYEE_DOCUMENTS_READ:           _EMPLOYEE_DOCUMENTS.READ,
  EMPLOYEE_DOCUMENTS_UPDATE:         _EMPLOYEE_DOCUMENTS.UPDATE,
  EMPLOYEE_DOCUMENTS_DELETE:         _EMPLOYEE_DOCUMENTS.DELETE,
  // Расписание сотрудников
  EMPLOYEE_SCHEDULES_CREATE:         _EMPLOYEE_SCHEDULES.CREATE,
  EMPLOYEE_SCHEDULES_READ:           _EMPLOYEE_SCHEDULES.READ,
  EMPLOYEE_SCHEDULES_UPDATE:         _EMPLOYEE_SCHEDULES.UPDATE,
  EMPLOYEE_SCHEDULES_DELETE:         _EMPLOYEE_SCHEDULES.DELETE,
  // Сотрудники
  EMPLOYEES_CREATE:                  _EMPLOYEES.CREATE,
  EMPLOYEES_READ:                    _EMPLOYEES.READ,
  EMPLOYEES_UPDATE:                  _EMPLOYEES.UPDATE,
  EMPLOYEES_DELETE:                  _EMPLOYEES.DELETE,
  EMPLOYEES_MANAGE_SENSITIVE:        _EMPLOYEES.MANAGE_SENSITIVE,
  // Категории расходов
  EXPENSE_CATEGORIES_CREATE:         _EXPENSE_CATEGORIES.CREATE,
  EXPENSE_CATEGORIES_READ:           _EXPENSE_CATEGORIES.READ,
  EXPENSE_CATEGORIES_UPDATE:         _EXPENSE_CATEGORIES.UPDATE,
  EXPENSE_CATEGORIES_DELETE:         _EXPENSE_CATEGORIES.DELETE,
  // Расходы
  EXPENSES_CREATE:                   _EXPENSES.CREATE,
  EXPENSES_READ:                     _EXPENSES.READ,
  EXPENSES_UPDATE:                   _EXPENSES.UPDATE,
  EXPENSES_DELETE:                   _EXPENSES.DELETE,
  // Входящие звонки
  // Организации
  ORGANIZATIONS_CREATE:              _ORGANIZATIONS.CREATE,
  ORGANIZATIONS_READ:                _ORGANIZATIONS.READ,
  ORGANIZATIONS_UPDATE:              _ORGANIZATIONS.UPDATE,
  ORGANIZATIONS_DELETE:              _ORGANIZATIONS.DELETE,
  // Платежи
  PAYMENTS_CREATE:                   _PAYMENTS.CREATE,
  PAYMENTS_READ:                     _PAYMENTS.READ,
  PAYMENTS_UPDATE:                   _PAYMENTS.UPDATE,
  PAYMENTS_DELETE:                   _PAYMENTS.DELETE,
  // Продукты
  PRODUCTS_CREATE:                   _PRODUCTS.CREATE,
  PRODUCTS_READ:                     _PRODUCTS.READ,
  PRODUCTS_UPDATE:                   _PRODUCTS.UPDATE,
  PRODUCTS_DELETE:                   _PRODUCTS.DELETE,
  // Ресепшн
  RECEPTION_CREATE:                  _RECEPTION.CREATE,
  RECEPTION_READ:                    _RECEPTION.READ,
  RECEPTION_UPDATE:                  _RECEPTION.UPDATE,
  RECEPTION_DELETE:                  _RECEPTION.DELETE,
  // Отчёты
  REPORTS_CREATE:                    _REPORTS.CREATE,
  REPORTS_READ:                      _REPORTS.READ,
  REPORTS_UPDATE:                    _REPORTS.UPDATE,
  REPORTS_DELETE:                    _REPORTS.DELETE,
  // Роли
  ROLES_CREATE:                      _ROLES.CREATE,
  ROLES_READ:                        _ROLES.READ,
  ROLES_UPDATE:                      _ROLES.UPDATE,
  ROLES_DELETE:                      _ROLES.DELETE,
  // Строки продаж
  SALE_LINES_CREATE:                 _SALE_LINES.CREATE,
  SALE_LINES_READ:                   _SALE_LINES.READ,
  SALE_LINES_UPDATE:                 _SALE_LINES.UPDATE,
  SALE_LINES_DELETE:                 _SALE_LINES.DELETE,
  // Правила зарплат
  SALARY_RULES_CREATE:               _SALARY_RULES.CREATE,
  SALARY_RULES_READ:                 _SALARY_RULES.READ,
  SALARY_RULES_UPDATE:               _SALARY_RULES.UPDATE,
  SALARY_RULES_DELETE:               _SALARY_RULES.DELETE,
  // Продажи
  SALES_CREATE:                      _SALES.CREATE,
  SALES_READ:                        _SALES.READ,
  SALES_UPDATE:                      _SALES.UPDATE,
  SALES_DELETE:                      _SALES.DELETE,
  // Товары для продажи
  SELLABLE_ITEMS_CREATE:             _SELLABLE_ITEMS.CREATE,
  SELLABLE_ITEMS_READ:               _SELLABLE_ITEMS.READ,
  SELLABLE_ITEMS_UPDATE:             _SELLABLE_ITEMS.UPDATE,
  SELLABLE_ITEMS_DELETE:             _SELLABLE_ITEMS.DELETE,
  // Правила зарплат по услугам
  SERVICE_SALARY_RULES_CREATE:       _SERVICE_SALARY_RULES.CREATE,
  SERVICE_SALARY_RULES_READ:         _SERVICE_SALARY_RULES.READ,
  SERVICE_SALARY_RULES_UPDATE:       _SERVICE_SALARY_RULES.UPDATE,
  SERVICE_SALARY_RULES_DELETE:       _SERVICE_SALARY_RULES.DELETE,
  // Услуги
  SERVICES_CREATE:                   _SERVICES.CREATE,
  SERVICES_READ:                     _SERVICES.READ,
  SERVICES_UPDATE:                   _SERVICES.UPDATE,
  SERVICES_DELETE:                   _SERVICES.DELETE,
  // Специализации
  SPECIALIZATIONS_CREATE:            _SPECIALIZATIONS.CREATE,
  SPECIALIZATIONS_READ:              _SPECIALIZATIONS.READ,
  SPECIALIZATIONS_UPDATE:            _SPECIALIZATIONS.UPDATE,
  SPECIALIZATIONS_DELETE:            _SPECIALIZATIONS.DELETE,
  // Пользователи
  USERS_CREATE:                      _USERS.CREATE,
  USERS_READ:                        _USERS.READ,
  USERS_UPDATE:                      _USERS.UPDATE,
  USERS_DELETE:                      _USERS.DELETE,
  // Настройки СКУД
  SKUD_SETTINGS_CREATE:              _SKUD_SETTINGS.CREATE,
  SKUD_SETTINGS_READ:                _SKUD_SETTINGS.READ,
  SKUD_SETTINGS_UPDATE:              _SKUD_SETTINGS.UPDATE,
  SKUD_SETTINGS_DELETE:              _SKUD_SETTINGS.DELETE,
  // Рабочие смены
  WORK_SHIFTS_CREATE:                _WORK_SHIFTS.CREATE,
  WORK_SHIFTS_READ:                  _WORK_SHIFTS.READ,
  WORK_SHIFTS_UPDATE:                _WORK_SHIFTS.UPDATE,
  WORK_SHIFTS_DELETE:                _WORK_SHIFTS.DELETE,
  WORK_SHIFTS_SELF_CLOCK_IN:         _WORK_SHIFTS.SELF_CLOCK_IN,
} as const;

// ---------------------------------------------------------------------------
// Backward-compatible flat P aliases (явный именованный экспорт)
// Используйте если хотите явно показать что работаете с flat API.
// ---------------------------------------------------------------------------
export const P = {
  // Приёмы
  APPOINTMENTS_CREATE:               _APPOINTMENTS.CREATE,
  APPOINTMENTS_READ:                 _APPOINTMENTS.READ,
  APPOINTMENTS_UPDATE:               _APPOINTMENTS.UPDATE,
  APPOINTMENTS_DELETE:               _APPOINTMENTS.DELETE,
  // Группы приёмов
  APPOINTMENT_GROUPS_CREATE:         _APPOINTMENT_GROUPS.CREATE,
  APPOINTMENT_GROUPS_READ:           _APPOINTMENT_GROUPS.READ,
  APPOINTMENT_GROUPS_UPDATE:         _APPOINTMENT_GROUPS.UPDATE,
  APPOINTMENT_GROUPS_DELETE:         _APPOINTMENT_GROUPS.DELETE,
  // Настройки приложения
  APP_SETTINGS_CREATE:               _APP_SETTINGS.CREATE,
  APP_SETTINGS_READ:                 _APP_SETTINGS.READ,
  APP_SETTINGS_UPDATE:               _APP_SETTINGS.UPDATE,
  APP_SETTINGS_DELETE:               _APP_SETTINGS.DELETE,
  // Транзакции баланса
  BALANCE_TRANSACTIONS_CREATE:       _BALANCE_TRANSACTIONS.CREATE,
  BALANCE_TRANSACTIONS_READ:         _BALANCE_TRANSACTIONS.READ,
  BALANCE_TRANSACTIONS_UPDATE:       _BALANCE_TRANSACTIONS.UPDATE,
  BALANCE_TRANSACTIONS_DELETE:       _BALANCE_TRANSACTIONS.DELETE,
  // Филиалы
  BRANCHES_CREATE:                   _BRANCHES.CREATE,
  BRANCHES_READ:                     _BRANCHES.READ,
  BRANCHES_UPDATE:                   _BRANCHES.UPDATE,
  BRANCHES_DELETE:                   _BRANCHES.DELETE,
  // Касса
  CASHBOX_CREATE:                    _CASHBOX.CREATE,
  CASHBOX_READ:                      _CASHBOX.READ,
  CASHBOX_UPDATE:                    _CASHBOX.UPDATE,
  CASHBOX_DELETE:                    _CASHBOX.DELETE,
  // Документы клиентов
  CLIENT_DOCUMENTS_CREATE:           _CLIENT_DOCUMENTS.CREATE,
  CLIENT_DOCUMENTS_READ:             _CLIENT_DOCUMENTS.READ,
  CLIENT_DOCUMENTS_UPDATE:           _CLIENT_DOCUMENTS.UPDATE,
  CLIENT_DOCUMENTS_DELETE:           _CLIENT_DOCUMENTS.DELETE,
  // Расписание клиентов
  CLIENT_SCHEDULES_CREATE:           _CLIENT_SCHEDULES.CREATE,
  CLIENT_SCHEDULES_READ:             _CLIENT_SCHEDULES.READ,
  CLIENT_SCHEDULES_UPDATE:           _CLIENT_SCHEDULES.UPDATE,
  CLIENT_SCHEDULES_DELETE:           _CLIENT_SCHEDULES.DELETE,
  // Клиенты
  CLIENTS_CREATE:                    _CLIENTS.CREATE,
  CLIENTS_READ:                      _CLIENTS.READ,
  CLIENTS_UPDATE:                    _CLIENTS.UPDATE,
  CLIENTS_DELETE:                    _CLIENTS.DELETE,
  // Документы сотрудников
  EMPLOYEE_DOCUMENTS_CREATE:         _EMPLOYEE_DOCUMENTS.CREATE,
  EMPLOYEE_DOCUMENTS_READ:           _EMPLOYEE_DOCUMENTS.READ,
  EMPLOYEE_DOCUMENTS_UPDATE:         _EMPLOYEE_DOCUMENTS.UPDATE,
  EMPLOYEE_DOCUMENTS_DELETE:         _EMPLOYEE_DOCUMENTS.DELETE,
  // Расписание сотрудников
  EMPLOYEE_SCHEDULES_CREATE:         _EMPLOYEE_SCHEDULES.CREATE,
  EMPLOYEE_SCHEDULES_READ:           _EMPLOYEE_SCHEDULES.READ,
  EMPLOYEE_SCHEDULES_UPDATE:         _EMPLOYEE_SCHEDULES.UPDATE,
  EMPLOYEE_SCHEDULES_DELETE:         _EMPLOYEE_SCHEDULES.DELETE,
  // Сотрудники
  EMPLOYEES_CREATE:                  _EMPLOYEES.CREATE,
  EMPLOYEES_READ:                    _EMPLOYEES.READ,
  EMPLOYEES_UPDATE:                  _EMPLOYEES.UPDATE,
  EMPLOYEES_DELETE:                  _EMPLOYEES.DELETE,
  EMPLOYEES_MANAGE_SENSITIVE:        _EMPLOYEES.MANAGE_SENSITIVE,
  // Категории расходов
  EXPENSE_CATEGORIES_CREATE:         _EXPENSE_CATEGORIES.CREATE,
  EXPENSE_CATEGORIES_READ:           _EXPENSE_CATEGORIES.READ,
  EXPENSE_CATEGORIES_UPDATE:         _EXPENSE_CATEGORIES.UPDATE,
  EXPENSE_CATEGORIES_DELETE:         _EXPENSE_CATEGORIES.DELETE,
  // Расходы
  EXPENSES_CREATE:                   _EXPENSES.CREATE,
  EXPENSES_READ:                     _EXPENSES.READ,
  EXPENSES_UPDATE:                   _EXPENSES.UPDATE,
  EXPENSES_DELETE:                   _EXPENSES.DELETE,
  // Входящие звонки
  // Организации
  ORGANIZATIONS_CREATE:              _ORGANIZATIONS.CREATE,
  ORGANIZATIONS_READ:                _ORGANIZATIONS.READ,
  ORGANIZATIONS_UPDATE:              _ORGANIZATIONS.UPDATE,
  ORGANIZATIONS_DELETE:              _ORGANIZATIONS.DELETE,
  // Платежи
  PAYMENTS_CREATE:                   _PAYMENTS.CREATE,
  PAYMENTS_READ:                     _PAYMENTS.READ,
  PAYMENTS_UPDATE:                   _PAYMENTS.UPDATE,
  PAYMENTS_DELETE:                   _PAYMENTS.DELETE,
  // Продукты
  PRODUCTS_CREATE:                   _PRODUCTS.CREATE,
  PRODUCTS_READ:                     _PRODUCTS.READ,
  PRODUCTS_UPDATE:                   _PRODUCTS.UPDATE,
  PRODUCTS_DELETE:                   _PRODUCTS.DELETE,
  // Ресепшн
  RECEPTION_CREATE:                  _RECEPTION.CREATE,
  RECEPTION_READ:                    _RECEPTION.READ,
  RECEPTION_UPDATE:                  _RECEPTION.UPDATE,
  RECEPTION_DELETE:                  _RECEPTION.DELETE,
  // Отчёты
  REPORTS_CREATE:                    _REPORTS.CREATE,
  REPORTS_READ:                      _REPORTS.READ,
  REPORTS_UPDATE:                    _REPORTS.UPDATE,
  REPORTS_DELETE:                    _REPORTS.DELETE,
  // Роли
  ROLES_CREATE:                      _ROLES.CREATE,
  ROLES_READ:                        _ROLES.READ,
  ROLES_UPDATE:                      _ROLES.UPDATE,
  ROLES_DELETE:                      _ROLES.DELETE,
  // Строки продаж
  SALE_LINES_CREATE:                 _SALE_LINES.CREATE,
  SALE_LINES_READ:                   _SALE_LINES.READ,
  SALE_LINES_UPDATE:                 _SALE_LINES.UPDATE,
  SALE_LINES_DELETE:                 _SALE_LINES.DELETE,
  // Правила зарплат
  SALARY_RULES_CREATE:               _SALARY_RULES.CREATE,
  SALARY_RULES_READ:                 _SALARY_RULES.READ,
  SALARY_RULES_UPDATE:               _SALARY_RULES.UPDATE,
  SALARY_RULES_DELETE:               _SALARY_RULES.DELETE,
  // Продажи
  SALES_CREATE:                      _SALES.CREATE,
  SALES_READ:                        _SALES.READ,
  SALES_UPDATE:                      _SALES.UPDATE,
  SALES_DELETE:                      _SALES.DELETE,
  // Товары для продажи
  SELLABLE_ITEMS_CREATE:             _SELLABLE_ITEMS.CREATE,
  SELLABLE_ITEMS_READ:               _SELLABLE_ITEMS.READ,
  SELLABLE_ITEMS_UPDATE:             _SELLABLE_ITEMS.UPDATE,
  SELLABLE_ITEMS_DELETE:             _SELLABLE_ITEMS.DELETE,
  // Правила зарплат по услугам
  SERVICE_SALARY_RULES_CREATE:       _SERVICE_SALARY_RULES.CREATE,
  SERVICE_SALARY_RULES_READ:         _SERVICE_SALARY_RULES.READ,
  SERVICE_SALARY_RULES_UPDATE:       _SERVICE_SALARY_RULES.UPDATE,
  SERVICE_SALARY_RULES_DELETE:       _SERVICE_SALARY_RULES.DELETE,
  // Услуги
  SERVICES_CREATE:                   _SERVICES.CREATE,
  SERVICES_READ:                     _SERVICES.READ,
  SERVICES_UPDATE:                   _SERVICES.UPDATE,
  SERVICES_DELETE:                   _SERVICES.DELETE,
  // Специализации
  SPECIALIZATIONS_CREATE:            _SPECIALIZATIONS.CREATE,
  SPECIALIZATIONS_READ:              _SPECIALIZATIONS.READ,
  SPECIALIZATIONS_UPDATE:            _SPECIALIZATIONS.UPDATE,
  SPECIALIZATIONS_DELETE:            _SPECIALIZATIONS.DELETE,
  // Пользователи
  USERS_CREATE:                      _USERS.CREATE,
  USERS_READ:                        _USERS.READ,
  USERS_UPDATE:                      _USERS.UPDATE,
  USERS_DELETE:                      _USERS.DELETE,
  // Настройки СКУД
  SKUD_SETTINGS_CREATE:              _SKUD_SETTINGS.CREATE,
  SKUD_SETTINGS_READ:                _SKUD_SETTINGS.READ,
  SKUD_SETTINGS_UPDATE:              _SKUD_SETTINGS.UPDATE,
  SKUD_SETTINGS_DELETE:              _SKUD_SETTINGS.DELETE,
  // Рабочие смены
  WORK_SHIFTS_CREATE:                _WORK_SHIFTS.CREATE,
  WORK_SHIFTS_READ:                  _WORK_SHIFTS.READ,
  WORK_SHIFTS_UPDATE:                _WORK_SHIFTS.UPDATE,
  WORK_SHIFTS_DELETE:                _WORK_SHIFTS.DELETE,
  WORK_SHIFTS_SELF_CLOCK_IN:         _WORK_SHIFTS.SELF_CLOCK_IN,
} as const;

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/**
 * Строгий тип — объединение всех строковых permission-значений.
 * Извлекается из плоских ключей PERMISSIONS (те что имеют строковые значения).
 */
export type Permission = Extract<typeof PERMISSIONS[keyof typeof PERMISSIONS], string>;

/**
 * Плоский массив всех валидных permission-строк.
 * Используется в dev-проверке и sync-скрипте.
 */
export const ALL_PERMISSIONS: readonly Permission[] = (
  Object.values(PERMISSIONS).filter((v): v is Permission => typeof v === 'string')
) as Permission[];

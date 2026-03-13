/**
 * Пример интеграции RBAC в App.tsx
 *
 * Этот файл показывает, как обновить ваш App.tsx для использования RBAC.
 * НЕ копируйте напрямую - адаптируйте под вашу структуру!
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ProtectedRoute } from './components/rbac/ProtectedRoute';
import { AccessDenied } from './pages/AccessDenied';

// Импорт ваших страниц
import { HomePage } from './pages/home';
import { PatientSearchPage } from './pages/patient-search';
import { ExpensesPage } from './pages/expenses';
import { EmployeesPage } from './pages/employees';
import { ServicesPage } from './pages/services';
import { SchedulePage } from './pages/schedule';
import { LoginPage } from './pages/auth/login';
import { RequireAuth } from './components/auth/RequireAuth';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичные маршруты */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/access-denied" element={<AccessDenied />} />

        {/* Защищенные маршруты */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              {/* Главная доступна всем авторизованным */}
              <HomePage />
            </RequireAuth>
          }
        />

        <Route
          path="/patient-search"
          element={
            <RequireAuth>
              <ProtectedRoute allowedRoles={['superadmin', 'admin', 'doctor', 'receptionist']}>
                <PatientSearchPage />
              </ProtectedRoute>
            </RequireAuth>
          }
        />

        <Route
          path="/expenses"
          element={
            <RequireAuth>
              <ProtectedRoute
                allowedRoles={['superadmin', 'admin', 'accountant']}
                redirectTo="/access-denied"
              >
                <ExpensesPage />
              </ProtectedRoute>
            </RequireAuth>
          }
        />

        <Route
          path="/employees"
          element={
            <RequireAuth>
              <ProtectedRoute
                allowedRoles={['superadmin', 'admin']}
                redirectTo="/access-denied"
              >
                <EmployeesPage />
              </ProtectedRoute>
            </RequireAuth>
          }
        />

        <Route
          path="/services"
          element={
            <RequireAuth>
              {/* Услуги доступны всем для просмотра */}
              <ServicesPage />
            </RequireAuth>
          }
        />

        <Route
          path="/schedule"
          element={
            <RequireAuth>
              <ProtectedRoute allowedRoles={['superadmin', 'admin', 'doctor', 'receptionist']}>
                <SchedulePage />
              </ProtectedRoute>
            </RequireAuth>
          }
        />

        {/* Редирект с корня */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

/**
 * Пример использования в компоненте Sidebar
 *
 * Обновите ваш сайдбар для условного отображения пунктов меню
 */

// В Sidebar.tsx
import { usePermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../types/rbac';

function Sidebar() {
  const { hasRole, hasPermission } = usePermissions();

  return (
    <nav>
      <MenuItem to="/home" icon={<HomeIcon />}>
        Главная
      </MenuItem>

      {hasPermission(PERMISSIONS.PATIENTS_LIST) && (
        <MenuItem to="/patient-search" icon={<PeopleIcon />}>
          Пациенты
        </MenuItem>
      )}

      {hasPermission(PERMISSIONS.EXPENSES_READ) && (
        <MenuItem to="/expenses" icon={<MoneyIcon />}>
          Расходы
        </MenuItem>
      )}

      {hasRole(['superadmin', 'admin']) && (
        <MenuItem to="/employees" icon={<BadgeIcon />}>
          Сотрудники
        </MenuItem>
      )}

      <MenuItem to="/services" icon={<LocalHospitalIcon />}>
        Услуги
      </MenuItem>

      {hasPermission(PERMISSIONS.SCHEDULE_READ) && (
        <MenuItem to="/schedule" icon={<CalendarIcon />}>
          График
        </MenuItem>
      )}
    </nav>
  );
}

/**
 * Пример использования в компоненте списка пациентов
 *
 * Условное отображение кнопок действий
 */

// В PatientsList.tsx
import { CanAccess } from '../components/rbac/CanAccess';
import { PERMISSIONS } from '../types/rbac';

function PatientsList() {
  return (
    <div>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h4">Пациенты</Typography>

        <CanAccess permissions={PERMISSIONS.PATIENTS_CREATE}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddPatient}
          >
            Добавить пациента
          </Button>
        </CanAccess>
      </Box>

      <DataGrid
        rows={patients}
        columns={[
          { field: 'fio', headerName: 'ФИО' },
          { field: 'phone', headerName: 'Телефон' },
          {
            field: 'actions',
            headerName: 'Действия',
            renderCell: (params) => (
              <>
                <CanAccess permissions={PERMISSIONS.PATIENTS_UPDATE}>
                  <IconButton onClick={() => handleEdit(params.row)}>
                    <EditIcon />
                  </IconButton>
                </CanAccess>

                <CanAccess permissions={PERMISSIONS.PATIENTS_DELETE}>
                  <IconButton onClick={() => handleDelete(params.row)}>
                    <DeleteIcon />
                  </IconButton>
                </CanAccess>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

/**
 * Пример проверки прав перед выполнением действия
 *
 * Дополнительная проверка в функции-обработчике
 */

// В любом компоненте
import { usePermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../types/rbac';

function PatientCard({ patient }) {
  const { hasPermission } = usePermissions();

  const handleDelete = async () => {
    // Дополнительная проверка перед удалением
    if (!hasPermission(PERMISSIONS.PATIENTS_DELETE)) {
      toast.error('У вас нет прав для удаления пациентов');
      return;
    }

    const confirmed = await confirmDialog('Вы уверены, что хотите удалить пациента?');
    if (!confirmed) return;

    try {
      await deletePatient(patient.id);
      toast.success('Пациент удален');
    } catch (error) {
      toast.error('Ошибка при удалении пациента');
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5">{patient.fio}</Typography>
        <Typography>{patient.phone}</Typography>
      </CardContent>
      <CardActions>
        {hasPermission(PERMISSIONS.PATIENTS_UPDATE) && (
          <Button onClick={() => handleEdit(patient)}>
            Редактировать
          </Button>
        )}
        {hasPermission(PERMISSIONS.PATIENTS_DELETE) && (
          <Button color="error" onClick={handleDelete}>
            Удалить
          </Button>
        )}
      </CardActions>
    </Card>
  );
}

/**
 * Пример динамической формы с условными полями
 *
 * Показывать разные поля в зависимости от прав
 */

function EmployeeForm({ employee }) {
  const { hasPermission, isAdmin } = usePermissions();

  return (
    <form>
      <TextField label="Полное имя" name="full_name" required />
      <TextField label="Телефон" name="phone" />
      <TextField label="Специализация" name="specialization" />

      {/* Только администраторы могут изменять роль */}
      {isAdmin() && (
        <Select label="Роль" name="role_id">
          <MenuItem value="doctor">Врач</MenuItem>
          <MenuItem value="receptionist">Регистратор</MenuItem>
          <MenuItem value="accountant">Бухгалтер</MenuItem>
        </Select>
      )}

      {/* Поле зарплаты только для супер-админов */}
      <CanAccess roles={['superadmin']}>
        <TextField label="Зарплата" name="salary" type="number" />
      </CanAccess>

      <Button type="submit">Сохранить</Button>
    </form>
  );
}

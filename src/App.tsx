import { Refine } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  RefineSnackbarProvider,
  ThemedLayout,
  useNotificationProvider,
} from "@refinedev/mui";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { useMediaQuery, useTheme } from "@mui/material";
import LinearProgress from "@mui/material/LinearProgress";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ruRU } from "@mui/x-date-pickers/locales";
import dayjs from "dayjs";

import routerProvider, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";

import { Outlet, Route, Routes, Navigate } from "react-router";

import { Header } from "./components/header";
import { Sidebar } from "./components/sidebar";
import { MobileSidebarProvider } from "./components/sidebar/mobile-context";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { RefreshProvider } from "./contexts/refresh-context";
import { TitleProvider } from "./contexts/title-context";
import { PageCacheProvider } from "./contexts/page-cache-context";
import { RequireAuth } from "./components/auth/RequireAuth";
import { ProtectedRoute } from "./components/rbac/ProtectedRoute";
import { BranchProvider } from "./contexts/branch-context";
// import { RoleDebugNotification } from "./components/debug/RoleDebugNotification"; // ⚠️ Временно отключено

import { lazy, Suspense, useEffect } from "react";
import { useAuthIdentitySync } from "./hooks/useAuthIdentitySync";
import { usePermissions } from "./hooks/usePermissions";
import { API_BASE_URL } from "./utility/apiClient";
import { getDefaultAuthorizedRoute } from "./utils/permissionHelpers";
import dataProvider from "@refinedev/simple-rest";

// ОПТИМИЗАЦИЯ: Все страницы загружаются через lazy() для code splitting
const UnderConstruction = lazy(() =>
  import("./pages/placeholder").then((m) => ({ default: m.UnderConstruction })),
);
const HomePage = lazy(() => import("./pages/home"));
const PatientSearchPage = lazy(() => import("./pages/patient-search"));
const ExpensesListPage = lazy(() => import("./pages/expenses"));
const EmployeesPage = lazy(() => import("./pages/employes"));
const ServicesPage = lazy(() => import("./pages/services"));
const ProductsPage = lazy(() => import("./pages/products"));
const LoginPage = lazy(() => import("./pages/auth/login"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const AccessDeniedPage = lazy(() => import("./pages/AccessDenied"));
const DoctorWorkPage = lazy(() => import("./pages/doctor"));
const CashboxPage = lazy(() => import("./pages/cashbox"));
const ReportsPage = lazy(() => import("./pages/reports"));
const AllAppointmentsPage = lazy(() => import("./pages/all-appointments"));
const AllProceduresPage = lazy(() => import("./pages/all-procedures"));
const SalaryReportsPage = lazy(() => import("./pages/salary-reports"));
const LoadAnalyticsPage = lazy(() => import("./pages/admin/load").then(module => ({ default: module.LoadAnalyticsPage })));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPasswordConfirmPage = lazy(() => import("./pages/auth/ResetPasswordConfirm"));
const ClientSchedulePage = lazy(() => import("./pages/ClientSchedulePage"));
const RolesPage = lazy(() => import("./pages/roles"));
const CategoriesPage = lazy(() => import("./pages/categories/index.tsx"));
const BranchManagePage = lazy(() => import("./pages/branches/BranchManagePage"));


// Вспомогательный компонент для обработки глобальных событий аутентификации
const AuthHelper = () => null;

// Оборачивает layout в BranchProvider с доступом к isSuperAdmin
const BranchAwareLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin } = usePermissions();
  return <BranchProvider isSuperAdmin={isSuperAdmin()}>{children}</BranchProvider>;
};

// Вспомогательный компонент для защиты корневого редиректа
const RootRedirect = () => {
  const { hasPermission, loading, role } = usePermissions();
  if (loading) return null;
  const target = getDefaultAuthorizedRoute({
    hasPermission,
    roleName: role?.name ?? null,
  });
  return <Navigate to={target} replace />;
};

function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Auto-link phone-login UUID to existing employee record on first sign-in
  useAuthIdentitySync();


  // ОПТИМИЗАЦИЯ: Более умный prefetch с приоритизацией
  useEffect(() => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    const ric = w.requestIdleCallback;

    // Приоритет 1: Самые часто используемые страницы
    const prefetchPriority = () => {
      import("./pages/home");
      import("./pages/expenses");
    };

    // Приоритет 2: Менее важные страницы загружаем позже
    const prefetchSecondary = () => {
      import("./pages/employes");
      import("./pages/services");
      import("./pages/products");
    };

    // Приоритет 3: Редко используемые страницы загружаем в последнюю очередь
    const prefetchTertiary = () => {
      /* reserved */
    };

    if (typeof ric === "function") {
      ric(prefetchPriority);
      ric(() => {
        setTimeout(prefetchSecondary, 1000);
      });
      ric(() => {
        setTimeout(prefetchTertiary, 3000);
      });
    } else {
      setTimeout(prefetchPriority, 1500);
      setTimeout(prefetchSecondary, 3000);
      setTimeout(prefetchTertiary, 5000);
    }
  }, []);
  return (
    <RefineKbarProvider>
      <PageCacheProvider>
        <TitleProvider>
          <ColorModeContextProvider>
            <RefreshProvider>
              <CssBaseline />
              <GlobalStyles
                styles={{
                  html: {
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    overscrollBehaviorY: "contain",
                    height: "100%",
                    overflow: "hidden",
                  },
                  body: {
                    overscrollBehaviorY: "contain",
                    WebkitOverflowScrolling: "touch",
                    minHeight: "100%",
                    height: "100%",
                    overflow: "hidden",
                  },
                  "#root": {
                    minHeight: "100%",
                    height: "100%",
                    overflow: "hidden",
                  },
                  ".app-page-scroll, [data-scrollable='true']": {
                    WebkitOverflowScrolling: "touch",
                    overscrollBehaviorY: "contain",
                    touchAction: "pan-y",
                  },
                }}
              />

              <RefineSnackbarProvider anchorOrigin={{ vertical: "top", horizontal: isMobile ? "right" : "center" }}>
                <LocalizationProvider
                  dateAdapter={AdapterDayjs}
                  adapterLocale="ru"
                  dateLibInstance={dayjs}
                  localeText={ruRU.components.MuiLocalizationProvider.defaultProps.localeText}
                >
                  <Refine
                    dataProvider={dataProvider(API_BASE_URL)}
                    notificationProvider={useNotificationProvider}
                    routerProvider={routerProvider}
                    resources={[
                      {
                        name: "Appointments",
                        list: "/home",
                        show: "/home/appointments/:id",
                      },
                      {
                        name: "categories",
                        list: "/categories",
                        create: "/categories/create",
                        edit: "/categories/edit/:id",
                        show: "/categories/show/:id",
                        meta: { canDelete: true },
                      },
                      {
                        name: "Expenses",
                        list: "/expenses",
                        meta: { label: "Расходы" }
                      },
                      {
                        name: "services",
                        list: "/services",
                        meta: { label: "Услуги" }
                      },
                      {
                        name: "products",
                        list: "/products",
                        meta: { label: "Товары" }
                      },
                      {
                        name: "employees",
                        list: "/employees",
                        meta: { label: "Сотрудники" }
                      },
                      {
                        name: "schedule",
                        list: "/schedule",
                        meta: { label: "Расписание" }
                      },
                      {
                        name: "specialist",
                        list: "/specialist",
                        meta: { label: "Кабинет специалиста" }
                      },
                      {
                        name: "cashbox",
                        list: "/cashbox",
                        meta: { label: "Касса" }
                      },
                      {
                        name: "reports",
                        list: "/reports",
                        meta: { label: "Отчеты" }
                      },
                      {
                        name: "load",
                        list: "/admin/load",
                        meta: { label: "Нагрузка" }
                      },
                      {
                        name: "salary-reports",
                        list: "/salary-reports",
                        meta: { label: "Отчет по ЗП" }
                      },
                      {
                        name: "all-appointments",
                        list: "/all-appointments",
                        meta: { label: "Все приемы" }
                      },
                    ]}
                    options={{
                      syncWithLocation: true,
                      warnWhenUnsavedChanges: true,
                      projectId: "Ajscvf-43VuiP-CaKNwq",
                      reactQuery: {
                        clientConfig: {
                          defaultOptions: {
                            queries: {
                              staleTime: 5 * 60 * 1000, // 5 minutes
                              gcTime: 10 * 60 * 1000, // 10 minutes
                              refetchOnWindowFocus: false,
                              retry: 1,
                            },
                          },
                        },
                      },
                    }}
                  >
                    <Routes>
                      <Route
                        element={
                          <RequireAuth>
                            <BranchAwareLayout>
                            <MobileSidebarProvider>
                              <ThemedLayout
                                Header={() => <Header sticky />}
                                Sider={() => <Sidebar />}
                                childrenBoxProps={{
                                  className: "app-page-scroll",
                                  sx: {
                                    p: 1,
                                    height: { xs: "auto", lg: "calc(100vh - 64px)" },
                                    minHeight: {
                                      xs: "calc(100dvh - 56px)",
                                      sm: "calc(100dvh - 64px)",
                                      lg: "calc(100vh - 64px)",
                                    },
                                    display: "flex",
                                    flexDirection: "column",
                                    overflowX: "hidden",
                                    overflowY: { xs: "auto", lg: "hidden" },
                                    position: "relative",
                                  }
                                }}
                              >
                                <Outlet />
                              </ThemedLayout>
                            </MobileSidebarProvider>
                            </BranchAwareLayout>
                          </RequireAuth>
                        }
                      >
                        <Route
                          path="client-schedule"
                          element={
                            <ProtectedRoute requiredPermissions={['client_schedules.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <ClientSchedulePage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />

                        <Route index element={<RootRedirect />} />
                        <Route
                          path="home"
                          element={
                            <ProtectedRoute requiredPermissions={['appointments.read', 'reception.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <HomePage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="patient-search"
                          element={
                            <ProtectedRoute requiredPermissions={['clients.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <PatientSearchPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="expenses"
                          element={
                            <ProtectedRoute requiredPermissions={['expenses.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <ExpensesListPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="employees"
                          element={
                            <ProtectedRoute requiredPermissions={['employees.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <EmployeesPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="services"
                          element={
                            <ProtectedRoute requiredPermissions={['services.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <ServicesPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="products"
                          element={
                            <ProtectedRoute requiredPermissions={['products.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <ProductsPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="schedule"
                          element={
                            <ProtectedRoute requiredPermissions={['employee_schedules.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <SchedulePage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="specialist"
                          element={
                            <ProtectedRoute requiredPermissions={['appointments.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <DoctorWorkPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="cashbox"
                          element={
                            <ProtectedRoute requiredPermissions={['cashbox.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <CashboxPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="reports"
                          element={
                            <ProtectedRoute requiredPermissions={['reports.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <ReportsPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="salary-reports"
                          element={
                            <ProtectedRoute requiredPermissions={['reports.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <SalaryReportsPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="roles"
                          element={
                            <ProtectedRoute requiredPermissions={['app_settings.update']}>
                              <Suspense fallback={<LinearProgress />}>
                                <RolesPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="categories"
                          element={
                            <ProtectedRoute requiredPermissions={['expenses.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <CategoriesPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="branches"
                          element={
                            <ProtectedRoute requiredPermissions={['app_settings.update']}>
                              <Suspense fallback={<LinearProgress />}>
                                <BranchManagePage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />


                        <Route
                          path="all-appointments"
                          element={
                            <ProtectedRoute requiredPermissions={['appointments.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <AllAppointmentsPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="all-procedures"
                          element={
                            <ProtectedRoute requiredPermissions={['appointments.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <AllProceduresPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />



                        <Route
                          path="admin/load"
                          element={
                            <ProtectedRoute requiredPermissions={['reports.read']}>
                              <Suspense fallback={<LinearProgress />}>
                                <LoadAnalyticsPage />
                              </Suspense>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="access-denied"
                          element={
                            <Suspense fallback={<LinearProgress />}>
                              <AccessDeniedPage />
                            </Suspense>
                          }
                        />

                        <Route
                          path="*"
                          element={
                            <Suspense fallback={<LinearProgress />}>
                              <UnderConstruction />
                            </Suspense>
                          }
                        />
                      </Route>
                      <Route
                        path="login"
                        element={
                          <Suspense fallback={<LinearProgress />}>
                            <LoginPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="forgot-password"
                        element={
                          <Suspense fallback={<LinearProgress />}>
                            <ForgotPasswordPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="reset-password"
                        element={
                          <Suspense fallback={<LinearProgress />}>
                            <ResetPasswordConfirmPage />
                          </Suspense>
                        }
                      />
                    </Routes>

                    <AuthHelper />
                    <RefineKbar />
                    <UnsavedChangesNotifier />
                    <DocumentTitleHandler
                      handler={(options) => {
                        const baseTitle = "Academy KG";
                        if (options.resource) {
                          const resourceLabel = options.resource.meta?.label || options.resource.name;
                          if (resourceLabel) {
                            return `${resourceLabel} | ${baseTitle}`;
                          }
                        }
                        return baseTitle;
                      }}
                    />
                  </Refine>
                </LocalizationProvider>

              </RefineSnackbarProvider>
            </RefreshProvider>
          </ColorModeContextProvider>
        </TitleProvider>
      </PageCacheProvider>
    </RefineKbarProvider>
  );
}

export default App;

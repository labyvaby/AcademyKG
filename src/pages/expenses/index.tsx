import React from "react";
import {
  Box,
  Typography,
  List,
  ListItemButton,
  Stack,
  Divider,
  Paper,
  Grid2,
  Button,
  useMediaQuery,
  Avatar,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Chip,
  Collapse,
  Badge,
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import { alpha, useTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import { formatKGS, formatDateRu } from "../../utility/format";
import { inferExpenseKindFromCategory, requiresAffectsMonth, type Expense, type EmployeesRow } from "./types";
import AddExpenseDrawer from "../../components/expenses/AddExpenseDrawer";
import EditExpenseDrawer from "../../components/expenses/EditExpenseDrawer";
import { DeleteExpenseDialog } from "../../components/expenses/DeleteExpenseDialog";
import { PaymentInfoBlock } from "../../components/ui";
import { ExpensesService } from "../../services/expenses";
import { getExpensesMonthlyReport } from "../../services/reports";
import { fetchEmployees } from "../../services/employees";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useSimplePageCache } from "../../hooks/useSimplePageCache";
import { useAvailableReportMonths } from "../../hooks/useAvailableReportMonths";
import { PageHeader, AppBottomSheet } from "../../components/ui";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";
import { useBranchContext } from "../../contexts/branch-context";
import dayjs from "dayjs";




const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

type CategoryRow = {
  id: string | number | null;
  name: string | null;
};

const getNameFrom = (o: Record<string, unknown>): string => {
  const directKeys = ["full_name", "fullName", "name", "fio", "ФИО сотрудников", "ФИО"];
  const vals: string[] = [];

  for (const k of directKeys) {
    const v = o[k as keyof typeof o];
    if (typeof v === "string" && v.trim().length > 0) vals.push(v.trim());
  }
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === "string" && /(name|fio|фио)/i.test(k) && v.trim().length > 0) {
      vals.push(v.trim());
    }
  }
  const fa = (o as Record<string, unknown>)["first_name"];
  const fb = (o as Record<string, unknown>)["last_name"];
  const combined = `${typeof fa === "string" ? fa.trim() : ""}${(typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
    }${typeof fb === "string" ? fb.trim() : ""}`.trim();

  const candidate = vals.concat(combined).find((s) => s.length > 0);
  return candidate ?? "";
};

// --- Employee Story Item (Main Page Style) ---
type EmployeeStoryItemProps = {
  name: string;
  nickname?: string;
  photoUrl?: string;
  isActive: boolean;
  onClick: () => void;
};

const EmployeeStoryItem: React.FC<EmployeeStoryItemProps> = ({ name, nickname, photoUrl, isActive, onClick }) => {
  const displayName = nickname || name.split(' ')[0];
  const theme = useTheme();

  return (
    <Stack
      spacing={0.25}
      alignItems="center"
      onClick={onClick}
      sx={{
        cursor: "pointer",
        minWidth: 56,
        transition: "all 0.2s ease",
        "&:active": { transform: "scale(0.92)" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: 48,
          height: 48,
          borderRadius: "50%",
          padding: "3px",
          background: isActive
            ? theme.palette.primary.main
            : "transparent",
          border: isActive ? "none" : `1.5px solid ${theme.palette.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Avatar
          src={photoUrl}
          sx={{
            width: "100%",
            height: "100%",
            border: isActive ? `2px solid ${theme.palette.background.paper}` : "none",
            bgcolor: "primary.main",
            fontSize: "1.25rem",
            fontWeight: 700,
          }}
        >
          {name.charAt(0)}
        </Avatar>
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: isActive ? 700 : 500,
          color: isActive ? "text.primary" : "text.secondary",
          fontSize: "0.7rem",
          textAlign: "center",
          maxWidth: 64,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {displayName}
      </Typography>
    </Stack>
  );
};

const ExpensesListPage: React.FC = () => {
  usePageTitle("Расходы");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { open: notify } = useNotification();
  const { hasPermission, employeeId } = usePermissions();
  const { selectedBranch } = useBranchContext();
  const hasManageExpenses = hasPermission(PERMISSIONS.EXPENSES_CREATE);
  const canEditExpense = hasPermission(PERMISSIONS.EXPENSES_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.EXPENSES_DELETE);
  const branchKey = selectedBranch?.id ?? "all";
  const availableExpenseMonths = useAvailableReportMonths("expensesMonths");


  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [expensesScopeKey, setExpensesScopeKey] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [monthlySummary, setMonthlySummary] = React.useState<{
    totalExpenses: number;
    payrollExpenses: number;
    advanceExpenses: number;
    operationalExpenses: number;
    otherExpenses: number;
    cashExpenses: number;
    cashlessExpenses: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedYear, setSelectedYear] = React.useState<string | null>(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = React.useState<string | null>(() => {
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = React.useState<Expense | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = React.useState<string | null>(null);
  const [expandedEmployee, setExpandedEmployee] = React.useState<string | null>(null);
  const [reloadTick, setReloadTick] = React.useState(0);
  const visibleExpenses = expensesScopeKey === branchKey ? expenses : [];
  const visibleSelectedExpense = expensesScopeKey === branchKey ? selectedExpense : null;
  const isScopeLoading = expensesScopeKey !== branchKey && !loadError;

  // Кеширование состояния страницы
  const { restoreState } = useSimplePageCache(`expenses-page:${branchKey}`, {
    expenses,
    searchQuery,
    selectedYear,
    selectedMonth,
    selectedDate,
    selectedExpense,
    selectedCategoryId,
    selectedEmployeeId
  });

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Восстанавливаем состояние из кеша
    const cached = restoreState();
    if (cached) {
      setExpenses(cached.expenses);
      setExpensesScopeKey(branchKey);
      setSearchQuery(cached.searchQuery);
      setSelectedYear(cached.selectedYear);
      setSelectedMonth(cached.selectedMonth);
      setSelectedDate(cached.selectedDate);
      setSelectedExpense(cached.selectedExpense);
      setSelectedCategoryId(cached.selectedCategoryId);
      setSelectedEmployeeId(cached.selectedEmployeeId);
    } else if (expensesScopeKey !== branchKey) {
      setExpenses([]);
      setExpensesScopeKey(null);
      setSearchQuery("");
      setSelectedYear(new Date().getFullYear().toString());
      setSelectedMonth(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
      setSelectedDate(null);
      setSelectedExpense(null);
      setSelectedCategoryId(null);
      setSelectedEmployeeId(null);
    }

    const fetchExpenses = async () => {
      try {
        setLoadError(null);
        // If Admin or Registrator -> fetch all (undefined). If not -> fetch associated with employeeId
        const targetEmployeeId = hasManageExpenses ? undefined : employeeId;
        const data = await ExpensesService.getAll(targetEmployeeId, controller.signal);
        if (!cancelled && data) {
          setExpenses(data);
          setExpensesScopeKey(branchKey);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("Failed to load expenses", e);
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Не удалось загрузить расходы";
          setLoadError(message);
          setExpensesScopeKey(null);
          notify?.({ type: "error", message });
        }
      } finally {
        // nothing
      }
    };
    fetchExpenses();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, hasManageExpenses, employeeId, reloadTick, branchKey, expensesScopeKey, notify]);

  // Загрузка сотрудников
  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);

  // Загрузка категорий
  const [categoriesMap, setCategoriesMap] = React.useState<Map<string, string>>(new Map());

  React.useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        setCategoriesMap(new Map());
        const { apiFetch } = await import("../../utility/apiClient");
        const res: any = await apiFetch("/api/v1/expense-categories/?pageSize=200");
        const data: any[] = res?.data?.results ?? res?.results ?? [];
        if (!cancelled && Array.isArray(data)) {
          const m = new Map<string, string>();
          data.forEach((c: any) => {
            if (c.id && c.name) m.set(String(c.id), c.name);
          });
          setCategoriesMap(m);
        }
      } catch (e) {
        console.error("Failed to load categories", e);
      }
    };
    loadCategories();
    return () => { cancelled = true; };
  }, [branchKey, reloadTick]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setEmployees([]);
        const emps = await fetchEmployees();
        if (!cancelled) setEmployees(emps);
      } catch {
        // ignore
      }
    };
    load();
    return () => { cancelled = true; };
  }, [branchKey, reloadTick]);



  const employeeNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) {
      m.set(e.id, e.full_name);
    }
    return m;
  }, [employees]);

  React.useEffect(() => {
    if (!selectedMonth) {
      setMonthlySummary(null);
      setSummaryError(null);
      setSummaryLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadSummary = async () => {
      try {
        setSummaryLoading(true);
        setSummaryError(null);
        const res = await getExpensesMonthlyReport(selectedMonth, selectedBranch?.id ?? undefined, undefined, controller.signal);
        if (cancelled) return;
        const totals = res?.data?.totals;
        const totalExpenses = Number(totals?.totalExpenses ?? 0);
        const payrollExpenses = Number(totals?.payrollExpenses ?? 0);
        const advanceExpenses = Number(totals?.advanceExpenses ?? 0);
        const operationalExpenses = Number(totals?.operationalExpenses ?? 0);
        const rawOtherExpenses =
          totals && "otherExpenses" in totals
            ? Number((totals as { otherExpenses?: number }).otherExpenses ?? 0)
            : Number.NaN;
        const otherExpenses = Number.isFinite(rawOtherExpenses)
          ? rawOtherExpenses
          : Math.max(0, totalExpenses - payrollExpenses - advanceExpenses - operationalExpenses);

        setMonthlySummary({
          totalExpenses,
          payrollExpenses,
          advanceExpenses,
          operationalExpenses,
          otherExpenses,
          cashExpenses: Number(totals?.cashExpenses ?? 0),
          cashlessExpenses: Number(totals?.cashlessExpenses ?? 0),
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Не удалось загрузить итог по расходам";
        setSummaryError(message);
        setMonthlySummary(null);
        notify?.({ type: "error", message });
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    loadSummary();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [notify, reloadTick, selectedBranch?.id, selectedMonth]);

  const isPayrollExpense = React.useCallback((expense: Expense) => {
    return requiresAffectsMonth(expense.kind);
  }, []);

  const getExpensePeriodDate = React.useCallback((expense: Expense) => {
    if (isPayrollExpense(expense) && expense.affects_month) {
      return `${expense.affects_month}-01`;
    }
    return expense.created_at || null;
  }, [isPayrollExpense]);

  const getExpensePeriodYear = React.useCallback((expense: Expense) => {
    const periodDate = getExpensePeriodDate(expense);
    return periodDate ? dayjs(periodDate).format("YYYY") : null;
  }, [getExpensePeriodDate]);

  const getExpensePeriodMonth = React.useCallback((expense: Expense) => {
    const periodDate = getExpensePeriodDate(expense);
    return periodDate ? dayjs(periodDate).format("YYYY-MM") : null;
  }, [getExpensePeriodDate]);

  const getExpenseDayKey = React.useCallback((expense: Expense) => {
    const periodDate = getExpensePeriodDate(expense);
    return periodDate ? dayjs(periodDate).format("YYYY-MM-DD") : null;
  }, [getExpensePeriodDate]);

  const getExpenseSortValue = React.useCallback((expense: Expense) => {
    const periodDate = getExpensePeriodDate(expense);
    return periodDate ? dayjs(periodDate).valueOf() : 0;
  }, [getExpensePeriodDate]);

  const getExpenseDisplayDayLabel = React.useCallback((expense: Expense) => {
    if (isPayrollExpense(expense) && expense.affects_month) {
      return `Месяц учета: ${dayjs(`${expense.affects_month}-01`).format("MM.YYYY")}`;
    }
    const periodDate = getExpensePeriodDate(expense);
    return periodDate ? formatDateRu(periodDate) : "Без даты";
  }, [getExpensePeriodDate, isPayrollExpense]);

  // Фильтрация расходов
  const filteredExpenses = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleExpenses.filter((r: Expense) => {
      if (q) {
        const name = (r.name ?? "").toLowerCase();
        const comment = (r.comment ?? "").toLowerCase();
        const catName = (categoriesMap.get(String(r.category_id)) ?? r.category ?? "").toLowerCase();
        const empName = (employeeNameById.get(r.employee_id ?? "") ?? "").toLowerCase();
        return name.includes(q) || comment.includes(q) || catName.includes(q) || empName.includes(q);
      }
      return true;
    }).filter((r: Expense) => {
      if (selectedCategoryId && String(r.category_id) !== selectedCategoryId) return false;
      if (selectedEmployeeId && r.employee_id !== selectedEmployeeId) return false;
      return true;
    });
  }, [visibleExpenses, searchQuery, employeeNameById, categoriesMap, selectedCategoryId, selectedEmployeeId]);

  const fallbackMonths = React.useMemo(() => {
    const months = new Set<string>();
    for (const exp of visibleExpenses) {
      const month = getExpensePeriodMonth(exp);
      if (month) months.add(month);
    }
    return months;
  }, [getExpensePeriodMonth, visibleExpenses]);

  const expenseMonthsSource = availableExpenseMonths ?? fallbackMonths;

  React.useEffect(() => {
    if (expenseMonthsSource.size === 0) return;
    if (selectedMonth && expenseMonthsSource.has(selectedMonth)) return;

    const todayMonth = dayjs().format("YYYY-MM");
    const fallbackMonth = expenseMonthsSource.has(todayMonth)
      ? todayMonth
      : Array.from(expenseMonthsSource).sort((a, b) => a.localeCompare(b)).at(-1);

    if (fallbackMonth) {
      setSelectedYear(fallbackMonth.slice(0, 4));
      setSelectedMonth(fallbackMonth);
      setSelectedDate(null);
    }
  }, [expenseMonthsSource, selectedMonth]);

  // Получаем список годов из доступных месяцев, чтобы навигация не зависела от текущего списка.
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    expenseMonthsSource.forEach((monthKey) => {
      years.add(monthKey.slice(0, 4));
    });
    if (selectedMonth) {
      years.add(selectedMonth.slice(0, 4));
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [expenseMonthsSource, selectedMonth]);

  type MonthOption = {
    value: string;
    monthIndex: number;
  };

  const availableMonths = React.useMemo<MonthOption[]>(() => {
    if (!selectedYear) return [];

    const monthMap = new Map<string, number>();
    const currentYear = new Date().getFullYear().toString();
    if (selectedYear === currentYear) {
      const currentMonthIndex = new Date().getMonth();
      const currentMonthKey = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}`;
      monthMap.set(currentMonthKey, currentMonthIndex);
    }

    expenseMonthsSource.forEach((monthKey) => {
      if (!monthKey.startsWith(`${selectedYear}-`)) return;
      const monthIndex = Number(monthKey.slice(5, 7)) - 1;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, monthIndex);
      }
    });

    if (selectedMonth?.startsWith(`${selectedYear}-`)) {
      monthMap.set(selectedMonth, Number(selectedMonth.slice(5, 7)) - 1);
    }

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, monthIndex]) => ({ value, monthIndex }));
  }, [expenseMonthsSource, selectedMonth, selectedYear]);



  // Получаем расходы для выбранной даты и сотрудника
  const periodFilteredExpenses = React.useMemo(() => {
    let result = filteredExpenses;

    if (selectedYear || selectedMonth || selectedDate || selectedEmployeeFilter) {
      result = filteredExpenses.filter((exp) => {
        if (selectedEmployeeFilter) {
          const empName = employeeNameById.get(exp.employee_id ?? "") || "Неизвестно";
          if (empName !== selectedEmployeeFilter) return false;
        }

        const year = getExpensePeriodYear(exp);
        if (!year) return false;

        if (selectedYear && year !== selectedYear) return false;

        if (selectedMonth) {
          const yearMonth = getExpensePeriodMonth(exp);
          if (yearMonth !== selectedMonth) return false;

          if (selectedDate) {
            const fullDate = getExpenseDayKey(exp);
            if (fullDate !== selectedDate) return false;
          }
        }

        return true;
      });
    }

    // Сортируем по дате (новые сверху)
    return [...result].sort((a, b) => getExpenseSortValue(b) - getExpenseSortValue(a));
  }, [filteredExpenses, selectedYear, selectedMonth, selectedDate, selectedEmployeeFilter, employeeNameById, getExpenseDayKey, getExpensePeriodMonth, getExpensePeriodYear, getExpenseSortValue]);

  // Группировка по сотруднику -> дням (для отображения списка подразделов в левой панели)
  const groupedByEmployee = React.useMemo(() => {
    // Группируем по году и месяцу (не учитываем selectedDate для списка дней)
    const expensesForDayList = filteredExpenses.filter((exp) => {
      const year = getExpensePeriodYear(exp);
      if (!year) return false;

      if (selectedYear && year !== selectedYear) return false;

      if (selectedMonth) {
        const yearMonth = getExpensePeriodMonth(exp);
        if (yearMonth !== selectedMonth) return false;
      }

      return true;
    });

    const empMap = new Map<string, { employeeName: string, total: number, count: number, days: Map<string, { count: number, total: number, label: string }> }>();

    for (const exp of expensesForDayList) {
      const dayKey = getExpenseDayKey(exp);
      if (!dayKey) continue;

      const empName = employeeNameById.get(exp.employee_id ?? "") || "Неизвестно";

      if (!empMap.has(empName)) {
        empMap.set(empName, { employeeName: empName, total: 0, count: 0, days: new Map() });
      }

      const empData = empMap.get(empName)!;
      empData.count++;
      empData.total += exp.total_amount ?? 0;

      if (!empData.days.has(dayKey)) {
        empData.days.set(dayKey, { count: 0, total: 0, label: getExpenseDisplayDayLabel(exp) });
      }

      const dayInfo = empData.days.get(dayKey)!;
      dayInfo.count++;
      dayInfo.total += exp.total_amount ?? 0;
    }

    return Array.from(empMap.values()).map(emp => ({
      employeeName: emp.employeeName,
      count: emp.count,
      total: emp.total,
      days: Array.from(emp.days.entries())
        .sort((a, b) => b[0].localeCompare(a[0])) // Descending dates
        .map(([date, info]) => ({ date, count: info.count, total: info.total, label: info.label }))
    })).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [filteredExpenses, selectedYear, selectedMonth, employeeNameById, getExpenseDayKey, getExpenseDisplayDayLabel, getExpensePeriodMonth, getExpensePeriodYear]);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const categoriesScrollRef = React.useRef<HTMLDivElement>(null);
  const isDragging = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);

  const handleMouseDown = (containerRef: React.RefObject<HTMLDivElement>) => (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeft.current = containerRef.current.scrollLeft;
    containerRef.current.style.cursor = 'grabbing';
    containerRef.current.style.userSelect = 'none';
  };

  const handleMouseLeave = (containerRef: React.RefObject<HTMLDivElement>) => () => {
    if (!containerRef.current) return;
    isDragging.current = false;
    containerRef.current.style.cursor = 'grab';
  };

  const handleMouseUp = (containerRef: React.RefObject<HTMLDivElement>) => () => {
    if (!containerRef.current) return;
    isDragging.current = false;
    containerRef.current.style.cursor = 'grab';
  };

  const handleMouseMove = (containerRef: React.RefObject<HTMLDivElement>) => (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleWheel = (containerRef: React.RefObject<HTMLDivElement>) => (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    if (e.deltaY !== 0) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  // Модалки
  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const handleEdit = (exp: Expense) => {
    setSelectedExpense(exp);
    setEditOpen(true);
  };

  const handleDelete = (exp: Expense) => {
    setSelectedExpense(exp);
    setDeleteOpen(true);
  };

  // Детальная панель
  const [employeeFullName, setEmployeeFullName] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedExpense(null);
    setEmployeeFullName(null);
    setEditOpen(false);
    setDeleteOpen(false);
    setExpandedEmployee(null);
  }, [branchKey]);

  const handleExpenseClick = async (exp: Expense) => {
    setSelectedExpense(exp);
    setEmployeeFullName(null);
    if (exp.employee_id) {
      try {
        const { apiFetch } = await import("../../utility/apiClient");
        const res: any = await apiFetch(`/api/v1/employees/${exp.employee_id}/`);
        const data = res?.data ?? res;
        const nm = data ? getNameFrom(data as Record<string, unknown>) : null;
        if (nm) setEmployeeFullName(nm);
      } catch {
        // ignore
      }
    }
  };

  // Компонент детальной карточки
  const ExpenseDetailCard = ({ expense }: { expense: Expense | null }) => {
    if (!expense) {
      return (
        <Box
          sx={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1,
            color: "text.secondary",
          }}
        >
          <Typography>Выберите расход для просмотра</Typography>
        </Box>
      );
    }

    const empName = employeeFullName || employeeNameById.get(expense.employee_id ?? "") || "-";

    return (
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Кнопки управления - в самом верху как в AppointmentDetailsCard */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            {canEditExpense && (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditOutlined />}
                  onClick={() => handleEdit(expense)}
                >
                  Изменить
                </Button>
              </Stack>
            )}

            {canDelete && (
              <Tooltip title="Удалить">
                <span>
                  <IconButton
                    size="small"
                    disabled={!canDelete}
                    onClick={() => handleDelete(expense)}
                    sx={{
                      border: '1px solid',
                      borderColor: 'error.main',
                      color: 'error.main',
                      '&:hover': {
                        borderColor: 'error.dark',
                        backgroundColor: 'rgba(211, 47, 47, 0.08)',
                      },
                      '&.Mui-disabled': {
                        borderColor: 'action.disabled',
                        color: 'action.disabled',
                      },
                    }}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        </Box>

        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 2.5,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        >
          <Stack spacing={2.5}>
            {/* Название расхода */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                {expense.name}
              </Typography>
            </Box>

            {/* Детали (Дата, Категория, Сотрудник) */}
            <Stack spacing={1.5} sx={{ bgcolor: "background.paper", borderRadius: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Дата и время</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {expense.created_at
                    ? `${formatDateRu(expense.created_at)}, ${new Date(expense.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
                    : "—"}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Категория</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {categoriesMap.get(String(expense.category_id)) || expense.category || "—"}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Вид расхода</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {expense.kind === "payroll"
                    ? "Зарплата"
                    : expense.kind === "advance"
                      ? "Аванс"
                      : expense.kind === "operational"
                        ? "Операционный"
                        : expense.kind === "other"
                          ? "Другое"
                          : "—"}
                </Typography>
              </Box>

              {expense.affects_month && (
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Месяц учета</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {dayjs(`${expense.affects_month}-01`).format("MM.YYYY")}
                  </Typography>
                </Box>
              )}

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Сотрудник</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>
                  {empName}
                </Typography>
              </Box>

              {expense.branch?.name && (
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Филиал</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {expense.branch.name}
                  </Typography>
                </Box>
              )}
            </Stack>

            {/* Payment Information */}
            <PaymentInfoBlock
              payment={{
                baseTotal: expense.total_amount ?? 0,
                cash: expense.cash_amount ?? 0,
                card: expense.cashless_amount ?? 0,
                finalTotal: expense.total_amount ?? 0,
                debt: 0,
              }}
              variant="detailed"
              showIcons={true}
            />
            {expense.photo && (
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  bgcolor: (theme) => theme.palette.action.hover,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <img
                  src={expense.photo as string}
                  alt={expense.name}
                  style={{
                    maxWidth: "100%",
                    maxHeight: 400,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </Box>
            )}

            {/* Комментарий */}
            {expense.comment && (
              <>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Комментарий
                  </Typography>
                  <Typography variant="body2">{expense.comment}</Typography>
                </Box>
              </>
            )}
          </Stack>
        </Box>
      </Paper>
    );
  };

  return (
    <Box
      sx={{
        minHeight: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: { xs: "visible", lg: "hidden" },
      }}
    >
      {/* ШАПКА */}
      <PageHeader
        title="Расходы"
        showTitle={false}
        addButtonText={hasManageExpenses ? "Добавить расход" : undefined}
        onAdd={hasManageExpenses ? () => setAddOpen(true) : undefined}
        showSearch
        searchVal={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Поиск..."
        actions={
          <TextField
            select
            size="small"
            value={selectedCategoryId ?? ""}
            onChange={(e) => setSelectedCategoryId(e.target.value || null)}
            sx={{ minWidth: 180 }}
            SelectProps={{
              displayEmpty: true,
              renderValue: (val) => {
                if (!val) return "Все категории";
                return categoriesMap.get(val as string) ?? "Все категории";
              },
            }}
          >
            <MenuItem value="">Все категории</MenuItem>
            {Array.from(categoriesMap.entries()).map(([id, name]) => (
              <MenuItem key={id} value={id}>{name}</MenuItem>
            ))}
          </TextField>
        }
      />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          pb: theme.appLayout.page.paddingY,
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <Box
          sx={(theme) => ({
            px: theme.appLayout.page.paddingX,
            mb: 2,
          })}
        >
          <Stack spacing={2}>
            {isScopeLoading && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  borderColor: "primary.main",
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                }}
              >
                <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                  Загружаем расходы выбранного филиала...
                </Typography>
              </Paper>
            )}
            {loadError && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  borderColor: "error.main",
                  bgcolor: alpha(theme.palette.error.main, 0.05),
                }}
              >
                <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                  Не удалось загрузить список расходов: {loadError}
                </Typography>
              </Paper>
            )}
          </Stack>
        </Box>

        <Box
          sx={(theme) => ({
            px: theme.appLayout.page.paddingX,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          })}
        >
          {/* ГРИД С КОЛОНКАМИ (3 колонки вместо 2) */}
          <Grid2 container spacing={2} sx={{ flex: 1, minHeight: 0 }}>

            {/* ЛЕВАЯ КОЛОННА (Фильтр периода) */}
            <Grid2
              size={{ xs: 12, md: 3 }}
              sx={(theme: Theme) => ({
                position: { md: "sticky" },
                top: { md: theme.spacing(2) },
                alignSelf: "flex-start",
                height: {
                  xs: "auto",
                  md: `calc(100dvh - 176px)`,
                },
                display: "flex",
                flexDirection: "column",
                overflow: { xs: "visible", md: "hidden" },
              })}
            >
              <Paper
                elevation={0}
                variant="outlined"
                sx={{
                  height: { xs: "auto", md: "100%" },
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Период
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedYear(null);
                      setSelectedMonth(null);
                      setSelectedDate(null);
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    Все расходы
                  </Button>
                </Box>

                <Box sx={{ overflowY: "auto", flex: 1, p: 2 }}>
                  <Stack spacing={2}>
                    {/* Фильтр по сотрудникам — только для категорий аванс/зарплата */}
                    {hasManageExpenses && employees.length > 0 && selectedCategoryId && requiresAffectsMonth(inferExpenseKindFromCategory(categoriesMap.get(selectedCategoryId) ?? null)) && (
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Сотрудник
                        </Typography>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={selectedEmployeeId ?? ""}
                          onChange={(event) => {
                            const empValue = event.target.value;
                            setSelectedEmployeeId(typeof empValue === "string" && empValue.length > 0 ? empValue : null);
                          }}
                          SelectProps={{ displayEmpty: true }}
                        >
                          <MenuItem value="">
                            <Typography variant="body2" color="text.secondary">
                              Все сотрудники
                            </Typography>
                          </MenuItem>
                          {employees.sort((a, b) => a.full_name.localeCompare(b.full_name)).map((emp) => (
                            <MenuItem key={emp.id} value={emp.id}>
                              {emp.full_name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                    )}

                    <Divider sx={{ my: 1 }} />

                    {/* Dropdown выбора года */}
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Год
                      </Typography>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={selectedYear ?? ""}
                        onChange={(event) => {
                          const yearValue = event.target.value;
                          const nextYear = typeof yearValue === "string" && yearValue.length > 0 ? yearValue : null;
                          setSelectedYear(nextYear);
                          setSelectedMonth(null);
                          setSelectedDate(null);
                        }}
                        SelectProps={{ displayEmpty: true }}
                      >
                        <MenuItem value="">
                          <Typography variant="body2" color="text.secondary">
                            Все годы
                          </Typography>
                        </MenuItem>
                        {availableYears.map((year) => (
                          <MenuItem key={year} value={year}>
                            {year}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>

                    {/* Dropdown выбора месяца (показываем только если выбран год) */}
                    {selectedYear && (
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Месяц
                        </Typography>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={selectedMonth ?? ""}
                          onChange={(event) => {
                            const monthValue = event.target.value;
                            const nextMonth = typeof monthValue === "string" && monthValue.length > 0 ? monthValue : null;
                            setSelectedMonth(nextMonth);
                            setSelectedDate(null);
                          }}
                          SelectProps={{ displayEmpty: true }}
                          disabled={availableMonths.length === 0}
                        >
                          <MenuItem value="">
                            <Typography variant="body2" color="text.secondary">
                              Все месяцы
                            </Typography>
                          </MenuItem>
                          {availableMonths.map((month) => (
                            <MenuItem key={month.value} value={month.value}>
                              {MONTH_NAMES[month.monthIndex]}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                    )}

                    {selectedMonth && (
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                          Итого за месяц
                        </Typography>
                        {summaryLoading ? (
                          <Typography variant="body2" color="text.secondary">
                            Загрузка...
                          </Typography>
                        ) : summaryError ? (
                          <Typography variant="body2" color="error.main">
                            {summaryError}
                          </Typography>
                        ) : monthlySummary ? (
                          <Stack spacing={0.75}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <AccountBalanceWalletOutlined sx={{ color: 'primary.main', fontSize: 20 }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                {formatKGS(monthlySummary.totalExpenses)}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              Зарплата: {formatKGS(monthlySummary.payrollExpenses)} • Авансы: {formatKGS(monthlySummary.advanceExpenses)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Операционные: {formatKGS(monthlySummary.operationalExpenses)} • Прочие: {formatKGS(monthlySummary.otherExpenses)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Наличные: {formatKGS(monthlySummary.cashExpenses)} • Безнал: {formatKGS(monthlySummary.cashlessExpenses)}
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Нет данных за выбранный месяц
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Список сотрудников и дней */}
                    {selectedMonth && (
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Сотрудники
                        </Typography>
                        <List dense sx={{ py: 0 }}>
                          {groupedByEmployee.map((emp) => {
                            const isExpanded = expandedEmployee === emp.employeeName;
                            const isSelected = selectedEmployeeFilter === emp.employeeName;

                            return (
                              <React.Fragment key={emp.employeeName}>
                                <ListItemButton
                                  selected={isSelected}
                                  onClick={() => {
                                    if (isExpanded) {
                                      setExpandedEmployee(null);
                                      setSelectedEmployeeFilter(null);
                                      setSelectedDate(null);
                                    } else {
                                      setExpandedEmployee(emp.employeeName);
                                      setSelectedEmployeeFilter(emp.employeeName);
                                      setSelectedDate(null);
                                    }
                                  }}
                                  sx={{ borderRadius: 1, mb: 0.5, pr: 1 }}
                                >
                                  <Typography variant="body2" sx={{ flex: 1, fontWeight: isSelected ? 600 : 400 }}>
                                    {emp.employeeName}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>
                                    {formatKGS(emp.total)}
                                  </Typography>
                                  {isExpanded ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
                                </ListItemButton>

                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                  <List dense disablePadding>
                                    {emp.days.map((day) => (
                                      <ListItemButton
                                        key={day.date}
                                        sx={{
                                          borderRadius: 1,
                                          mb: 0.5,
                                          pl: 3,
                                          bgcolor: selectedDate === day.date ? "action.selected" : "transparent",
                                        }}
                                        onClick={() => {
                                          setSelectedEmployeeFilter(emp.employeeName);
                                          setSelectedDate(day.date);
                                        }}
                                      >
                                        <Typography variant="body2" sx={{ flex: 1, color: "text.secondary" }}>
                                          {day.label}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {formatKGS(day.total)}
                                        </Typography>
                                      </ListItemButton>
                                    ))}
                                  </List>
                                </Collapse>
                              </React.Fragment>
                            );
                          })}
                        </List>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              </Paper>
            </Grid2>

            {/* СРЕДНЯЯ КОЛОННА (Список расходов) */}
            <Grid2
              size={{ xs: 12, md: 4 }}
              sx={(theme: Theme) => ({
                position: { md: "sticky" },
                top: { md: theme.spacing(2) },
                alignSelf: "flex-start",
                height: {
                  xs: "auto",
                  md: `calc(100dvh - 176px)`,
                },
                display: "flex",
                flexDirection: "column",
                overflow: { xs: "visible", md: "hidden" },
              })}
            >
              <Paper
                elevation={0}
                variant="outlined"
                sx={{
                  height: { xs: "auto", md: "100%" },
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Список расходов ({periodFilteredExpenses.length})
                  </Typography>
                </Box>
                <Box sx={{ overflowY: "auto", flex: 1 }}>
                  {periodFilteredExpenses.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        Нет расходов
                      </Typography>
                    </Box>
                  ) : (
                    <List sx={{ py: 0 }}>
                      {(() => {
                        let currentDayStr = "";

                        return periodFilteredExpenses.map((exp) => {
                          const hasCash = (exp.cash_amount ?? 0) > 0;
                          const hasCashless = (exp.cashless_amount ?? 0) > 0;
                          const dayStr = getExpenseDisplayDayLabel(exp);

                          const isNewDay = dayStr !== currentDayStr;
                          if (isNewDay) currentDayStr = dayStr;

                          return (
                            <React.Fragment key={exp.id}>
                              {isNewDay && (
                                <Box
                                  sx={{
                                    px: 2,
                                    py: 1,
                                    bgcolor: "background.default",
                                    borderBottom: 1,
                                    borderColor: "divider",
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 1,
                                  }}
                                >
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                                    {dayStr}
                                  </Typography>
                                </Box>
                              )}
                              <ListItemButton
                                sx={{
                                  px: 2,
                                  py: 1.5,
                                  bgcolor: visibleSelectedExpense?.id === exp.id ? "action.selected" : "transparent",
                                  "&:hover": { bgcolor: "action.hover" },
                                  borderBottom: 1,
                                  borderColor: "divider",
                                }}
                                onClick={() => handleExpenseClick(exp)}
                              >
                                <Avatar
                                  variant="rounded"
                                  src={exp.photo ? (exp.photo as string) : undefined}
                                  sx={{ mr: 2, width: 40, height: 40, bgcolor: "action.selected", color: "text.secondary" }}
                                >
                                  <ReceiptLongOutlined />
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body1" sx={{ fontWeight: 500 }} noWrap>
                                    {exp.name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" noWrap>
                                    {categoriesMap.get(String(exp.category_id)) || exp.category}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  {/* Иконки оплаты */}
                                  {hasCash && (
                                    <Tooltip title="Наличные">
                                      <AccountBalanceWalletOutlined sx={{ fontSize: 16, color: 'success.main' }} />
                                    </Tooltip>
                                  )}
                                  {hasCashless && (
                                    <Tooltip title="Безнал">
                                      <CreditCardOutlined sx={{ fontSize: 16, color: 'info.main' }} />
                                    </Tooltip>
                                  )}
                                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {formatKGS(exp.total_amount ?? 0)}
                                  </Typography>
                                </Stack>
                              </ListItemButton>
                            </React.Fragment>
                          );
                        });
                      })()}
                    </List>
                  )}
                </Box>
              </Paper>
            </Grid2>

            {/* ПРАВАЯ КОЛОННА (Карточка деталей) - Скрыта на мобильных */}
            {!isMobile && (
              <Grid2
                size={{ xs: 12, md: 5 }}
                sx={(theme: Theme) => ({
                  position: { md: "sticky" },
                  top: { md: theme.spacing(2) },
                  alignSelf: "flex-start",
                  height: {
                    md: `calc(100dvh - 176px)`,
                  },
                  display: "flex",
                  flexDirection: "column",
                  overflow: { xs: "visible", md: "hidden" },
                })}
              >
                <Box
                  sx={{
                    height: "100%",
                    overflowY: "auto",
                    pr: 0.5,
                    '&::-webkit-scrollbar': { width: 8 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                      bgcolor: 'divider',
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.disabled' }
                    },
                  }}
                >
                  <ExpenseDetailCard expense={visibleSelectedExpense} />
                </Box>
              </Grid2>
            )}
          </Grid2>
        </Box>

        {/* BOTTOM SHEET (Мобильная карточка) */}
        {isMobile && (
          <AppBottomSheet
            open={Boolean(visibleSelectedExpense)}
            onClose={() => setSelectedExpense(null)}
          >
            <Box sx={{ p: 2 }}>
              <ExpenseDetailCard expense={visibleSelectedExpense} />
            </Box>
          </AppBottomSheet>
        )}

        {/* ДИАЛОГИ ДЕЙСТВИЙ */}
        <AddExpenseDrawer
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={(rec) => {
            setExpensesScopeKey(branchKey);
            setExpenses((prev) => [rec, ...prev].sort((a, b) => getExpenseSortValue(b) - getExpenseSortValue(a)));
            setReloadTick((prev) => prev + 1);
          }}
        />

        {visibleSelectedExpense && (
          <EditExpenseDrawer
            open={editOpen}
            onClose={() => setEditOpen(false)}
            record={visibleSelectedExpense}
            onUpdated={(rec) => {
              setExpensesScopeKey(branchKey);
              setSelectedExpense(rec);
              setExpenses((prev) => prev.map((e) => (e.id === rec.id ? rec : e)));
              setReloadTick((prev) => prev + 1);
            }}
          />
        )}

        <DeleteExpenseDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          record={visibleSelectedExpense}
          onDeleted={(id) => {
            setExpensesScopeKey(branchKey);
            setSelectedExpense(null);
            setExpenses((prev) => prev.filter((e) => e.id !== id));
            setReloadTick((prev) => prev + 1);
          }}
        />
      </Box>
    </Box>
  );
};

export default ExpensesListPage;

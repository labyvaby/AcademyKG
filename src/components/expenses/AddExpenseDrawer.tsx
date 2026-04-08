import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  Autocomplete,
  CardContent,
  Avatar,
  Paper,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import { useNotification } from "@refinedev/core";
import { ExpensesService } from "../../services/expenses";
import { apiFetch } from "../../utility/apiClient";
import {
  inferExpenseKindFromCategory,
  requiresAffectsMonth,
  type Expense,
  type ExpenseFormValues,
} from "../../pages/expenses/types";
import { AppCard, CustomDateTimePicker } from "../ui";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useEmployees } from "../../hooks/useEmployees";
// import { fetchEmployees } from "../../services/employees"; // Import fetcher
import { roundDateTimeLocalToStep } from "../../utility/time";

type AddExpenseDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (record: Expense) => void;
};

const defaultValues: ExpenseFormValues = {
  employee_id: null,
  name: "",
  cash_amount: 0,
  cashless_amount: 0,
  total_amount: 0,
  comment: "",
  category: "",
  category_id: null,
  photo: null,
  photoFile: null,
  kind: null,
  affects_month: null,
};

type ExpenseCategory = {
  id: string;
  name: string;
  kind?: "payroll" | "advance" | "operational" | "other" | null;
};

export const AddExpenseDrawer: React.FC<AddExpenseDrawerProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const { open: notify } = useNotification();
  const [values, setValues] = React.useState<ExpenseFormValues>(defaultValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = React.useState(false);

  // const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  // const [loadingEmployees, setLoadingEmployees] = React.useState(false);

  const { employees, loading: loadingEmployees } = useEmployees(open);

  const [expenseDate, setExpenseDate] = React.useState<string>("");

  // Custom Expenses Service - ExpensesService is already imported at the top.

  React.useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const res: any = await apiFetch("/api/v1/expense-categories/?pageSize=200");
        const data = res?.data?.results ?? res?.results ?? [];
        if (Array.isArray(data)) {
          setCategories(
            data.map((c: any) => ({
              id: String(c.id),
              name: c.name,
              kind: c.kind ?? null,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching expense categories:", error);
        notify?.({
          type: "error",
          message: "Не удалось загрузить категории расходов",
        });
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [notify]);

  // Load employees - Handled by useEmployees hook
  // React.useEffect(() => {
  //   const loadEmps = async () => { ... }
  // }, []);

  const selectedCategory = React.useMemo(
    () => categories.find((category) => category.id === values.category_id) ?? values.category ?? null,
    [categories, values.category, values.category_id],
  );
  const inferredKind = React.useMemo(
    () => inferExpenseKindFromCategory(selectedCategory),
    [selectedCategory],
  );
  const payrollLike = requiresAffectsMonth(inferredKind);

  // Scehdule reset
  React.useEffect(() => {
    if (!open) {
      setValues(defaultValues);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setBusy(false);
      setTouched(false);
      // Initialize date to now
      const nowStr = dayjs().format("YYYY-MM-DDTHH:mm");
      setExpenseDate(roundDateTimeLocalToStep(nowStr, 15));
    }
  }, [open, previewUrl]);

  const handleFileChange = (file: File | null) => {
    setValues((s) => ({ ...s, photoFile: file }));
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const computeTotal = () => {
    return (values.cash_amount || 0) + (values.cashless_amount || 0);
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!values.name.trim()) {
      notify?.({ type: "error", message: "Название расхода обязательно" });
      return;
    }

    if (payrollLike && !values.affects_month) {
      notify?.({ type: "error", message: "Для зарплаты и аванса нужно указать месяц учета" });
      return;
    }

    setBusy(true);

    try {
      const createdAtDate = expenseDate ? dayjs(expenseDate) : dayjs();

      const payload = {
        employee_id: payrollLike ? values.employee_id || null : null,
        name: values.name.trim(),
        cash_amount: Number(values.cash_amount) || 0,
        cashless_amount: Number(values.cashless_amount) || 0,
        total_amount: computeTotal(),
        comment: values.comment?.trim() || null,
        category: values.category?.trim() || null,
        category_id: values.category_id || null,
        photo: values.photoFile,
        created_at: createdAtDate.toISOString(),
        affects_month: payrollLike ? values.affects_month || null : null,
      };

      const created = await ExpensesService.create(payload);

      if (created && onCreated) onCreated(created);
      notify?.({ type: "success", message: "Расход добавлен" });
      onClose();
    } catch (e: unknown) {
      console.error("Create expense failed:", e);
      notify?.({ type: "error", message: "Не удалось создать расход" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{ sx: { width: { xs: 320, sm: 480, md: 520 }, maxWidth: "100vw", display: "flex", flexDirection: "column" } }}
    >
      <Box sx={{ width: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
          }}
        >
          <Typography variant="h6">Добавить расход</Typography>
          <IconButton onClick={busy ? undefined : onClose} aria-label="Закрыть">
            <CloseOutlined />
          </IconButton>
        </Box>
        <Divider />
        <Box
          sx={{
            p: 2,
            flex: 1,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        >
          <Stack spacing={3}>
            <Stack spacing={2}>
              {/* Категория */}
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Фото расхода
                </Typography>
                <AppCard variant="outlined" sx={{ borderStyle: "dashed" }} disableContentPadding>
                  <CardContent
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      py: 2,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      const el = document.getElementById("expense-photo-input") as HTMLInputElement | null;
                      el?.click();
                    }}
                  >
                    <Avatar
                      variant="rounded"
                      src={previewUrl || undefined}
                      sx={{ width: 48, height: 48 }}
                    >
                      <PhotoCameraOutlined />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">
                        {values.photoFile
                          ? values.photoFile.name
                          : "Нажмите для выбора изображения"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        JPG, PNG. Необязательно.
                      </Typography>
                    </Box>
                    <input
                      id="expense-photo-input"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        handleFileChange(f);
                      }}
                    />
                  </CardContent>
                </AppCard>
              </Stack>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Дата расхода
                </Typography>
                <CustomDateTimePicker
                  value={expenseDate ? dayjs(expenseDate) : null}
                  onChange={(val) => setExpenseDate(val ? val.format() : '')}
                  ampm={false}
                  minutesStep={15}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      InputLabelProps: { shrink: true }
                    }
                  }}
                />
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Название *
                </Typography>
                <TextField
                  value={values.name}
                  onChange={(e) => setValues((s) => ({ ...s, name: e.target.value }))}
                  fullWidth
                  autoFocus
                  placeholder="Введите название расхода"
                  error={touched && !values.name.trim()}
                  helperText={touched && !values.name.trim() ? "Обязательное поле" : ""}
                />
              </Stack>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Категория
              </Typography>
              <Autocomplete
                options={categories}
                loading={loadingCategories}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={
                  categories.find((c) => c.id === values.category_id) || null
                }
                onChange={(_, newValue) => {
                  const newCategory = newValue?.name || "";
                  const nextKind = inferExpenseKindFromCategory(newValue ?? newCategory);
                  const emp = employees.find((e) => e.id === values.employee_id);
                  const empName = emp?.full_name || "";

                  setValues((s) => ({
                    ...s,
                    category_id: newValue?.id || null,
                    category: newCategory,
                    employee_id: requiresAffectsMonth(nextKind) ? s.employee_id : null,
                    affects_month: requiresAffectsMonth(nextKind) ? s.affects_month : null,
                    name: !s.name.trim() && requiresAffectsMonth(nextKind) && newCategory && empName
                      ? `${newCategory} - ${empName}`
                      : s.name,
                  }));
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Выберите категорию" fullWidth />
                )}
                loadingText="Загрузка категорий..."
                noOptionsText={loadingCategories ? "Загрузка..." : "Нет категорий"}
              />
            </Stack>

            {payrollLike && (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Сотрудник
                </Typography>
                <Autocomplete
                  options={employees}
                  loading={loadingEmployees}
                  getOptionLabel={(option) => option.specialization ? `${option.full_name} — ${option.specialization}` : option.full_name || ""}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={employees.find((e) => e.id === values.employee_id) || null}
                  onChange={(_, newValue) => {
                    const empName = newValue?.full_name || "";
                    setValues((s) => ({
                      ...s,
                      employee_id: newValue?.id || null,
                      name: !s.name.trim() && s.category && empName
                        ? `${s.category} - ${empName}`
                        : s.name,
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Выберите сотрудника"
                      fullWidth
                      helperText="Выберите сотрудника, к которому относится аванс или заработная плата"
                    />
                  )}
                  noOptionsText="Нет сотрудников"
                />
              </Stack>
            )}

            {payrollLike && (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Месяц учета *
                </Typography>
                <TextField
                  type="month"
                  fullWidth
                  value={values.affects_month ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, affects_month: e.target.value || null }))}
                  error={touched && payrollLike && !values.affects_month}
                  helperText={touched && payrollLike && !values.affects_month ? "Укажите месяц в формате YYYY-MM" : "Месяц, к которому относится зарплата или аванс"}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            )}

            {/* Payment Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <Stack spacing={2}>
                {/* Наличные и Безналичные */}
                <Stack direction="row" spacing={2}>
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Наличные
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                      <Box px={1}><AccountBalanceWalletOutlined color="action" fontSize="small" /></Box>
                      <TextField
                        variant="standard"
                        fullWidth
                        type="number"
                        value={values.cash_amount || ""}
                        onChange={(e) => {
                          setValues((s) => ({
                            ...s,
                            cash_amount: Number(e.target.value) || 0,
                          }));
                        }}
                        InputProps={{ disableUnderline: true }}
                        sx={{
                          py: 0.5,
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                          '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                        }}
                        placeholder="0"
                      />
                    </Stack>
                  </Stack>

                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Безналичные
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                      <Box px={1}><CreditCardOutlined color="action" fontSize="small" /></Box>
                      <TextField
                        variant="standard"
                        fullWidth
                        type="number"
                        value={values.cashless_amount || ""}
                        onChange={(e) => {
                          setValues((s) => ({
                            ...s,
                            cashless_amount: Number(e.target.value) || 0,
                          }));
                        }}
                        InputProps={{ disableUnderline: true }}
                        sx={{
                          py: 0.5,
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                          '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                        }}
                        placeholder="0"
                      />
                    </Stack>
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1 }} />

                {/* Итого */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    ИТОГО
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KGS" }).format(computeTotal())}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Комментарий
              </Typography>
              <TextField
                value={values.comment || ""}
                onChange={(e) => setValues((s) => ({ ...s, comment: e.target.value }))}
                fullWidth
                multiline
                rows={3}
                placeholder="Добавьте комментарий (необязательно)"
              />
            </Stack>

          </Stack>
        </Box>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={busy}>
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={busy || !values.name.trim() || (payrollLike && !values.affects_month)}
            >
              {busy ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={18} />
                  <span>Сохранение…</span>
                </Stack>
              ) : (
                "Сохранить"
              )}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
};

export default AddExpenseDrawer;

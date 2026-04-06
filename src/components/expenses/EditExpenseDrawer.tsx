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
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import { useNotification } from "@refinedev/core";
import { apiFetch } from "../../utility/apiClient";
import { ExpensesService } from "../../services/expenses";
import {
  EXPENSE_KIND_OPTIONS,
  requiresAffectsMonth,
  type Expense,
  type ExpenseFormValues,
} from "../../pages/expenses/types";
import { AppCard, CustomDateTimePicker } from "../ui";
import { useEmployees } from "../../hooks/useEmployees";
import dayjs from "dayjs";

type EditExpenseDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: Expense;
  onUpdated?: (record: Expense) => void;
};

type ExpenseCategory = {
  id: string;
  name: string;
};

export const EditExpenseDrawer: React.FC<EditExpenseDrawerProps> = ({
  open,
  onClose,
  record,
  onUpdated,
}) => {
  const { open: notify } = useNotification();

  const initialValues: ExpenseFormValues = React.useMemo(
    () => ({
      employee_id: record.employee_id || null, // Keep existing ID if any, but won't edit
      name: record.name || "",
      cash_amount: record.cash_amount || 0,
      cashless_amount: record.cashless_amount || 0,
      total_amount: record.total_amount || 0,
      comment: record.comment || "",
      category: record.category || "",
      category_id: record.category_id || null,
      photo: record.photo || null,
      photoFile: null,
      kind: record.kind || null,
      created_at: record.created_at ? dayjs(record.created_at).format("YYYY-MM-DDTHH:mm") : dayjs().format("YYYY-MM-DDTHH:mm"),
      affects_month: record.affects_month ?? null,
    }),
    [record]
  );

  const [values, setValues] = React.useState<ExpenseFormValues>(initialValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const { employees, loading: loadingEmployees } = useEmployees(open);
  const payrollLike = requiresAffectsMonth(values.kind);

  // Refine hooks removed
  // const { mutateAsync: updateAsync } = useUpdate<Expense>();
  // 


  // Custom Expenses Service - Imported at top


  // Загрузка категорий при монтировании компонента
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res: any = await apiFetch("/api/v1/expense-categories/?pageSize=200");
        const data = res?.data?.results ?? res?.results ?? [];

        if (Array.isArray(data)) {
          const cats: ExpenseCategory[] = data.map((c: any) => ({
            id: String(c.id),
            name: c.name,
          }));
          if (!cancelled) {
            setCategories(cats);
          }
        }
      } catch (e) {
        console.error("Failed to load categories in EditExpenseDrawer", e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []); // Загружаем один раз при монтировании

  // Обновление значений при изменении record
  React.useEffect(() => {
    if (open) {
      setValues(initialValues);
      setTouched(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [open, initialValues, previewUrl]);

  const handleFileChange = (file: File | null) => {
    setValues((s) => ({ ...s, photoFile: file }));
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const computeTotal = () => {
    const cash = Number(values.cash_amount) || 0;
    const cashless = Number(values.cashless_amount) || 0;
    return cash + cashless;
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!values.name.trim()) {
      notify?.({ type: "error", message: "Введите название расхода" });
      return;
    }

    if (!values.kind) {
      notify?.({ type: "error", message: "Выберите вид расхода" });
      return;
    }

    if (payrollLike && !values.affects_month) {
      notify?.({ type: "error", message: "Для зарплаты и аванса нужно указать месяц учета" });
      return;
    }

    try {
      setBusy(true);

      const createdAtDate = values.created_at ? dayjs(values.created_at) : dayjs();

      const payload = {
        employee_id: values.employee_id || null,
        name: values.name.trim(),
        cash_amount: Number(values.cash_amount) || 0,
        cashless_amount: Number(values.cashless_amount) || 0,
        total_amount: computeTotal(),
        comment: values.comment?.trim() || null,
        category: values.category?.trim() || null,
        category_id: values.category_id || null,
        photo: values.photoFile || values.photo, // Pass File if selected, otherwise keep URL
        kind: values.kind,
        created_at: createdAtDate.toISOString(),
        affects_month: payrollLike ? values.affects_month || null : null,
      };

      const updated = await ExpensesService.update(record.id, payload);

      if (updated && onUpdated) onUpdated(updated);
      notify?.({ type: "success", message: "Расход обновлен" });
      onClose();
    } catch (e: unknown) {
      console.error("Update expense failed:", e);
      notify?.({ type: "error", message: "Не удалось обновить расход" });
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
          <Typography variant="h6">Редактировать расход</Typography>
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

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Дата и время
              </Typography>
              <CustomDateTimePicker
                value={values.created_at ? dayjs(values.created_at) : null}
                onChange={(val) => setValues((s) => ({ ...s, created_at: val ? val.format() : '' }))}
                ampm={false}
                format="DD.MM.YYYY HH:mm"
                slotProps={{
                  textField: {
                    fullWidth: true,
                    placeholder: "Укажите дату и время",
                  },
                }}
              />
            </Stack>

            {/* Photo Uploader */}
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
                    const el = document.getElementById("edit-expense-photo-input") as HTMLInputElement | null;
                    el?.click();
                  }}
                >
                  <Avatar
                    variant="rounded"
                    src={previewUrl || (typeof values.photo === 'string' ? values.photo : undefined)}
                    sx={{ width: 48, height: 48 }}
                  >
                    <PhotoCameraOutlined />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">
                      {values.photoFile
                        ? values.photoFile.name
                        : values.photo
                          ? "Изображение загружено"
                          : "Нажмите для выбора изображения"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      JPG, PNG. Необязательно.
                    </Typography>
                  </Box>
                  <input
                    id="edit-expense-photo-input"
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
                Вид расхода *
              </Typography>
              <TextField
                select
                fullWidth
                value={values.kind ?? ""}
                onChange={(e) => {
                  const nextKind = e.target.value || null;
                  const employeeName = employees.find((emp) => emp.id === values.employee_id)?.full_name || "";
                  const baseName = values.category?.trim() || values.name.trim();
                  setValues((s) => ({
                    ...s,
                    kind: nextKind as ExpenseFormValues["kind"],
                    affects_month: requiresAffectsMonth(nextKind as ExpenseFormValues["kind"])
                      ? s.affects_month
                      : null,
                    name: requiresAffectsMonth(nextKind as ExpenseFormValues["kind"]) && s.category && employeeName
                      ? `${s.category} - ${employeeName}`
                      : baseName,
                  }));
                }}
                error={touched && !values.kind}
                helperText={touched && !values.kind ? "Обязательное поле" : "Определяет серверную финансовую семантику"}
              >
                <MenuItem value="">
                  <Typography variant="body2" color="text.secondary">Выберите вид</Typography>
                </MenuItem>
                {EXPENSE_KIND_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Категория
              </Typography>
              <Autocomplete
                options={categories}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={
                  categories.find((c) => c.id === values.category_id) || null
                }
                onChange={(_, newValue) => {
                  const newCategory = newValue?.name || "";
                  const emp = employees.find((e) => e.id === values.employee_id);
                  const empName = emp?.full_name || "";

                  let newName = values.name;
                  if (newCategory) {
                    newName = payrollLike && empName ? `${newCategory} - ${empName}` : newCategory;
                  }

                  setValues((s) => ({
                    ...s,
                    category_id: newValue?.id || null,
                    category: newCategory,
                    name: newCategory ? newName : s.name
                  }));
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Выберите категорию" fullWidth />
                )}
                noOptionsText="Нет категорий"
              />
            </Stack>

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
                  let newName = values.name;
                  if (payrollLike && values.category && empName) {
                    newName = `${values.category} - ${empName}`;
                  }
                  setValues((s) => ({ ...s, employee_id: newValue?.id || null, name: newName }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Выберите сотрудника"
                    fullWidth
                    helperText={payrollLike ? "Для зарплаты и аванса обычно указывается сотрудник" : "Необязательное поле"}
                  />
                )}
                noOptionsText="Нет сотрудников"
              />
            </Stack>

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
              disabled={busy || !values.name.trim() || !values.kind || (payrollLike && !values.affects_month)}
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
    </Drawer >
  );
};

export default EditExpenseDrawer;

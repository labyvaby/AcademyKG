import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
  Avatar,
  CircularProgress,
} from "@mui/material";
import AppAutocomplete from "../../components/ui/AppAutocomplete";
import { useNotification } from "@refinedev/core";
import { fetchEmployees } from "../../services/employees";
import { apiFetch } from "../../utility/apiClient";
import { ExpensesService } from "../../services/expenses";
import type { Expense, ExpenseFormValues, EmployeesRow } from "../../pages/expenses/types";

type EditExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  record: Expense;
  onUpdated?: (record: Expense) => void;
};

type ExpenseCategory = {
  id: string;
  name: string;
};

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  open,
  onClose,
  record,
  onUpdated,
}) => {
  const initialValues: ExpenseFormValues = React.useMemo(
    () => ({
      employee_id: record.employee_id,
      name: record.name,
      cash_amount: record.cash_amount,
      cashless_amount: record.cashless_amount,
      total_amount: record.total_amount,
      comment: record.comment ?? "",
      category: record.category ?? "",
      category_id: record.category_id ?? null,
      photo: record.photo ?? null,
      photoFile: null,
    }),
    [record]
  );

  const [values, setValues] = React.useState<ExpenseFormValues>(initialValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [emps, catRes] = await Promise.all([
          fetchEmployees(),
          apiFetch<any>("/api/v1/expense-categories/?pageSize=200"),
        ]);

        const cats: ExpenseCategory[] = (catRes?.data?.results ?? catRes?.results ?? []).map(
          (c: any) => ({ id: String(c.id), name: c.name ?? "" })
        );

        if (!cancelled) {
          setEmployees(emps);
          setCategories(cats);
        }
      } catch (e) {
        console.error("Failed to load in EditExpenseModal", e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const { open: notify } = useNotification();

  React.useEffect(() => {
    if (open) {
      setValues(initialValues);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const handleChange =
    (field: keyof ExpenseFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (field === "cash_amount" || field === "cashless_amount" || field === "total_amount") {
        const n = Number(raw);
        setValues((s) => ({ ...s, [field]: Number.isFinite(n) ? n : 0 }));
      } else {
        setValues((s) => ({ ...s, [field]: raw }));
      }
    };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setValues((s) => ({ ...s, photoFile: file ?? null }));
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const computeTotal = (cash: number, cashless: number) =>
    (Number.isFinite(cash) ? cash : 0) + (Number.isFinite(cashless) ? cashless : 0);

  const handleSubmit = async () => {
    try {
      setBusy(true);

      // Find category_id from selected name
      const selectedCat = categories.find((c) => c.name === values.category);

      const payload = {
        employee_id: values.employee_id,
        category_id: selectedCat?.id ?? values.category_id ?? null,
        name: values.name,
        cash_amount: values.cash_amount ?? 0,
        cashless_amount: values.cashless_amount ?? 0,
        comment: values.comment ?? null,
        photoFile: values.photoFile ?? null,
      };

      const updated = await ExpensesService.update(record.id, payload);

      notify?.({ type: "success", message: "Расход обновлён", description: values.name });
      if (onUpdated) onUpdated(updated);
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Update expense failed:", e);
      notify?.({ type: "error", message: "Ошибка при обновлении", description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Редактировать расход</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Название"
                value={values.name}
                onChange={handleChange("name")}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Наличные"
                type="number"
                value={values.cash_amount}
                onChange={handleChange("cash_amount")}
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Безнал"
                type="number"
                value={values.cashless_amount}
                onChange={handleChange("cashless_amount")}
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Итого"
                type="number"
                value={computeTotal(values.cash_amount ?? 0, values.cashless_amount ?? 0)}
                disabled
                helperText="Итого рассчитывается: наличные + безнал"
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <AppAutocomplete<string, false, false, false>
                options={categories.map((c) => c.name)}
                noOptionsText=""
                value={values.category && values.category.length > 0 ? values.category : null}
                onChange={(_e, newValue) => {
                  const cat = categories.find((c) => c.name === newValue);
                  setValues((s) => ({ ...s, category: newValue ?? null, category_id: cat?.id ?? null }));
                }}
                renderInput={(params) => <TextField {...params} label="Категория" fullWidth />}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                placeholder="Комментарий"
                value={values.comment ?? ""}
                onChange={handleChange("comment")}
                minRows={3}
                multiline
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <AppAutocomplete<EmployeesRow, false, false, false>
                options={employees}
                noOptionsText=""
                getOptionLabel={(option) => option.full_name || option.id}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={employees.find((e) => e.id === values.employee_id) ?? null}
                onChange={(_e, newValue) => setValues((s) => ({ ...s, employee_id: newValue?.id ?? null }))}
                renderInput={(params) => <TextField {...params} label="Сотрудник" fullWidth />}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button variant="outlined" component="label" disabled={busy}>
                  Выбрать новое фото
                  <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                </Button>
                {previewUrl ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar variant="rounded" src={previewUrl} sx={{ width: 64, height: 64 }} />
                    <Typography variant="body2" color="text.secondary">Новое фото</Typography>
                  </Stack>
                ) : record.photo ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar variant="rounded" src={record.photo as string | undefined} sx={{ width: 64, height: 64 }} />
                    <Typography variant="body2" color="text.secondary">Текущее фото</Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">Фото отсутствует</Typography>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={busy}>
          {busy ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={18} />
              <span>Сохранение…</span>
            </Stack>
          ) : (
            "Сохранить"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

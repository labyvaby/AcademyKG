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
import { ExpensesService } from "../../services/expenses";
import type { Expense, ExpenseFormValues, EmployeesRow } from "../../pages/expenses/types";

type AddExpenseModalProps = {
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
};

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [values, setValues] = React.useState<ExpenseFormValues>(defaultValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const { open: notify } = useNotification();

  React.useEffect(() => {
    if (!open) {
      setValues(defaultValues);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const emps = await fetchEmployees();
        if (!cancelled) setEmployees(emps);
      } catch (e) {
        console.error("Failed to load employees in AddExpenseModal", e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

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
    if (file) setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    try {
      setBusy(true);

      const payload = {
        employee_id: values.employee_id || null,
        category_id: values.category_id || null,
        name: values.name,
        cash_amount: values.cash_amount ?? 0,
        cashless_amount: values.cashless_amount ?? 0,
        comment: values.comment ?? null,
        photoFile: values.photoFile ?? null,
      };

      const created = await ExpensesService.create(payload);

      notify?.({ type: "success", message: "Расход успешно создан", description: values.name });
      if (onCreated) onCreated(created);
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Create expense failed:", e);
      notify?.({ type: "error", message: "Ошибка при создании расхода", description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Добавить расход</DialogTitle>
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
                getOptionLabel={(option) =>
                  option.specialization
                    ? `${option.full_name} — ${option.specialization}`
                    : option.full_name || option.id
                }
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={employees.find((e) => e.id === values.employee_id) ?? null}
                onChange={(_e, newValue) =>
                  setValues((s) => ({ ...s, employee_id: newValue?.id ?? null }))
                }
                renderInput={(params) => <TextField {...params} label="Сотрудник" fullWidth />}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button variant="outlined" component="label" disabled={busy}>
                  Выбрать фото
                  <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                </Button>
                {previewUrl ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar variant="rounded" src={previewUrl} sx={{ width: 64, height: 64 }} />
                    <Typography variant="body2" color="text.secondary">Предпросмотр</Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">Фото не выбрано</Typography>
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
              <span>Создание…</span>
            </Stack>
          ) : (
            "Создать"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

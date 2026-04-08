import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import { useNotification } from "@refinedev/core";
import { PayrollTransactionsService } from "../../services/payroll-transactions";
import { PAYROLL_KIND_OPTIONS, type PayrollTransaction, type PayrollFormValues } from "../../pages/expenses/types";
import { useEmployees } from "../../hooks/useEmployees";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

type EditPayrollDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: PayrollTransaction;
  onUpdated?: (record: PayrollTransaction) => void;
};

export const EditPayrollDrawer: React.FC<EditPayrollDrawerProps> = ({ open, onClose, record, onUpdated }) => {
  const { open: notify } = useNotification();
  const { employees, loading: loadingEmployees } = useEmployees(open);

  const initialValues = React.useMemo<PayrollFormValues>(() => ({
    employee_id: record.employee_id || null,
    kind: record.kind || null,
    affects_month: record.affects_month || "",
    name: record.name || "",
    cash_amount: record.cash_amount || 0,
    cashless_amount: record.cashless_amount || 0,
    comment: record.comment || "",
  }), [record]);

  const [values, setValues] = React.useState<PayrollFormValues>(initialValues);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) { setValues(initialValues); setTouched(false); }
  }, [open, initialValues]);

  const computeTotal = () => (Number(values.cash_amount) || 0) + (Number(values.cashless_amount) || 0);
  const isValid = !!values.employee_id && !!values.kind && !!values.affects_month;

  const handleSubmit = async () => {
    setTouched(true);
    if (!isValid) {
      notify?.({ type: "error", message: "Заполните обязательные поля: сотрудник, тип, месяц" });
      return;
    }
    setBusy(true);
    try {
      const updated = await PayrollTransactionsService.update(record.id, {
        employee_id: values.employee_id!,
        kind: values.kind!,
        affects_month: values.affects_month,
        name: values.name?.trim() || null,
        cash_amount: Number(values.cash_amount) || 0,
        cashless_amount: Number(values.cashless_amount) || 0,
        comment: values.comment?.trim() || null,
      });
      if (onUpdated) onUpdated(updated);
      notify?.({ type: "success", message: "Транзакция обновлена" });
      onClose();
    } catch {
      notify?.({ type: "error", message: "Не удалось обновить транзакцию" });
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
      <Box sx={{ width: 1, height: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1 }}>
          <Typography variant="h6">Редактировать транзакцию</Typography>
          <IconButton onClick={busy ? undefined : onClose}><CloseOutlined /></IconButton>
        </Box>
        <Divider />
        <Box sx={{ p: 2, flex: 1, overflowY: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          <Stack spacing={3}>
            {/* Сотрудник */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Сотрудник *</Typography>
              <Autocomplete
                options={employees}
                loading={loadingEmployees}
                getOptionLabel={(o) => o.specialization ? `${o.full_name} — ${o.specialization}` : o.full_name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={employees.find((e) => e.id === values.employee_id) || null}
                onChange={(_, v) => setValues((s) => ({ ...s, employee_id: v?.id || null }))}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Выберите сотрудника" fullWidth
                    error={touched && !values.employee_id}
                    helperText={touched && !values.employee_id ? "Обязательное поле" : ""} />
                )}
                noOptionsText="Нет сотрудников"
              />
            </Stack>

            {/* Тип */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Тип *</Typography>
              <TextField select fullWidth value={values.kind ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, kind: e.target.value as any || null }))}
                error={touched && !values.kind} helperText={touched && !values.kind ? "Обязательное поле" : ""}>
                <MenuItem value="" disabled><em>Выберите тип</em></MenuItem>
                {PAYROLL_KIND_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Stack>

            {/* Месяц */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Месяц учёта *</Typography>
              <DatePicker
                views={["year", "month"]}
                openTo="month"
                value={values.affects_month ? dayjs(values.affects_month + "-01") : null}
                onChange={(val) => setValues((s) => ({ ...s, affects_month: val ? val.format("YYYY-MM") : "" }))}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: touched && !values.affects_month,
                    helperText: touched && !values.affects_month ? "Обязательное поле" : "",
                  },
                }}
              />
            </Stack>

            {/* Название */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Название</Typography>
              <TextField value={values.name} onChange={(e) => setValues((s) => ({ ...s, name: e.target.value }))}
                fullWidth placeholder="Например: Аванс за апрель" />
            </Stack>

            {/* Суммы */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" display="block">Наличные</Typography>
                    <Stack direction="row" alignItems="center" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
                      <Box px={1}><AccountBalanceWalletOutlined color="action" fontSize="small" /></Box>
                      <TextField variant="standard" fullWidth type="number" value={values.cash_amount || ""}
                        onChange={(e) => setValues((s) => ({ ...s, cash_amount: Number(e.target.value) || 0 }))}
                        InputProps={{ disableUnderline: true }}
                        sx={{ py: 0.5, "& input[type=number]": { MozAppearance: "textfield" }, "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": { WebkitAppearance: "none" } }}
                        placeholder="0" />
                    </Stack>
                  </Stack>
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" display="block">Безналичные</Typography>
                    <Stack direction="row" alignItems="center" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
                      <Box px={1}><CreditCardOutlined color="action" fontSize="small" /></Box>
                      <TextField variant="standard" fullWidth type="number" value={values.cashless_amount || ""}
                        onChange={(e) => setValues((s) => ({ ...s, cashless_amount: Number(e.target.value) || 0 }))}
                        InputProps={{ disableUnderline: true }}
                        sx={{ py: 0.5, "& input[type=number]": { MozAppearance: "textfield" }, "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": { WebkitAppearance: "none" } }}
                        placeholder="0" />
                    </Stack>
                  </Stack>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>ИТОГО</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KGS" }).format(computeTotal())}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            {/* Комментарий */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Комментарий</Typography>
              <TextField value={values.comment || ""} onChange={(e) => setValues((s) => ({ ...s, comment: e.target.value }))}
                fullWidth multiline rows={3} placeholder="Добавьте комментарий (необязательно)" />
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={busy}>Отмена</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={busy}>
              {busy ? <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={18} /><span>Сохранение…</span></Stack> : "Сохранить"}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
};

export default EditPayrollDrawer;

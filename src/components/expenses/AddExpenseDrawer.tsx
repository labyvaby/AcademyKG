import React from "react";
import { useTranslation } from "react-i18next";
import AppAutocomplete from "../../components/ui/AppAutocomplete";
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
  CardContent,
  Avatar,
  Paper
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import { useNotification } from "@refinedev/core";
import { ExpensesService } from "../../services/expenses";
import { apiFetch } from "../../utility/apiClient";
import type { Expense, ExpenseFormValues } from "../../pages/expenses/types";
import { AppCard, CustomDateTimePicker } from "../ui";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { roundDateTimeLocalToStep } from "../../utility/time";
import { useBranchCurrency } from "../../hooks/useBranchCurrency";

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
  photoFile: null
};

type ExpenseCategory = { id: string; name: string };

export const AddExpenseDrawer: React.FC<AddExpenseDrawerProps> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { suffix } = useBranchCurrency();
  const { open: notify } = useNotification();
  const [values, setValues] = React.useState<ExpenseFormValues>(defaultValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = React.useState(false);
  const [expenseDate, setExpenseDate] = React.useState<string>("");

  React.useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const res: any = await apiFetch("/api/v1/expense-categories/?pageSize=200");
        const data = res?.data?.results ?? res?.results ?? [];
        if (Array.isArray(data)) {
          setCategories(data.map((c: any) => ({ id: String(c.id), name: c.name })));
        }
      } catch {
        notify?.({ type: "error", message: t("expenses.loadCategoriesError") });
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [notify]);

  React.useEffect(() => {
    if (!open) {
      setValues(defaultValues);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      setBusy(false);
      setTouched(false);
      const nowStr = dayjs().format("YYYY-MM-DDTHH:mm");
      setExpenseDate(roundDateTimeLocalToStep(nowStr, 15));
    }
  }, [open, previewUrl]);

  const handleFileChange = (file: File | null) => {
    setValues((s) => ({ ...s, photoFile: file }));
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const computeTotal = () => (values.cash_amount || 0) + (values.cashless_amount || 0);

  const handleSubmit = async () => {
    setTouched(true);
    if (!values.name.trim()) {
      notify?.({ type: "error", message: t("expenses.expenseNameRequired") });
      return;
    }
    setBusy(true);
    try {
      const created = await ExpensesService.create({
        employee_id: values.employee_id || null,
        name: values.name.trim(),
        cash_amount: Number(values.cash_amount) || 0,
        cashless_amount: Number(values.cashless_amount) || 0,
        total_amount: computeTotal(),
        comment: values.comment?.trim() || null,
        category: values.category?.trim() || null,
        category_id: values.category_id || null,
        photo: values.photoFile,
        created_at: (expenseDate ? dayjs(expenseDate) : dayjs()).toISOString()
});
      if (created && onCreated) onCreated(created);
      notify?.({ type: "success", message: t("expenses.expenseAdded") });
      onClose();
    } catch {
      notify?.({ type: "error", message: t("expenses.createExpenseError") });
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
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1 }}>
          <Typography variant="h6">{t("expenses.addExpense")}</Typography>
          <IconButton onClick={busy ? undefined : onClose} aria-label={t("common.close")}><CloseOutlined /></IconButton>
        </Box>
        <Divider />
        <Box sx={{ p: 2, flex: 1, overflowY: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          <Stack spacing={3}>
            {/* Фото */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.expensePhoto")}</Typography>
              <AppCard variant="outlined" sx={{ borderStyle: "dashed" }} disableContentPadding>
                <CardContent
                  sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2, cursor: "pointer" }}
                  onClick={() => (document.getElementById("expense-photo-input") as HTMLInputElement)?.click()}
                >
                  <Avatar variant="rounded" src={previewUrl || undefined} sx={{ width: 48, height: 48 }}>
                    <PhotoCameraOutlined />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{values.photoFile ? values.photoFile.name : t("expenses.clickToSelectImage")}</Typography>
                    <Typography variant="caption" color="text.secondary">{t("expenses.jpgPngOptional")}</Typography>
                  </Box>
                  <input id="expense-photo-input" type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
                </CardContent>
              </AppCard>
            </Stack>

            {/* Дата */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.expenseDate")}</Typography>
              <CustomDateTimePicker
                value={expenseDate ? dayjs(expenseDate) : null}
                onChange={(val) => setExpenseDate(val ? val.format() : "")}
                ampm={false}
                minutesStep={15}
                slotProps={{ textField: { fullWidth: true, InputLabelProps: { shrink: true } } }}
              />
            </Stack>

            {/* Название */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.nameRequired")}</Typography>
              <TextField
                value={values.name}
                onChange={(e) => setValues((s) => ({ ...s, name: e.target.value }))}
                fullWidth autoFocus
                placeholder={t("expenses.enterExpenseName")}
                error={touched && !values.name.trim()}
                helperText={touched && !values.name.trim() ? t("common.requiredField") : ""}
              />
            </Stack>

            {/* Категория */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.category")}</Typography>
              <AppAutocomplete
                options={categories}
                loading={loadingCategories}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={categories.find((c) => c.id === values.category_id) || null}
                onChange={(_, v) => setValues((s) => ({ ...s, category_id: v?.id || null, category: v?.name || "" }))}
                renderInput={(params) => <TextField {...params} placeholder={t("expenses.selectCategory")} fullWidth />}
                loadingText={t("expenses.loadingCategories")}
                noOptionsText={loadingCategories ? t("common.loading") : t("expenses.noCategories")}
              />
            </Stack>

            {/* Суммы */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" display="block">{t("expenses.cashAmount")}</Typography>
                    <Stack direction="row" alignItems="center" spacing={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
                      <Box px={1}><AccountBalanceWalletOutlined color="action" fontSize="small" /></Box>
                      <TextField variant="standard" fullWidth type="number" value={values.cash_amount || ""}
                        onChange={(e) => setValues((s) => ({ ...s, cash_amount: Number(e.target.value) || 0 }))}
                        InputProps={{ disableUnderline: true }}
                        sx={{ py: 0.5, "& input[type=number]": { MozAppearance: "textfield" }, "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 } }}
                        placeholder="0" />
                    </Stack>
                  </Stack>
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" display="block">{t("expenses.cashlessAmount")}</Typography>
                    <Stack direction="row" alignItems="center" spacing={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
                      <Box px={1}><CreditCardOutlined color="action" fontSize="small" /></Box>
                      <TextField variant="standard" fullWidth type="number" value={values.cashless_amount || ""}
                        onChange={(e) => setValues((s) => ({ ...s, cashless_amount: Number(e.target.value) || 0 }))}
                        InputProps={{ disableUnderline: true }}
                        sx={{ py: 0.5, "& input[type=number]": { MozAppearance: "textfield" }, "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 } }}
                        placeholder="0" />
                    </Stack>
                  </Stack>
                </Stack>
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>{t("expenses.total")}</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(computeTotal()) + " " + suffix}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            {/* Комментарий */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.comment")}</Typography>
              <TextField value={values.comment || ""} onChange={(e) => setValues((s) => ({ ...s, comment: e.target.value }))}
                fullWidth multiline rows={3} placeholder={t("expenses.addCommentOptional")} />
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={busy || !values.name.trim()}>
              {busy ? <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={18} /><span>{t("common.saving")}</span></Stack> : t("common.save")}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
};

export default AddExpenseDrawer;

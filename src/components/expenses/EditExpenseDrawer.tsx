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
import { apiFetch } from "../../utility/apiClient";
import { ExpensesService } from "../../services/expenses";
import type { Expense, ExpenseFormValues } from "../../pages/expenses/types";
import { AppCard, CustomDateTimePicker } from "../ui";
import dayjs from "dayjs";
import { useBranchCurrency } from "../../hooks/useBranchCurrency";

type EditExpenseDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: Expense;
  onUpdated?: (record: Expense) => void;
};

type ExpenseCategory = { id: string; name: string };

export const EditExpenseDrawer: React.FC<EditExpenseDrawerProps> = ({ open, onClose, record, onUpdated }) => {
  const { t } = useTranslation();
  const { suffix } = useBranchCurrency();
  const { open: notify } = useNotification();

  const initialValues = React.useMemo<ExpenseFormValues>(() => ({
    employee_id: record.employee_id || null,
    name: record.name || "",
    cash_amount: record.cash_amount || 0,
    cashless_amount: record.cashless_amount || 0,
    total_amount: record.total_amount || 0,
    comment: record.comment || "",
    category: record.category || "",
    category_id: record.category_id || null,
    photo: record.photo || null,
    photoFile: null,
    created_at: record.created_at ? dayjs(record.created_at).format("YYYY-MM-DDTHH:mm") : dayjs().format("YYYY-MM-DDTHH:mm")
}), [record]);

  const [values, setValues] = React.useState<ExpenseFormValues>(initialValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res: any = await apiFetch("/api/v1/expense-categories/?pageSize=200");
        const data = res?.data?.results ?? res?.results ?? [];
        if (!cancelled && Array.isArray(data)) {
          setCategories(data.map((c: any) => ({ id: String(c.id), name: c.name })));
        }
      } catch { /* ignore */ }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (open) {
      setValues(initialValues);
      setTouched(false);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    }
  }, [open, initialValues, previewUrl]);

  const handleFileChange = (file: File | null) => {
    setValues((s) => ({ ...s, photoFile: file }));
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const computeTotal = () => (Number(values.cash_amount) || 0) + (Number(values.cashless_amount) || 0);

  const handleSubmit = async () => {
    setTouched(true);
    if (!values.name.trim()) {
      notify?.({ type: "error", message: t("expenses.enterExpenseName") });
      return;
    }
    try {
      setBusy(true);
      const updated = await ExpensesService.update(record.id, {
        employee_id: values.employee_id || null,
        name: values.name.trim(),
        cash_amount: Number(values.cash_amount) || 0,
        cashless_amount: Number(values.cashless_amount) || 0,
        total_amount: computeTotal(),
        comment: values.comment?.trim() || null,
        category: values.category?.trim() || null,
        category_id: values.category_id || null,
        photo: values.photoFile || values.photo,
        created_at: (values.created_at ? dayjs(values.created_at) : dayjs()).toISOString()
});
      if (updated && onUpdated) onUpdated(updated);
      notify?.({ type: "success", message: t("expenses.expenseUpdated") });
      onClose();
    } catch {
      notify?.({ type: "error", message: t("expenses.updateExpenseError") });
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
          <Typography variant="h6">{t("expenses.editExpense")}</Typography>
          <IconButton onClick={busy ? undefined : onClose} aria-label={t("common.close")}><CloseOutlined /></IconButton>
        </Box>
        <Divider />
        <Box sx={{ p: 2, flex: 1, overflowY: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          <Stack spacing={3}>
            {/* Название */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.nameRequired")}</Typography>
              <TextField value={values.name} onChange={(e) => setValues((s) => ({ ...s, name: e.target.value }))}
                fullWidth autoFocus placeholder={t("expenses.enterExpenseName")}
                error={touched && !values.name.trim()} helperText={touched && !values.name.trim() ? t("common.requiredField") : ""} />
            </Stack>

            {/* Дата */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.dateAndTime")}</Typography>
              <CustomDateTimePicker
                value={values.created_at ? dayjs(values.created_at) : null}
                onChange={(val) => setValues((s) => ({ ...s, created_at: val ? val.format() : "" }))}
                ampm={false} format="DD.MM.YYYY HH:mm"
                slotProps={{ textField: { fullWidth: true, placeholder: t("expenses.specifyDateTime") } }}
              />
            </Stack>

            {/* Фото */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.expensePhoto")}</Typography>
              <AppCard variant="outlined" sx={{ borderStyle: "dashed" }} disableContentPadding>
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2, cursor: "pointer" }}
                  onClick={() => (document.getElementById("edit-expense-photo-input") as HTMLInputElement)?.click()}>
                  <Avatar variant="rounded" src={previewUrl || (typeof values.photo === "string" ? values.photo : undefined)} sx={{ width: 48, height: 48 }}>
                    <PhotoCameraOutlined />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{values.photoFile ? values.photoFile.name : values.photo ? t("expenses.imageUploaded") : t("expenses.clickToSelectImage")}</Typography>
                    <Typography variant="caption" color="text.secondary">{t("expenses.jpgPngOptional")}</Typography>
                  </Box>
                  <input id="edit-expense-photo-input" type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
                </CardContent>
              </AppCard>
            </Stack>

            {/* Категория */}
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t("expenses.category")}</Typography>
              <AppAutocomplete
                options={categories}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={categories.find((c) => c.id === values.category_id) || null}
                onChange={(_, v) => setValues((s) => ({ ...s, category_id: v?.id || null, category: v?.name || "" }))}
                renderInput={(params) => <TextField {...params} placeholder={t("expenses.selectCategory")} fullWidth />}
                noOptionsText={t("expenses.noCategories")}
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

export default EditExpenseDrawer;

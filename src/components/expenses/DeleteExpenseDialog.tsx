import React from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
// import { useDelete, useInvalidate } from "@refinedev/core";
import { useNotification } from "@refinedev/core";
import type { Expense } from "../../pages/expenses/types";
import { ExpensesService } from "../../services/expenses";

type DeleteExpenseDialogProps = {
  open: boolean;
  onClose: () => void;
  record: Expense | null;
  onDeleted?: (id: string | number) => void;
};

export const DeleteExpenseDialog: React.FC<DeleteExpenseDialogProps> = ({
  open,
  onClose,
  record,
  onDeleted,
}) => {
  // Refine hooks removed
  // const { mutateAsync: deleteAsync } = useDelete();
  // const invalidate = useInvalidate();


  // Custom Service - Imported at top

  const { t } = useTranslation();
  const [busy, setBusy] = React.useState(false);
  const { open: notify } = useNotification();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const handleDelete = async () => {
    if (!record) return;
    try {
      setBusy(true);

      // Delete DB row via service
      await ExpensesService.delete(record.id);

      if (onDeleted) onDeleted(record.id);
      onClose();
    } catch (e: unknown) {
      console.error("Delete expense failed:", e);
      const message = e instanceof Error ? e.message : t("expenses.deleteExpenseError");
      notify?.({
        type: "error",
        message: t("expenses.deleteExpenseError"),
        description: message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle>{t("expenses.deleteExpenseTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {record ? t("expenses.deleteExpenseConfirmNamed", { name: record.name }) : t("expenses.deleteExpenseConfirm")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
        <Tooltip title={t("expenses.deleteExpenseTooltip")}>
          <IconButton
            onClick={handleDelete}
            color="error"
            disabled={busy}
            sx={{
              border: '1px solid',
              borderColor: 'error.main',
              '&:hover': {
                borderColor: 'error.dark',
                backgroundColor: 'rgba(211, 47, 47, 0.08)',
              },
              '&.Mui-disabled': {
                borderColor: 'action.disabled',
                color: 'action.disabled',
              }
            }}
          >
            {busy ? (
              <CircularProgress size={20} color="error" />
            ) : (
              <DeleteOutlined fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

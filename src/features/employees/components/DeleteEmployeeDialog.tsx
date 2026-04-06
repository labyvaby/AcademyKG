import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Typography, IconButton, Tooltip } from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import type { EmployesRow } from "../types";
import { AppButton } from "../../../components/ui";
import { deleteEmployeeApi } from "../hooks/useEmployeesPage";
import { useNotification } from "@refinedev/core";
import { usePermissions } from "../../../hooks/usePermissions";
import { PERMISSIONS } from "../../../constants/permissions";
import { apiFetch } from "../../../utility/apiClient";
import dayjs from "dayjs";


export type DeleteEmployeeDialogProps = {
  record: EmployesRow | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

const DeleteEmployeeDialog: React.FC<DeleteEmployeeDialogProps> = ({ record, onClose, onDeleted }) => {
  const open = Boolean(record);
  const [busy, setBusy] = React.useState(false);
  const { open: notify } = useNotification();
  const { hasPermission } = usePermissions();

  React.useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const handleDelete = async () => {
    if (!record || !hasPermission(PERMISSIONS.EMPLOYEES_DELETE)) return;
    try {
      setBusy(true);
      const today = dayjs().format("YYYY-MM-DD");
      const dayRes: any = await apiFetch(`/api/v1/appointments/?date=${today}&pageSize=500`);
      const dayItems: any[] = dayRes?.data?.results ?? dayRes?.results ?? [];
      const employeeId = String(record.id);
      const hasTodayAppointments = dayItems.some((appt: any) => {
        if (String(appt?.doctorId ?? appt?.doctor_id ?? "") === employeeId) return true;
        const services = appt?.services ?? appt?.services_json ?? appt?.servicesJson;
        if (Array.isArray(services)) {
          return services.some((s: any) => String(s?.performer?.id ?? s?.performer ?? s?.performer_id ?? s?.doctor_id ?? "") === employeeId);
        }
        return false;
      });
      if (hasTodayAppointments) {
        notify?.({
          type: "error",
          message: "Нельзя удалить активного специалиста",
          description: "На сотрудника назначены приёмы на сегодня. Перенесите или отмените их перед удалением.",
        });
        return;
      }
      await deleteEmployeeApi(String(record.id));
      notify?.({ type: "success", message: "Сотрудник удалён" });
      onDeleted(record.id);
      onClose();
    } catch (e) {
       
      console.error("Delete employee failed:", e);
      notify?.({ type: "error", message: "Не удалось удалить сотрудника" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Удалить сотрудника</DialogTitle>
      <DialogContent>
        <Typography variant="body2">Действительно удалить сотрудника "{record?.full_name || record?.id}"?</Typography>
      </DialogContent>
      <DialogActions>
        <AppButton onClick={onClose} disabled={busy}>Отмена</AppButton>
        <Tooltip title="Удалить сотрудника">
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
            {busy ? <CircularProgress size={20} color="error" /> : <DeleteOutlined fontSize="small" />}
          </IconButton>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteEmployeeDialog;

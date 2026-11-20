/**
 * «Сбросить пароль» в карточке сотрудника.
 *
 * Сотрудник не может войти (SMS не доходит, пароль забыт) — админ с правом
 * employees.manage_sensitive сбрасывает пароль: бэкенд ставит стандартный
 * (STAFF_DEFAULT_PASSWORD, по умолчанию profigram123), отзывает старые сессии
 * и при входе требует придумать свой. После сброса показываем «Данные для
 * входа», чтобы админ передал номер и пароль сотруднику.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";

import { apiFetch } from "../../../utility/apiClient";
import { usePermissions } from "../../../hooks/usePermissions";
import { PERMISSIONS } from "../../../constants/permissions";
import StartingPasswordDialog, { type StartingCredentials } from "./StartingPasswordDialog";

type Props = {
  employeeId: string;
  fullName: string;
  /** Номер аккаунта сотрудника; без него аккаунта нет и сбрасывать нечего. */
  phone: string | null;
};

const ResetPasswordButton: React.FC<Props> = ({ employeeId, fullName, phone }) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [credentials, setCredentials] = React.useState<StartingCredentials | null>(null);

  if (!phone || !hasPermission(PERMISSIONS.EMPLOYEES_MANAGE_SENSITIVE)) return null;

  const close = () => {
    if (busy) return;
    setConfirmOpen(false);
    setError(null);
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{
        data?: { temporaryPassword?: string };
        temporaryPassword?: string;
      }>(`/api/v1/employees/${employeeId}/reset-password/`, { method: "POST" });
      const password = res?.data?.temporaryPassword ?? res?.temporaryPassword ?? "";
      setConfirmOpen(false);
      setCredentials({ fullName, phone, password });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("employees.resetPasswordFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        color="warning"
        startIcon={<LockResetOutlined />}
        onClick={() => setConfirmOpen(true)}
        sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 600, mb: 2 }}
      >
        {t("employees.resetPassword")}
      </Button>

      <Dialog open={confirmOpen} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle>{t("employees.resetPasswordTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t("employees.resetPasswordText", { name: fullName })}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} variant="outlined" disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={reset}
            variant="contained"
            color="warning"
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t("employees.resetPassword")}
          </Button>
        </DialogActions>
      </Dialog>

      <StartingPasswordDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
};

export default ResetPasswordButton;

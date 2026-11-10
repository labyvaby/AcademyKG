/**
 * Экран обязательной смены пароля.
 *
 * Новым сотрудникам бэкенд выдаёт один общий стандартный пароль
 * (STAFF_DEFAULT_PASSWORD) и ставит флаг: users/me → mustChangePassword.
 * Пока флаг стоит, RequireAuth вместо любой страницы показывает этот экран.
 * Текущий пароль не спрашиваем — сервер в этом состоянии его не требует,
 * а стандартный пароль новым не примет. Смена отзывает refresh-токены,
 * поэтому changeStartingPassword сразу входит заново новым паролем.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";

import AuthLayout from "./AuthLayout";
import AuthCard from "./AuthCard";
import { LanguageSwitcher } from "../language/LanguageSwitcher";
import { apiFetch } from "../../utility/apiClient";
import { changeStartingPassword, logout } from "../../services/auth";
import { markPasswordChanged } from "../../hooks/usePermissions";

const MIN_LENGTH = 8;

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "16px",
    bgcolor: "rgba(255, 255, 255, 0.6)",
    "&:hover": { bgcolor: "rgba(255, 255, 255, 0.9)" },
    "&.Mui-focused": {
      bgcolor: "#fff",
      boxShadow: "0 0 0 4px rgba(42, 82, 152, 0.1)",
    },
  },
};

function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const ForcePasswordChange: React.FC = () => {
  const { t } = useTranslation();
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phone, setPhone] = React.useState<string | null>(null);

  // Телефон нужен, чтобы после смены сразу войти новым паролем.
  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ data?: { phoneNumber?: string }; phoneNumber?: string }>("/api/v1/users/me/")
      .then((res) => {
        if (!cancelled) setPhone(res?.data?.phoneNumber ?? res?.phoneNumber ?? null);
      })
      .catch(() => {
        /* без телефона после смены просто попросим войти заново */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;

  const signOut = () => {
    logout();
    window.location.href = "/login";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < MIN_LENGTH) {
      setError(t("login.minLength", { count: MIN_LENGTH }));
      return;
    }
    if (next !== confirm) {
      setError(t("login.passwordsMismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (phone) {
        await changeStartingPassword(phone, next, confirm);
        markPasswordChanged();
      } else {
        // Телефона не узнали — пароль сменён, входим заново вручную.
        await apiFetch("/api/v1/auth/change-password/", {
          method: "POST",
          body: JSON.stringify({ newPassword: next, passwordConfirm: confirm }),
        });
        signOut();
      }
    } catch (err) {
      setError(errorText(err, t("login.unknownError")));
    } finally {
      setBusy(false);
    }
  };

  const lock = (
    <InputAdornment position="start">
      <LockOutlined fontSize="small" color="action" />
    </InputAdornment>
  );

  return (
    <AuthLayout>
      <AuthCard>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
          <LanguageSwitcher />
        </Box>
        <Typography
          variant="h4"
          fontWeight={800}
          sx={{
            background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: 2,
          }}
        >
          {t("login.changeTitle")}
        </Typography>
        <Alert severity="warning" icon={<LockOutlined fontSize="inherit" />} sx={{ mb: 3, borderRadius: 2 }}>
          {t("login.changeWarning")}
        </Alert>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Stack component="form" onSubmit={submit} spacing={2.5}>
          <TextField
            label={t("login.newPassword")}
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setError(null);
            }}
            required
            fullWidth
            autoFocus
            autoComplete="new-password"
            error={tooShort}
            helperText={tooShort ? t("login.minLength", { count: MIN_LENGTH }) : " "}
            InputProps={{
              startAdornment: lock,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShow((v) => !v)} edge="end">
                    {show ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
          <TextField
            label={t("login.repeatPassword")}
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
            }}
            required
            fullWidth
            autoComplete="new-password"
            error={mismatch}
            helperText={mismatch ? t("login.passwordsMismatch") : " "}
            InputProps={{ startAdornment: lock }}
            sx={fieldSx}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={busy}
            startIcon={busy ? <CircularProgress size={20} color="inherit" /> : undefined}
            sx={{
              py: 1.5,
              borderRadius: "16px",
              fontSize: "1.05rem",
              fontWeight: 600,
              textTransform: "none",
              background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
              boxShadow: "0 8px 20px -6px rgba(42, 82, 152, 0.5)",
            }}
          >
            {busy ? t("login.saving") : t("login.saveAndContinue")}
          </Button>
          <Button
            variant="text"
            onClick={signOut}
            disabled={busy}
            sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary" }}
          >
            {t("login.logout")}
          </Button>
        </Stack>
      </AuthCard>
    </AuthLayout>
  );
};

export default ForcePasswordChange;

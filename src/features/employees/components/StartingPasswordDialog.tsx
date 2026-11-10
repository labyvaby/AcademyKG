/**
 * «Данные для входа» нового сотрудника.
 *
 * Бэкенд выдаёт новому аккаунту общий стандартный пароль (temporaryPassword
 * в ответе создания сотрудника). Админ передаёт его сотруднику: тот входит
 * на вкладке «Телефон» по номеру и паролю, и система сразу просит придумать
 * свой (ForcePasswordChange).
 */
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";

export type StartingCredentials = {
  fullName: string;
  phone: string;
  password: string;
};

const CopyRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // буфер недоступен (http, старый браузер) — значение видно и так
    }
  };
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: "action.hover",
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 600, fontFamily: "monospace", wordBreak: "break-all" }}>
          {value}
        </Typography>
      </Box>
      <Tooltip title={copied ? t("login.copied") : t("login.copy")}>
        <IconButton onClick={copy} aria-label={`${t("login.copy")}: ${label}`} size="small">
          {copied ? <CheckOutlined fontSize="small" /> : <ContentCopyOutlined fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

type Props = {
  credentials: StartingCredentials | null;
  onClose: () => void;
};

const StartingPasswordDialog: React.FC<Props> = ({ credentials, onClose }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={credentials !== null} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("login.credentialsTitle")}</DialogTitle>
      <DialogContent>
        {credentials && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t("login.credentialsHint", { name: credentials.fullName })}
            </Typography>
            <CopyRow label={t("login.credentialsLogin")} value={credentials.phone} />
            <CopyRow label={t("login.password")} value={credentials.password} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          {t("login.understood")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StartingPasswordDialog;

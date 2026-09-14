import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Stack,
  Divider,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import TranslateOutlined from "@mui/icons-material/TranslateOutlined";
import { useTranslation } from "react-i18next";
import { logout } from "../../services/auth";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "../../i18n";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
}) => {
  const { t, i18n } = useTranslation();

  const currentCode = (i18n.resolvedLanguage ?? i18n.language ?? "ru").slice(0, 2) as LanguageCode;

  const handleLogout = () => {
    logout();
    onClose();
    window.location.href = "/login";
  };

  const handleLanguageChange = (
    _e: React.MouseEvent<HTMLElement>,
    next: LanguageCode | null,
  ) => {
    if (next) void i18n.changeLanguage(next);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("settings.title")}</DialogTitle>
      <Divider />
      <DialogContent sx={{ pb: 3 }}>
        <Stack spacing={2}>
          {/* Выбор языка интерфейса */}
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TranslateOutlined fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={600}>
                {t("settings.language")}
              </Typography>
            </Stack>
            <ToggleButtonGroup
              value={currentCode}
              exclusive
              onChange={handleLanguageChange}
              fullWidth
              size="small"
              color="primary"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <ToggleButton key={lang.code} value={lang.code} sx={{ textTransform: "none" }}>
                  {lang.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>

          <Divider />

          <Button
            variant="contained"
            color="error"
            fullWidth
            onClick={handleLogout}
            startIcon={<LogoutOutlined />}
          >
            {t("settings.logout")}
          </Button>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          mt={2}
          display="block"
          textAlign="center"
        >
          {t("settings.version", { version: "0.1.0" })}
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

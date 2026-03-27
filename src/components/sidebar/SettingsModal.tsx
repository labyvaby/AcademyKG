import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Stack,
  Divider,
  Typography,
} from "@mui/material";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import Brightness4Outlined from "@mui/icons-material/Brightness4Outlined";
import NotificationsOutlined from "@mui/icons-material/NotificationsOutlined";
import { logout } from "../../services/auth";
import { ColorModeContext } from "../../contexts/color-mode";
import { CanAccess } from "../rbac/CanAccess";
import { Link as RouterLink } from "react-router";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
}) => {
  const { mode, setMode } = React.useContext(ColorModeContext);

  const handleLogout = () => {
    logout();
    onClose();
    window.location.href = "/login";
  };

  const handleToggleTheme = () => {
    setMode();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Настройки</DialogTitle>
      <Divider />
      <DialogContent sx={{ pb: 3 }}>
        <Stack spacing={2}>
<CanAccess roles={['superadmin']}>
            <Button
              variant="outlined"
              fullWidth
              component={RouterLink}
              to="/settings/notifications"
              onClick={onClose}
              startIcon={<NotificationsOutlined />}
            >
              Настройка уведомлений
            </Button>
          </CanAccess>

{/* 
          // Темная тема временно отключена по просьбе пользователя
          <Button
            variant="outlined"
            fullWidth
            onClick={handleToggleTheme}
            startIcon={<Brightness4Outlined />}
          >
            {mode === "dark" ? "Светлая тема" : "Темная тема"}
          </Button>
          */}

          <Button
            variant="contained"
            color="error"
            fullWidth
            onClick={handleLogout}
            startIcon={<LogoutOutlined />}
          >
            Выход из аккаунта
          </Button>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          mt={2}
          display="block"
          textAlign="center"
        >
          Версия Academy KG v0.1.0
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

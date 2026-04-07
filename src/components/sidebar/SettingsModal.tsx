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
import { logout } from "../../services/auth";
import { CanAccess } from "../rbac/CanAccess";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
}) => {
  const handleLogout = () => {
    logout();
    onClose();
    window.location.href = "/login";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Настройки</DialogTitle>
      <Divider />
      <DialogContent sx={{ pb: 3 }}>
        <Stack spacing={2}>
          {/* Вход в страницу уведомлений временно отключен. */}
          {/* <CanAccess roles={['superadmin']}>
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
          </CanAccess> */}

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

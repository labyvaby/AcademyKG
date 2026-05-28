import React from "react";
import { Box, Divider, Drawer, IconButton, Stack, Typography, CircularProgress } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { AppButton } from "../../../components/ui";
import { useModalBackdropGuard } from "../../../hooks/useModalBackdropGuard";

type DrawerBaseProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
  isDirty?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
};

const DrawerBase: React.FC<DrawerBaseProps> = ({
  open,
  title,
  onClose,
  children,
  busy,
  isDirty = false,
  onSubmit,
  submitLabel = "Сохранить",
  submitDisabled,
}) => {
  const { handleClose, handleCloseButton, ConfirmLeaveDialog } = useModalBackdropGuard({
    isDirty,
    onClose,
  });

  const onCloseDrawer = busy ? undefined : handleClose;
  const onCloseButton = busy ? undefined : handleCloseButton;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onCloseDrawer}
        PaperProps={{
          sx: {
            width: { xs: 320, sm: 480, md: 520 },
            maxWidth: "100vw",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        }}
      >
        <Box sx={{ width: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
            <Typography variant="h6">{title}</Typography>
            <IconButton onClick={onCloseButton}>
              <CloseOutlined />
            </IconButton>
          </Stack>
          <Divider />
          <Box
            sx={{
              p: 2,
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': {
                display: 'none',
              },
            }}
          >
            {children}
          </Box>
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', mt: 'auto', bgcolor: 'background.paper', display: 'flex', justifyContent: 'flex-end', gap: 1.5, flexShrink: 0 }}>
            <AppButton onClick={handleCloseButton} disabled={busy}>
              Отмена
            </AppButton>
            {onSubmit && (
              <AppButton onClick={onSubmit} variant="contained" disabled={busy || submitDisabled}>
                {busy ? (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CircularProgress size={18} />
                    <span>Сохранение…</span>
                  </Stack>
                ) : (
                  submitLabel
                )}
              </AppButton>
            )}
          </Box>
        </Box>
      </Drawer>
      <ConfirmLeaveDialog />
    </>
  );
};

export default DrawerBase;

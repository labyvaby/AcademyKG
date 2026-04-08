import React, { useEffect } from "react";
import {
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme, alpha } from "@mui/material/styles";
import appLogo from "../../assets/img/logo.png";


import HomeOutlined from "@mui/icons-material/HomeOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import LocalHospitalOutlined from "@mui/icons-material/LocalHospitalOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import MedicalServicesOutlined from "@mui/icons-material/MedicalServicesOutlined";
import AnalyticsOutlined from "@mui/icons-material/AnalyticsOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import BusinessOutlined from "@mui/icons-material/BusinessOutlined";

import { useThemedLayoutContext } from "@refinedev/mui";
import { logout } from "../../services/auth";
import { Link as RouterLink, useLocation } from "react-router";
import { useMobileSidebar } from "./mobile-context";
import { SettingsModal } from "./SettingsModal";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";

import { AccountBalanceWalletOutlined } from "@mui/icons-material";

// Sidebar root that ThemedLayout will render via Sider={() => <Sidebar />}
export const Sidebar: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const stickyTop = (
    <>
      {isMobile && <MobileSidebarHeader />}
      {isDesktop && <DesktopSidebarHeader />}
      <Divider sx={{ my: 1 }} />
    </>
  );

  const nav = <SidebarSecondary />;

  const footer = (
    <>
      <Divider sx={{ my: 1 }} />
      <SidebarFooter />
    </>
  );

  return (
    <SidebarContainer stickyTop={stickyTop} footer={footer}>
      {nav}
    </SidebarContainer>
  );
};

// Container responsible for width/collapsed behavior
const SidebarContainer: React.FC<React.PropsWithChildren<{ stickyTop?: React.ReactNode; footer?: React.ReactNode }>> = ({ children, stickyTop, footer }) => {
  const { siderCollapsed, setSiderCollapsed } = useThemedLayoutContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // mobile-only open state comes from shared header/sidebar context
  const { mobileOpen, setMobileOpen } = useMobileSidebar();

  const desktopWidth = siderCollapsed ? 64 : 260;
  const overlayWidth = 260;

  // Ensure layout stays collapsed on mobile to prevent content shift
  useEffect(() => {
    if (isMobile && !siderCollapsed) {
      setSiderCollapsed?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original || "";
      };
    }
    return;
  }, [isMobile, mobileOpen]);

  return (
    <>
      {/* Backdrop behind the sidebar on mobile */}
      <Backdrop
        open={Boolean(isMobile && mobileOpen)}
        onClick={() => setMobileOpen(false)}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 3 }}
      />

      {/* Layout participant wrapper ensures no width on mobile */}
      <Box sx={{ width: { xs: 0, md: desktopWidth }, transition: (theme) => theme.transitions.create("width", { duration: theme.transitions.duration.standard }) }}>
        {/* Desktop sidebar (sticky, participates in layout) */}
        <Box
          component="nav"
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            width: "100%",
            bgcolor: "background.paper",
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
            height: (theme) => theme.appLayout.fullPage.minHeight,
            position: "sticky",
            top: 0,
            p: 1,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {/* Лого + divider — не скроллируются */}
          <Box sx={{ flexShrink: 0 }}>{stickyTop}</Box>
          {/* Список пунктов — скроллируется */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              minHeight: 0,
              scrollbarWidth: "thin",
              scrollbarColor: (theme) => `${alpha(theme.palette.text.primary, 0.28)} transparent`,
              "&::-webkit-scrollbar": { width: 8 },
              "&::-webkit-scrollbar-track": { background: "transparent" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.28),
                borderRadius: 8,
              },
              "&::-webkit-scrollbar-thumb:hover": {
                backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.42),
              },
            }}
          >
            {children}
          </Box>
          {/* Футер — не скроллируется */}
          <Box sx={{ flexShrink: 0 }}>{footer}</Box>
        </Box>
      </Box>

      {/* Mobile overlay sidebar (fixed, does not affect layout) */}
      <Box
        component="nav"
        sx={{
          display: { xs: "flex", md: "none" },
          flexDirection: "column",
          width: overlayWidth,
          bgcolor: "background.paper",
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          height: "100dvh",
          position: "fixed",
          left: 0,
          top: 0,
          p: 1,
          boxSizing: "border-box",
          overflow: "hidden",
          zIndex: (theme) => theme.zIndex.drawer + 5,
          boxShadow: 8,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 300ms ease-in-out !important",
        }}
      >
        {/* Лого + divider — не скроллируются */}
        <Box sx={{ flexShrink: 0 }}>{stickyTop}</Box>
        {/* Список пунктов — скроллируется */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
            scrollbarWidth: "thin",
            scrollbarColor: (theme) => `${alpha(theme.palette.text.primary, 0.28)} transparent`,
            "&::-webkit-scrollbar": { width: 8 },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.28),
              borderRadius: 8,
            },
            "&::-webkit-scrollbar-thumb:hover": {
              backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.42),
            },
          }}
        >
          {children}
        </Box>
        {/* Футер — не скроллируется */}
        <Box sx={{ flexShrink: 0 }}>{footer}</Box>
      </Box>
    </>
  );
};

// Mobile header with logo (< 768px - мобильные и планшеты)
const MobileSidebarHeader: React.FC = () => {
  const { mobileOpen, setMobileOpen } = useMobileSidebar();

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pt: 2,
        pb: 1.5,
        px: 1,
        opacity: mobileOpen ? 1 : 0,
        transform: mobileOpen ? "translateY(0)" : "translateY(-10px)",
        transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <RouterLink to="/home" onClick={() => setMobileOpen(false)} style={{ textDecoration: "none" }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            component="img"
            src={appLogo}
            alt="Academy KG"
            sx={{
              height: 36,
              width: "auto",
            }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.5px",
              background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Academy<span style={{ fontWeight: 400 }}>KG</span>
          </Typography>
        </Stack>
      </RouterLink>
    </Box>
  );
};

// Desktop header with logo and burger button on same level (>= 768px)
const DesktopSidebarHeader: React.FC = () => {
  const { siderCollapsed, setSiderCollapsed } = useThemedLayoutContext();

  const handleClick = () => {
    setSiderCollapsed?.(!siderCollapsed);
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: siderCollapsed ? "center" : "space-between",
        alignItems: "center",
        py: 1,
        px: 1,
      }}
    >
      {/* Логотип слева - скрывается при коллапсе */}
      <Box
        sx={{
          opacity: !siderCollapsed ? 1 : 0,
          transform: !siderCollapsed ? "translateX(0)" : "translateX(-10px)",
          transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
          width: !siderCollapsed ? "auto" : 0,
          overflow: "hidden",
        }}
      >
        <RouterLink to="/home" style={{ textDecoration: "none" }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              component="img"
              src={appLogo}
              alt="Academy KG"
              sx={{
                height: 28,
                width: "auto",
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 850,
                fontSize: "1.1rem",
                letterSpacing: "-0.4px",
                background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                whiteSpace: "nowrap"
              }}
            >
              Academy<span style={{ fontWeight: 450 }}>KG</span>
            </Typography>
          </Stack>
        </RouterLink>
      </Box>

      {/* Кнопка бургера - всегда видна */}
      <Tooltip title={siderCollapsed ? "Открыть меню" : "Скрыть меню"} placement="right">
        <IconButton onClick={handleClick} size="small">
          <MenuOutlined />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// Extra static sections: mimic the provided design with many items
const SidebarSecondary: React.FC = () => {
  const { siderCollapsed } = useThemedLayoutContext();
const { hasPermission, isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const isSuper = isSuperAdmin();

  // Во время загрузки прав не показываем элементы меню
  // Это предотвращает "моргание" при переключении вкладок
  if (permissionsLoading) {
    return <List sx={{ py: 0 }} />;
  }

  return (
    <>
      <List sx={{ py: 0 }}>
        {hasPermission(PERMISSIONS.APPOINTMENTS_READ) && hasPermission(PERMISSIONS.RECEPTION_READ) && (
          <SidebarMenuItem to="/home" icon={<HomeOutlined />} label="Регистратура" collapsed={siderCollapsed} />
        )}

        {hasPermission(PERMISSIONS.APPOINTMENTS_READ) && (
          <SidebarMenuItem to="/specialist" icon={<LocalHospitalOutlined />} label="Кабинет специалиста" collapsed={siderCollapsed} />
        )}

        {hasPermission(PERMISSIONS.APPOINTMENTS_READ) && (
          <SidebarMenuItem to="/all-appointments" icon={<HistoryOutlined />} label="Все приемы" collapsed={siderCollapsed} />
        )}
        {hasPermission(PERMISSIONS.EMPLOYEE_SCHEDULES_READ) && (
          <SidebarMenuItem to="/schedule" icon={<CalendarMonthOutlined />} label="Расписание" collapsed={siderCollapsed} />
        )}
        {hasPermission(PERMISSIONS.CLIENT_SCHEDULES_READ) && (
          <SidebarMenuItem to="/client-schedule" icon={<CalendarMonthOutlined />} label="Клиентское расписание" collapsed={siderCollapsed} />
        )}
        {hasPermission(PERMISSIONS.EMPLOYEES_READ) && (
          <SidebarMenuItem to="/employees" icon={<BadgeOutlined />} label="Сотрудники" collapsed={siderCollapsed} />
        )}

        {hasPermission(PERMISSIONS.CLIENTS_READ) && (
          <SidebarMenuItem to="/patient-search" icon={<SearchOutlined />} label="Поиск клиентов" collapsed={siderCollapsed} />
        )}

        {hasPermission(PERMISSIONS.REPORTS_READ) && (
          <SidebarMenuItem to="/reports" icon={<AnalyticsOutlined />} label="Отчеты" collapsed={siderCollapsed} />
        )}
        {hasPermission(PERMISSIONS.REPORTS_READ) && (
          <SidebarMenuItem to="/admin/load" icon={<AnalyticsOutlined />} label="Нагрузка" collapsed={siderCollapsed} />
        )}
        {hasPermission(PERMISSIONS.REPORTS_READ) && (
          <SidebarMenuItem to="/salary-reports" icon={<AccountBalanceWalletOutlined />} label="Отчет по ЗП" collapsed={siderCollapsed} />
        )}

        {hasPermission(PERMISSIONS.EXPENSES_READ) && (
          <SidebarMenuItem to="/expenses" icon={<PaymentsOutlined />} label="Расходы" collapsed={siderCollapsed} />
        )}
        {hasPermission(PERMISSIONS.EXPENSES_READ) && (
          <SidebarMenuItem to="/categories" icon={<CategoryOutlined />} label="Категории расходов" collapsed={siderCollapsed} />
        )}
        {hasPermission(PERMISSIONS.CASHBOX_READ) && (
          <SidebarMenuItem to="/cashbox" icon={<AccountBalanceWalletOutlined />} label="Касса" collapsed={siderCollapsed} />
        )}

        {hasPermission(PERMISSIONS.SERVICES_READ) && (
          <SidebarMenuItem to="/services" icon={<MedicalServicesOutlined />} label="Услуги" collapsed={siderCollapsed} />
        )}
        {isSuper && (
          <SidebarMenuItem to="/roles" icon={<AdminPanelSettingsOutlined />} label="Роли и права" collapsed={siderCollapsed} />
        )}
        {isSuper && (
          <SidebarMenuItem to="/branches" icon={<BusinessOutlined />} label="Управление филиалами" collapsed={siderCollapsed} />
        )}
        {/* Вход в страницу уведомлений временно отключен. */}
        {/* {hasPermission(PERMISSIONS.APP_SETTINGS_UPDATE) && (
          <SidebarMenuItem to="/settings/notifications" icon={<NotificationsOutlined />} label="Уведомления" collapsed={siderCollapsed} />
        )} */}

      </List>
    </>
  );
};

// Reusable item with tooltip-on-collapse
type SidebarMenuItemProps = {
  to: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  selected?: boolean;
  collapsed?: boolean;
  showBadge?: boolean;
};

const SidebarMenuItem: React.FC<SidebarMenuItemProps> = ({
  to,
  icon,
  label,
  selected,
  collapsed,
  showBadge = false,
}) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const collapsedFinal = (collapsed ?? false) && !isMobile;
  const isActive = selected ?? (location.pathname === to || location.pathname.startsWith(to + "/"));

  const text = (
    <Box
      sx={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        opacity: collapsedFinal ? 0 : 1,
        width: collapsedFinal ? 0 : "auto",
        transition: (theme) => theme.transitions.create(["opacity", "width", "margin"], { duration: 200 }),
        ml: collapsedFinal ? 0 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <ListItemText primary={label} />
      {showBadge && !collapsedFinal && (
        <Badge
          variant="dot"
          color="error"
          sx={{
            '& .MuiBadge-dot': {
              width: 8,
              height: 8,
              borderRadius: '50%',
            }
          }}
        />
      )}
    </Box>
  );

  const button = (
    <ListItem disablePadding>
      <ListItemButton
        component={RouterLink}
        to={to}
        selected={isActive}
        sx={{
          borderRadius: 4,
          my: 0.25,
          px: 1.4,
          color: (theme) => (isActive ? theme.palette.primary.main : undefined),
          '& .MuiListItemIcon-root': {
            color: (theme) => (isActive ? theme.palette.primary.main : undefined),
          },
          bgcolor: (theme) =>
            isActive
              ? (theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.22)
                : alpha(theme.palette.primary.main, 0.08))
              : 'transparent',
          '&:hover': {
            bgcolor: (theme) =>
              isActive
                ? (theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.main, 0.28)
                  : alpha(theme.palette.primary.main, 0.12))
                : theme.palette.action.hover,
          },
        }}
      >
        {icon && (
          <ListItemIcon sx={{ minWidth: 36 }}>
            {showBadge && collapsedFinal ? (
              <Badge
                variant="dot"
                color="error"
                sx={{
                  '& .MuiBadge-dot': {
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                  }
                }}
              >
                {icon}
              </Badge>
            ) : (
              icon
            )}
          </ListItemIcon>
        )}
        {text}
      </ListItemButton>
    </ListItem>
  );

  if (collapsedFinal) {
    return (
      <Tooltip title={label} placement="right">
        <Box>{button}</Box>
      </Tooltip>
    );
  }

  return button;
};

// Bottom area (user info + logout)
const SidebarFooter: React.FC = () => {
  const { siderCollapsed } = useThemedLayoutContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isCollapsed = siderCollapsed && !isMobile;

  const { employee, role } = usePermissions();
  const fullName = employee?.fullName ?? '';
  const roleLabel = role?.display_name ?? role?.name ?? '';

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [logoutOpen, setLogoutOpen] = React.useState(false);

  const handleLogoutClick = () => {
    setSettingsOpen(false);
    setLogoutOpen(true);
  };

  const handleConfirmLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <Box px={1} py={1.5}>
      <Stack
        direction={isCollapsed ? "column" : "row"}
        justifyContent={isCollapsed ? "center" : "space-between"}
        alignItems="center"
        spacing={1}
      >
        {isCollapsed ? (
          <Stack spacing={1} alignItems="center">
            <Tooltip title={fullName || "Профиль"} placement="right">
              <IconButton onClick={() => setSettingsOpen(true)} size="small">
                <SettingsOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Выйти" placement="right">
              <IconButton onClick={handleLogoutClick} size="small" color="error">
                <LogoutOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : (
          <>
            <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
              {fullName ? (
                <>
                  <Typography variant="caption" fontWeight={600} display="block" noWrap>
                    {fullName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {roleLabel}
                  </Typography>
                </>
              ) : (
                <Typography variant="caption" color="text.secondary" display="block">
                  Academy KG
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={0.5} flexShrink={0}>
              <Tooltip title="Настройки" placement="top">
                <IconButton onClick={() => setSettingsOpen(true)} size="small">
                  <SettingsOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Выйти" placement="top">
                <IconButton onClick={handleLogoutClick} size="small" color="error">
                  <LogoutOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </>
        )}
      </Stack>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Confirmation Dialog */}
      <Dialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
      >
        <DialogTitle id="logout-dialog-title">
          {"Выход из аккаунта"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="logout-dialog-description">
            Вы действительно хотите выйти из аккаунта?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutOpen(false)} color="inherit">
            Отмена
          </Button>
          <Button onClick={handleConfirmLogout} color="error" variant="contained" autoFocus>
            Выйти
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

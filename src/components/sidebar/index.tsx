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
import SecurityOutlined from "@mui/icons-material/SecurityOutlined";
import AppsOutlined from "@mui/icons-material/AppsOutlined";
import WorkOutlineOutlined from "@mui/icons-material/WorkOutlineOutlined";
import ApartmentOutlined from "@mui/icons-material/ApartmentOutlined";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import SavingsOutlined from "@mui/icons-material/SavingsOutlined";

import { useThemedLayoutContext } from "@refinedev/mui";
import { logout } from "../../services/auth";
import { Link as RouterLink, useLocation } from "react-router";
import { useBranchContext } from "../../contexts/branch-context";
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
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
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
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
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
  const { selectedBranch } = useBranchContext();
  const logoSrc = selectedBranch?.logoUrl || appLogo;
  const brandLabel = selectedBranch?.brandName || selectedBranch?.name || "";

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
            src={logoSrc}
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              if (e.currentTarget.src !== appLogo) e.currentTarget.src = appLogo;
            }}
            alt={selectedBranch?.brandName || selectedBranch?.name || "Academy KG"}
            sx={{
              height: 36,
              width: "auto",
              maxWidth: 120,
              objectFit: "contain",
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
              // Длинное название филиала: переносим на 2 строки и уменьшаем шрифт
              maxWidth: 220,
              textAlign: "center",
              wordBreak: "break-word",
              lineHeight: 1.15,
              fontSize: brandLabel.length > 16 ? "1.15rem" : undefined,
            }}
          >
            {brandLabel ? brandLabel : <>Academy<span style={{ fontWeight: 400 }}>KG</span></>}
          </Typography>
        </Stack>
      </RouterLink>
    </Box>
  );
};

// Desktop header with logo and burger button on same level (>= 768px)
const DesktopSidebarHeader: React.FC = () => {
  const { siderCollapsed, setSiderCollapsed } = useThemedLayoutContext();
  const { selectedBranch } = useBranchContext();
  const logoSrc = selectedBranch?.logoUrl || appLogo;
  const brandLabel = selectedBranch?.brandName || selectedBranch?.name || "";

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
              src={logoSrc}
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                if (e.currentTarget.src !== appLogo) e.currentTarget.src = appLogo;
              }}
              alt={selectedBranch?.brandName || selectedBranch?.name || "Academy KG"}
              sx={{
                height: 28,
                width: "auto",
                maxWidth: 110,
                objectFit: "contain",
              }}
            />
            <Typography
              variant="h6"
              title={brandLabel || undefined}
              sx={{
                fontWeight: 850,
                fontSize: brandLabel.length > 14 ? "0.95rem" : "1.1rem",
                letterSpacing: "-0.4px",
                background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                // Длинное название переносим максимум на 2 строки (не толкает бургер)
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                whiteSpace: "normal",
                wordBreak: "break-word",
                lineHeight: 1.1,
                maxWidth: 170,
              }}
            >
              {brandLabel ? brandLabel : <>Academy<span style={{ fontWeight: 450 }}>KG</span></>}
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

// Категории навигации — позволяют отфильтровать длинный список пунктов
// в компактную "плиточную" сетку наверху сайдбара.
type MenuCategory = "work" | "org" | "finance" | "admin";

type SidebarEntry = {
  to: string;
  icon: React.ReactNode;
  label: string;
  category: MenuCategory;
  visible: boolean;
};

// LocalStorage-ключ для запоминания выбранной категории между сессиями.
const ACTIVE_CATEGORY_STORAGE_KEY = "sidebar.activeCategory";

const SidebarSecondary: React.FC = () => {
  const { siderCollapsed } = useThemedLayoutContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const [activeCategory, setActiveCategory] = React.useState<MenuCategory | "all">(() => {
    if (typeof window === "undefined") return "all";
    const saved = window.localStorage.getItem(ACTIVE_CATEGORY_STORAGE_KEY);
    if (saved === "work" || saved === "org" || saved === "finance" || saved === "admin" || saved === "all") {
      return saved;
    }
    return "all";
  });

  const handleSetCategory = React.useCallback((next: MenuCategory | "all") => {
    setActiveCategory(next);
    try {
      window.localStorage.setItem(ACTIVE_CATEGORY_STORAGE_KEY, next);
    } catch { /* ignore quota / SSR */ }
  }, []);

  // Во время загрузки прав не показываем элементы меню
  // Это предотвращает "моргание" при переключении вкладок
  if (permissionsLoading) {
    return <List sx={{ py: 0 }} />;
  }

  const entries: SidebarEntry[] = [
    // Моя работа — повседневные операции
    { to: "/home", icon: <HomeOutlined />, label: "Регистратура", category: "work", visible: hasPermission(PERMISSIONS.APPOINTMENTS_READ) && hasPermission(PERMISSIONS.RECEPTION_READ) },
    { to: "/specialist", icon: <LocalHospitalOutlined />, label: "Кабинет специалиста", category: "work", visible: hasPermission(PERMISSIONS.APPOINTMENTS_READ) },
    { to: "/all-appointments", icon: <HistoryOutlined />, label: "Все услуги", category: "work", visible: hasPermission(PERMISSIONS.APPOINTMENTS_READ) },
    { to: "/schedule", icon: <CalendarMonthOutlined />, label: "Расписание", category: "work", visible: hasPermission(PERMISSIONS.EMPLOYEE_SCHEDULES_READ) },
    { to: "/skud", icon: <SecurityOutlined />, label: "СКУД", category: "work", visible: hasPermission(PERMISSIONS.WORK_SHIFTS_READ) || hasPermission(PERMISSIONS.WORK_SHIFTS_SELF_CLOCK_IN) },
    { to: "/client-schedule", icon: <CalendarMonthOutlined />, label: "Клиентское расписание", category: "work", visible: hasPermission(PERMISSIONS.CLIENT_SCHEDULES_READ) },
    { to: "/patient-search", icon: <SearchOutlined />, label: "Поиск клиентов", category: "work", visible: hasPermission(PERMISSIONS.CLIENTS_READ) },

    // Организация — структура
    { to: "/employees", icon: <BadgeOutlined />, label: "Сотрудники", category: "org", visible: hasPermission(PERMISSIONS.EMPLOYEES_READ) },
    { to: "/services", icon: <MedicalServicesOutlined />, label: "Услуги", category: "org", visible: hasPermission(PERMISSIONS.SERVICES_READ) },
    { to: "/branches", icon: <BusinessOutlined />, label: "Управление филиалами", category: "org", visible: hasPermission(PERMISSIONS.APP_SETTINGS_UPDATE) },

    // Финансы — деньги, отчёты
    { to: "/cashbox", icon: <AccountBalanceWalletOutlined />, label: "Касса", category: "finance", visible: hasPermission(PERMISSIONS.CASHBOX_READ) },
    { to: "/expenses", icon: <PaymentsOutlined />, label: "Расходы", category: "finance", visible: hasPermission(PERMISSIONS.EXPENSES_READ) },
    { to: "/categories", icon: <CategoryOutlined />, label: "Категории расходов", category: "finance", visible: hasPermission(PERMISSIONS.EXPENSES_READ) },
    { to: "/reports", icon: <AnalyticsOutlined />, label: "Отчеты", category: "finance", visible: hasPermission(PERMISSIONS.REPORTS_READ) },
    { to: "/admin/load", icon: <AnalyticsOutlined />, label: "Нагрузка", category: "finance", visible: hasPermission(PERMISSIONS.REPORTS_READ) },
    { to: "/salary-reports", icon: <AccountBalanceWalletOutlined />, label: "Отчет по ЗП", category: "finance", visible: hasPermission(PERMISSIONS.REPORTS_READ) },

    // Управление — админ-настройки
    { to: "/roles", icon: <AdminPanelSettingsOutlined />, label: "Роли и права", category: "admin", visible: hasPermission(PERMISSIONS.APP_SETTINGS_UPDATE) },
  ];

  const visibleEntries = entries.filter((e) => e.visible);
  const categoriesWithItems = new Set<MenuCategory>(visibleEntries.map((e) => e.category));
  const filteredEntries = activeCategory === "all"
    ? visibleEntries
    : visibleEntries.filter((e) => e.category === activeCategory);

  // В свёрнутом сайдбаре на десктопе плитки прячем — там нет места под текст;
  // показываем весь список как иконки, как было раньше.
  const showTiles = !(siderCollapsed && !isMobile);

  return (
    <>
      {showTiles && (
        <Stack spacing={0.75} sx={{ px: 0.5, pb: 1 }}>
          <CategoryTile
            label="Все"
            icon={<AppsOutlined fontSize="small" />}
            active={activeCategory === "all"}
            onClick={() => handleSetCategory("all")}
            fullWidth
          />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
            {categoriesWithItems.has("work") && (
              <CategoryTile
                label="Моя работа"
                icon={<WorkOutlineOutlined fontSize="small" />}
                active={activeCategory === "work"}
                onClick={() => handleSetCategory("work")}
              />
            )}
            {categoriesWithItems.has("org") && (
              <CategoryTile
                label="Организация"
                icon={<ApartmentOutlined fontSize="small" />}
                active={activeCategory === "org"}
                onClick={() => handleSetCategory("org")}
              />
            )}
            {categoriesWithItems.has("finance") && (
              <CategoryTile
                label="Финансы"
                icon={<SavingsOutlined fontSize="small" />}
                active={activeCategory === "finance"}
                onClick={() => handleSetCategory("finance")}
              />
            )}
            {categoriesWithItems.has("admin") && (
              <CategoryTile
                label="Управление"
                icon={<ManageAccountsOutlined fontSize="small" />}
                active={activeCategory === "admin"}
                onClick={() => handleSetCategory("admin")}
              />
            )}
          </Box>
        </Stack>
      )}

      <List sx={{ py: 0 }}>
        {(showTiles ? filteredEntries : visibleEntries).map((e) => (
          <SidebarMenuItem
            key={e.to}
            to={e.to}
            icon={e.icon}
            label={e.label}
            collapsed={siderCollapsed}
          />
        ))}
      </List>
    </>
  );
};

// Плитка-категория для верхней сетки сайдбара
type CategoryTileProps = {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  fullWidth?: boolean;
};

const CategoryTile: React.FC<CategoryTileProps> = ({ label, icon, active, onClick, fullWidth }) => (
  <Box
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
    sx={{
      cursor: "pointer",
      userSelect: "none",
      borderRadius: 1,
      border: "1px solid",
      borderColor: active ? "primary.main" : "divider",
      bgcolor: (theme) => (active ? alpha(theme.palette.primary.main, 0.08) : "transparent"),
      color: active ? "primary.main" : "text.primary",
      py: fullWidth ? 0.75 : 1,
      px: 1,
      display: "flex",
      flexDirection: fullWidth ? "row" : "column",
      alignItems: "center",
      justifyContent: "center",
      gap: fullWidth ? 0.75 : 0.25,
      minHeight: fullWidth ? 36 : 60,
      transition: "border-color 0.15s, background-color 0.15s",
      "&:hover": {
        borderColor: "primary.main",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
      },
      "&:focus-visible": {
        outline: "2px solid",
        outlineColor: "primary.main",
        outlineOffset: 1,
      },
    }}
  >
    {icon}
    <Typography
      variant="caption"
      fontWeight={600}
      sx={{
        fontSize: fullWidth ? "0.78rem" : "0.7rem",
        textAlign: "center",
        lineHeight: 1.1,
      }}
    >
      {label}
    </Typography>
  </Box>
);

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
          borderRadius: 1,
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

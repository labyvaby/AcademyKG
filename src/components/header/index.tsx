import MenuOutlined from "@mui/icons-material/MenuOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import LocalPhoneOutlined from "@mui/icons-material/LocalPhoneOutlined";
import TelegramIcon from "@mui/icons-material/Telegram";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import CorporateFareOutlined from "@mui/icons-material/CorporateFareOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import Alert from "@mui/material/Alert";
import appIcon from "../../assets/img/icon_2.png";

import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";

import { RefineThemedLayoutHeaderProps } from "@refinedev/mui";
import React from "react";
import { useMobileSidebar } from "../sidebar/mobile-context";
import { useBranchContext } from "../../contexts/branch-context";
import { useRefresh } from "../../contexts/refresh-context";
import { useTitleContext } from "../../contexts/title-context";
import { mapAnyToEmployee } from "../../features/employees/api";
import { apiFetch } from "../../utility/apiClient";
import { Employee } from "../../features/employees/types";
import PassportPhotoUploader from "../../features/employees/components/PassportPhotoUploader";
import { useNotification } from "@refinedev/core";
import SaveIcon from "@mui/icons-material/Save";
import { usePermissions, refetchPermissions } from "../../hooks/usePermissions";
import {
  parsePhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneLocalMaxLength,
  type PhoneCountryCode,
} from "../../utility/phone";
import { PhoneCountryCodeSelect } from "../ui";

export const Header: React.FC<RefineThemedLayoutHeaderProps> = ({
  sticky = true,
}) => {
  const [identity] = React.useState<{ name?: string; avatar?: string; email?: string } | null>(null);
  const [employee, setEmployee] = React.useState<Employee | null>(null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const { toggle } = useMobileSidebar();
  const { triggerRefresh, onRefresh } = useRefresh();
  const { title } = useTitleContext();

  const [roleInfo, setRoleInfo] = React.useState<{ name: string; display_name: string } | null>(null);
  const [specializationName, setSpecializationName] = React.useState<string | null>(null);
  const { open: notify } = useNotification();
  const [busy, setBusy] = React.useState(false);
  const [passportPhotos, setPassportPhotos] = React.useState<string[]>([]);
  const [passportFiles, setPassportFiles] = React.useState<File[]>([]);
  const [removedPassportUrls, setRemovedPassportUrls] = React.useState<string[]>([]);

  // Режим редактирования
  const [editMode, setEditMode] = React.useState(false);
  const [editFullName, setEditFullName] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editPhoneCode, setEditPhoneCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [editEmail, setEditEmail] = React.useState("");
  const [editTelegram, setEditTelegram] = React.useState("");
  const [editBank, setEditBank] = React.useState("");
  const [editNameError, setEditNameError] = React.useState("");

  // Смена пароля
  const [changePasswordMode, setChangePasswordMode] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showOldPassword, setShowOldPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState("");

  const { employee: empFromPerms, isSuperAdmin } = usePermissions();
  const isSuper = isSuperAdmin();
  const { branches, selectedBranch, setSelectedBranch } = useBranchContext();

  React.useEffect(() => {
    if (empFromPerms) {
      setEmployee(mapAnyToEmployee(empFromPerms));
      const roleName = empFromPerms.roleName ?? empFromPerms.roles?.name ?? '';
      const roleDisplayName = empFromPerms.roles?.display_name ?? roleName;
      if (roleName) {
        setRoleInfo({ name: roleName, display_name: roleDisplayName });
      }
    } else {
      setEmployee(null);
      setRoleInfo(null);
      setSpecializationName(null);
    }
  }, [empFromPerms]);

  // Дозагружаем полный профиль сотрудника при открытии модалки
  React.useEffect(() => {
    if (!profileOpen) return;
    const empId = empFromPerms?.id;
    if (!empId) return;
    apiFetch(`/api/v1/employees/${empId}/`)
      .then((res: any) => {
        const raw = res?.data ?? res;
        if (!raw?.id) return;
        const roleName = typeof raw.role === 'object' ? (raw.role?.displayName ?? raw.role?.name ?? '') : (raw.roleName ?? '');
        if (roleName) setRoleInfo({ name: roleName, display_name: roleName });
        const spec = raw.specializations?.[0]?.name ?? null;
        if (spec) setSpecializationName(spec);
        const full = mapAnyToEmployee(raw);
        if (full) setEmployee(full);
      })
      .catch(() => { /* оставляем то что уже есть */ });
  }, [profileOpen, empFromPerms]);

  React.useEffect(() => {
    if (employee) {
      setPassportPhotos(Array.isArray(employee.passport_photos) ? employee.passport_photos : []);
      setPassportFiles([]);
      setRemovedPassportUrls([]);
    }
  }, [employee]);

  // При закрытии диалога — сбрасываем режим редактирования
  const handleClose = () => {
    setProfileOpen(false);
    setEditMode(false);
    setEditNameError("");
    setChangePasswordMode(false);
    setOldPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordError("");
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (!oldPassword.trim()) { setPasswordError("Введите текущий пароль"); return; }
    if (newPassword.length < 8) { setPasswordError("Новый пароль должен быть не менее 8 символов"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Пароли не совпадают"); return; }
    try {
      setBusy(true);
      await apiFetch("/api/v1/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({ oldPassword: oldPassword.trim(), newPassword: newPassword.trim(), newPasswordConfirm: confirmPassword.trim() }),
      });
      notify?.({ type: "success", message: "Пароль успешно изменён" });
      setChangePasswordMode(false);
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPasswordError(msg || "Не удалось изменить пароль");
    } finally {
      setBusy(false);
    }
  };

  // Заполняем поля при переходе в режим редактирования
  const handleEnterEdit = () => {
    const parsed = parsePhone(employee?.phone ?? "");
    setEditFullName(employee?.full_name ?? "");
    setEditPhone(parsed.local);
    setEditPhoneCode(parsed.countryCode);
    setEditEmail(employee?.email ?? "");
    setEditTelegram(employee?.telegram_id ?? "");
    setEditBank(employee?.bank_account_number ?? "");
    setEditNameError("");
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditNameError("");
  };

  const handleSaveProfile = async () => {
    if (!empFromPerms?.id) return;

    const nameTrim = editFullName.trim();
    if (!nameTrim) {
      setEditNameError("Введите ФИО");
      return;
    }
    setEditNameError("");

    const payload: Record<string, unknown> = {
      fullName: nameTrim,
      email: editEmail.trim() || null,
    };

    try {
      setBusy(true);
      await apiFetch("/api/v1/users/me/", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      // Обновляем локальное состояние
      setEmployee((prev) => prev ? {
        ...prev,
        full_name: nameTrim,
        email: editEmail.trim() || prev.email,
      } : prev);

      notify?.({ type: "success", message: "Профиль обновлён" });
      setEditMode(false);
      // Принудительно обновляем глобальный кэш: сайдбар и хедер получат новое имя
      void refetchPermissions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify?.({ type: "error", message: "Не удалось сохранить профиль", description: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleSavePassport = async () => {
    if (!employee?.id) return;
    try {
      setBusy(true);
      notify?.({ type: "success", message: "Сохранение паспортных данных через новый API будет доступно в ближайшее время" });
      setPassportFiles([]);
      setRemovedPassportUrls([]);
    } catch (e) {
      console.error("Save passport failed:", e);
      notify?.({ type: "error", message: "Не удалось сохранить паспортные данные" });
    } finally {
      setBusy(false);
    }
  };

  const displayAvatar = employee?.photo_url || (empFromPerms as any)?.photoUrl || identity?.avatar;
  const displayName = employee?.full_name || (empFromPerms as any)?.fullName || identity?.name || "Пользователь";
  const displayEmail = employee?.email || identity?.email;
  const roleText = roleInfo?.display_name || roleInfo?.name || (employee?.status === 'active' ? "Сотрудник" : "Пользователь");

  return (
    <AppBar
      position={sticky ? "sticky" : "relative"}
      color="default"
      sx={{
        bgcolor: (theme) => theme.palette.background.paper,
        color: (theme) => theme.palette.text.primary,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
      elevation={0}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 56, sm: 64 },
          px: { xs: 1, sm: 2 },
          gap: { xs: 0.5, sm: 1 },
        }}
      >
        {/* Левая часть: Бургер-меню + Компактный логотип */}
        <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1 }}>
          <IconButton
            color="inherit"
            onClick={toggle}
            aria-label="Открыть меню"
            size="small"
            sx={{
              display: { xs: "inline-flex", md: "none" },
              p: { xs: 0.5, sm: 1 },
              ml: { xs: 1, sm: 1.5 },
            }}
          >
            <MenuOutlined fontSize="small" />
          </IconButton>

          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              gap: 1,
              '@media (min-width: 750px)': { display: "none" },
            }}
          >
            <Box
              component="img"
              src={appIcon}
              alt="Academy KG"
              sx={{ height: { xs: 28, sm: 32 }, width: "auto" }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "1.1rem", sm: "1.25rem" },
                letterSpacing: "-0.5px",
                background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: { xs: "block", sm: "block" }
              }}
            >
              Academy<span style={{ fontWeight: 400 }}>KG</span>
            </Typography>
          </Box>
        </Stack>

        {/* Центр: Заголовок страницы */}
        <Box sx={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
          maxWidth: { xs: "50%", md: "60%" },
        }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              fontSize: "1.5rem",
              color: "text.primary",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              opacity: title ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          >
            {title}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Правая часть: Branch switcher + Refresh + Avatar */}
        <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1 }} sx={{ ml: "auto" }}>
          <IconButton
            color="inherit"
            onClick={() => {
              if (onRefresh) triggerRefresh();
              else window.location.reload();
            }}
            aria-label="Обновить"
            size="small"
            sx={{
              p: { xs: 0.5, sm: 1 },
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              borderRadius: '50%',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                bgcolor: (theme) => theme.palette.primary.main,
                color: (theme) => theme.palette.primary.contrastText,
                transform: 'rotate(180deg)',
                boxShadow: (theme) => `0 4px 12px ${theme.palette.primary.main}40`,
              },
              '&:active': { transform: 'rotate(180deg) scale(0.9)' },
            }}
          >
            <RefreshOutlined sx={{ fontSize: { xs: 18, sm: 20 } }} />
          </IconButton>

          {(displayAvatar || displayName) && (
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              onClick={() => setProfileOpen(true)}
              sx={{
                cursor: "pointer",
                ml: 0.5,
                borderRadius: 24,
                pr: { xs: 0, md: 1.5 },
                py: 0.5,
                transition: 'background-color 0.2s',
                '&:hover': {
                  bgcolor: (theme) => theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.04)',
                }
              }}
            >
              <Avatar
                src={displayAvatar}
                alt={displayName}
                sx={{ width: { xs: 28, sm: 32, md: 36 }, height: { xs: 28, sm: 32, md: 36 } }}
              />
              {isSuper && branches.length > 0 ? (
                <Select
                  size="small"
                  value={selectedBranch?.id ?? "all"}
                  renderValue={(val) => {
                    const selectedLabel = val === "all"
                      ? "Все филиалы"
                      : branches.find((b) => b.id === val)?.name ?? "Все филиалы";
                    return (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, width: "100%", overflow: "hidden" }}>
                        <CorporateFareOutlined fontSize="small" sx={{ color: selectedBranch ? "primary.main" : "text.secondary", flexShrink: 0, alignSelf: "center" }} />
                        <Box component="span" sx={{ fontSize: "0.8rem", lineHeight: 1.2, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {selectedLabel}
                        </Box>
                      </Box>
                    );
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    const val = e.target.value;
                    if (val === "all") setSelectedBranch(null);
                    else setSelectedBranch(branches.find((b) => b.id === val) ?? null);
                    setTimeout(() => window.location.reload(), 50);
                  }}
                  sx={{
                    display: { xs: "none", md: "block" },
                    height: 34,
                    minWidth: 130,
                    maxWidth: 180,
                    bgcolor: selectedBranch ? (theme) => theme.palette.primary.main + "18" : "transparent",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: selectedBranch ? "primary.main" : "divider" },
                    "& .MuiSelect-select, & .MuiSelect-select.MuiInputBase-input, & .MuiOutlinedInput-input.MuiSelect-select": {
                      display: "flex !important",
                      alignItems: "center !important",
                      boxSizing: "border-box",
                      paddingTop: "0 !important",
                      paddingBottom: "0 !important",
                      paddingLeft: "10px !important",
                      paddingRight: "32px !important",
                      height: "100% !important",
                      minHeight: "unset !important",
                      lineHeight: "normal !important",
                      overflow: "hidden",
                    },
                  }}
                >
                  <MenuItem value="all">Все филиалы</MenuItem>
                  {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                  ))}
                </Select>
              ) : null}
            </Stack>
          )}

          {/* Диалог профиля */}
          <Dialog
            open={profileOpen}
            onClose={busy ? undefined : handleClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
              sx: { borderRadius: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", overflow: "hidden" }
            }}
          >
            <DialogContent sx={{ p: 0 }}>
              {/* Header Background */}
              <Box sx={{ height: 100, bgcolor: (theme) => theme.palette.primary.light, opacity: 0.15, mb: -10 }} />

              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", px: 3, pb: 4, gap: 1 }}>
                <Avatar
                  src={displayAvatar}
                  alt={displayName}
                  sx={{
                    width: 96,
                    height: 96,
                    mb: 2,
                    border: (theme) => `4px solid ${theme.palette.background.paper}`,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    zIndex: 1,
                  }}
                />

                {!editMode ? (
                  /* ── РЕЖИМ ПРОСМОТРА ── */
                  <>
                    <Box sx={{ textAlign: "center", mb: 1, width: "100%" }}>
                      <Typography variant="h5" component="h2" fontWeight="700">
                        {displayName}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center', mt: 1 }}>
                        <Typography variant="body1" color="text.secondary" fontWeight="500">
                          {roleText}
                        </Typography>
                        {specializationName && (
                          <Typography variant="body2" color="primary" fontWeight="600">
                            {specializationName}
                          </Typography>
                        )}
                        {employee?.status && (
                          <Chip
                            label={employee.status === "active" ? "Работает" : "Неактивен"}
                            size="small"
                            color={employee.status === "active" ? "success" : "default"}
                            variant="filled"
                            sx={{ mt: 0.5, fontWeight: 600, fontSize: '0.75rem', height: 20 }}
                          />
                        )}
                      </Box>
                    </Box>

                    <Stack spacing={2} sx={{ width: '100%' }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 1, borderRadius: '50%', bgcolor: 'action.hover' }}>
                          <LocalPhoneOutlined color="primary" fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Телефон</Typography>
                          <Typography variant="body2" fontWeight={500}>{employee?.phone || "—"}</Typography>
                        </Box>
                      </Stack>

                      <Divider />

                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 1, borderRadius: '50%', bgcolor: 'action.hover' }}>
                          <TelegramIcon color={employee?.telegram_id ? "primary" : "disabled"} fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Telegram ID</Typography>
                          <Typography variant="body2" fontWeight={500}>{employee?.telegram_id || "—"}</Typography>
                        </Box>
                      </Stack>

                      <Divider />

                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 1, borderRadius: '50%', bgcolor: 'action.hover' }}>
                          <EmailOutlined color={displayEmail ? "primary" : "disabled"} fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Email</Typography>
                          <Typography variant="body2" fontWeight={500}>{displayEmail || "—"}</Typography>
                        </Box>
                      </Stack>

                      <Divider />

                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 1, borderRadius: '50%', bgcolor: 'action.hover' }}>
                          <CreditCardOutlined color={employee?.bank_account_number ? "primary" : "disabled"} fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Банковский счет</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                            {employee?.bank_account_number
                              ? employee.bank_account_number.replace(/(.{4})/g, '$1 ').trim()
                              : "—"}
                          </Typography>
                        </Box>
                      </Stack>

                      <Divider />

                      <Box sx={{ mt: 1 }}>
                        <PassportPhotoUploader
                          photos={passportPhotos}
                          onAddPhoto={(file) => {
                            setPassportFiles((prev) => [...prev, file]);
                            const reader = new FileReader();
                            reader.onload = () => setPassportPhotos((prev) => [...prev, String(reader.result)]);
                            reader.readAsDataURL(file);
                          }}
                          onRemovePhoto={(url) => {
                            setPassportPhotos((prev) => prev.filter((u) => u !== url));
                            if (!url.startsWith('data:')) setRemovedPassportUrls((prev) => [...prev, url]);
                          }}
                          inputId="self-passport-photo-input"
                        />
                        {(passportFiles.length > 0 || removedPassportUrls.length > 0) && (
                          <Button
                            startIcon={busy ? <CircularProgress size={16} /> : <SaveIcon />}
                            variant="contained"
                            disabled={busy}
                            onClick={handleSavePassport}
                            sx={{ mt: 2, borderRadius: 24, px: 4, width: '100%' }}
                          >
                            Сохранить изменения
                          </Button>
                        )}
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ mt: 3, width: '100%' }}>
                      <Button
                        variant="outlined"
                        startIcon={<EditOutlined />}
                        onClick={handleEnterEdit}
                        sx={{ borderRadius: 24, flex: 1 }}
                      >
                        Редактировать
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<LockOutlined />}
                        onClick={() => setChangePasswordMode(true)}
                        sx={{ borderRadius: 24, flex: 1 }}
                      >
                        Пароль
                      </Button>
                    </Stack>
                    <Button
                      variant="text"
                      onClick={handleClose}
                      sx={{ borderRadius: 24, mt: 1, width: '100%' }}
                    >
                      Закрыть
                    </Button>
                  </>
                ) : changePasswordMode ? (
                  /* ── СМЕНА ПАРОЛЯ ── */
                  <>
                    <Box sx={{ textAlign: "center", mb: 2 }}>
                      <Typography variant="h6" fontWeight="700">Смена пароля</Typography>
                    </Box>
                    <Stack spacing={2} sx={{ width: '100%' }}>
                      {passwordError && <Alert severity="error" sx={{ borderRadius: 2 }}>{passwordError}</Alert>}
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Текущий пароль *</Typography>
                        <TextField
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          fullWidth
                          size="small"
                          type={showOldPassword ? "text" : "password"}
                          placeholder="••••••••"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton size="small" onClick={() => setShowOldPassword(!showOldPassword)}>
                                  {showOldPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Stack>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Новый пароль *</Typography>
                        <TextField
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          fullWidth
                          size="small"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Минимум 8 символов"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton size="small" onClick={() => setShowNewPassword(!showNewPassword)}>
                                  {showNewPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Stack>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Повторите новый пароль *</Typography>
                        <TextField
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          fullWidth
                          size="small"
                          type="password"
                          placeholder="••••••••"
                          error={!!confirmPassword && confirmPassword !== newPassword}
                          helperText={confirmPassword && confirmPassword !== newPassword ? "Пароли не совпадают" : ""}
                        />
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 3, width: '100%' }}>
                      <Button
                        variant="contained"
                        startIcon={busy ? <CircularProgress size={16} /> : <LockOutlined />}
                        onClick={handleChangePassword}
                        disabled={busy}
                        sx={{ borderRadius: 24, flex: 1 }}
                      >
                        Сохранить пароль
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<ArrowBackOutlined />}
                        onClick={() => { setChangePasswordMode(false); setOldPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordError(""); }}
                        disabled={busy}
                        sx={{ borderRadius: 24, flex: 1 }}
                      >
                        Назад
                      </Button>
                    </Stack>
                  </>
                ) : (
                  /* ── РЕЖИМ РЕДАКТИРОВАНИЯ ── */
                  <>
                    <Box sx={{ textAlign: "center", mb: 1 }}>
                      <Typography variant="h6" fontWeight="700">Редактирование профиля</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Роль изменить нельзя — обратитесь к администратору
                      </Typography>
                    </Box>

                    <Stack spacing={2} sx={{ width: '100%' }}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>ФИО *</Typography>
                        <TextField
                          value={editFullName}
                          onChange={(e) => { setEditFullName(e.target.value); setEditNameError(""); }}
                          fullWidth
                          size="small"
                          error={Boolean(editNameError)}
                          helperText={editNameError}
                          placeholder="Введите ФИО"
                        />
                      </Stack>

                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Телефон</Typography>
                        <TextField
                          value={editPhone}
                          onChange={(e) => {
                            const maxLen = getPhoneLocalMaxLength(editPhoneCode);
                            setEditPhone(e.target.value.replace(/[^\d]/g, "").slice(0, maxLen));
                          }}
                          fullWidth
                          size="small"
                          disabled
                          placeholder="XXX XXX XXX"
                          helperText="Контактные данные обновляются через HR-модуль"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start" sx={{ mr: 1, ml: "-14px" }}>
                                <PhoneCountryCodeSelect value={editPhoneCode} onChange={setEditPhoneCode} />
                              </InputAdornment>
                            ),
                          }}
                          inputProps={{ inputMode: "tel", pattern: "[0-9]*" }}
                        />
                      </Stack>

                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Email</Typography>
                        <TextField
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          fullWidth
                          size="small"
                          type="email"
                          placeholder="example@mail.com"
                        />
                      </Stack>

                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Telegram ID</Typography>
                        <TextField
                          value={editTelegram}
                          onChange={(e) => setEditTelegram(e.target.value.replace(/[^0-9]/g, ""))}
                          fullWidth
                          size="small"
                          disabled
                          placeholder="Только цифры"
                          inputProps={{ inputMode: "numeric" }}
                        />
                      </Stack>

                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Банковский счёт</Typography>
                        <TextField
                          value={editBank}
                          onChange={(e) => setEditBank(e.target.value.replace(/[^0-9]/g, "").slice(0, 16))}
                          fullWidth
                          size="small"
                          disabled
                          placeholder="16 цифр"
                          inputProps={{ inputMode: "numeric" }}
                          helperText="Редактирование банковских реквизитов ограничено"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <CreditCardOutlined fontSize="small" color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ mt: 3, width: '100%' }}>
                      <Button
                        variant="contained"
                        startIcon={busy ? <CircularProgress size={16} /> : <SaveIcon />}
                        onClick={handleSaveProfile}
                        disabled={busy}
                        sx={{ borderRadius: 24, flex: 1 }}
                      >
                        Сохранить
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<CloseOutlined />}
                        onClick={handleCancelEdit}
                        disabled={busy}
                        sx={{ borderRadius: 24, flex: 1 }}
                      >
                        Отмена
                      </Button>
                    </Stack>
                  </>
                )}
              </Box>
            </DialogContent>
          </Dialog>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

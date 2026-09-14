import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Divider,
  Stack,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Paper,
  Dialog,
  Avatar,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import MedicalServicesOutlined from "@mui/icons-material/MedicalServicesOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import DirectionsWalkOutlined from "@mui/icons-material/DirectionsWalkOutlined";
import PersonOffOutlined from "@mui/icons-material/PersonOffOutlined";

import { PaymentSidebar } from "./PaymentSidebar";
import PatientQuickViewDrawer from "../../../components/patients/PatientQuickViewDrawer";
import ServiceQuickViewDrawer from "../../../components/services/ServiceQuickViewDrawer";
import DoctorQuickViewDrawer from "../../../components/employees/DoctorQuickViewDrawer";
import { PaymentInfoBlock } from "../../../components/ui";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { printReceipt } from "../../../components/ui/PaymentReceipt";
import { useEffectiveBranch } from "../../../hooks/useEffectiveBranch";

import { apiFetch } from "../../../utility/apiClient";
import { markAttendance } from "../../../features/group-appointments/api/group-appointments.api";
import { setCachedDetail, getCachedDetail } from "../../../utility/appointmentCache";
import EditAppointmentSidebar from "./EditAppointmentSidebar";
import { useHasPermission, usePermissions } from "../../../hooks/usePermissions";
import { PERMISSIONS } from "../../../constants/permissions";
import { canSeePatientBalance, canViewSpecialistContent, canViewAllAppointments } from "../../../utils/permissionHelpers";

import { getStatusConfig, getStatusChipSx, APPOINTMENT_STATUSES } from "../../../config/appointmentStatuses";
import { useAppointmentDetails } from "../../../hooks/useAppointmentDetails";
import { usePatientBalance } from "../../patient-search/usePatientBalance";

import { Appointment } from "../types";
import { useBranchCurrency } from "../../../hooks/useBranchCurrency";

type AppointmentDetailsCardProps = {
  appointmentId: string | null;
  onClose: () => void;
  onUpdate: () => void; // Callback to refresh list after changes
  onStartAppointment?: (patientId: string) => void;
  hideActionsForDoctor?: boolean; // Hide doctor-specific actions (for doctor workspace page)
  extraHeaderActions?: React.ReactNode; // Additional actions to show in header
  showPaymentAction?: boolean; // Показать кнопку "Принять оплату"
  readOnly?: boolean; // If true, hide all editing/status changing actions
};

export const AppointmentDetailsCard: React.FC<AppointmentDetailsCardProps> = ({
  appointmentId,
  onClose,
  onUpdate,
  onStartAppointment,
  hideActionsForDoctor = false,
  extraHeaderActions,
  showPaymentAction = false,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme(); // Need theme for matches
  const { suffix, format: formatKGS } = useBranchCurrency();
  // Hide specific elements on mobile if requested, but here we use it for logic
  const isMobile = useMediaQuery(theme.breakpoints.down("md")); // Same breakpoint as pages

  // Fetch data using custom hook with caching
  const {
    item,
    patientData,
    appointmentDoctors,
    servicesPhotos,
    loading: hookLoading,
    error: hookError,
    refresh
  } = useAppointmentDetails(appointmentId);

  // Local state for actions
  const [actionLoading, setActionLoading] = React.useState(false);
  // Combined loading state for UI
  const loading = hookLoading || actionLoading;

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (hookError) setErrorMsg(hookError);
    else setErrorMsg(null);
  }, [hookError]);

  // Sidebar редактирования приема
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const { isSuperAdmin, hasPermission, employeeId } = usePermissions();
  const canDelete = isSuperAdmin() || hasPermission(PERMISSIONS.APPOINTMENTS_DELETE);
  const selectedBranch = useEffectiveBranch();

  const canManageAppointment = hasPermission(PERMISSIONS.APPOINTMENTS_UPDATE);
  const canViewAsSpecialist = canViewSpecialistContent(hasPermission);

  // Drawer'ы быстрого просмотра
  const [patientDrawerOpen, setPatientDrawerOpen] = React.useState(false);
  const [serviceDrawerOpen, setServiceDrawerOpen] = React.useState(false);
  const [selectedServiceId, setSelectedServiceId] = React.useState<string | null>(null);
  const [doctorDrawerOpen, setDoctorDrawerOpen] = React.useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string | null>(null);

  // Врачи приёма (Calculated from hook data, no state needed if direct usage, but existing code might rely on state?)
  // actually...


  // We should call `refresh()` when we update status or delete internally.
  const handleRefresh = React.useCallback(() => {
    refresh();
    onUpdate(); // Call parent update too
  }, [refresh, onUpdate]);

  // Payment Sidebar
  const [paymentOpen, setPaymentOpen] = React.useState(false);

  // Attendance
  const [attendanceBusy, setAttendanceBusy] = React.useState(false);
  const handleAttendanceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!item || attendanceBusy) return;
    setAttendanceBusy(true);
    try {
      await markAttendance(item.id, e.target.checked);
      refresh();
    } catch {
      // ignore — server will return error if not paid
    } finally {
      setAttendanceBusy(false);
    }
  };

  const canSeeBalance = canSeePatientBalance(hasPermission);
  const { balance: patientBalance } = usePatientBalance(
    canSeeBalance ? (item?.patient_id ?? null) : null
  );

  // Status Handlers
  const { open } = useNotification();

  // Confirmation Dialog State
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"cancel" | "delete" | "not_came" | null>(null);
  // Причина отмены — обязательна при переводе приёма в статус "Отменено"
  const [cancellationReason, setCancellationReason] = React.useState("");


  const queryClient = useQueryClient();


  const handleStatusUpdate = async (newStatus: string, reason?: string) => {
    if (!item || !appointmentId) return;

    const STATUS_API_MAP: Record<string, string> = {
      "Отменено": "cancelled",
      "Клиент не пришел": "not_came",
    };
    const apiStatus = STATUS_API_MAP[newStatus] ?? newStatus;

    // Бэк требует cancellationReason при новом переводе в "cancelled"
    const body: Record<string, unknown> = { status: apiStatus };
    if (apiStatus === "cancelled" && reason?.trim()) {
      body.cancellationReason = reason.trim();
    }

    try {
      setActionLoading(true);
      await apiFetch(`/api/v1/appointments/${appointmentId}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      open?.({ message: t("details.statusUpdated"), type: "success" });
      handleRefresh();
    } catch (e: unknown) {
      const description = e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message) : String(e);
      open?.({ message: t("details.statusUpdateError"), type: "error", description });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArrived = () => handleStatusUpdate(APPOINTMENT_STATUSES.PATIENT_ARRIVED);

  const handleConfirmAction = async () => {
    setConfirmOpen(false);
    if (confirmAction === 'cancel') {
      await handleStatusUpdate(APPOINTMENT_STATUSES.CANCELLED, cancellationReason);
      setCancellationReason("");
    } else if (confirmAction === 'not_came') {
      await handleStatusUpdate(APPOINTMENT_STATUSES.PATIENT_NOT_CAME);
    } else if (confirmAction === 'delete') {
      if (!item || deleting) return;
      try {
        setDeleting(true);
        await apiFetch(`/api/v1/appointments/${item.id}/`, {
            method: "DELETE",
        });

        // Чистим кэш истории клиентов
        try {
          Object.keys(localStorage)
            .filter(k => k.startsWith("patientSearch.history.v1."))
            .forEach(k => localStorage.removeItem(k));
        } catch { /* ignore */ }

        open?.({
          message: t("details.appointmentDeleted"),
          type: "success",
        });
        onClose();
        onUpdate();
        // No need to refresh local here as we close it
      } catch (e: unknown) {
        console.error("Delete appointment failed:", e);
        const description =
          e && typeof e === "object" && "message" in e
            ? String((e as { message?: unknown }).message)
            : String(e);
        open?.({
          message: t("details.appointmentDeleteError"),
          type: "error",
          description,
        });
      } finally {
        setDeleting(false);
      }
    }
    setConfirmAction(null);
  };

  // Wrapper for buttons to trigger dialog
  const promptDelete = () => {
    setConfirmAction('delete');
    setConfirmOpen(true);
  };

  const promptCancel = () => {
    setCancellationReason("");
    setConfirmAction('cancel');
    setConfirmOpen(true);
  };

  const promptNotCame = () => {
    setConfirmAction('not_came');
    setConfirmOpen(true);
  };


  if (!appointmentId) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 1,
          color: "text.secondary",
          p: 2,
        }}
      >
        <Typography align="center">
          {t("details.selectAppointment")}
        </Typography>
      </Box>
    );
  }

  return (
    <Card
      variant={isMobile ? "elevation" : "outlined"}
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: 'border-box',
        m: 0,
        p: 0
      }}
    >
      <CardHeader
        title={
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 1, sm: 2 },
            flexWrap: 'wrap',
          }}>
            {/* Основные действия - слева */}
            <Stack
              direction="row"
              spacing={{ xs: 0.5, sm: 1 }}
              alignItems="center"
              flexWrap="wrap"
              sx={{ gap: { xs: 0.5, sm: 1 }, overflow: 'hidden' }}
            >
              {item && !hideActionsForDoctor && !readOnly && (
                <>
                  {/* Кнопки для тренера: Отменить и Не пришел (только если нет прав на управление) */}
                  {canViewAsSpecialist && !canManageAppointment && item.status !== APPOINTMENT_STATUSES.CANCELLED && item.status !== APPOINTMENT_STATUSES.PATIENT_NOT_CAME && (
                    <>
                      <Button
                        variant="outlined"
                        size="small"
                        color="warning"
                        startIcon={<PersonOffOutlined />}
                        disabled={actionLoading}
                        onClick={promptNotCame}
                      >
                        {t("details.notCameShort")}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<DirectionsWalkOutlined />}
                        disabled={actionLoading}
                        onClick={promptCancel}
                      >
                        {t("details.cancelAppointment")}
                      </Button>
                    </>
                  )}

                  {/* Кнопки для регистратуры/админа: Отменить и Клиент не пришел */}
                  {canManageAppointment && item.status !== APPOINTMENT_STATUSES.CANCELLED && item.status !== APPOINTMENT_STATUSES.PATIENT_NOT_CAME && (
                    <>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<PersonOffOutlined />}
                        disabled={actionLoading}
                        onClick={promptNotCame}
                      >
                        {t("details.clientNotCame")}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        disabled={actionLoading}
                        onClick={promptCancel}
                      >
                        {t("details.cancelAppointment")}
                      </Button>
                    </>
                  )}

                  {/* Кнопка изменения только для админов и регистраторов */}
                  {canManageAppointment && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditOutlined />}
                      onClick={() => setEditOpen(true)}
                    >
                      {t("common.change")}
                    </Button>
                  )}
                </>
              )}


              {/* Extra header actions */}
              {extraHeaderActions}
            </Stack>

            {/* Второстепенные действия - справа - Show for Admin/SuperAdmin/Receptionist */}
            {item && !hideActionsForDoctor && !readOnly && canManageAppointment && (
              <Stack direction="row" spacing={1}>

                {/* Кнопка удаления приема - только для Супер-админа */}
                {isSuperAdmin() && (
                  <Tooltip title={t("common.delete")}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!canDelete || deleting}
                        onClick={promptDelete}
                        sx={{
                          border: '1px solid',
                          borderColor: 'error.main',
                          color: 'error.main',
                          '&:hover': {
                            borderColor: 'error.dark',
                            backgroundColor: (theme) => alpha(theme.palette.error.main, 0.08),
                          },
                          '&.Mui-disabled': {
                            borderColor: 'action.disabled',
                            color: 'action.disabled',
                          },
                        }}
                      >
                        {deleting ? <CircularProgress size={20} color="error" /> : <DeleteOutlineOutlined fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Stack>
            )}
          </Box>
        }
        action={
          /* Служебное действие - закрытие (выше всех) */
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
          </IconButton>
        }
        sx={{
          px: 3, // Fixed 24px on all mobile/tablet views for consistency
          pb: 1,
          boxSizing: 'border-box'
        }} />
      <Divider />
      <CardContent sx={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        p: 2,
        px: 3, // Fixed 24px
        boxSizing: 'border-box'
      }}>
        {
          loading ? (
            <Typography variant="caption">{t("common.loading")}</Typography>
          ) : item ? (
            <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
              <CalendarMonthOutlined fontSize="medium" sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={700} color="text.primary">
                {item.formatted_date}
              </Typography>
              {/* Метаданные создания и изменения */}
              <Stack direction="column" spacing={0} sx={{ ml: 1 }}>
                {item.created_by_name && (
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.725rem', lineHeight: 1.2 }}>
                    {t("details.createdBy", { name: item.created_by_name, date: dayjs(item.created_at).format("DD.MM HH:mm") })}
                  </Typography>
                )}
                {item.updated_by_name && item.updated_at && item.updated_at !== item.created_at && (
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.725rem', lineHeight: 1.2 }}>
                    {t("details.updatedBy", { name: item.updated_by_name, date: dayjs(item.updated_at).format("DD.MM HH:mm") })}
                  </Typography>
                )}
              </Stack>
            </Stack>
          ) : null
        }
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : errorMsg ? (
          <Typography color="error">{t("common.errorWithMsg", { msg: errorMsg })}</Typography>
        ) : item ? (
          <Stack spacing={3}>


            {canSeeBalance && (
              <>
                {/* Payment Information */}
                <PaymentInfoBlock
                  payment={{
                    baseTotal: Number(item.total_amount || item.total_cost || item.estimated_total || 0),
                    cash: Number(item.paid_cash || 0),
                    card: Number(item.paid_card || 0),
                    balance: Number(item.paid_balance || 0),
                    bonuses: Number(item.paid_bonuses || 0),
                    finalTotal: Number(item.total_amount || item.total_cost || item.estimated_total || 0),
                    debt: Number(item.debt || 0),
                    status: item.status,
                  }}
                  variant="detailed"
                  showIcons={true}
                  actionButton={
                    showPaymentAction ? (
                      (() => {
                        const hasPayment =
                          (item.paid_cash ?? 0) > 0 ||
                          (item.paid_card ?? 0) > 0 ||
                          (item.paid_balance ?? 0) > 0 ||
                          (item.paid_bonuses ?? 0) > 0;
                        return (
                          <Button
                            variant={hasPayment ? "outlined" : "contained"}
                            color={hasPayment ? "primary" : "success"}
                            size="small"
                            onClick={() => setPaymentOpen(true)}
                            sx={{
                              boxShadow: 'none',
                              textTransform: 'none',
                              whiteSpace: 'nowrap',
                              minWidth: hasPayment ? 'auto' : undefined,
                              px: hasPayment ? 1.5 : 2,
                            }}
                          >
                            {hasPayment ? t("details.editPayment") : t("details.acceptPayment")}
                          </Button>
                        );
                      })()
                    ) : undefined
                  }
                />
                {item.debt === 0 && (
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: -1 }}>
                    <Tooltip title={item.attended ? t("details.attendedTooltipOn") : t("details.attendedTooltipOff")} disableInteractive>
                      <span>
                        <Checkbox
                          size="small"
                          checked={Boolean(item.attended)}
                          onChange={handleAttendanceChange}
                          disabled={attendanceBusy}
                          color="success"
                          sx={{ p: 0.5 }}
                        />
                      </span>
                    </Tooltip>
                    <Typography variant="caption" color={item.attended ? "success.main" : "text.secondary"}>
                      {item.attended ? t("details.attended") : t("details.attendedQuestion")}
                    </Typography>
                  </Stack>
                )}
                {((item.paid_cash ?? 0) > 0 || (item.paid_card ?? 0) > 0 ||
                  (item.paid_balance ?? 0) > 0 || (item.paid_bonuses ?? 0) > 0) && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<PrintOutlinedIcon fontSize="small" />}
                    sx={{ alignSelf: "flex-start", textTransform: "none", px: 0.5 }}
                    onClick={() => {
                      const baseTotal = Number(item.total_amount || item.total_cost || item.estimated_total || 0);
                      const disc = Number(item.discount || 0);
                      const cash = Number(item.paid_cash || 0);
                      const card = Number(item.paid_card || 0);
                      const bal = Number(item.paid_balance || 0);
                      const bon = Number(item.paid_bonuses || 0);
                      const pct = baseTotal > 0 ? Math.round((disc / baseTotal) * 100) : 0;
                      printReceipt({
                        appointment: item,
                        cashPaid: cash,
                        cardPaid: card,
                        balancePaid: bal,
                        bonusesPaid: bon,
                        discountPercent: pct,
                        discountAmount: disc,
                        basePrice: baseTotal,
                        finalPrice: Math.max(0, baseTotal - disc),
                        cashierName: item.updated_by_name ?? item.created_by_name ?? null,
                        orgName: selectedBranch?.brandName || selectedBranch?.name,
                        branchName: selectedBranch?.name ?? null,
                        isReprint: true,
                      });
                    }}
                  >
                    {t("payment.printReceipt")}
                  </Button>
                )}
                <Divider />
              </>
            )}

            {/* Patient */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                {t("home.client")}
              </Typography>
              <Paper
                variant={isMobile ? "elevation" : "outlined"}
                elevation={0}
                onClick={() => item.patient_id && setPatientDrawerOpen(true)}
                sx={{
                  p: 2,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04), // slightly darker for better contrast without border
                  cursor: item.patient_id ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  '&:hover': item.patient_id ? {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                    borderColor: 'primary.main',
                  } : {},
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Avatar
                  src={patientData?.photo_url || undefined}
                  sx={{
                    width: 48,
                    height: 48,
                    mr: 2,
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                  }}
                >
                  {item.patient_name?.charAt(0) || 'П'}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight={600}>
                    {item.patient_name || t("details.notSpecified")}
                  </Typography>

                  {patientData?.phone && (
                    <Typography
                      variant="body2"
                      color="primary"
                      component="a"
                      href={`tel:${patientData.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {patientData.phone}
                    </Typography>
                  )}

                  {/* Patient Balance — visible for admin/registrator when balance is non-zero or there are bonuses */}
                  {canSeeBalance && patientBalance && (patientBalance.balance !== 0 || patientBalance.bonuses > 0) && (
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {patientBalance.balance !== 0 && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            {patientBalance.balance < 0 ? t("details.balanceDebt") : t("details.account")}
                          </Typography>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color={patientBalance.balance < 0 ? "error.main" : "success.main"}
                          >
                            {patientBalance.balance.toLocaleString()} {suffix}
                          </Typography>
                        </Stack>
                      )}
                      {patientBalance.bonuses > 0 && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="caption" color="text.secondary">{t("details.points")}</Typography>
                          <Typography variant="caption" fontWeight={700} color="warning.main">
                            {patientBalance.bonuses.toLocaleString()} {suffix}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  )}
                </Box>
              </Paper>
            </Box>


            {/* Services Grouped by Doctor */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                {t("details.servicesAndSpecialists")}
              </Typography>
              <Stack spacing={2}>
                {(() => {
                  try {
                    let services: any[] = [];
                    if (item.services_json) {
                      services = typeof item.services_json === 'string'
                        ? JSON.parse(item.services_json)
                        : item.services_json;
                    }

                    if (!Array.isArray(services) || services.length === 0) {
                      return (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
                          }}
                        >
                          <Typography variant="body1" color="text.secondary">—</Typography>
                        </Paper>
                      );
                    }

                    // Group by doctor
                    const grouped: Record<string, { doctor: any, services: any[] }> = {};
                    const noDoctorServices: any[] = [];

                    services.forEach(svc => {
                      if (!svc) return;
                      // Safe access to properties
                      const docId = svc.doctor_id || svc.performer_id;
                      if (!docId && !svc.service_id && !svc.id) return;

                      if (docId) {
                        if (!grouped[docId]) {
                          grouped[docId] = {
                            doctor: {
                              id: docId,
                              name: svc.doctor_name || svc.performer_name || t("home.specialist"),
                              photo: svc.doctor_photo || svc.performer_photo || null
                            },
                            services: []
                          };
                        }
                        grouped[docId].services.push(svc);
                      } else {
                        noDoctorServices.push(svc);
                      }
                    });

                    const renderServiceItem = (svc: any, idx: number) => {
                      if (!svc) return null;
                      // service_id = UUID SellableItem (для quick view endpoint /services/{id}/)
                      // svc.id = UUID AppointmentService (только для ключей React)
                      const sellableId = svc.service_id || null;
                      const sidStr = sellableId ? String(sellableId) : null;
                      const serviceName = svc.name ?? svc.service_name ?? t("details.service");
                      const servicePrice = Number(svc.price ?? svc.cost ?? 0);
                      const servicePhoto = svc.image_url || (sidStr && servicesPhotos ? servicesPhotos.get(sidStr) : null);

                      return (
                        <Paper
                          key={svc.id || idx}
                          variant="outlined"
                          onClick={() => {
                            if (sellableId) {
                              setSelectedServiceId(sellableId);
                              setServiceDrawerOpen(true);
                            }
                          }}
                          sx={{
                            p: 1.5,
                            pl: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            bgcolor: 'background.paper',
                            cursor: sellableId ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                            '&:hover': sellableId ? {
                              borderColor: 'primary.main',
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
                            } : {},
                          }}
                        >
                          <Avatar
                            src={servicePhoto || undefined}
                            variant="rounded"
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: 'action.selected',
                              color: 'text.secondary',
                            }}
                          >
                            <MedicalServicesOutlined fontSize="small" />
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {serviceName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatKGS(servicePrice)}
                            </Typography>
                          </Box>
                        </Paper>
                      );
                    };

                    return (
                      <Stack spacing={2}>
                        {Object.values(grouped).map((group) => (
                          <Box key={group.doctor.id}>
                            {/* Doctor Header */}
                            <Paper
                              variant="outlined"
                              onClick={() => {
                                setSelectedDoctorId(group.doctor.id);
                                setDoctorDrawerOpen(true);
                              }}
                              sx={{
                                p: 1.5,
                                mb: 1,
                                display: 'flex',
                                alignItems: 'center',
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                                borderColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                                  borderColor: 'primary.main',
                                },
                              }}
                            >
                              <Avatar
                                src={group.doctor.photo || undefined}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  mr: 1.5,
                                  bgcolor: 'primary.main',
                                  fontSize: '0.875rem'
                                }}
                              >
                                {group.doctor.name?.charAt(0) || '?'}
                              </Avatar>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {group.doctor.name || t("home.specialist")}
                              </Typography>
                            </Paper>

                            {/* Doctor's Services */}
                            <Stack spacing={1} sx={{ pl: 2 }}>
                              {group.services.map((svc, idx) => renderServiceItem(svc, idx))}
                            </Stack>
                          </Box>
                        ))}

                        {/* Services without doctor */}
                        {noDoctorServices.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ml: 1 }}>
                              {t("details.otherServices")}
                            </Typography>
                            <Stack spacing={1}>
                              {noDoctorServices.map((svc, idx) => renderServiceItem(svc, idx))}
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    );
                  } catch (e) {
                    console.error("Error grouped services:", e);
                    return null;
                  }
                })()}
              </Stack>
            </Box>


            {/* Причина отмены — показываем для отменённых приёмов */}
            {item.status?.startsWith("Отмен") && (
              <Box>
                <Typography variant="subtitle2" color="error.main" gutterBottom>
                  {t("details.cancellationReason")}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    bgcolor: (theme) => alpha(theme.palette.error.main, 0.04),
                    p: 1,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: (theme) => alpha(theme.palette.error.main, 0.2),
                    color: item.cancellation_reason ? "text.primary" : "text.secondary",
                    fontStyle: item.cancellation_reason ? "normal" : "italic",
                  }}
                >
                  {item.cancellation_reason || t("details.reasonNotSpecified")}
                </Typography>
              </Box>
            )}

            {/* Комментарий администратора */}
            {item.admin_comment && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t("payment.adminComment")}
                </Typography>
                <Typography variant="body2" sx={{ bgcolor: "background.paper", p: 1, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                  {item.admin_comment}
                </Typography>
              </Box>
            )}


            {canViewAsSpecialist && !canSeeBalance && (
              <>
                <Divider />
                <Typography variant="caption" color="text.secondary" display="block">
                  {t("details.paymentInfo")}
                </Typography>
                <PaymentInfoBlock
                  payment={{
                    baseTotal: Number(item.total_amount || item.total_cost || item.estimated_total || 0),
                    cash: Number(item.paid_cash || 0),
                    card: Number(item.paid_card || 0),
                    balance: Number(item.paid_balance || 0),
                    bonuses: Number(item.paid_bonuses || 0),
                    finalTotal: Number(item.total_amount || item.total_cost || item.estimated_total || 0),
                    debt: Number(item.debt || 0),
                    status: item.status,
                  }}
                  variant="detailed"
                  showIcons={true}
                  actionButton={
                    showPaymentAction ? (
                      (() => {
                        const hasPayment =
                          (item.paid_cash ?? 0) > 0 ||
                          (item.paid_card ?? 0) > 0 ||
                          (item.paid_balance ?? 0) > 0 ||
                          (item.paid_bonuses ?? 0) > 0;
                        return (
                          <Button
                            variant={hasPayment ? "outlined" : "contained"}
                            color={hasPayment ? "primary" : "success"}
                            size="small"
                            onClick={() => setPaymentOpen(true)}
                            sx={{
                              boxShadow: 'none',
                              textTransform: 'none',
                              whiteSpace: 'nowrap',
                              minWidth: hasPayment ? 'auto' : undefined,
                              px: hasPayment ? 1.5 : 2,
                            }}
                          >
                            {hasPayment ? t("details.editPayment") : t("details.acceptPayment")}
                          </Button>
                        );
                      })()
                    ) : undefined
                  }
                />
                {((item.paid_cash ?? 0) > 0 || (item.paid_card ?? 0) > 0 ||
                  (item.paid_balance ?? 0) > 0 || (item.paid_bonuses ?? 0) > 0) && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<PrintOutlinedIcon fontSize="small" />}
                    sx={{ alignSelf: "flex-start", textTransform: "none", px: 0.5 }}
                    onClick={() => {
                      const baseTotal = Number(item.total_amount || item.total_cost || item.estimated_total || 0);
                      const disc = Number(item.discount || 0);
                      printReceipt({
                        appointment: item,
                        cashPaid: Number(item.paid_cash || 0),
                        cardPaid: Number(item.paid_card || 0),
                        balancePaid: Number(item.paid_balance || 0),
                        bonusesPaid: Number(item.paid_bonuses || 0),
                        discountPercent: baseTotal > 0 ? Math.round((disc / baseTotal) * 100) : 0,
                        discountAmount: disc,
                        basePrice: baseTotal,
                        finalPrice: Math.max(0, baseTotal - disc),
                        cashierName: item.updated_by_name ?? item.created_by_name ?? null,
                        orgName: selectedBranch?.brandName || selectedBranch?.name,
                        branchName: selectedBranch?.name ?? null,
                        isReprint: true,
                      });
                    }}
                  >
                    {t("payment.printReceipt")}
                  </Button>
                )}
              </>
            )}

            {/* Actions */}
            {/* Actions moved to Header */}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" align="center">
            {t("details.appointmentNotFound")}
          </Typography>
        )}
      </CardContent>

      {/* Sidebar редактирования приема */}
      {item ? (
        <EditAppointmentSidebar
          key={item.id}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          item={item}
          onDeleted={() => {
            setEditOpen(false);
            onClose();
            onUpdate();
          }}
          onSaved={() => {
            setEditOpen(false);
            onUpdate();
            handleRefresh();
          }}
        />
      ) : null}


      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      >
        <DialogTitle>
          {confirmAction === 'delete' ? t("details.deleteTitle") : confirmAction === 'not_came' ? t("details.notCameTitle") : t("details.cancelTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction === 'delete'
              ? t("details.deleteText")
              : confirmAction === 'not_came'
              ? t("details.notCameText")
              : t("details.cancelText")}
          </DialogContentText>
          {confirmAction === 'cancel' && (
            <TextField
              label={t("details.cancellationReason")}
              required
              fullWidth
              multiline
              minRows={2}
              autoFocus
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              error={cancellationReason.length > 0 && !cancellationReason.trim()}
              helperText={t("details.cancellationReasonHelper")}
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t("common.back")}</Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmAction === 'not_came' ? "warning" : "error"}
            variant="contained"
            autoFocus={confirmAction !== 'cancel'}
            disabled={confirmAction === 'cancel' && !cancellationReason.trim()}
          >
            {confirmAction === 'delete' ? t("common.delete") : confirmAction === 'not_came' ? t("common.confirm") : t("details.confirmCancel")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Sidebar */}
      <PaymentSidebar
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        appointment={item}
        onSaved={() => {
          onUpdate();
          handleRefresh();
        }}
        />

      {/* Drawer быстрого просмотра клиента */}
      <PatientQuickViewDrawer
        open={patientDrawerOpen}
        onClose={() => setPatientDrawerOpen(false)}
        patientId={item?.patient_id || null}
        onStartAppointment={onStartAppointment}
      />

      {/* Drawer быстрого просмотра услуги */}
      <ServiceQuickViewDrawer
        open={serviceDrawerOpen}
        onClose={() => {
          setServiceDrawerOpen(false);
          setSelectedServiceId(null);
        }}
        serviceId={selectedServiceId}
      />

      {/* Drawer быстрого просмотра врача */}
      <DoctorQuickViewDrawer
        open={doctorDrawerOpen}
        onClose={() => {
          setDoctorDrawerOpen(false);
          setSelectedDoctorId(null);
        }}
        doctorId={selectedDoctorId}
      />

    </Card>
  );
};

export default AppointmentDetailsCard;

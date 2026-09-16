import React from "react";
import { useTranslation } from "react-i18next";
import {
  Divider,
  Stack,
  Typography,
  Avatar,
  Chip,
  Card,
  CardContent,
  Box,
  Link,
  Skeleton,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress,
  Grid,
} from "@mui/material";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import LocalPhoneOutlined from "@mui/icons-material/LocalPhoneOutlined";
import LocalOfferOutlined from "@mui/icons-material/LocalOfferOutlined";
import TelegramIcon from "@mui/icons-material/Telegram";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import WorkOutlined from "@mui/icons-material/WorkOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import AttachFileOutlined from "@mui/icons-material/AttachFileOutlined";
import ZoomInOutlined from "@mui/icons-material/ZoomInOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import AddCircleOutlineOutlined from "@mui/icons-material/AddCircleOutlineOutlined";
import type { EmployesRow } from "../types";
import { formatDateRu } from "../../../utility/format";
import { apiFetch, resolveApiUrl } from "../../../utility/apiClient";
import { useBranchCurrency } from "../../../hooks/useBranchCurrency";

function resolveUrl(url: string | null | undefined): string | undefined {
  return resolveApiUrl(url) ?? undefined;
}

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

const calculateAge = (birthDate: string, t: (key: string, opts?: any) => string): string => {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const now = new Date();
  let monthDiff =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) monthDiff--;
  const y = Math.floor(monthDiff / 12);
  const m = monthDiff % 12;
  const yearsStr = t("employees.ageYears", { count: y });
  const monthsStr = m > 0 ? ` ${t("employees.and")} ${t("employees.ageMonths", { count: m })}` : "";
  return `(${yearsStr}${monthsStr})`;
};

type EmployeeDocument = { id: string; title: string; fileUrl: string };

type EmployeeSchedule = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  shiftType: string;
  isDayOff: boolean;
  note: string;
};

type EmployeeDetail = {
  id: string;
  fullName: string;
  nickname?: string | null;
  photoUrl?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  telegramId?: string | null;
  email?: string | null;
  bankAccountNumber?: string | null;
  inn?: string | null;
  status?: string | null;
  roleName?: string | null;
  specializations?: { id: string; name: string }[];
  services?: { id: string; name: string; price?: number | null }[];
  documents?: { id: string | number; title: string; file: string }[];
  schedules?: EmployeeSchedule[];
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  active: "employees.statusWorking",
  inactive: "employees.statusNotActive",
  fired: "employees.statusFired",
  on_vacation: "employees.statusOnVacation",
};

const STATUS_COLOR: Record<string, "success" | "default" | "error" | "warning"> = {
  active: "success",
  inactive: "default",
  fired: "error",
  on_vacation: "warning",
};

// Строка с иконкой, label-caption и значением (или "(не заполнено)")
const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  href?: string;
  emptyLabel: string;
}> = ({ icon, label, value, href, emptyLabel }) => (
  <Stack direction="row" spacing={2} alignItems="flex-start">
    <Box sx={{ color: "text.secondary", mt: 0.25, flexShrink: 0 }}>{icon}</Box>
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3 }}>
        {label}
      </Typography>
      {value ? (
        href ? (
          <Link href={href} underline="hover" variant="body2" fontWeight={500}>
            {value}
          </Link>
        ) : (
          <Typography variant="body2" fontWeight={500}>
            {value}
          </Typography>
        )
      ) : (
        <Typography variant="body2" color="text.disabled">
          {emptyLabel}
        </Typography>
      )}
    </Box>
  </Stack>
);

export type EmployeeCardProps = {
  emp: EmployesRow | null;
  allServices?: { id: string; name?: string }[];
};

const EmployeeCard: React.FC<EmployeeCardProps> = ({ emp }) => {
  const { t } = useTranslation();
  const { suffix } = useBranchCurrency();
  const [detail, setDetail] = React.useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = React.useState<EmployeeDocument | null>(null);
  const [deletingDocId, setDeletingDocId] = React.useState<string | null>(null);
  const [addDocOpen, setAddDocOpen] = React.useState(false);
  const [addDocTitle, setAddDocTitle] = React.useState("");
  const [addDocFile, setAddDocFile] = React.useState<File | null>(null);
  const [addDocLoading, setAddDocLoading] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  // refreshKey меняется когда emp обновляется после редактирования
  const refreshKey = emp
    ? `${emp.id}_${emp.phone ?? ""}_${emp.email ?? ""}_${emp.status ?? ""}_${emp.updated_at ?? ""}`
    : "";

  React.useEffect(() => {
    if (!emp?.id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    apiFetch(`/api/v1/employees/${emp.id}/`)
      .then((res: any) => {
        if (cancelled) return;
        const d: any = res?.data ?? res;
        setDetail({
          id: String(d.id ?? emp.id),
          fullName: d.fullName ?? d.full_name ?? emp.full_name ?? "",
          nickname: d.nickname ?? null,
          photoUrl: d.photoUrl ?? d.photo_url ?? null,
          // API возвращает userPhoneNumber для телефона в EmployeeDetail
          phone: d.userPhoneNumber ?? d.phone ?? emp.phone ?? null,
          birthDate: d.birthDate ?? d.birth_date ?? emp.birth_date ?? null,
          telegramId: d.telegramId ?? d.telegram_id ?? emp.telegram_id ?? null,
          // API возвращает userEmail для email в EmployeeDetail
          email: d.userEmail ?? d.email ?? emp.email ?? null,
          bankAccountNumber:
            d.bankAccountNumber ?? d.bank_account_number ?? emp.bank_account_number ?? null,
          inn: d.inn ?? emp.inn ?? null,
          status: d.status ?? emp.status ?? null,
          // role — объект { id, name } в EmployeeDetail
          roleName: d.role?.name ?? d.roleName ?? d.role_display_name ?? null,
          specializations: Array.isArray(d.specializations) ? d.specializations : [],
          // services[].priceSom — поле цены в EmployeeServiceRead
          services: Array.isArray(d.services)
            ? d.services.map((s: any) => ({
                id: s.id,
                name: s.name,
                price: s.priceSom ?? s.price ?? null,
              }))
            : [],
          documents: Array.isArray(d.documents) ? d.documents : [],
          schedules: Array.isArray(d.schedules) ? d.schedules.map((s: any) => ({
            id: String(s.id),
            date: s.date ?? "",
            startTime: s.startTime ?? null,
            endTime: s.endTime ?? null,
            shiftType: s.shiftType ?? "day",
            isDayOff: s.isDayOff ?? false,
            note: s.note ?? "",
          })) : [],
        });
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (!emp) return null;

  const d = detail;
  const fio = d?.fullName || emp.full_name || emp.id || "";
  const photo = resolveUrl(d?.photoUrl ?? emp.photo_url);
  const status = d?.status ?? emp.status ?? null;
  const statusLabel = status ? (STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status) : null;
  const statusColor = status ? STATUS_COLOR[status] ?? "default" : "default";
  const roleText = d?.roleName ?? (emp as any).roleName ?? "";
  const specializations = d?.specializations ?? [];
  const services = d?.services ?? [];
  const documents: EmployeeDocument[] = (d?.documents ?? []).map((doc) => ({
    id: String(doc.id),
    title: doc.title,
    fileUrl: resolveUrl(doc.file) ?? doc.file,
  }));

  const handleDeleteDoc = async () => {
    if (!deleteDoc) return;
    setDeletingDocId(deleteDoc.id);
    setDeleteDoc(null);
    try {
      await apiFetch(`/api/v1/employee-documents/${deleteDoc.id}/`, { method: "DELETE" });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              documents: (prev.documents ?? []).filter((x) => String(x.id) !== deleteDoc.id),
            }
          : prev
      );
      setSnackbar({ open: true, message: t("employees.documentDeleted"), severity: "success" });
    } catch {
      setSnackbar({ open: true, message: t("employees.somethingWentWrong"), severity: "error" });
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleAddDoc = async () => {
    if (!addDocFile || !emp?.id) return;
    setAddDocLoading(true);
    try {
      const fd = new FormData();
      fd.append("employee", emp.id);
      fd.append("title", addDocTitle.trim() || addDocFile.name);
      fd.append("file", addDocFile);
      const res: any = await apiFetch("/api/v1/employee-documents/", {
        method: "POST",
        body: fd,
      });
      const newDoc = res?.data ?? res;
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              documents: [
                ...(prev.documents ?? []),
                {
                  id: String(newDoc.id ?? Date.now()),
                  title: newDoc.title ?? addDocTitle,
                  file: newDoc.file ?? "",
                },
              ],
            }
          : prev
      );
      setSnackbar({ open: true, message: t("employees.documentAdded"), severity: "success" });
      setAddDocOpen(false);
      setAddDocTitle("");
      setAddDocFile(null);
    } catch {
      setSnackbar({ open: true, message: t("employees.somethingWentWrong"), severity: "error" });
    } finally {
      setAddDocLoading(false);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}
    >
      {/* Заголовок карточки */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <PersonOutlineOutlined color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>
          {t("employees.cardTitle")}
        </Typography>
      </Box>

      <CardContent sx={{ p: 2.5 }}>
        {detailLoading && !d ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Skeleton variant="circular" width={56} height={56} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" />
                <Skeleton width="40%" />
              </Box>
            </Stack>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </Stack>
        ) : (
          <Stack spacing={0}>
            {/* ─── Шапка: фото + ФИО + никнейм + статус ─── */}
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
              <Avatar
                src={photo}
                sx={{ width: 56, height: 56, bgcolor: "primary.main", fontSize: 22, flexShrink: 0 }}
              >
                {!photo && (fio ? fio[0].toUpperCase() : <PersonOutlineOutlined />)}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {fio}
                </Typography>
                {d?.nickname && (
                  <Typography variant="body2" color="primary" fontWeight={500} sx={{ mb: 0.5 }}>
                    {d.nickname}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.5}>
                  {statusLabel && (
                    <Chip label={statusLabel} size="small" color={statusColor} />
                  )}
                  {specializations.map((s) => (
                    <Chip key={s.id} label={s.name} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {/* ─── Должность ─── */}
            {roleText && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                    {t("employees.position")}
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {roleText}
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
              </>
            )}

            {/* ─── Телефон + Дата рождения (две колонки) ─── */}
            {((d?.phone ?? emp.phone) || (d?.birthDate ?? emp.birth_date)) && (
              <>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                      {t("employees.phone")}
                    </Typography>
                    {(d?.phone ?? emp.phone) ? (
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <LocalPhoneOutlined fontSize="small" color="primary" />
                        <Link
                          href={`tel:${d?.phone ?? emp.phone}`}
                          underline="hover"
                          variant="body2"
                          fontWeight={500}
                        >
                          {d?.phone ?? emp.phone}
                        </Link>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.disabled">{t("employees.notFilled")}</Typography>
                    )}
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                      {t("employees.birthDate")}
                    </Typography>
                    {(d?.birthDate ?? emp.birth_date) ? (
                      <Typography variant="body2" fontWeight={500}>
                        {formatDateRu(d?.birthDate ?? emp.birth_date ?? "")}{" "}
                        {calculateAge(d?.birthDate ?? emp.birth_date ?? "", t)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.disabled">{t("employees.notFilled")}</Typography>
                    )}
                  </Grid>
                </Grid>
                <Divider sx={{ mb: 2 }} />
              </>
            )}

            {/* ─── Telegram, Email, Счёт, ИНН ─── */}
            <Stack spacing={2} sx={{ mb: 2 }}>
              <InfoRow
                icon={<TelegramIcon fontSize="small" />}
                label="Telegram ID"
                value={d?.telegramId ?? emp.telegram_id ?? null}
                emptyLabel={t("employees.notFilled")}
              />
              <InfoRow
                icon={<EmailOutlined fontSize="small" />}
                label="Email"
                value={d?.email ?? emp.email ?? null}
                href={d?.email ?? emp.email ? `mailto:${d?.email ?? emp.email}` : undefined}
                emptyLabel={t("employees.notFilled")}
              />
              <InfoRow
                icon={<CreditCardOutlined fontSize="small" />}
                label={t("employees.accountNumber")}
                value={d?.bankAccountNumber ?? emp.bank_account_number ?? null}
                emptyLabel={t("employees.notFilled")}
              />
              <InfoRow
                icon={<CreditCardOutlined fontSize="small" />}
                label={t("employees.inn")}
                value={d?.inn ?? emp.inn ?? null}
                emptyLabel={t("employees.notFilled")}
              />
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {/* ─── Услуги сотрудника ─── */}
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <LocalOfferOutlined fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>
                  {t("employees.employeeServices")}
                </Typography>
              </Stack>
              {services.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("employees.noLinkedServices")}
                </Typography>
              ) : (
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {services.map((s: any) => (
                    <Chip
                      key={s.id}
                      label={
                        s.price != null
                          ? `${s.name} — ${Number(s.price).toLocaleString("ru-RU")} ${suffix}`
                          : s.name
                      }
                      size="small"
                    />
                  ))}
                </Stack>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* ─── Документы ─── */}
            <Box>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <WorkOutlined fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t("employees.documents")}
                  </Typography>
                </Stack>
                <Tooltip title={t("employees.addDocument")}>
                  <IconButton size="small" onClick={() => setAddDocOpen(true)}>
                    <AddCircleOutlineOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              {documents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("employees.noDocumentsAttached")}
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {/* Изображения */}
                  {documents.filter((doc) => isImage(doc.fileUrl)).length > 0 && (
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {documents
                        .filter((doc) => isImage(doc.fileUrl))
                        .map((doc) => (
                          <Box
                            key={doc.id}
                            sx={{
                              position: "relative",
                              width: 80,
                              height: 80,
                              borderRadius: 1,
                              overflow: "hidden",
                              border: "1px solid",
                              borderColor: "divider",
                              cursor: "pointer",
                              "&:hover .doc-overlay": { opacity: 1 },
                            }}
                            onClick={() => setPreviewUrl(doc.fileUrl)}
                          >
                            <Box
                              component="img"
                              src={doc.fileUrl}
                              alt={doc.title}
                              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <Box
                              className="doc-overlay"
                              sx={{
                                position: "absolute",
                                inset: 0,
                                bgcolor: "rgba(0,0,0,0.45)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: 0,
                                transition: "opacity 0.15s",
                              }}
                            >
                              <ZoomInOutlined sx={{ color: "white", fontSize: 28 }} />
                            </Box>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDoc(doc);
                              }}
                              disabled={deletingDocId === doc.id}
                              sx={{
                                position: "absolute",
                                top: 2,
                                right: 2,
                                bgcolor: "rgba(0,0,0,0.5)",
                                color: "white",
                                p: 0.25,
                                "&:hover": { bgcolor: "rgba(200,0,0,0.7)" },
                              }}
                            >
                              {deletingDocId === doc.id ? (
                                <CircularProgress size={12} color="inherit" />
                              ) : (
                                <DeleteOutline sx={{ fontSize: 14 }} />
                              )}
                            </IconButton>
                          </Box>
                        ))}
                    </Stack>
                  )}

                  {/* Файлы */}
                  {documents
                    .filter((doc) => !isImage(doc.fileUrl))
                    .map((doc) => (
                      <Stack
                        key={doc.id}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          px: 1.5,
                          py: 0.75,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <InsertDriveFileOutlined fontSize="small" color="action" />
                          <Link
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover"
                            variant="body2"
                            noWrap
                          >
                            {doc.title}
                          </Link>
                        </Stack>
                        <IconButton
                          size="small"
                          onClick={() => setDeleteDoc(doc)}
                          disabled={deletingDocId === doc.id}
                        >
                          {deletingDocId === doc.id ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            <DeleteOutline fontSize="small" />
                          )}
                        </IconButton>
                      </Stack>
                    ))}
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </CardContent>

      {/* ─── Превью документа ─── */}
      <Dialog open={Boolean(previewUrl)} onClose={() => setPreviewUrl(null)} maxWidth={false}>
        <DialogTitle sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
          <IconButton onClick={() => setPreviewUrl(null)} size="small">
            <CloseOutlined />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 1 }}>
          {previewUrl && (
            <Box
              component="img"
              src={previewUrl}
              alt="preview"
              sx={{ maxWidth: "80vw", maxHeight: "80vh", display: "block", objectFit: "contain" }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Подтверждение удаления ─── */}
      <Dialog
        open={Boolean(deleteDoc)}
        onClose={() => setDeleteDoc(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("employees.deleteDocumentTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t("employees.deleteDocumentConfirm", { title: deleteDoc?.title })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDoc(null)} variant="outlined">
            {t("common.cancel")}
          </Button>
          <Button onClick={handleDeleteDoc} variant="contained" color="error">
            {t("common.delete")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Добавить документ ─── */}
      <Dialog
        open={addDocOpen}
        onClose={() => {
          setAddDocOpen(false);
          setAddDocTitle("");
          setAddDocFile(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("employees.addDocument")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box
              component="input"
              type="text"
              placeholder={t("employees.documentNameOptional")}
              value={addDocTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddDocTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileOutlined />}
              size="small"
            >
              {addDocFile ? addDocFile.name : t("employees.selectFile")}
              <input
                type="file"
                hidden
                onChange={(e) => setAddDocFile(e.target.files?.[0] ?? null)}
              />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddDocOpen(false);
              setAddDocTitle("");
              setAddDocFile(null);
            }}
            variant="outlined"
            disabled={addDocLoading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleAddDoc}
            variant="contained"
            disabled={!addDocFile || addDocLoading}
            startIcon={
              addDocLoading ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            {addDocLoading ? t("common.loading") : t("common.add")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Уведомления ─── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default EmployeeCard;

/**
 * PatientCard.tsx
 * Карточка выбранного клиента (правая колонка).
 */
import React from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Divider,
  Stack,
  Typography,
  Avatar,
  Box,
  Button,
  Chip,
  Alert,
  AlertTitle,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Snackbar,
  Link,
} from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import LocalPhoneOutlined from "@mui/icons-material/LocalPhoneOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import AddCircleOutlineOutlined from "@mui/icons-material/AddCircleOutlineOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ZoomInOutlined from "@mui/icons-material/ZoomInOutlined";
import { formatDateRu } from "../../../utility/format";
import PhoneInTalkOutlined from "@mui/icons-material/PhoneInTalkOutlined";
import type { PatientBalance } from "../usePatientBalance";

export type PatientDocument = {
  id: string | number;
  title: string;
  file: string; // URL
  createdAt?: string;
};

export type PatientLite = {
  fio: string;
  phone?: string;
  photo?: string | null;
  birth_date?: string | null;
  inn?: string | null;
  is_blacklisted?: boolean | null;
  blacklist_reason?: string | null;
} | null;

type Props = {
  patient: PatientLite;
  onEdit?: () => void;
  onTopUp?: () => void;
  balance?: PatientBalance | null;
  lastDateTime?: string;
  lastService?: string;
  lastComplaints?: string;
  lastWeight?: number | null;
  lastHeight?: number | null;
  lastTemperature?: number | null;
  documents?: PatientDocument[];
  onAddDocument?: (title: string, file: File) => Promise<void>;
  onDeleteDocument?: (docId: string | number) => Promise<void>;
};

function calculateAge(birthDateStr: string): string {
  const birthDate = new Date(birthDateStr);
  const now = new Date();
  if (isNaN(birthDate.getTime())) return "";
  let y = now.getFullYear() - birthDate.getFullYear();
  let m = now.getMonth() - birthDate.getMonth();
  if (now.getDate() < birthDate.getDate()) m--;
  if (m < 0) { m += 12; y--; }
  const yearStr = getDeclension(y, ["год", "года", "лет"]);
  const monthStr = getDeclension(m, ["месяц", "месяца", "месяцев"]);
  if (y === 0 && m === 0) return "(меньше месяца)";
  if (y === 0) return `(${m} ${monthStr})`;
  if (m === 0) return `(${y} ${yearStr})`;
  return `(${y} ${yearStr} и ${m} ${monthStr})`;
}

function getDeclension(number: number, titles: [string, string, string]): string {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[number % 100 > 4 && number % 100 < 20 ? 2 : cases[number % 10 < 5 ? number % 10 : 5]];
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
}

const PatientCard: React.FC<Props> = ({
  patient,
  onEdit,
  onTopUp,
  balance,
  lastDateTime,
  lastService,
  lastComplaints,
  lastWeight,
  lastHeight,
  lastTemperature,
  documents,
  onAddDocument,
  onDeleteDocument,
}) => {
  const [addDocOpen, setAddDocOpen] = React.useState(false);
  const [docTitle, setDocTitle] = React.useState("");
  const [docFile, setDocFile] = React.useState<File | null>(null);
  const [docBusy, setDocBusy] = React.useState(false);

  // Подтверждение удаления
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | number | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | number | null>(null);

  // Превью документа
  const [previewDoc, setPreviewDoc] = React.useState<PatientDocument | null>(null);

  // Уведомления
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const showSnack = (message: string, severity: "success" | "error" = "success") => {
    setSnack({ open: true, message, severity });
  };

  const handleAddDoc = async () => {
    if (!docFile || !onAddDocument) return;
    setDocBusy(true);
    try {
      await onAddDocument(docTitle.trim() || docFile.name, docFile);
      setAddDocOpen(false);
      setDocTitle("");
      setDocFile(null);
      showSnack("Документ успешно добавлен");
    } catch {
      showSnack("Ой, что-то пошло не так", "error");
    } finally {
      setDocBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId == null || !onDeleteDocument) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      await onDeleteDocument(confirmDeleteId);
      showSnack("Документ успешно удалён");
    } catch {
      showSnack("Ой, что-то пошло не так", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Box sx={{ height: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Card variant="outlined" sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
              <Stack direction="row" alignItems="center" gap={1.25}>
                <PersonOutlineOutlined color="primary" />
                <Typography variant="h6">Карточка клиента</Typography>
              </Stack>
              {patient && (onTopUp || onEdit) && (
                <Stack direction="row" spacing={1} flexShrink={0}>
                  {onTopUp && (
                    <Button size="small" variant="outlined" color="success" onClick={onTopUp} startIcon={<AccountBalanceWalletOutlined />}>
                      Пополнить
                    </Button>
                  )}
                  {onEdit && (
                    <Button size="small" variant="contained" onClick={onEdit} startIcon={<EditOutlined />}>
                      Редактировать
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>
          }
          sx={{ pb: 1 }}
        />
        <Divider />
        <CardContent sx={{ p: 0, flex: 1, overflowY: "auto", minHeight: 0 }}>
          {patient ? (
            <Stack spacing={2} sx={{ p: 2 }}>
              {patient.is_blacklisted && (
                <Alert severity="error" variant="filled">
                  <AlertTitle>В черном списке</AlertTitle>
                  {patient.blacklist_reason || "Причина не указана"}
                </Alert>
              )}

              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar src={patient.photo || undefined} sx={{ width: 64, height: 64 }} />
                <Box>
                  <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{patient.fio}</Typography>
                  {patient.phone ? (
                    <Link
                      href={`tel:${patient.phone}`}
                      sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", textDecoration: "none", mt: 0.5, "&:hover": { color: "primary.main" } }}
                    >
                      <PhoneInTalkOutlined fontSize="small" sx={{ color: "primary.main" }} />
                      <Typography variant="body2">{patient.phone}</Typography>
                    </Link>
                  ) : (
                    <Stack direction="row" alignItems="center" gap={1} color="text.secondary" sx={{ mt: 0.5 }}>
                      <LocalPhoneOutlined fontSize="small" />
                      <Typography variant="body2">—</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" alignItems="center" gap={1} color="text.secondary" sx={{ mt: 0.5 }}>
                    <BadgeOutlined fontSize="small" />
                    <Typography variant="body2">ИНН: {patient.inn || "отсутствует"}</Typography>
                  </Stack>
                  {patient.birth_date && (
                    <Stack direction="row" alignItems="center" gap={1} color="text.secondary" sx={{ mt: 0.5 }}>
                      <CalendarMonthOutlined fontSize="small" />
                      <Typography variant="body2">
                        {formatDateRu(patient.birth_date)} {calculateAge(patient.birth_date)}
                      </Typography>
                    </Stack>
                  )}
                </Box>
              </Stack>

              {/* Vitals */}
              {(lastWeight || lastHeight || lastTemperature) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">Последние измерения</Typography>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                      {lastHeight && <Chip label={`Рост: ${lastHeight} см`} size="small" variant="outlined" />}
                      {lastWeight && <Chip label={`Вес: ${lastWeight} кг`} size="small" variant="outlined" />}
                      {lastTemperature && (
                        <Chip label={`Темп: ${lastTemperature} °C`} size="small" variant="outlined" color={lastTemperature > 37 ? "warning" : "default"} />
                      )}
                    </Stack>
                  </Stack>
                </>
              )}

              {/* Balance */}
              {balance !== undefined && balance !== null && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <AccountBalanceWalletOutlined fontSize="small" color="action" />
                      <Typography variant="subtitle2" color="text.secondary">Счёт клиента</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap">
                      <Box sx={{ flex: 1, minWidth: 70, borderRadius: 1, border: "1px solid", borderColor: "divider", px: 1.5, py: 1, textAlign: "center" }}>
                        <Typography variant="caption" color="text.secondary" display="block">Нал</Typography>
                        <Typography variant="body2" fontWeight={600} color={balance.cashBalance > 0 ? "success.main" : "text.primary"}>
                          {balance.cashBalance.toLocaleString("ru-RU")} сом
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 70, borderRadius: 1, border: "1px solid", borderColor: "divider", px: 1.5, py: 1, textAlign: "center" }}>
                        <Typography variant="caption" color="text.secondary" display="block">Безнал</Typography>
                        <Typography variant="body2" fontWeight={600} color={balance.cardBalance > 0 ? "success.main" : "text.primary"}>
                          {balance.cardBalance.toLocaleString("ru-RU")} сом
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 70, borderRadius: 1, border: "1px solid", borderColor: "divider", px: 1.5, py: 1, textAlign: "center" }}>
                        <Typography variant="caption" color="text.secondary" display="block">Бонусы</Typography>
                        <Typography variant="body2" fontWeight={600} color={balance.bonuses > 0 ? "warning.main" : "text.primary"}>
                          {balance.bonuses.toLocaleString("ru-RU")} сом
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </>
              )}

              {/* Documents */}
              {onAddDocument && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" gap={1}>
                        <FolderOutlined fontSize="small" color="action" />
                        <Typography variant="subtitle2" color="text.secondary">Документы</Typography>
                      </Stack>
                      <Tooltip title="Добавить документ">
                        <IconButton size="small" onClick={() => setAddDocOpen(true)}>
                          <AddCircleOutlineOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    {documents && documents.length > 0 ? (
                      <>
                        {/* Миниатюры изображений */}
                        {documents.some((d) => isImageUrl(d.file)) && (
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {documents.filter((d) => isImageUrl(d.file)).map((doc) => (
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
                                onClick={() => setPreviewDoc(doc)}
                              >
                                <Box
                                  component="img"
                                  src={doc.file}
                                  alt={doc.title}
                                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                                <Box
                                  className="doc-overlay"
                                  sx={{
                                    position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.4)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    opacity: 0, transition: "opacity 0.15s",
                                  }}
                                >
                                  <ZoomInOutlined sx={{ color: "white", fontSize: 28 }} />
                                </Box>
                                <Tooltip title="Удалить">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(doc.id); }}
                                    disabled={deletingId === doc.id}
                                    sx={{
                                      position: "absolute", top: 2, right: 2,
                                      bgcolor: "rgba(0,0,0,0.5)", color: "white",
                                      "&:hover": { bgcolor: "error.main" },
                                      p: 0.25,
                                    }}
                                  >
                                    {deletingId === doc.id ? <CircularProgress size={12} color="inherit" /> : <CloseOutlined sx={{ fontSize: 14 }} />}
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Нефото-документы */}
                        {documents.filter((d) => !isImageUrl(d.file)).map((doc) => (
                          <Stack
                            key={doc.id}
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{
                              px: 1, py: 0.5, borderRadius: 1,
                              border: "1px solid", borderColor: "divider",
                              "&:hover": { bgcolor: "action.hover" },
                            }}
                          >
                            <Box
                              component="a"
                              href={doc.file}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", flex: 1, minWidth: 0, color: "text.primary" }}
                            >
                              <Typography variant="body2" noWrap>{doc.title}</Typography>
                            </Box>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setConfirmDeleteId(doc.id)}
                              disabled={deletingId === doc.id}
                            >
                              {deletingId === doc.id ? <CircularProgress size={16} /> : <DeleteOutlineOutlined fontSize="small" />}
                            </IconButton>
                          </Stack>
                        ))}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.disabled" sx={{ pl: 0.5 }}>
                        Нет документов
                      </Typography>
                    )}
                  </Stack>
                </>
              )}

              {/* Last visit */}
              {(lastDateTime || lastService || lastComplaints) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">Последний прием</Typography>
                    {lastDateTime && (
                      <Stack direction="row" alignItems="center" gap={1} color="text.secondary">
                        <CalendarMonthOutlined fontSize="small" />
                        <Typography variant="body2">{lastDateTime}</Typography>
                      </Stack>
                    )}
                    {lastService && (
                      <Typography variant="body2">
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>Услуга:</Typography>
                        {lastService}
                      </Typography>
                    )}
                    {lastComplaints && (
                      <Typography variant="body2">
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>Жалобы:</Typography>
                        {lastComplaints}
                      </Typography>
                    )}
                  </Stack>
                </>
              )}
            </Stack>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, opacity: 0.6 }}>
              <PersonOutlineOutlined sx={{ fontSize: 48, mb: 1, color: "text.secondary" }} />
              <Typography variant="body1" color="text.secondary">Выберите клиента из списка</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Добавить документ */}
      <Dialog open={addDocOpen} onClose={docBusy ? undefined : () => { setAddDocOpen(false); setDocTitle(""); setDocFile(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Добавить документ</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Название"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              fullWidth
              size="small"
              placeholder="Необязательно"
            />
            <Button variant="outlined" component="label" fullWidth>
              {docFile ? docFile.name : "Выбрать файл"}
              <input type="file" hidden onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDocOpen(false); setDocTitle(""); setDocFile(null); }} disabled={docBusy}>Отмена</Button>
          <Button variant="contained" onClick={handleAddDoc} disabled={!docFile || docBusy}>
            {docBusy ? <CircularProgress size={18} /> : "Загрузить"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Подтверждение удаления */}
      <Dialog open={confirmDeleteId != null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить документ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Вы уверены, что хотите удалить этот документ? Это действие нельзя отменить.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Отмена</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>Удалить</Button>
        </DialogActions>
      </Dialog>

      {/* Превью документа (80% экрана) */}
      <Dialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        maxWidth={false}
        PaperProps={{ sx: { width: "80vw", maxWidth: "80vw", height: "80vh", maxHeight: "80vh", m: 0 } }}
      >
        <Box sx={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1, flexShrink: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>{previewDoc?.title}</Typography>
            <IconButton onClick={() => setPreviewDoc(null)} size="small">
              <CloseOutlined />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "grey.100" }}>
            {previewDoc && isImageUrl(previewDoc.file) ? (
              <Box
                component="img"
                src={previewDoc.file}
                alt={previewDoc.title}
                sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : (
              <Box component="iframe" src={previewDoc?.file} sx={{ width: "100%", height: "100%", border: "none" }} title={previewDoc?.title} />
            )}
          </Box>
        </Box>
      </Dialog>

      {/* Уведомления */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <MuiAlert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" elevation={6}>
          {snack.message}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default PatientCard;

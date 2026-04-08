import React from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  InputAdornment,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { alpha, useTheme } from "@mui/material/styles";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import { useNotification } from "@refinedev/core";
import { apiFetch } from "../../utility/apiClient";
import { usePageTitle } from "../../hooks/usePageTitle";
import { PageHeader } from "../../components/ui";

type Category = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

// ── Диалог создания/редактирования категории ──────────────────────────────
type CategoryDialogProps = {
  open: boolean;
  initial?: Category | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string, isActive: boolean) => void;
};

const CategoryDialog: React.FC<CategoryDialogProps> = ({ open, initial, busy, onClose, onSubmit }) => {
  const [name, setName] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [nameError, setNameError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setIsActive(initial?.isActive ?? true);
      setNameError("");
    }
  }, [open, initial]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Введите название категории");
      return;
    }
    setNameError("");
    onSubmit(trimmed, isActive);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{initial ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Название *"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(""); }}
            fullWidth
            autoFocus
            error={Boolean(nameError)}
            helperText={nameError}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                color="success"
              />
            }
            label={
              <Typography variant="body2" fontWeight={500}>
                {isActive ? "Активна" : "Неактивна"}
              </Typography>
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={busy || !name.trim()}
          startIcon={busy ? <CircularProgress size={16} /> : undefined}
        >
          {initial ? "Сохранить" : "Создать"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Диалог подтверждения удаления ─────────────────────────────────────────
type DeleteDialogProps = {
  open: boolean;
  name: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const DeleteDialog: React.FC<DeleteDialogProps> = ({ open, name, busy, onClose, onConfirm }) => (
  <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Удалить категорию?</DialogTitle>
    <DialogContent>
      <Typography variant="body2">
        Вы уверены, что хотите удалить категорию <b>«{name}»</b>?
        Все расходы в этой категории останутся без категории.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={busy}>Отмена</Button>
      <Button
        variant="contained"
        color="error"
        onClick={onConfirm}
        disabled={busy}
        startIcon={busy ? <CircularProgress size={16} /> : <DeleteOutlined />}
      >
        Удалить
      </Button>
    </DialogActions>
  </Dialog>
);

// ── Основная страница ──────────────────────────────────────────────────────
const CategoriesPage: React.FC = () => {
  usePageTitle("Категории расходов");
  const { open: notify } = useNotification();
  const theme = useTheme();
  const isTabletLayout = useMediaQuery(theme.breakpoints.down(900));
  const isCompactLayout = useMediaQuery(theme.breakpoints.down(640));

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Category | null>(null);
  const [formBusy, setFormBusy] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await apiFetch("/api/v1/expense-categories/?pageSize=200&ordering=name");
      const list: any[] = res?.data?.results ?? res?.results ?? [];
      setCategories(list.map((c: any) => ({
        id: String(c.id),
        name: c.name ?? "",
        isActive: c.isActive ?? true,
        createdAt: c.createdAt ?? "",
      })));
    } catch {
      notify?.({ type: "error", message: "Не удалось загрузить категории" });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async (name: string, isActive: boolean) => {
    try {
      setFormBusy(true);
      await apiFetch("/api/v1/expense-categories/", {
        method: "POST",
        body: JSON.stringify({ name, isActive }),
      });
      notify?.({ type: "success", message: "Категория создана" });
      setFormOpen(false);
      await load();
    } catch (e) {
      notify?.({ type: "error", message: "Не удалось создать категорию", description: e instanceof Error ? e.message : String(e) });
    } finally {
      setFormBusy(false);
    }
  };

  const handleEdit = async (name: string, isActive: boolean) => {
    if (!editTarget) return;
    try {
      setFormBusy(true);
      await apiFetch(`/api/v1/expense-categories/${editTarget.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ name, isActive }),
      });
      notify?.({ type: "success", message: "Категория обновлена" });
      setEditTarget(null);
      await load();
    } catch (e) {
      notify?.({ type: "error", message: "Не удалось обновить категорию", description: e instanceof Error ? e.message : String(e) });
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteBusy(true);
      await apiFetch(`/api/v1/expense-categories/${deleteTarget.id}/`, { method: "DELETE" });
      notify?.({ type: "success", message: "Категория удалена" });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      notify?.({ type: "error", message: "Не удалось удалить категорию", description: e instanceof Error ? e.message : String(e) });
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box
      sx={{
        height: {
          xs: "calc(100dvh - 56px)",
          md: "calc(100dvh - 64px)",
          lg: "100%",
        },
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <PageHeader
        title="Категории расходов"
        showTitle={!isTabletLayout}
        showSearch={!isTabletLayout}
        searchVal={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск категории..."
        addButtonText="Добавить категорию"
        onAdd={!isTabletLayout ? () => { setEditTarget(null); setFormOpen(true); } : undefined}
      />

      <Box
        sx={(t) => ({
          px: t.appLayout.page.paddingX,
          pb: t.appLayout.page.paddingY,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        })}
      >
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: { xs: 3, md: 3 },
          }}
        >
          {isTabletLayout && (
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderBottom: 1,
                borderColor: "divider",
                background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, transparent 100%)`,
              }}
            >
              <Stack
                direction="column"
                justifyContent="space-between"
                gap={{ xs: 1.5, sm: 2 }}
              >
                <Stack direction="row" alignItems="flex-start" gap={1.25} flexWrap="nowrap">
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: "primary.main",
                      flexShrink: 0,
                    }}
                  >
                    <CategoryOutlined fontSize="small" />
                  </Box>
                  <Stack spacing={0.75} minWidth={0}>
                    <Typography variant="h6" fontWeight={700}>
                      Категории расходов
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Управляйте справочником категорий и быстро находите нужные записи.
                    </Typography>
                  </Stack>
                  {!loading && (
                    <Chip
                      label={filtered.length}
                      size="small"
                      sx={{ fontWeight: 700, alignSelf: "flex-start", ml: "auto" }}
                    />
                  )}
                </Stack>

                <Stack
                  direction="column"
                  gap={1}
                  alignItems="stretch"
                  sx={{ width: "100%" }}
                >
                  <TextField
                    size="small"
                    placeholder="Поиск категории..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchOutlined fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      width: "100%",
                      "& .MuiInputBase-root": {
                        borderRadius: 2.5,
                        bgcolor: "background.paper",
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddOutlined />}
                    onClick={() => { setEditTarget(null); setFormOpen(true); }}
                    fullWidth={isTabletLayout}
                    sx={{
                      width: "100%",
                      borderRadius: 2.5,
                      alignSelf: isTabletLayout ? "stretch" : "flex-start",
                    }}
                  >
                    {isCompactLayout ? "Добавить категорию" : "Добавить"}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}

          {/* Список */}
          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 6 }}>
                <CircularProgress />
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 6, gap: 1 }}>
                <CategoryOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
                <Typography variant="body1" color="text.secondary">
                  {search ? "Категории не найдены" : "Категорий пока нет"}
                </Typography>
                {!search && (
                  <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => { setEditTarget(null); setFormOpen(true); }} sx={{ mt: 1 }}>
                    Создать первую категорию
                  </Button>
                )}
              </Box>
            ) : (
              <List disablePadding sx={{ p: isTabletLayout ? 1.5 : 0 }}>
                {filtered.map((cat, idx) => (
                  <React.Fragment key={cat.id}>
                    {!isTabletLayout && idx > 0 && <Divider component="li" />}
                    <ListItem
                      sx={{
                        py: 1.5,
                        px: 2,
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        alignItems: { xs: "stretch", sm: "center" },
                        gap: { xs: 1.5, sm: 2 },
                        mb: isTabletLayout ? 1 : 0,
                        border: isTabletLayout ? `1px solid ${theme.palette.divider}` : "none",
                        borderRadius: isTabletLayout ? 2.5 : 0,
                        bgcolor: isTabletLayout ? alpha(theme.palette.background.paper, 0.92) : "transparent",
                        transition: "background-color 0.15s",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <ListItemText
                        sx={{ my: 0, mr: 0 }}
                        primary={
                          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                            <Typography variant="body1" fontWeight={500}>{cat.name}</Typography>
                            <Chip
                              label={cat.isActive ? "Активна" : "Неактивна"}
                              size="small"
                              color={cat.isActive ? "success" : "default"}
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.7rem" }}
                            />
                          </Stack>
                        }
                      />
                      <Stack
                        direction="row"
                        gap={0.5}
                        justifyContent={{ xs: "flex-end", sm: "flex-start" }}
                        sx={{ ml: { sm: "auto" } }}
                      >
                        <Tooltip title="Редактировать">
                          <IconButton
                            size="small"
                            onClick={() => { setEditTarget(cat); setFormOpen(true); }}
                          >
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(cat)}
                          >
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Диалоги */}
      <CategoryDialog
        open={formOpen}
        initial={editTarget}
        busy={formBusy}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSubmit={editTarget ? handleEdit : handleCreate}
      />
      <DeleteDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name ?? ""}
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
};

export default CategoriesPage;

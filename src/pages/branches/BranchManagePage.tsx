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
  Divider,
  List,
  ListItem,
  ListItemText,
  MenuItem,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { alpha, useTheme } from "@mui/material/styles";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import BusinessOutlined from "@mui/icons-material/BusinessOutlined";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import { useNotification } from "@refinedev/core";
import { apiFetch } from "../../utility/apiClient";
import { usePageTitle } from "../../hooks/usePageTitle";
import { PageHeader } from "../../components/ui";

type Organization = { id: string; name: string };

type BranchItem = {
  id: string;
  name: string;
  address: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
};

// ── Диалог создания/редактирования филиала ────────────────────────────────
type BranchDialogProps = {
  open: boolean;
  initial?: BranchItem | null;
  organizations: Organization[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; address: string; organization: string }) => void;
};

const BranchDialog: React.FC<BranchDialogProps> = ({
  open, initial, organizations, busy, onClose, onSubmit,
}) => {
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [orgId, setOrgId] = React.useState("");
  const [nameError, setNameError] = React.useState("");
  const [orgError, setOrgError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setAddress(initial?.address ?? "");
      setOrgId(initial?.organizationId ?? (organizations[0]?.id ?? ""));
      setNameError("");
      setOrgError("");
    }
  }, [open, initial, organizations]);

  const handleSubmit = () => {
    let valid = true;
    if (!name.trim()) { setNameError("Введите название филиала"); valid = false; }
    else setNameError("");
    if (!orgId) { setOrgError("Выберите организацию"); valid = false; }
    else setOrgError("");
    if (!valid) return;
    onSubmit({ name: name.trim(), address: address.trim(), organization: orgId });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{initial ? "Редактировать филиал" : "Новый филиал"}</DialogTitle>
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
          <TextField
            label="Адрес"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
            placeholder="ул. Примерная, 1"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LocationOnOutlined fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label="Организация *"
            value={orgId}
            onChange={(e) => { setOrgId(e.target.value); setOrgError(""); }}
            fullWidth
            error={Boolean(orgError)}
            helperText={orgError}
          >
            {organizations.map((org) => (
              <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={busy || !name.trim() || !orgId}
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
    <DialogTitle>Удалить филиал?</DialogTitle>
    <DialogContent>
      <Typography variant="body2">
        Вы уверены, что хотите удалить филиал <b>«{name}»</b>?
        Это действие нельзя отменить.
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

// ── Основная страница управления филиалами ────────────────────────────────
const BranchManagePage: React.FC = () => {
  usePageTitle("Управление филиалами");
  const { open: notify } = useNotification();
  const theme = useTheme();
  const isTabletLayout = useMediaQuery(theme.breakpoints.down(900));
  const isCompactLayout = useMediaQuery(theme.breakpoints.down(640));

  const [branches, setBranches] = React.useState<BranchItem[]>([]);
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<BranchItem | null>(null);
  const [formBusy, setFormBusy] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<BranchItem | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const [brRes, orgRes]: any[] = await Promise.all([
        apiFetch("/api/v1/branches/?pageSize=200&ordering=name"),
        apiFetch("/api/v1/organizations/?pageSize=200"),
      ]);
      const brList: any[] = brRes?.data?.results ?? brRes?.results ?? [];
      const orgList: any[] = orgRes?.data?.results ?? orgRes?.results ?? [];

      setOrganizations(orgList.map((o: any) => ({ id: String(o.id), name: o.name ?? "" })));
      setBranches(brList.map((b: any) => ({
        id: String(b.id),
        name: b.name ?? "",
        address: b.address ?? "",
        organizationId: String(b.organization ?? ""),
        organizationName: b.organizationName ?? "",
        createdAt: b.createdAt ?? "",
      })));
    } catch {
      notify?.({ type: "error", message: "Не удалось загрузить филиалы" });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: { name: string; address: string; organization: string }) => {
    try {
      setFormBusy(true);
      await apiFetch("/api/v1/branches/", {
        method: "POST",
        body: JSON.stringify(data),
      });
      notify?.({ type: "success", message: "Филиал создан" });
      setFormOpen(false);
      await load();
    } catch (e) {
      notify?.({ type: "error", message: "Не удалось создать филиал", description: e instanceof Error ? e.message : String(e) });
    } finally {
      setFormBusy(false);
    }
  };

  const handleEdit = async (data: { name: string; address: string; organization: string }) => {
    if (!editTarget) return;
    try {
      setFormBusy(true);
      await apiFetch(`/api/v1/branches/${editTarget.id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      notify?.({ type: "success", message: "Филиал обновлён" });
      setEditTarget(null);
      await load();
    } catch (e) {
      notify?.({ type: "error", message: "Не удалось обновить филиал", description: e instanceof Error ? e.message : String(e) });
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteBusy(true);
      await apiFetch(`/api/v1/branches/${deleteTarget.id}/`, { method: "DELETE" });
      notify?.({ type: "success", message: "Филиал удалён" });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      notify?.({ type: "error", message: "Не удалось удалить филиал", description: e instanceof Error ? e.message : String(e) });
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Управление филиалами"
        showTitle={!isTabletLayout}
        showSearch={!isTabletLayout}
        searchVal={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск филиала..."
        addButtonText="Добавить филиал"
        onAdd={() => { setEditTarget(null); setFormOpen(true); }}
      />

      <Box sx={(t) => ({ px: t.appLayout.page.paddingX, pb: t.appLayout.page.paddingY, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 })}>
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
              <Stack direction="column" gap={{ xs: 1.5, sm: 2 }}>
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
                    <BusinessOutlined fontSize="small" />
                  </Box>
                  <Stack spacing={0.75} minWidth={0}>
                    <Typography variant="h6" fontWeight={700}>Управление филиалами</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Создавайте филиалы, редактируйте адреса и распределяйте их по организациям.
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
                    placeholder="Поиск филиала..."
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
                    {isCompactLayout ? "Добавить филиал" : "Добавить"}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}

          {/* Список */}
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 6 }}>
                <CircularProgress />
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 6, gap: 1 }}>
                <BusinessOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
                <Typography variant="body1" color="text.secondary">
                  {search ? "Филиалы не найдены" : "Филиалов пока нет"}
                </Typography>
                {!search && (
                  <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => { setEditTarget(null); setFormOpen(true); }} sx={{ mt: 1 }}>
                    Создать первый филиал
                  </Button>
                )}
              </Box>
            ) : (
              <List disablePadding sx={{ p: isTabletLayout ? 1.5 : 0 }}>
                {filtered.map((branch, idx) => (
                  <React.Fragment key={branch.id}>
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
                            <Typography variant="body1" fontWeight={500}>{branch.name}</Typography>
                            {branch.organizationName && (
                              <Chip label={branch.organizationName} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                            )}
                          </Stack>
                        }
                        secondary={
                          branch.address ? (
                            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.25 }}>
                              <LocationOnOutlined sx={{ fontSize: 13, color: "text.disabled" }} />
                              <Typography variant="caption" color="text.secondary">{branch.address}</Typography>
                            </Stack>
                          ) : null
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
                            onClick={() => { setEditTarget(branch); setFormOpen(true); }}
                          >
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(branch)}
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
      <BranchDialog
        open={formOpen}
        initial={editTarget}
        organizations={organizations}
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

export default BranchManagePage;

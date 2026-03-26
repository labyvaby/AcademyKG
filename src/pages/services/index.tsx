import React from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Divider,
  Stack,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddServiceDrawer from "../../components/services/AddServiceDrawer";
import EditServiceDrawer from "../../components/services/EditServiceDrawer";
import { PageHeader } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useNotification, useTranslate } from "@refinedev/core";
import { usePermissions } from "../../hooks/usePermissions";
import ServiceQuickViewDrawer from "../../components/services/ServiceQuickViewDrawer";

const API_BASE = "https://academy.operator.kg";

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

// Нормализация сервисных полей из произвольной схемы
function mapServiceId(r: Record<string, unknown>): string {
  const cand =
    r["sellable_item_id"] ??
    r["Услуга ID"] ??
    r["Service ID"] ??
    r["service_id"] ??
    r["serviceId"] ??
    r["ID"] ??
    r["id"];
  return String(cand ?? "");
}

function mapServiceName(r: Record<string, unknown>): string {
  return String(
    r["name"] ??
    r["Название услуги"] ??
    r["Название"] ??
    r["Наименование"] ??
    r["title"] ??
    r["service_name"] ??
    ""
  );
}

function mapServicePrice(r: Record<string, unknown>): number {
  const v = (r["price_som"] ?? r["price"] ?? r["Стоимость, сом"] ?? r["Стоимость"] ?? r["Итого, сом"] ?? r["amount"] ?? r["cost"]) as
    | number
    | string
    | null
    | undefined;
  return Number(v ?? 0);
}

function mapServicePhoto(r: Record<string, unknown>): string | null {
  const raw = (r["image_url"] as string | null) ?? (r["photo_url"] as string | null) ?? (r["Картинка"] as string | null) ?? null;
  return resolveImageUrl(raw);
}

function mapEmployeeName(r: Record<string, unknown>): string | null {
  return (
    (r["employee_name"] as string | null) ??
    (r["Доктор ФИО"] as string | null) ??
    (r["Сотрудник ФИО"] as string | null) ??
    null
  );
}

// Тип агрегированной услуги
type AggregatedService = {
  id: string;
  name: string;
  price: number;
  photo_url: string | null;
  employees: string[]; // список сотрудников для этой услуги
  editable: boolean;
  description: string | null;
  is_active: boolean;
};

// Агрегация: объединяем строки по ID услуги, собираем сотрудников
function aggregateServices(rows: Array<Record<string, unknown>>): AggregatedService[] {
  const map = new Map<string, AggregatedService>();
  for (const r of rows) {
    const id = mapServiceId(r);
    // Skip if no ID or if ID is "undefined" or empty
    if (!id || id === "undefined") continue;

    const name = mapServiceName(r);
    const price = mapServicePrice(r);
    const photo = mapServicePhoto(r);
    const emp = mapEmployeeName(r);

    const existing = map.get(id);
    if (!existing) {
      map.set(id, {
        id,
        name,
        price,
        photo_url: photo,
        employees: emp ? [emp] : [],
        editable: false,
        description: (r["description"] as string | null) ?? null,
        is_active: (r["is_active"] as boolean) ?? true,
      });
    } else {
      if (!existing.name && name) existing.name = name;
      if (!existing.price && price) existing.price = price;
      if (!existing.photo_url && photo) existing.photo_url = photo;
      if (emp && !existing.employees.includes(emp)) existing.employees.push(emp);
    }
  }
  // Сортируем по названию для стабильного UI
  return Array.from(map.values()).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, "ru", { sensitivity: "base" }));
}

const ServicesPage: React.FC = () => {
  usePageTitle("Услуги");
  const { open: notify } = useNotification();
  const { isAdmin: isAdminFunc } = usePermissions();
  const isAdmin = isAdminFunc();
  // Инфинит-скролл по уникальным услугам (после агрегации)
  const BATCH_SIZE = 20;
  const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Данные
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [allServices, setAllServices] = React.useState<AggregatedService[]>([]);
  const [totalUnique, setTotalUnique] = React.useState(0);

  // Drawers
  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedServiceId, setSelectedServiceId] = React.useState<string | null>(null);

  // Запись для редактирования
  const [editingRec, setEditingRec] = React.useState<{
    id: string | number;
    name: string;
    price: number;
    employee_id: string | null;
    employee_name?: string | null;
    photo_url?: string | null;
    description?: string | null;
    is_active?: boolean;
  } | null>(null);

  // Подтверждение удаления
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmRow, setConfirmRow] = React.useState<AggregatedService | null>(null);

  // Загрузка услуг через REST API
  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { apiFetch } = await import("../../utility/apiClient");
      // Собираем все страницы
      const allItems: AggregatedService[] = [];
      let nextUrl: string | null = "/api/v1/services/?pageSize=200&ordering=name";
      while (nextUrl) {
        const res: any = await apiFetch(nextUrl);
        const items: any[] = res?.data?.results ?? res?.results ?? [];
        for (const item of items) {
          allItems.push({
            id: item.sellableItem ?? item.id ?? "",
            name: item.name ?? "",
            price: item.price ?? item.priceSom ?? 0,
            photo_url: resolveImageUrl(item.imageUrl ?? item.image_url),
            employees: Array.isArray(item.employeeIds) ? item.employeeIds : [],
            editable: true,
            description: item.description ?? null,
            is_active: item.isActive ?? item.is_active ?? true,
          });
        }
        const next = res?.data?.next ?? res?.next ?? null;
        if (next) {
          try { const u = new URL(next); nextUrl = u.pathname + u.search; } catch { nextUrl = null; }
        } else {
          nextUrl = null;
        }
      }
      setAllServices(allItems);
      setTotalUnique(allItems.length);
    } catch (e) {
      console.error("Load services failed:", e);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);


  // Поиск
  const [searchQuery, setSearchQuery] = React.useState("");

  // Видимые элементы для бесконечной прокрутки (клиентская нарезка + фильтрация)
  const visibleServices = React.useMemo(() => {
    let filtered = allServices;
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      filtered = allServices.filter(s => s.name.toLowerCase().includes(lower));
    }
    return filtered.slice(0, visibleCount);
  }, [allServices, visibleCount, searchQuery]);

  // Сброс видимого количества при изменении общего списка или поиска
  React.useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [totalUnique, searchQuery]);

  // Scroll container ref
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  // IntersectionObserver для подгрузки следующих батчей
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    // Ensure we have the root if possible, otherwise default to viewport (which might be flaky here)
    // But since we are creating the observer in an effect, scrollContainerRef.current should be available
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisibleCount((prev) => {
            if (prev >= allServices.length) return prev;
            return Math.min(prev + BATCH_SIZE, allServices.length);
          });
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "200px", // Preload earlier
        threshold: 0.1
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelRef, allServices.length]);

  // Действия
  const handleEdit = (row: AggregatedService) => {
    if (!row.editable) {
      notify?.({ type: "error", message: "Эту запись нельзя редактировать (нет ID в таблице изменений Services)." });
      return;
    }
    setEditingRec({
      id: row.id, // предполагаем совпадение с ID в write-таблице (Services)
      name: row.name,
      price: Number(row.price || 0),
      employee_id: null,
      employee_name: row.employees[0] || null,
      photo_url: row.photo_url ?? null,
      description: row.description,
      is_active: row.is_active,
    });
    setEditOpen(true);
  };

  const handleDelete = async (row: AggregatedService) => {
    try {
      const { apiFetch } = await import("../../utility/apiClient");
      await apiFetch(`/api/v1/services/${row.id}/`, { method: "DELETE" });

      // Перезагружаем
      await loadAll();
      notify?.({ type: "success", message: "Услуга удалена" });
    } catch (e) {
      console.error("Delete service failed:", e);
      notify?.({ type: "error", message: "Не удалось удалить услугу. Проверьте права RLS." });
    }
  };

  // Компонент элемента услуги
  const ServiceItem: React.FC<{ s: AggregatedService }> = ({ s }) => {
    return (
      <Box
        onClick={() => {
          setSelectedServiceId(s.id);
          setDetailsOpen(true);
        }}
        sx={{
          px: 2,
          py: 2,
          cursor: "pointer",
          "&:hover": { bgcolor: (theme) => theme.palette.action.hover },
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          gap={1.5}
        >
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                overflow: "hidden",
                borderRadius: 1,
                flexShrink: 0,
                bgcolor: s.photo_url ? "transparent" : "action.hover",
              }}
            >
              {s.photo_url ? (
                <Box
                  component="img"
                  src={s.photo_url}
                  alt=""
                  sx={{ width: 1, height: 1, objectFit: "cover", display: "block" }}
                />
              ) : null}
            </Box>

            <Stack sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" noWrap sx={{ opacity: s.is_active ? 1 : 0.6 }}>
                {s.name || "Без названия"}
              </Typography>
              {!s.is_active && (
                <Typography variant="caption" color="error">
                  Неактивна
                </Typography>
              )}
            </Stack>
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            gap={1.25}
            sx={{ minWidth: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="subtitle2" color="text.primary" sx={{ whiteSpace: "nowrap" }}>
              {Number.isFinite(Number(s.price)) ? String(s.price ?? 0) : "0"} сом
            </Typography>
            {isAdmin && (
              <Tooltip title={s.editable ? "Редактировать" : "Нельзя редактировать"}>
                <span>
                  <IconButton size="small" onClick={() => handleEdit(s)} disabled={!s.editable}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {isAdmin && (
              <Tooltip title={s.editable ? "Удалить" : "Нельзя удалить"}>
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      setConfirmRow(s);
                      setConfirmOpen(true);
                    }}
                    disabled={!s.editable}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      <PageHeader
        title="Услуги"
        showTitle={false}
        addButtonText={isAdmin ? "Добавить услугу" : undefined}
        onAdd={isAdmin ? () => setAddOpen(true) : undefined}
        showSearch
        searchVal={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <Box sx={(theme) => ({ px: theme.appLayout.page.paddingX, pb: 2, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" })}>
        <Card
          variant="outlined"
          sx={{ flex: 1, width: 1, display: "flex", flexDirection: "column" }}
        >
          {/* Removed CardHeader as actions are now in PageHeader */}
          <CardContent
            ref={scrollContainerRef}
            sx={{ p: 0, flex: 1, minHeight: 0, overflowY: "auto" }}
          >
            {loading ? (
              <Stack alignItems="center" sx={{ py: 6 }}>
                <CircularProgress size={28} />
              </Stack>
            ) : errorMsg ? (
              <Typography color="error" sx={{ p: 2 }}>
                {errorMsg}
              </Typography>
            ) : (
              <>
                {visibleServices.length === 0 ? (
                  <Typography variant="body2" sx={{ p: 2 }}>
                    Нет услуг
                  </Typography>
                ) : (
                  <Stack divider={<Divider flexItem />}>
                    {visibleServices.map((s) => (
                      <ServiceItem key={s.id} s={s} />
                    ))}
                  </Stack>
                )}
                <Stack alignItems="center" sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {visibleCount < totalUnique ? "Прокрутите вниз, чтобы загрузить ещё…" : "Больше услуг нет"}
                  </Typography>
                </Stack>
                <Box ref={sentinelRef} sx={{ height: 8 }} />
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Добавление услуги */}
      <AddServiceDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={async () => {
          setAddOpen(false);
          await loadAll();
        }}
      />

      {/* Редактирование услуги */}
      {editingRec && (
        <EditServiceDrawer
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setEditingRec(null);
          }}
          record={editingRec}
          onUpdated={async () => {
            setEditOpen(false);
            setEditingRec(null);
            await loadAll();
          }}
        />
      )}

      {/* Просмотр услуги */}
      <ServiceQuickViewDrawer
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedServiceId(null);
        }}
        serviceId={selectedServiceId}
      />

      {/* Подтверждение удаления */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Удалить услугу</DialogTitle>
        <DialogContent>
          <Typography>Вы уверены, что хотите удалить услугу "{confirmRow?.name}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Отмена</Button>
          <Tooltip title="Удалить услугу">
            <IconButton
              color="error"
              onClick={async () => {
                if (confirmRow) {
                  await handleDelete(confirmRow);
                  setConfirmOpen(false);
                  setConfirmRow(null);
                } else {
                  setConfirmOpen(false);
                }
              }}
              sx={{
                border: '1px solid',
                borderColor: 'error.main',
                '&:hover': {
                  borderColor: 'error.dark',
                  backgroundColor: 'rgba(211, 47, 47, 0.08)',
                }
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServicesPage;

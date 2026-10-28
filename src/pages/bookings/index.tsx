import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { PageHeader } from "../../components/ui";
import { PERMISSIONS } from "../../constants/permissions";
import { useBranchContext } from "../../contexts/branch-context";
import { useNewBookingsCount } from "../../hooks/useNewBookingsCount";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { formatMoney } from "../../utility/currency";
import {
  countBookings,
  listBookings,
  listBookingSettings,
  type Booking,
  type BookingListParams,
} from "../../services/bookings";
import { BookingDrawer } from "./BookingDrawer";
import { BookingSettingsDrawer } from "./BookingSettingsDrawer";
import { branchBookLink } from "./slug";
import {
  BOOKING_STATUS_COLOR,
  formatBookingStart,
  formatPhone,
  isClosedStatus,
  isOverdue,
  PREPAYMENT_STATUS_COLOR,
} from "./meta";

// Онлайн-заявки с витрины /book. Заявка — не приём: администратор подтверждает её
// на карту клиента (создаётся приём) или отклоняет. Скоуп по филиалам — на бэке.
// Новая заявка держит окно до обработки; пропущенные (время визита прошло) — своя вкладка.

type TabValue = "new" | "overdue" | "awaiting_payment" | "attention" | "confirmed" | "rejected" | "expired" | "all";
const TAB_PARAMS: Record<TabValue, BookingListParams> = {
  new: { status: "new", overdue: false },
  overdue: { overdue: true },
  awaiting_payment: { status: "awaiting_payment" },
  attention: { needsAttention: true },
  confirmed: { status: "confirmed" },
  rejected: { status: "rejected" },
  expired: { status: "expired" },
  all: {},
};
// Вкладки предоплаты видны, только когда в них что-то есть (или они открыты).
const OPTIONAL_TABS: TabValue[] = ["awaiting_payment", "attention", "expired"];
const TABS: TabValue[] = ["new", "overdue", "awaiting_payment", "attention", "confirmed", "rejected", "expired", "all"];
const COUNTED_TABS: TabValue[] = ["new", "overdue", "awaiting_payment", "attention", "expired"];
const TAB_CHIP_COLOR: Partial<Record<TabValue, "warning" | "error" | "info" | "default">> = {
  new: "warning",
  overdue: "error",
  awaiting_payment: "info",
  attention: "error",
  expired: "default",
};
const PAGE_SIZE = 20;

const BookingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  usePageTitle(t("menu.bookings"));
  const { hasPermission } = usePermissions();
  // Бейдж в меню опрашивается там же; здесь — только чтобы вкладки обновились вместе с ним.
  useNewBookingsCount();

  const [tab, setTab] = React.useState<TabValue>("new");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);

  // Филиал заявок: по умолчанию — выбранный в сайдбаре; «Все» — явно все доступные
  // (у роли филиала их может быть несколько, а переключатель в сайдбаре есть не у всех).
  const { branches, selectedBranch } = useBranchContext();
  const [branchFilter, setBranchFilter] = React.useState<string>(selectedBranch?.id ?? "all");
  React.useEffect(() => setBranchFilter(selectedBranch?.id ?? "all"), [selectedBranch?.id]);

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);
  React.useEffect(() => setPage(1), [tab, debouncedSearch, branchFilter]);
  // ?open=<id> — ссылка на заявку из предупреждения «на это время онлайн-заявка».
  const linkedId = searchParams.get("open");
  React.useEffect(() => {
    if (!linkedId) return;
    setOpenId(linkedId);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("open");
        return next;
      },
      { replace: true },
    );
  }, [linkedId, setSearchParams]);

  const query = useQuery({
    queryKey: ["bookings", tab, debouncedSearch, page, branchFilter],
    queryFn: () =>
      listBookings({
        ...TAB_PARAMS[tab],
        branch: branchFilter,
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
        // Новые и ждущие оплату — по времени визита (ближайшие сверху), пропущенные — самые
        // давние сверху тоже по визиту, остальные — свежие сверху.
        // Значение ordering — в snake_case: CamelCaseMiddleWare переводит имена query-параметров, но не значения.
        ordering: tab === "new" || tab === "overdue" || tab === "awaiting_payment" ? "start_at" : "-created_at",
      }),
    placeholderData: keepPreviousData,
    refetchInterval: tab === "new" || tab === "awaiting_payment" ? 60_000 : false,
  });

  // Счётчики вкладок; ключ под ["bookings"] — обновляются вместе со списком после действий.
  const countsQuery = useQuery({
    queryKey: ["bookings", "tab-counts", branchFilter],
    queryFn: async () => {
      const counts = await Promise.all(
        COUNTED_TABS.map((value) => countBookings({ ...TAB_PARAMS[value], branch: branchFilter })),
      );
      return Object.fromEntries(COUNTED_TABS.map((value, index) => [value, counts[index]])) as Partial<Record<TabValue, number>>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const counts = countsQuery.data ?? {};
  const visibleTabs = TABS.filter((value) => !OPTIONAL_TABS.includes(value) || value === tab || (counts[value] ?? 0) > 0);

  // Ссылка на витрину: выбран филиал — его короткий адрес, иначе общий выбор филиала.
  const settingsQuery = useQuery({
    queryKey: ["booking-settings"],
    queryFn: listBookingSettings,
    enabled: hasPermission(PERMISSIONS.BOOKING_SETTINGS_READ),
    staleTime: 60_000,
  });
  const filteredSettings = settingsQuery.data?.find((item) => item.branch === branchFilter);
  const publicLink =
    branchFilter === "all"
      ? `${window.location.origin}/book`
      : branchBookLink(window.location.origin, branchFilter, filteredSettings?.publicSlug ?? "");
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt(t("bookings.copyLinkPrompt"), publicLink);
    }
  };

  const rows = query.data?.results ?? [];
  const pages = Math.max(1, Math.ceil((query.data?.count ?? 0) / PAGE_SIZE));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, overflowY: "auto" }}>
      <PageHeader
        title={t("menu.bookings")}
        showSearch
        searchVal={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("bookings.searchPlaceholder")}
        loading={query.isFetching}
        actions={
          <Stack direction="row" spacing={1}>
            {branches.length > 1 && (
              <TextField
                select
                size="small"
                label={t("bookings.branchFilter")}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="all">{t("bookings.allBranches")}</MenuItem>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.brandName || b.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Tooltip title={linkCopied ? t("bookings.linkCopied") : publicLink}>
              <Button variant="outlined" startIcon={<LinkOutlined />} onClick={copyLink}>
                {t("bookings.copyLink")}
              </Button>
            </Tooltip>
            {hasPermission(PERMISSIONS.BOOKING_SETTINGS_READ) && (
              <Button variant="outlined" startIcon={<SettingsOutlined />} onClick={() => setSettingsOpen(true)}>
                {t("bookings.settings.open")}
              </Button>
            )}
          </Stack>
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 1.5 }}>
        {visibleTabs.map((value) => {
          const count = counts[value] ?? 0;
          return (
            <Tab
              key={value}
              value={value}
              label={
                count > 0 ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{t(`bookings.tabs.${value}`)}</span>
                    <Chip label={count} size="small" color={TAB_CHIP_COLOR[value] ?? "default"} sx={{ height: 20, fontWeight: 700 }} />
                  </Stack>
                ) : (
                  t(`bookings.tabs.${value}`)
                )
              }
            />
          );
        })}
      </Tabs>

      {tab === "overdue" && rows.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t("bookings.overdueHint")}
        </Alert>
      )}
      {tab === "attention" && rows.length > 0 && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {t("bookings.attentionHint")}
        </Alert>
      )}
      {query.isError && <Alert severity="error">{(query.error as Error).message}</Alert>}
      {query.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography fontWeight={700}>{t(`bookings.empty.${tab}`)}</Typography>
          {(tab === "new" || tab === "all") && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("bookings.empty.hint")}
            </Typography>
          )}
        </Box>
      ) : (
        <Stack spacing={1}>
          {rows.map((b) => (
            <BookingRow key={b.id} booking={b} lang={i18n.language} onOpen={() => setOpenId(b.id)} />
          ))}
        </Stack>
      )}

      {pages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <Pagination count={pages} page={page} onChange={(_, p) => setPage(p)} />
        </Box>
      )}

      <BookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />
      <BookingSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
};

const BookingRow: React.FC<{ booking: Booking; lang: string; onOpen: () => void }> = ({ booking, lang, onOpen }) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onOpen} sx={{ p: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.75, sm: 2 }} alignItems={{ sm: "center" }}>
          <Box sx={{ minWidth: 150 }}>
            <Typography fontWeight={800}>
              {formatBookingStart(booking.startAt, booking.branch.timezone, lang)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {booking.branch.name}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>
              {booking.clientName}
              {booking.contactName && (
                <Typography component="span" variant="body2" color="text.secondary">
                  {" "}
                  · {booking.contactName}
                </Typography>
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {booking.service.name} · {booking.performer.fullName}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap" rowGap={0.5}>
            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
              {formatPhone(booking.contactPhone)}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
              {formatMoney(booking.price, booking.currency)}
            </Typography>
            {booking.prepayment && (
              <Chip
                size="small"
                variant="outlined"
                color={booking.prepaymentNeedsAttention ? "error" : PREPAYMENT_STATUS_COLOR[booking.prepayment.status]}
                label={t(`bookings.prepayment.chip.${booking.prepaymentNeedsAttention ? "attention" : booking.prepayment.status}`, {
                  amount: formatMoney(booking.prepayment.paidAmount ?? booking.prepayment.amount, booking.currency),
                })}
              />
            )}
            {booking.claimedBy && booking.status === "new" && (
              <Chip size="small" variant="outlined" label={t("bookings.claim.chip", { who: booking.claimedBy.fullName })} />
            )}
            {booking.slotTaken && (
              <Tooltip title={t("bookings.conflicts.chipHint")}>
                <Chip size="small" color="error" variant="outlined" label={t("bookings.conflicts.chip")} />
              </Tooltip>
            )}
            <Chip
              size="small"
              label={
                isOverdue(booking.status, booking.startAt) ? t("bookings.status.overdue") : t(`bookings.status.${booking.status}`)
              }
              color={isOverdue(booking.status, booking.startAt) ? "error" : BOOKING_STATUS_COLOR[booking.status]}
              variant={isClosedStatus(booking.status) ? "outlined" : "filled"}
            />
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default BookingsPage;

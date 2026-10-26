import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../../components/ui";
import { PERMISSIONS } from "../../constants/permissions";
import { useNewBookingsCount } from "../../hooks/useNewBookingsCount";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePermissions } from "../../hooks/usePermissions";
import { formatMoney } from "../../utility/currency";
import { listBookings, type Booking, type BookingStatus } from "../../services/bookings";
import { BookingDrawer } from "./BookingDrawer";
import { BookingSettingsDrawer } from "./BookingSettingsDrawer";
import { BOOKING_STATUS_COLOR, formatBookingStart, formatPhone } from "./meta";

// Онлайн-заявки с витрины /book. Заявка — не приём: администратор подтверждает её
// на карту клиента (создаётся приём) или отклоняет. Скоуп по филиалам — на бэке.

type TabValue = BookingStatus | "all";
const TABS: TabValue[] = ["new", "confirmed", "rejected", "all"];
const PAGE_SIZE = 20;

const BookingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  usePageTitle(t("menu.bookings"));
  const { hasPermission } = usePermissions();
  const newCount = useNewBookingsCount();

  const [tab, setTab] = React.useState<TabValue>("new");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);
  React.useEffect(() => setPage(1), [tab, debouncedSearch]);

  const query = useQuery({
    queryKey: ["bookings", tab, debouncedSearch, page],
    queryFn: () =>
      listBookings({
        status: tab === "all" ? undefined : tab,
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
        // Новые — по времени визита (ближайшие сверху), остальные — свежие сверху.
        // Значение ordering — в snake_case: CamelCaseMiddleWare переводит имена query-параметров, но не значения.
        ordering: tab === "new" ? "start_at" : "-created_at",
      }),
    placeholderData: keepPreviousData,
    refetchInterval: tab === "new" ? 60_000 : false,
  });

  const publicLink = `${window.location.origin}/book`;
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
        {TABS.map((value) => (
          <Tab
            key={value}
            value={value}
            label={
              value === "new" && newCount > 0 ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{t(`bookings.tabs.${value}`)}</span>
                  <Chip label={newCount} size="small" color="warning" sx={{ height: 20, fontWeight: 700 }} />
                </Stack>
              ) : (
                t(`bookings.tabs.${value}`)
              )
            }
          />
        ))}
      </Tabs>

      {query.isError && <Alert severity="error">{(query.error as Error).message}</Alert>}
      {query.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography fontWeight={700}>{t(`bookings.empty.${tab}`)}</Typography>
          {tab === "new" && (
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
      <BookingSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} publicLink={publicLink} />
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
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
              {formatPhone(booking.contactPhone)}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
              {formatMoney(booking.price, booking.currency)}
            </Typography>
            <Chip
              size="small"
              label={t(`bookings.status.${booking.status}`)}
              color={BOOKING_STATUS_COLOR[booking.status]}
              variant={booking.status === "rejected" ? "outlined" : "filled"}
            />
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default BookingsPage;

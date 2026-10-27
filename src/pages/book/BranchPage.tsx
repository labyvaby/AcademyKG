import React from "react";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { formatPrice } from "./money";
import {
  getPublicServices,
  getPublicSpecialists,
  type PublicBranch,
  type PublicService,
  type PublicSpecialist,
} from "../../services/publicBooking";
import { branchPath, findBranch, useBookInfo } from "./BookContext";
import { lessonIcon } from "./lessonIcons";
import { BookShell, Loading, StepMessage, initials, useLoad, useRelativeDay } from "./shared";
import {
  BORDER,
  CARD_SHADOW,
  hoverLift,
  MUTED,
  NEAREST_TONE,
  PILL_RADIUS,
  RADIUS,
  TILE_RADIUS,
} from "./theme";

// /book/:branch — занятия филиала плитками; ?service=<id> — специалисты этого занятия
// с ближайшими окнами. Слева (на телефоне — сверху) остаётся список занятий.

export function useBranchRoute() {
  const { branchRef } = useParams();
  const { info, loading, error, reload } = useBookInfo();
  const branch = findBranch(info?.branches ?? [], branchRef);
  return { branchRef: branchRef ?? "", branch, loading: loading && !info, error, reload, single: (info?.branches.length ?? 0) <= 1 };
}

/** Заглушки «загрузка / ошибка / нет филиала» и переход со ссылки по id на короткий адрес. */
export function useBranchGate(route: ReturnType<typeof useBranchRoute>): React.ReactElement | null {
  const { t } = useTranslation();
  const location = useLocation();
  if (route.loading) {
    return (
      <BookShell>
        <Loading />
      </BookShell>
    );
  }
  if (route.error) {
    return (
      <BookShell narrow>
        <StepMessage
          title={t("book.errors.loadTitle")}
          text={t("book.errors.loadText")}
          action={<Button onClick={route.reload}>{t("book.retry")}</Button>}
        />
      </BookShell>
    );
  }
  if (!route.branch) {
    return (
      <BookShell narrow>
        <StepMessage
          title={t("book.branchNotFound")}
          text={t("book.branchNotFoundText")}
          action={<Button href="/book">{t("book.allBranches")}</Button>}
        />
      </BookShell>
    );
  }
  if (route.branch.slug && route.branchRef !== route.branch.slug) {
    const rest = location.pathname.split("/").slice(3).join("/");
    return <Navigate to={`${branchPath(route.branch, rest ? `/${rest}` : "")}${location.search}`} replace />;
  }
  return null;
}

const BranchPage: React.FC = () => {
  const route = useBranchRoute();
  const gate = useBranchGate(route);
  if (gate) return gate;
  return <BranchContent branch={route.branch!} single={route.single} />;
};

const BranchContent: React.FC<{ branch: PublicBranch; single: boolean }> = ({ branch, single }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const serviceId = params.get("service") ?? "";

  const services = useLoad((signal) => getPublicServices(branch.id, signal), [branch.id]);
  const service = services.data?.find((s) => s.id === serviceId) ?? null;
  const specialists = useLoad(
    service ? (signal) => getPublicSpecialists(branch.id, service.id, signal) : null,
    [branch.id, service?.id],
  );

  const pickService = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("service", id);
    else next.delete("service");
    setParams(next);
  };
  const openSpecialist = (specialistId: string, slot?: { date: string; time: string }) => {
    const query = new URLSearchParams({ service: serviceId });
    if (slot) {
      query.set("date", slot.date);
      query.set("time", slot.time);
    }
    navigate(branchPath(branch, `/specialist/${specialistId}?${query}`));
  };

  if (services.loading && !services.data) {
    return (
      <BookShell branch={branch} title={t("book.steps.service")}>
        <TilesGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: TILE_RADIUS }} />
          ))}
        </TilesGrid>
      </BookShell>
    );
  }
  if (services.error || !services.data || services.data.length === 0) {
    return (
      <BookShell branch={branch} narrow>
        <StepMessage
          title={services.error ? t("book.errors.loadTitle") : t("book.empty.services")}
          text={services.error ? t("book.errors.loadText") : t("book.empty.callUs")}
          action={
            services.error ? (
              <Button onClick={services.reload}>{t("book.retry")}</Button>
            ) : (
              <CallBranchButton branch={branch} />
            )
          }
        />
      </BookShell>
    );
  }

  // ── Занятия ───────────────────────────────────────────────────────────────
  if (!service) {
    return (
      <BookShell
        branch={branch}
        title={t("book.steps.service")}
        onBack={single ? undefined : () => navigate("/book")}
      >
        <TilesGrid>
          {services.data.map((s) => (
            <LessonTile key={s.id} service={s} currency={branch.currency} onClick={() => pickService(s.id)} />
          ))}
        </TilesGrid>
      </BookShell>
    );
  }

  // ── Специалисты занятия ───────────────────────────────────────────────────
  return (
    <BookShell branch={branch} title={t("book.steps.specialist")} onBack={() => pickService(null)}>
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "280px minmax(0, 1fr)" } }}>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <Stack spacing={1.25} sx={{ position: "sticky", top: 84 }}>
            {services.data.map((s) => (
              <LessonTile
                key={s.id}
                service={s}
                currency={branch.currency}
                active={s.id === service.id}
                compact
                onClick={() => pickService(s.id)}
              />
            ))}
          </Stack>
        </Box>
        {/* Телефон: занятия — лентой над списком. */}
        <Box sx={{ display: { xs: "flex", md: "none" }, gap: 1, overflowX: "auto", mx: -2, px: 2, pb: 0.5 }}>
          {services.data.map((s) => {
            const active = s.id === service.id;
            return (
              <Box
                key={s.id}
                component="button"
                type="button"
                onClick={() => pickService(s.id)}
                sx={{
                  flexShrink: 0,
                  px: 1.75,
                  py: 1,
                  borderRadius: PILL_RADIUS,
                  border: 1,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  whiteSpace: "nowrap",
                  bgcolor: active ? "primary.main" : "background.paper",
                  borderColor: active ? "primary.main" : BORDER,
                  color: active ? "primary.contrastText" : "text.primary",
                }}
              >
                {s.name}
              </Box>
            );
          })}
        </Box>

        <Box>
          {specialists.loading && !specialists.data ? (
            <SpecialistsGrid>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={340} sx={{ borderRadius: RADIUS }} />
              ))}
            </SpecialistsGrid>
          ) : specialists.error ? (
            <StepMessage
              title={t("book.errors.loadTitle")}
              text={t("book.errors.loadText")}
              action={<Button onClick={specialists.reload}>{t("book.retry")}</Button>}
            />
          ) : !specialists.data || specialists.data.length === 0 ? (
            <StepMessage
              title={t("book.empty.specialists")}
              text={t("book.empty.callUs")}
              action={<CallBranchButton branch={branch} />}
            />
          ) : (
            <SpecialistsGrid>
              {specialists.data.map((s) => (
                <SpecialistCard
                  key={s.id}
                  specialist={s}
                  branch={branch}
                  onOpen={() => openSpecialist(s.id)}
                  onPickTime={(date, time) => openSpecialist(s.id, { date, time })}
                />
              ))}
            </SpecialistsGrid>
          )}
        </Box>
      </Box>
    </BookShell>
  );
};

// ── Плитки и карточки ───────────────────────────────────────────────────────

const TilesGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: "grid",
      gap: 1.5,
      gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
    }}
  >
    {children}
  </Box>
);

const SpecialistsGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: "grid",
      gap: 2,
      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
    }}
  >
    {children}
  </Box>
);

/** Плитка занятия: значок, название, длительность и цена. */
export const LessonTile: React.FC<{
  service: PublicService;
  currency: string;
  active?: boolean;
  /** В боковой колонке — без цены. */
  compact?: boolean;
  onClick: () => void;
}> = ({ service, currency, active, compact, onClick }) => {
  const { t } = useTranslation();
  const Icon = lessonIcon(service.name);
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        gap: 1.75,
        width: "100%",
        p: compact ? 1.5 : 2,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        color: "text.primary",
        border: 1,
        borderRadius: TILE_RADIUS,
        transition: "background-color .2s, border-color .2s, transform .1s",
        bgcolor: active ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
        borderColor: active ? "primary.main" : BORDER,
        "&:hover": { borderColor: "primary.main" },
        "&:active": { transform: "scale(0.98)" },
      })}
    >
      <Box
        sx={(theme) => ({
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: alpha(theme.palette.primary.main, active ? 0.16 : 0.08),
          color: "primary.main",
          fontWeight: 700,
        })}
      >
        {Icon ? <Icon sx={{ fontSize: 22 }} /> : service.name.charAt(0).toUpperCase()}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontSize: { xs: 14, md: 15 }, fontWeight: active ? 700 : 600, color: active ? "primary.main" : "text.primary" }}
        >
          {service.name}
        </Typography>
        <Typography variant="body2" sx={{ color: MUTED, mt: 0.25 }}>
          {t("book.minutes", { count: service.durationMinutes })}
          {!compact && ` · ${formatPrice(service.price, currency)}`}
        </Typography>
      </Box>
      <ChevronRightOutlined sx={{ fontSize: 20, color: "text.secondary", flexShrink: 0 }} />
    </Box>
  );
};

/** Стаж по году начала работы; null — год не указан или меньше года. */
export function experienceYears(careerStartYear: number | null): number | null {
  if (!careerStartYear) return null;
  const years = new Date().getFullYear() - careerStartYear;
  return years >= 1 ? years : null;
}

/** Фото специалиста или монограмма на нейтральном фоне. */
export const SpecialistPhoto: React.FC<{ specialist: PublicSpecialist; height: number | Record<string, number> }> = ({
  specialist,
  height,
}) => {
  const [broken, setBroken] = React.useState(false);
  if (specialist.photoUrl && !broken) {
    return (
      <Box
        component="img"
        src={specialist.photoUrl}
        alt={specialist.fullName}
        loading="lazy"
        onError={() => setBroken(true)}
        sx={{ width: "100%", height, objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <Box
      sx={(theme) => ({
        width: "100%",
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        color: "primary.main",
        fontSize: 40,
        fontWeight: 700,
      })}
    >
      {initials(specialist.fullName)}
    </Box>
  );
};

const SpecialistCard: React.FC<{
  specialist: PublicSpecialist;
  branch: PublicBranch;
  onOpen: () => void;
  onPickTime: (date: string, time: string) => void;
}> = ({ specialist, branch, onOpen, onPickTime }) => {
  const { t } = useTranslation();
  const relativeDay = useRelativeDay();
  const nearest = specialist.nearest;
  const tone = nearest ? NEAREST_TONE[dayKind(nearest.date, branch.timezone)] : null;
  const years = experienceYears(specialist.careerStartYear);
  const specialization = specialist.specializations[0];

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        border: 1,
        borderColor: BORDER,
        borderRadius: RADIUS,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
        transition: "transform .15s, box-shadow .15s, border-color .15s",
        "&:hover": hoverLift(theme),
      })}
    >
      <Box component="button" type="button" onClick={onOpen} sx={{ p: 0, border: 0, cursor: "pointer", position: "relative", bgcolor: "transparent" }}>
        <SpecialistPhoto specialist={specialist} height={{ xs: 170, md: 200 }} />
        {specialization && (
          <Box
            sx={{
              position: "absolute",
              right: 0,
              bottom: 0,
              px: 1.25,
              py: 0.5,
              borderTopLeftRadius: TILE_RADIUS,
              bgcolor: "background.paper",
              fontSize: 12,
              fontWeight: 700,
              color: "text.secondary",
            }}
          >
            {specialization}
          </Box>
        )}
      </Box>
      <Stack spacing={1.25} sx={{ p: 1.75, flex: 1 }}>
        <Box>
          <Typography
            component="button"
            type="button"
            onClick={onOpen}
            sx={{ p: 0, border: 0, bgcolor: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "text.primary", lineHeight: 1.35 }}
          >
            {specialist.fullName}
          </Typography>
          {(years || specialist.prepayment) && (
            <Typography variant="body2" sx={{ color: MUTED, mt: 0.25 }}>
              {[
                years ? t("book.profile.experience", { count: years }) : null,
                specialist.prepayment
                  ? t("book.prepayment.badge", { amount: formatPrice(specialist.prepayment.amount, branch.currency) })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          {nearest && tone ? (
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: tone.label }}>
                {capitalize(relativeDay(nearest.date, branch.timezone))}:
              </Typography>
              {nearest.times.map((hhmm) => (
                <Box
                  key={hhmm}
                  component="button"
                  type="button"
                  onClick={() => onPickTime(nearest.date, hhmm)}
                  sx={{
                    px: 1,
                    py: 0.4,
                    border: 0,
                    borderRadius: PILL_RADIUS,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    bgcolor: tone.bg,
                    color: tone.text,
                    "&:hover": { filter: "brightness(0.95)" },
                  }}
                >
                  {hhmm}
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: MUTED }}>
              {t("book.noSlotsSoon")}
            </Typography>
          )}
        </Box>

        {nearest ? (
          <Button
            variant="outlined"
            onClick={onOpen}
            sx={{ borderRadius: PILL_RADIUS, borderColor: BORDER, color: "text.primary", fontWeight: 600 }}
          >
            {t("book.form.submit")}
          </Button>
        ) : (
          <CallBranchButton branch={branch} fullWidth />
        )}
      </Stack>
    </Box>
  );
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Сегодня / завтра / позже — в часовом поясе филиала. */
function dayKind(date: string, timezone: string): keyof typeof NEAREST_TONE {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  if (date === fmt.format(new Date())) return "today";
  if (date === fmt.format(new Date(Date.now() + 24 * 60 * 60 * 1000))) return "tomorrow";
  return "later";
}

/** «Позвонить в филиал» — когда онлайн записаться нельзя. Без телефона филиала не рисуется. */
export const CallBranchButton: React.FC<{ branch: PublicBranch; fullWidth?: boolean }> = ({ branch, fullWidth }) => {
  const { t } = useTranslation();
  if (!branch.phone) return null;
  return (
    <Button
      variant="outlined"
      href={`tel:${branch.phone}`}
      startIcon={<PhoneOutlined />}
      fullWidth={fullWidth}
      sx={{ borderRadius: PILL_RADIUS, borderColor: BORDER, color: "text.primary", fontWeight: 600 }}
    >
      {t("book.callBranch")}
    </Button>
  );
};

export default BranchPage;

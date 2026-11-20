import React from "react";
import { Alert, Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import TranslateOutlined from "@mui/icons-material/TranslateOutlined";
import WorkOutlineOutlined from "@mui/icons-material/WorkOutlineOutlined";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { formatPrice } from "./money";
import { formatPhone } from "../bookings/meta";
import {
  getPublicCalendar,
  getPublicSpecialist,
  type PublicBranch,
  type PublicCalendar,
  type PublicService,
  type PublicSpecialistDetail,
} from "../../services/publicBooking";
import { branchPath, branchTitle } from "./BookContext";
import { CallBranchButton, experienceYears, SpecialistPhoto, useBranchGate, useBranchRoute } from "./BranchPage";
import { ContactsDialog } from "./ContactsDialog";
import { LANGUAGE_LABEL } from "./i18n";
import { BookShell, formatDay, Loading, Panel, StepMessage, useLoad } from "./shared";
import {
  accentChip,
  BORDER,
  DISABLED_TEXT,
  DIVIDER,
  FREE_TONE,
  MUTED,
  pickedShadow,
  PILL_RADIUS,
  TILE_RADIUS,
} from "./theme";

// /book/:branch/specialist/:id?service=&date=&time= — запись к специалисту: занятие,
// день и время в часовом поясе филиала, затем контакты в модалке. Выбор живёт в query:
// обновление страницы и ссылка «на окно» из списка специалистов открывают то же самое.

const DAYS_PAGE = 14;
const BIO_CLAMP = 180;

const SpecialistPage: React.FC = () => {
  const route = useBranchRoute();
  const gate = useBranchGate(route);
  if (gate) return gate;
  return <SpecialistContent branch={route.branch!} />;
};

const SpecialistContent: React.FC<{ branch: PublicBranch }> = ({ branch }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { specialistId = "" } = useParams();
  const specialist = useLoad((signal) => getPublicSpecialist(branch.id, specialistId, signal), [branch.id, specialistId]);

  if (specialist.loading && !specialist.data) {
    return (
      <BookShell branch={branch}>
        <Loading />
      </BookShell>
    );
  }
  if (specialist.error || !specialist.data) {
    const gone = (specialist.error as { status?: number } | null)?.status === 404;
    return (
      <BookShell branch={branch} narrow>
        <StepMessage
          title={gone ? t("book.specialistGone") : t("book.errors.loadTitle")}
          text={gone ? t("book.specialistGoneText") : t("book.errors.loadText")}
          action={
            gone ? (
              <Button variant="contained" onClick={() => navigate(branchPath(branch))}>
                {t("book.allLessons")}
              </Button>
            ) : (
              <Button onClick={specialist.reload}>{t("book.retry")}</Button>
            )
          }
        />
      </BookShell>
    );
  }
  return <Booking branch={branch} specialist={specialist.data} />;
};

const Booking: React.FC<{ branch: PublicBranch; specialist: PublicSpecialistDetail }> = ({ branch, specialist }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const services = specialist.services;
  const requested = params.get("service");
  const service =
    services.find((s) => s.id === requested) ?? (services.length === 1 ? services[0] : null);

  const calendar = useLoad(
    service ? (signal) => getPublicCalendar(branch.id, specialist.id, service.id, signal) : null,
    [branch.id, specialist.id, service?.id],
  );
  const days = calendar.data?.days ?? [];
  const firstFree = days.find((d) => d.times.length > 0)?.date ?? "";
  const requestedDate = params.get("date") ?? "";
  const date = days.some((d) => d.date === requestedDate && d.times.length > 0) ? requestedDate : firstFree;
  const day = days.find((d) => d.date === date);
  const requestedTime = params.get("time") ?? "";
  const time = day?.times.includes(requestedTime) ? requestedTime : "";

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [slotLost, setSlotLost] = React.useState(false);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  const step = !service ? 0 : !time ? (date ? 2 : 1) : 3;
  const back = () => navigate(branchPath(branch, service ? `?service=${service.id}` : ""));

  return (
    <BookShell branch={branch} title={t("book.steps.time")} onBack={back}>
      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          alignItems: "start",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 5fr) minmax(0, 7fr)" },
          pb: { xs: 10, md: 0 },
        }}
      >
        <Stack spacing={2}>
          <ProfileCard specialist={specialist} />
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <BranchCard branch={branch} />
          </Box>
        </Stack>

        <Stack spacing={2}>
          <Stepper step={step} />
          {slotLost && (
            <Alert severity="warning" onClose={() => setSlotLost(false)}>
              <strong>{t("book.errors.slotTakenTitle")}.</strong> {t("book.errors.slotTakenHint")}
            </Alert>
          )}

          {services.length > 1 && (
            <Panel>
              <SectionTitle title={t("book.pickLesson")} aside={t("book.lessonsCount", { count: services.length })} />
              <Stack spacing={1}>
                {services.map((s) => (
                  <ServiceRow
                    key={s.id}
                    service={s}
                    currency={branch.currency}
                    picked={s.id === service?.id}
                    onPick={() => update({ service: s.id, date: null, time: null })}
                  />
                ))}
              </Stack>
            </Panel>
          )}

          {services.length === 0 ? (
            <Panel>
              <StepMessage title={t("book.empty.specialistLessons")} text={t("book.empty.callUs")} action={<CallBranchButton branch={branch} />} />
            </Panel>
          ) : service ? (
            <Panel>
              <DaysAndTimes
                branch={branch}
                calendar={calendar}
                date={date}
                time={time}
                onDate={(d) => update({ date: d, time: null })}
                onTime={(hhmm) => {
                  setSlotLost(false);
                  update({ date, time: hhmm });
                }}
              />
            </Panel>
          ) : null}

          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <BranchCard branch={branch} />
          </Box>

          {service && (
            <Summary
              branch={branch}
              service={service}
              date={date}
              time={time}
              prepayment={specialist.prepayment?.amount ?? null}
              language={i18n.language}
              onSubmit={() => setDialogOpen(true)}
            />
          )}
        </Stack>
      </Box>

      {service && time && (
        <ContactsDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          branch={branch}
          service={service}
          specialist={specialist}
          date={date}
          time={time}
          onSlotLost={() => {
            setDialogOpen(false);
            setSlotLost(true);
            update({ time: null });
            calendar.reload();
          }}
        />
      )}
    </BookShell>
  );
};

// ── Левая колонка ───────────────────────────────────────────────────────────

const ProfileCard: React.FC<{ specialist: PublicSpecialistDetail }> = ({ specialist }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const years = experienceYears(specialist.careerStartYear);
  const longBio = specialist.bio.length > BIO_CLAMP;

  return (
    <Panel>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box sx={{ width: { xs: 104, md: 120 }, flexShrink: 0, borderRadius: TILE_RADIUS, overflow: "hidden" }}>
          <SpecialistPhoto specialist={specialist} height={{ xs: 124, md: 144 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, fontWeight: 700, lineHeight: 1.35 }}>{specialist.fullName}</Typography>
          {specialist.specializations.length > 0 && (
            <Stack direction="row" sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.75 }}>
              {specialist.specializations.map((name) => (
                <Box
                  key={name}
                  sx={(theme) => ({ ...accentChip(theme), px: 1.25, py: 0.5, borderRadius: PILL_RADIUS, fontSize: 12, fontWeight: 600 })}
                >
                  {name}
                </Box>
              ))}
            </Stack>
          )}
          <Stack spacing={0.5} sx={{ mt: 1.25 }}>
            {years && (
              <InfoLine icon={<WorkOutlineOutlined sx={{ fontSize: 16 }} />} text={t("book.profile.experience", { count: years })} />
            )}
            {specialist.languages.length > 0 && (
              <InfoLine
                icon={<TranslateOutlined sx={{ fontSize: 16 }} />}
                text={t("book.profile.languages", {
                  list: specialist.languages.map((code) => LANGUAGE_LABEL[code] ?? t(`book.profile.lang.${code}`)).join(", "),
                })}
              />
            )}
          </Stack>
        </Box>
      </Stack>
      {specialist.bio && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: DIVIDER }}>
          <Typography variant="body2" sx={{ whiteSpace: "pre-line", color: "text.secondary", lineHeight: 1.6 }}>
            {longBio && !expanded ? `${specialist.bio.slice(0, BIO_CLAMP).trimEnd()}…` : specialist.bio}
          </Typography>
          {longBio && (
            <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ mt: 0.5, ml: -1 }}>
              {expanded ? t("book.profile.less") : t("book.profile.more")}
            </Button>
          )}
        </Box>
      )}
    </Panel>
  );
};

const InfoLine: React.FC<{ icon: React.ReactNode; text: React.ReactNode }> = ({ icon, text }) => (
  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: "text.secondary" }}>
    {icon}
    <Typography variant="body2">{text}</Typography>
  </Stack>
);

/** UTC-смещение пояса филиала («GMT+5») — подпись, когда у гостя на устройстве другой пояс. */
function utcOffset(timezone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

const BranchCard: React.FC<{ branch: PublicBranch }> = ({ branch }) => {
  const { t } = useTranslation();
  const guestTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <Panel>
      <Typography fontWeight={700} sx={{ mb: 1 }}>
        {branchTitle(branch)}
      </Typography>
      <Stack spacing={0.75}>
        {branch.address && <InfoLine icon={<PlaceOutlined sx={{ fontSize: 18 }} />} text={branch.address} />}
        {branch.phone && (
          <InfoLine
            icon={<PhoneOutlined sx={{ fontSize: 18 }} />}
            text={
              <Box component="a" href={`tel:${branch.phone}`} sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}>
                {formatPhone(branch.phone)}
              </Box>
            }
          />
        )}
        {guestTimezone !== branch.timezone && (
          <InfoLine
            icon={<AccessTimeOutlined sx={{ fontSize: 18 }} />}
            text={t("book.localTime", { offset: utcOffset(branch.timezone) })}
          />
        )}
      </Stack>
    </Panel>
  );
};

// ── Правая колонка ──────────────────────────────────────────────────────────

const Stepper: React.FC<{ step: number }> = ({ step }) => {
  const { t } = useTranslation();
  const labels = [t("book.stepper.lesson"), t("book.stepper.date"), t("book.stepper.time")];
  return (
    <Panel sx={{ py: { xs: 1.25, md: 1.5 } }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        {labels.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <React.Fragment key={label}>
              {index > 0 && <Box sx={{ flex: 1, height: 2, borderRadius: 1, bgcolor: done || active ? "success.light" : DIVIDER }} />}
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    border: done || active ? 0 : 1,
                    borderColor: BORDER,
                    bgcolor: done ? "success.main" : active ? "primary.main" : "transparent",
                    color: done || active ? "#fff" : MUTED,
                  }}
                >
                  {done ? <CheckOutlined sx={{ fontSize: 16 }} /> : index + 1}
                </Box>
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: done ? "success.main" : active ? "primary.main" : MUTED,
                    display: { xs: active ? "block" : "none", sm: "block" },
                  }}
                >
                  {label}
                </Typography>
              </Stack>
            </React.Fragment>
          );
        })}
      </Stack>
    </Panel>
  );
};

const SectionTitle: React.FC<{ title: string; aside?: string }> = ({ title, aside }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
    <Typography fontWeight={700}>{title}</Typography>
    {aside && <Typography variant="caption" sx={{ color: MUTED }}>{aside}</Typography>}
  </Stack>
);

const ServiceRow: React.FC<{ service: PublicService; currency: string; picked: boolean; onPick: () => void }> = ({
  service,
  currency,
  picked,
  onPick,
}) => (
  <Box
    component="button"
    type="button"
    onClick={onPick}
    aria-pressed={picked}
    sx={(theme) => ({
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      width: "100%",
      p: 1.5,
      textAlign: "left",
      cursor: "pointer",
      fontFamily: "inherit",
      color: "text.primary",
      border: 1,
      borderRadius: TILE_RADIUS,
      borderColor: picked ? "primary.main" : BORDER,
      bgcolor: picked ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
    })}
  >
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: "6px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: picked ? 0 : 1.5,
        borderColor: "#CBD2DC",
        bgcolor: picked ? "primary.main" : "transparent",
        color: "#fff",
      }}
    >
      {picked && <CheckOutlined sx={{ fontSize: 15 }} />}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography fontWeight={600} fontSize={14}>
        {service.name}
      </Typography>
      <InlineMinutes minutes={service.durationMinutes} />
    </Box>
    <Typography fontWeight={700} fontSize={14} sx={{ whiteSpace: "nowrap", color: picked ? "primary.main" : "text.primary" }}>
      {formatPrice(service.price, currency)}
    </Typography>
  </Box>
);

const InlineMinutes: React.FC<{ minutes: number }> = ({ minutes }) => {
  const { t } = useTranslation();
  return (
    <Typography variant="caption" sx={{ color: MUTED }}>
      {t("book.minutes", { count: minutes })}
    </Typography>
  );
};

const DaysAndTimes: React.FC<{
  branch: PublicBranch;
  calendar: { data: PublicCalendar | null; loading: boolean; error: Error | null; reload: () => void };
  date: string;
  time: string;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
}> = ({ branch, calendar, date, time, onDate, onTime }) => {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = React.useState(DAYS_PAGE);
  const days = React.useMemo(() => calendar.data?.days ?? [], [calendar.data]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: branch.timezone }).format(new Date());
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: branch.timezone }).format(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  );

  // Выбранный день дальше показанных двух недель (ссылка «на окно») — раскрываем до него.
  React.useEffect(() => {
    const index = days.findIndex((d) => d.date === date);
    if (index >= visible) setVisible(Math.ceil((index + 1) / DAYS_PAGE) * DAYS_PAGE);
  }, [days, date, visible]);

  if (calendar.loading && !calendar.data) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: TILE_RADIUS }} />
        ))}
      </Box>
    );
  }
  if (calendar.error) {
    return (
      <StepMessage
        title={t("book.errors.loadTitle")}
        text={t("book.errors.loadText")}
        action={<Button onClick={calendar.reload}>{t("book.retry")}</Button>}
      />
    );
  }
  if (!days.some((d) => d.times.length > 0)) {
    return <StepMessage title={t("book.empty.slots")} text={t("book.empty.callUs")} action={<CallBranchButton branch={branch} />} />;
  }

  const activeDay = days.find((d) => d.date === date);
  return (
    <Box>
      <SectionTitle title={t("book.pickDay")} aside={t("book.daysAhead", { count: days.length })} />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: { xs: 0.75, sm: 1 } }}>
        {days.slice(0, visible).map((d) => {
          const free = d.times.length > 0;
          const picked = d.date === date;
          const label =
            d.date === today ? t("book.today") : d.date === tomorrow ? t("book.tomorrow") : formatDay(d.date, i18n.language, { weekday: "short" });
          return (
            <Box
              key={d.date}
              component="button"
              type="button"
              disabled={!free}
              onClick={() => onDate(d.date)}
              aria-pressed={picked}
              sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.25,
                py: 1,
                px: 0.25,
                minWidth: 0,
                fontFamily: "inherit",
                cursor: free ? "pointer" : "default",
                border: 1,
                borderRadius: TILE_RADIUS,
                transition: "border-color .15s",
                borderColor: picked ? "primary.main" : free ? BORDER : DIVIDER,
                bgcolor: picked ? "primary.main" : free ? "background.paper" : "#FAFAFB",
                color: picked ? "primary.contrastText" : free ? "text.primary" : DISABLED_TEXT,
                boxShadow: picked ? pickedShadow(theme) : "none",
                "&:hover": free && !picked ? { borderColor: "primary.light" } : undefined,
              })}
            >
              <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", opacity: 0.85 }} noWrap>
                {label}
              </Typography>
              <Typography sx={{ fontSize: { xs: 17, sm: 20 }, fontWeight: 800, lineHeight: 1.1 }}>
                {formatDay(d.date, i18n.language, { day: "numeric" })}
              </Typography>
              <Typography sx={{ fontSize: 10, opacity: 0.85 }} noWrap>
                {formatDay(d.date, i18n.language, { month: "short" })}
              </Typography>
              <Box
                sx={{
                  mt: 0.25,
                  px: 0.75,
                  borderRadius: PILL_RADIUS,
                  fontSize: 9.5,
                  fontWeight: 700,
                  display: { xs: "none", sm: "block" },
                  bgcolor: picked ? "rgba(255,255,255,0.22)" : free ? FREE_TONE.bg : "transparent",
                  color: picked ? "#fff" : free ? FREE_TONE.text : DISABLED_TEXT,
                }}
              >
                {free ? t("book.slotsCount", { count: d.times.length }) : t("book.noSlotsDay")}
              </Box>
            </Box>
          );
        })}
      </Box>
      {visible < days.length && (
        <Button
          fullWidth
          variant="outlined"
          onClick={() => setVisible((v) => v + DAYS_PAGE)}
          sx={{ mt: 1.5, borderRadius: TILE_RADIUS, borderColor: BORDER, fontWeight: 600 }}
        >
          {t("book.moreDays", { count: Math.min(DAYS_PAGE, days.length - visible) })}
        </Button>
      )}

      {activeDay && (
        <Box sx={{ mt: 2.5, pt: 2.5, borderTop: 1, borderColor: DIVIDER }}>
          <SectionTitle
            title={t("book.pickTime")}
            aside={formatDay(activeDay.date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))", gap: 1 }}>
            {activeDay.times.map((hhmm) => {
              const picked = hhmm === time;
              return (
                <Box
                  key={hhmm}
                  component="button"
                  type="button"
                  onClick={() => onTime(hhmm)}
                  aria-pressed={picked}
                  sx={(theme) => ({
                    py: 1.1,
                    border: 1,
                    borderRadius: TILE_RADIUS,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    borderColor: picked ? "primary.main" : BORDER,
                    bgcolor: picked ? "primary.main" : "background.paper",
                    color: picked ? "primary.contrastText" : "text.primary",
                    boxShadow: picked ? pickedShadow(theme) : "none",
                    "&:hover": picked ? undefined : { borderColor: "primary.light" },
                  })}
                >
                  {hhmm}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

const Summary: React.FC<{
  branch: PublicBranch;
  service: PublicService;
  date: string;
  time: string;
  prepayment: string | null;
  language: string;
  onSubmit: () => void;
}> = ({ branch, service, date, time, prepayment, language, onSubmit }) => {
  const { t } = useTranslation();
  const chips: Array<{ icon?: React.ReactNode; label: string }> = [
    { icon: <PlaceOutlined sx={{ fontSize: 14 }} />, label: branchTitle(branch) },
    ...(date ? [{ icon: <CalendarMonthOutlined sx={{ fontSize: 14 }} />, label: formatDay(date, language, { day: "numeric", month: "long" }) }] : []),
    ...(time ? [{ icon: <AccessTimeOutlined sx={{ fontSize: 14 }} />, label: time }] : []),
    { label: service.name },
  ];
  const button = (
    <Button
      variant="contained"
      size="large"
      disabled={!time}
      onClick={onSubmit}
      sx={(theme) => ({
        borderRadius: PILL_RADIUS,
        px: 6,
        py: 1.4,
        fontWeight: 700,
        boxShadow: time ? pickedShadow(theme) : "none",
        width: { xs: "100%", md: "auto" },
      })}
    >
      {time ? t("book.form.submit") : t("book.pickTimeFirst")}
    </Button>
  );

  return (
    <>
      <Stack alignItems="center" spacing={1.5} sx={{ display: { xs: "none", md: "flex" }, pt: 0.5 }}>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", justifyContent: "center", rowGap: 0.75 }}>
          {chips.map((chip) => (
            <Stack
              key={chip.label}
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ px: 1.5, py: 0.6, borderRadius: PILL_RADIUS, border: 1, borderColor: BORDER, bgcolor: "background.paper", fontSize: 13 }}
            >
              {chip.icon}
              <span>{chip.label}</span>
            </Stack>
          ))}
          <Box sx={(theme) => ({ ...accentChip(theme), px: 1.5, py: 0.6, borderRadius: PILL_RADIUS, fontSize: 13, fontWeight: 700 })}>
            {formatPrice(service.price, branch.currency)}
          </Box>
        </Stack>
        {prepayment && (
          <Typography variant="caption" sx={{ color: MUTED }}>
            {t("book.prepayment.badge", { amount: formatPrice(prepayment, branch.currency) })}
          </Typography>
        )}
        {button}
      </Stack>
      {/* Телефон: итог и кнопка прилипают к низу экрана. */}
      <Box
        sx={{
          display: { xs: "block", md: "none" },
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 4,
          px: 2,
          pt: 1.25,
          pb: "calc(12px + env(safe-area-inset-bottom))",
          bgcolor: "background.paper",
          borderTop: 1,
          borderColor: BORDER,
        }}
      >
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2" noWrap sx={{ color: "text.secondary", minWidth: 0 }}>
            {time ? `${formatDay(date, language, { day: "numeric", month: "short" })}, ${time} · ${service.name}` : service.name}
          </Typography>
          <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap", ml: 1 }}>
            {formatPrice(service.price, branch.currency)}
          </Typography>
        </Stack>
        {button}
      </Box>
    </>
  );
};

export default SpecialistPage;

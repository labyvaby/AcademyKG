import React from "react";
import { Avatar, Box, Container, IconButton, Link, Stack, Typography } from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { Link as RouterLink } from "react-router";
import { Trans, useTranslation } from "react-i18next";

import smallIcon from "../../assets/img/icon_2s.png";
import type { PublicBookingError } from "../../services/publicBooking";
import { formatPhone } from "../bookings/meta";

// Общие куски публичной витрины онлайн-записи (/book).

const LAST_CODES_KEY = "academy.book.lastCodes";

/** Последние коды заявок гостя в этом браузере (для формы «проверить статус»). */
export function readLastCodes(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_CODES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export function rememberCode(code: string) {
  try {
    localStorage.setItem(LAST_CODES_KEY, JSON.stringify([code, ...readLastCodes().filter((c) => c !== code)].slice(0, 5)));
  } catch {
    /* приватный режим — код и так на экране */
  }
}

/**
 * Ключ нашего текста для ошибки отправки заявки — по коду и статусу, никогда по тексту бэка:
 * он адресован разработчику. null — показать текст как есть (ошибки сети и полей уже по-русски).
 */
export function submitErrorKey(error: PublicBookingError): string | null {
  if (error.status === 429 || error.code === "throttled") return "book.errors.tooManyAttempts";
  switch (error.code) {
    case "too_many_bookings":
      return "book.errors.tooManyBookings";
    case "payment_unavailable":
      return "book.errors.paymentUnavailable";
    case "network":
      return null;
    default:
      return error.status === 404 ? "book.errors.targetGone" : error.status >= 500 ? "book.errors.serverError" : null;
  }
}

/** Дата "YYYY-MM-DD" (локальная дата филиала) → подпись на языке интерфейса. */
export function formatDay(date: string, lang: string, opts: Intl.DateTimeFormatOptions): string {
  // Полдень UTC + timeZone UTC: дата не «съезжает» на соседний день ни в каком часовом поясе браузера.
  const text = new Intl.DateTimeFormat(lang, { ...opts, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  // Фраза с дня недели — с заглавной («Пятница, 23 октября»); только первая буква:
  // CSS capitalize дал бы «23 Октября». Месяц сам по себе («окт.») не трогаем.
  return opts.weekday ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** «сегодня» / «завтра» / «чт, 23 окт.» — для подсказок о ближайшем окне. */
export function useRelativeDay() {
  const { t, i18n } = useTranslation();
  return React.useCallback(
    (date: string, timezone: string) => {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
      const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );
      if (date === today) return t("book.today");
      if (date === tomorrow) return t("book.tomorrow");
      return formatDay(date, i18n.language, { weekday: "short", day: "numeric", month: "short" });
    },
    [t, i18n.language],
  );
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const SpecialistAvatar: React.FC<{ name: string; photoUrl?: string | null; size?: number }> = ({
  name,
  photoUrl,
  size = 56,
}) => (
  <Avatar
    src={photoUrl ?? undefined}
    alt={name}
    sx={{ width: size, height: size, bgcolor: "primary.main", fontWeight: 700, fontSize: size * 0.36 }}
  >
    {initials(name)}
  </Avatar>
);

type BookShellProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Кнопка «назад» в шапке шага; без неё — только бренд. */
  onBack?: () => void;
  children: React.ReactNode;
};

/** Оболочка витрины: бренд центра, заголовок шага и контент по центру (мобильный — во всю ширину). */
export const BookShell: React.FC<BookShellProps> = ({ title, subtitle, onBack, children }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", pb: 6 }}>
      <Box
        component="header"
        sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", position: "sticky", top: 0, zIndex: 2 }}
      >
        <Container maxWidth={false} sx={{ maxWidth: 600, py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            component="img"
            src={smallIcon}
            alt=""
            sx={{ width: 36, height: 36, borderRadius: "50%", objectFit: "contain", flexShrink: 0 }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2} noWrap>
              {t("book.brandTitle")}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {t("book.brandSubtitle")}
            </Typography>
          </Box>
        </Container>
      </Box>

      <Container maxWidth={false} sx={{ maxWidth: 600, pt: 2.5 }}>
        {(title || onBack) && (
          <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
            {onBack && (
              <IconButton onClick={onBack} aria-label={t("book.back")} sx={{ mt: -0.5, ml: -1 }}>
                <ArrowBackOutlined />
              </IconButton>
            )}
            <Box sx={{ minWidth: 0 }}>
              {title && (
                <Typography variant="h5" fontWeight={800} lineHeight={1.25}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
        )}
        {children}
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 4 }}>
          <Link component={RouterLink} to="/book/status" underline="hover">
            {t("book.checkStatusLink")}
          </Link>
        </Typography>
      </Container>
    </Box>
  );
};

/** Пустое состояние / ошибка шага с действием. */
export const StepMessage: React.FC<{ title: string; text?: string; action?: React.ReactNode }> = ({
  title,
  text,
  action,
}) => (
  <Box sx={{ textAlign: "center", py: 6, px: 2 }}>
    <Typography variant="subtitle1" fontWeight={700}>
      {title}
    </Typography>
    {text && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {text}
      </Typography>
    )}
    {action && <Box sx={{ mt: 2 }}>{action}</Box>}
  </Box>
);

/** Загрузка с отменой прошлого запроса при смене зависимостей. */
export function useLoad<T>(loader: ((signal: AbortSignal) => Promise<T>) | null, deps: React.DependencyList) {
  const [state, setState] = React.useState<{ data: T | null; loading: boolean; error: Error | null }>({
    data: null,
    loading: Boolean(loader),
    error: null,
  });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!loader) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState((prev) => ({ data: prev.data, loading: true, error: null }));
    loader(controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: Error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ data: null, loading: false, error });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = React.useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}

/**
 * Блок «Важно» перед отправкой: согласие с правилами и обработкой данных, условия
 * предоплаты (только когда она есть) и как перенести или отменить запись.
 */
export const BookingTerms: React.FC<{
  /** Подпись кнопки, к которой относится согласие. */
  action: string;
  /** Сумма предоплаты (уже отформатированная) или null. */
  prepayment: string | null;
  branchPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
}> = ({ action, prepayment, branchPhone, termsUrl, privacyUrl }) => {
  const { t } = useTranslation();
  const link = (href?: string) =>
    href ? <Link href={href} target="_blank" rel="noopener noreferrer" underline="always" /> : <span />;
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <InfoOutlined fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={800}>
          {t("book.terms.title")}
        </Typography>
      </Stack>
      <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
        {prepayment && (
          <Typography component="li" variant="body2">
            {t("book.terms.prepayment", { amount: prepayment })}
          </Typography>
        )}
        <Typography component="li" variant="body2">
          {branchPhone
            ? t("book.terms.changeByPhone", { phone: formatPhone(branchPhone) })
            : t("book.terms.changeByCall")}
        </Typography>
        <Typography component="li" variant="body2">
          {termsUrl || privacyUrl ? (
            <Trans
              i18nKey={termsUrl && privacyUrl ? "book.terms.consentBoth" : termsUrl ? "book.terms.consentRules" : "book.terms.consentPrivacy"}
              values={{ action }}
              components={{ rules: link(termsUrl), privacy: link(privacyUrl) }}
            />
          ) : (
            t("book.terms.consentPlain", { action })
          )}
        </Typography>
      </Stack>
    </Box>
  );
};

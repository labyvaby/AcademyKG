import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  GlobalStyles,
  IconButton,
  Link,
  Stack,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import ArrowBackIosNewOutlined from "@mui/icons-material/ArrowBackIosNewOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import { Link as RouterLink } from "react-router";
import { Trans, useTranslation } from "react-i18next";

import logo from "../../assets/img/logo.png";
import type { PublicBookingError, PublicBranch } from "../../services/publicBooking";
import { formatPhone } from "../bookings/meta";
import { branchPath, branchTitle } from "./BookContext";
import { LANGUAGE_LABEL, LANGUAGE_SHORT, useBookLanguages } from "./i18n";
import { BORDER, CARD_SHADOW, CONTENT_WIDTH, NARROW_WIDTH, PAGE_BG, PILL_RADIUS, RADIUS } from "./theme";

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
 * он адресован разработчику. null — общий текст «не удалось отправить».
 */
export function submitErrorKey(error: PublicBookingError): string | null {
  if (error.status === 429 || error.code === "throttled") return "book.errors.tooManyAttempts";
  switch (error.code) {
    case "too_many_bookings":
      return "book.errors.tooManyBookings";
    case "payment_unavailable":
      return "book.errors.paymentUnavailable";
    case "network":
      return "book.errors.network";
    default:
      return error.status === 404 ? "book.errors.targetGone" : error.status >= 500 ? "book.errors.serverError" : null;
  }
}

/**
 * Названия дней и месяцев для языков, которых нет в данных Intl браузеров: Chrome на
 * «uz» пишет «M10 30, Fri», а на «ky» отдаёт русский. Индекс дня — getUTCDay (0 — вс).
 */
const CALENDAR_NAMES: Record<string, { weekdayShort: string[]; weekdayLong: string[]; monthShort: string[]; monthLong: string[] }> = {
  ky: {
    weekdayShort: ["жек", "дүй", "шей", "шар", "бей", "жум", "ише"],
    weekdayLong: ["жекшемби", "дүйшөмбү", "шейшемби", "шаршемби", "бейшемби", "жума", "ишемби"],
    monthShort: ["янв.", "фев.", "мар.", "апр.", "май", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."],
    monthLong: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  },
  uz: {
    weekdayShort: ["ya", "du", "se", "cho", "pa", "ju", "sha"],
    weekdayLong: ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"],
    monthShort: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
    monthLong: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  },
};

/** Дата по своим названиям: «juma, 30-oktabr», «30-окт.». Формат «день-месяц» — как пишут в KG и UZ. */
function formatByNames(date: string, lang: string, opts: Intl.DateTimeFormatOptions): string | null {
  const names = CALENDAR_NAMES[lang];
  if (!names) return null;
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = opts.weekday
    ? (opts.weekday === "long" ? names.weekdayLong : names.weekdayShort)[d.getUTCDay()]
    : "";
  const month = opts.month ? (opts.month === "long" ? names.monthLong : names.monthShort)[d.getUTCMonth()] : "";
  const day = opts.day ? String(d.getUTCDate()) : "";
  const dayMonth = day && month ? `${day}-${month}` : day || month;
  return [weekday, dayMonth].filter(Boolean).join(", ");
}

/** Дата "YYYY-MM-DD" (локальная дата филиала) → подпись на языке интерфейса. */
export function formatDay(date: string, lang: string, opts: Intl.DateTimeFormatOptions): string {
  // Полдень UTC + timeZone UTC: дата не «съезжает» на соседний день ни в каком часовом поясе браузера.
  const text =
    formatByNames(date, lang, opts) ??
    new Intl.DateTimeFormat(lang, { ...opts, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
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

type BookShellProps = {
  /** Филиал страницы: бренд и адрес в шапке, языки витрины. */
  branch?: PublicBranch | null;
  /** Языки переключателя без филиала (выбор филиала, статус заявки). */
  languages?: string[];
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Стрелка «назад» у заголовка. */
  onBack?: () => void;
  /** Узкая колонка — статус и проверка заявки; по умолчанию витрина во всю ширину. */
  narrow?: boolean;
  children: React.ReactNode;
};

/**
 * CRM держит html/body/#root в overflow: hidden — у неё скроллится свой контейнер.
 * Витрина рендерится вне layout, поэтому на время её показа возвращаем прокрутку
 * документа: иначе всё ниже первого экрана недостижимо.
 */
const scrollableDocument = (
  <GlobalStyles
    styles={{
      html: { height: "auto", overflow: "visible" },
      body: { height: "auto", minHeight: "100%", overflow: "visible", backgroundColor: PAGE_BG },
      "#root": { height: "auto", minHeight: "100%", overflow: "visible" },
    }}
  />
);

/** Оболочка витрины: шапка с брендом и языком, заголовок страницы, контент. */
export const BookShell: React.FC<BookShellProps> = ({
  branch,
  languages,
  title,
  subtitle,
  onBack,
  narrow,
  children,
}) => {
  const { t } = useTranslation();
  const available = branch?.languages ?? languages ?? null;
  const lang = useBookLanguages(available);
  const maxWidth = narrow ? NARROW_WIDTH : CONTENT_WIDTH;

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: PAGE_BG, pb: 8 }}>
      {scrollableDocument}
      <Box
        component="header"
        sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: BORDER, position: "sticky", top: 0, zIndex: 3 }}
      >
        <Container
          maxWidth={false}
          sx={{ maxWidth: CONTENT_WIDTH, py: 1.25, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <Box
            component={RouterLink}
            to={branch ? branchPath(branch) : "/book"}
            sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, color: "inherit", textDecoration: "none", flex: 1 }}
          >
            <Box
              component="img"
              src={branch?.logoUrl || logo}
              alt=""
              sx={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} lineHeight={1.2} noWrap>
                {branch ? branchTitle(branch) : t("book.brandTitle")}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {branch?.address || t("book.brandSubtitle")}
              </Typography>
            </Box>
          </Box>
          {lang.languages.length > 1 && (
            <Stack direction="row" spacing={0.5} role="group" aria-label={t("book.language")}>
              {lang.languages.map((code) => {
                const active = code === lang.current;
                return (
                  <Box
                    key={code}
                    component="button"
                    type="button"
                    onClick={() => lang.choose(code)}
                    aria-pressed={active}
                    title={LANGUAGE_LABEL[code]}
                    sx={{
                      px: 1.25,
                      height: 32,
                      border: 1,
                      borderRadius: PILL_RADIUS,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 700,
                      bgcolor: active ? "primary.main" : "background.paper",
                      borderColor: active ? "primary.main" : BORDER,
                      color: active ? "primary.contrastText" : "text.primary",
                    }}
                  >
                    {LANGUAGE_SHORT[code] ?? code.toUpperCase()}
                  </Box>
                );
              })}
            </Stack>
          )}
          <Button
            component={RouterLink}
            to="/book/status"
            size="small"
            startIcon={<ReceiptLongOutlined />}
            sx={{
              display: { xs: "none", md: "inline-flex" },
              borderRadius: PILL_RADIUS,
              border: 1,
              borderColor: BORDER,
              color: "text.primary",
              px: 1.5,
              whiteSpace: "nowrap",
            }}
          >
            {t("book.myRequest")}
          </Button>
          {/* Телефон: место в шапке — бренду филиала, заявка — значком. */}
          <IconButton
            component={RouterLink}
            to="/book/status"
            aria-label={t("book.myRequest")}
            size="small"
            sx={{ display: { xs: "inline-flex", md: "none" }, border: 1, borderColor: BORDER }}
          >
            <ReceiptLongOutlined fontSize="small" />
          </IconButton>
        </Container>
      </Box>

      <Container maxWidth={false} sx={{ maxWidth, pt: { xs: 2, md: 3 } }}>
        {(title || onBack) && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
            {onBack && (
              <IconButton onClick={onBack} aria-label={t("book.back")} size="small" sx={{ ml: -0.75 }}>
                <ArrowBackIosNewOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            )}
            <Box sx={{ minWidth: 0 }}>
              {title && (
                <Typography fontWeight={700} sx={{ fontSize: { xs: 17, md: 20 } }} lineHeight={1.3}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
        )}
        {children}
        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          sx={{ mt: 5, display: { xs: "block", md: "none" } }}
        >
          <Link component={RouterLink} to="/book/status" underline="hover">
            {t("book.checkStatusLink")}
          </Link>
        </Typography>
      </Container>
    </Box>
  );
};

/** Белая карточка витрины. */
export const Panel: React.FC<{ children: React.ReactNode; sx?: SxProps<Theme> }> = ({ children, sx }) => (
  <Box sx={[{ bgcolor: "background.paper", borderRadius: RADIUS, boxShadow: CARD_SHADOW, p: { xs: 2, md: 2.5 } }, ...(Array.isArray(sx) ? sx : [sx])]}>
    {children}
  </Box>
);

export const Loading: React.FC = () => (
  <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
    <CircularProgress />
  </Box>
);

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

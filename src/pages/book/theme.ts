import { alpha, type Theme } from "@mui/material/styles";

// Геометрия и нейтрали публичной витрины (/book). Раскладка и пропорции — как у
// витрины mamadoc, цвет — основной цвет темы Академии (theme.palette.primary).

/** Карточки и панели. */
export const RADIUS = "16px";
/** Плитки дня, слоты, мелкие блоки. */
export const TILE_RADIUS = "12px";
/** Чипы и кнопки-пилюли. */
export const PILL_RADIUS = "999px";

export const PAGE_BG = "#F5F5F7";
export const BORDER = "#E7E7EE";
export const DIVIDER = "#F0F1F4";
export const MUTED = "#98A2B3";
export const DISABLED_TEXT = "#C6CAD2";
export const CARD_SHADOW = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";

/** Ширина контента витрины на десктопе. */
export const CONTENT_WIDTH = 1200;
/** Узкие страницы: статус заявки, проверка кода. */
export const NARROW_WIDTH = 640;

/** Чип «N окон» и свободные дни. */
export const FREE_TONE = { bg: "#E9F9EE", text: "#1FA84A" } as const;

/**
 * Ближайшие окна в карточке специалиста: сегодня — зелёные, завтра — синие, позже —
 * фиолетовые. Срок окна гость считывает цветом раньше, чем читает дату.
 */
export const NEAREST_TONE = {
  today: { label: "#1FA84A", bg: "#E3F8EA", text: "#008236" },
  tomorrow: { label: "#1A5DD0", bg: "#ECF1FB", text: "#1A5DD0" },
  later: { label: "#6E56CF", bg: "#F0EDFB", text: "#5B46B8" },
} as const;

/** Голубой чип: специализация, итоговая сумма. */
export const accentChip = (t: Theme) => ({
  bgcolor: alpha(t.palette.primary.main, 0.08),
  color: t.palette.primary.main,
});

/** Подъём карточки при наведении. */
export const hoverLift = (t: Theme) => ({
  transform: "translateY(-2px)",
  boxShadow: `0 8px 24px ${alpha(t.palette.primary.main, 0.16)}`,
  borderColor: t.palette.primary.main,
});

/** Тень выбранного дня/слота и основной кнопки. */
export const pickedShadow = (t: Theme) => `0 6px 16px ${alpha(t.palette.primary.main, 0.28)}`;

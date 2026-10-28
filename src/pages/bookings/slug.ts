// Короткий адрес витрины филиала (/book/<slug>): латиница, цифры и дефис, 2–40 символов.
// Правила — как на бэке (BookingSettingsSerializer.validate_public_slug).

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 40;

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  // Кыргызские и узбекские буквы.
  ң: "ng", ө: "o", ү: "u", қ: "q", ғ: "g", ҳ: "h", ў: "o",
};

/** Адрес из названия филиала: «Филиал Фергана» → «fergana». */
export function suggestSlug(name: string): string {
  const latin = name
    .toLowerCase()
    .replace(/филиал|filial/g, " ")
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[‘’ʻʼ']/g, "");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/** Что пользователь вводит в поле адреса: нижний регистр, пробелы → дефис, без лишних символов. */
export function normalizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, SLUG_MAX);
}

/** Ссылка на витрину филиала. */
export function branchBookLink(origin: string, branchId: string, slug: string): string {
  return `${origin}/book/${slug || branchId}`;
}

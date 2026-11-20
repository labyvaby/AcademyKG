import React from "react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";

import { DEFAULT_LANGUAGE, I18N_RESOURCES, SUPPORTED_LANGUAGES } from "../../i18n";

// Язык витрины живёт отдельно от языка CRM: гость в Фергане переключает uz/ru, а
// сотрудник, открывший витрину в том же браузере, не должен получить CRM на узбекском.
// Словари общие, детектора и initReactI18next нет — экземпляр отдаётся через
// I18nextProvider только страницам /book.

const BOOK_LANGUAGE_KEY = "academy.book.language";
const KNOWN = SUPPORTED_LANGUAGES.map((l) => l.code) as string[];

function storedLanguage(): string | null {
  try {
    const value = localStorage.getItem(BOOK_LANGUAGE_KEY);
    return value && KNOWN.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function storeLanguage(code: string) {
  try {
    localStorage.setItem(BOOK_LANGUAGE_KEY, code);
  } catch {
    /* приватный режим — язык просто не запомнится */
  }
}

export const bookI18n = i18next.createInstance();
void bookI18n.init({
  resources: I18N_RESOURCES,
  lng: storedLanguage() ?? DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: KNOWN,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

export const LANGUAGE_SHORT: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.short]),
);
export const LANGUAGE_LABEL: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.label]),
);

/**
 * Языки, доступные на текущей странице витрины (у филиала — по его стране), и выбор
 * между ними. Язык страницы — выбранный гостем, если филиал его поддерживает, иначе
 * первый язык филиала: новый гость по ссылке Ферганы видит узбекский, Бишкека — русский.
 */
export function useBookLanguages(available: string[] | null) {
  const { i18n } = useTranslation();
  const languages = React.useMemo(
    () => (available && available.length > 0 ? available.filter((c) => KNOWN.includes(c)) : KNOWN),
    [available],
  );
  const current = i18n.language;

  React.useEffect(() => {
    if (languages.length === 0) return;
    const stored = storedLanguage();
    const wanted = stored && languages.includes(stored) ? stored : languages[0];
    if (wanted !== current) void i18n.changeLanguage(wanted);
  }, [languages, current, i18n]);

  React.useEffect(() => {
    document.documentElement.lang = current;
  }, [current]);

  const choose = React.useCallback(
    (code: string) => {
      storeLanguage(code);
      void i18n.changeLanguage(code);
    },
    [i18n],
  );

  return { languages, current, choose };
}

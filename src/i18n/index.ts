import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ru from "./locales/ru.json";
import ky from "./locales/ky.json";
import uz from "./locales/uz.json";

// Поддерживаемые языки приложения. Порядок влияет на список в переключателе.
export const SUPPORTED_LANGUAGES = [
  { code: "ru", label: "Русский", short: "RU" },
  { code: "ky", label: "Кыргызча", short: "KG" },
  { code: "uz", label: "O‘zbekcha", short: "UZ" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "ru";

// Ключ localStorage для запоминания выбора между сессиями.
export const LANGUAGE_STORAGE_KEY = "app.language";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      ky: { translation: ky },
      uz: { translation: uz },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    // Русский — язык-источник; недостающие ключи KG/UZ откатываются на него.
    nonExplicitSupportedLngs: false,
    interpolation: {
      escapeValue: false, // React сам экранирует
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    returnNull: false,
  });

export default i18n;

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import es from "./es.json";

export const SUPPORTED_LANGUAGES = ["en", "es"] as const;

const LANG_KEY = "mc_lang";

function initialLanguage(): string {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "en" || saved === "es") return saved;
  return "es";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: initialLanguage(),
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: string): void {
  localStorage.setItem(LANG_KEY, lang);
}

export default i18n;

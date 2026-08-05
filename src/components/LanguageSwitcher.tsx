import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES, setLanguage } from "../i18n";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <select
      className="lang-switch"
      value={i18n.language}
      onChange={(e) => {
        const lang = e.target.value;
        setLanguage(lang);
        i18n.changeLanguage(lang);
      }}
      aria-label="Language"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {lang === "en" ? "English" : "Español"}
        </option>
      ))}
    </select>
  );
}

import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES, setLanguage } from "../i18n";

export function LanguageSwitcher({ id, disabled }: { id?: string; disabled?: boolean }) {
  const { i18n } = useTranslation();
  return (
    <select
      id={id}
      className="lang-switch"
      value={i18n.language}
      onChange={(e) => {
        const lang = e.target.value;
        setLanguage(lang);
        i18n.changeLanguage(lang);
      }}
      disabled={disabled}
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

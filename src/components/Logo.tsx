import { useTranslation } from "react-i18next";

import logoUrl from "../assets/logo.png";

export function Logo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <img
      src={logoUrl}
      alt={t("app.name")}
      className={className}
      width={size}
      height={size}
      style={{ height: size, width: size, objectFit: "contain" }}
    />
  );
}

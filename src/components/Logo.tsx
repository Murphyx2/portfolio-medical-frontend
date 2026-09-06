import { useTranslation } from "react-i18next";

/** Generic placeholder mark for this demo branch -- the real product's
 * branded logo lives only on the private main line, not here. */
export function Logo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <svg
      role="img"
      aria-label={t("app.name")}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
    >
      <rect width="32" height="32" rx="7" fill="#2f6f6a" />
      <path d="M16 7v18M7 16h18" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

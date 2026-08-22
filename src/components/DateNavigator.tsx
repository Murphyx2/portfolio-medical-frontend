import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DateField } from "./DateField";
import { nextLocalISO, prevLocalISO } from "../utils/date";

/** Prev/next-day-stepped date field used by any page that browses a list
 * "one day at a time" (Encounters, Appointments) -- presentational/state-
 * plumbing only, the actual list filtering happens in the consuming page. */
export function DateNavigator({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="date-navigator">
      <button
        type="button"
        className="date-navigator-btn"
        aria-label={t("common.previousDay")}
        onClick={() => onChange(prevLocalISO(value))}
      >
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <DateField value={value} onChange={onChange} ariaLabel={ariaLabel} />
      <button
        type="button"
        className="date-navigator-btn"
        aria-label={t("common.nextDay")}
        onClick={() => onChange(nextLocalISO(value))}
      >
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

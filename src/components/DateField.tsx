import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

/** A native `<input type="date">` always displays/edits in the OS/browser's
 * own locale format -- on a US-locale machine that's MM/DD/YYYY, which
 * fights this app's fixed DD/MM/YYYY convention (see `utils/date.ts`).
 * There's no HTML/CSS way to force a native date input's display format, so
 * this renders a masked DD/MM/YYYY text field instead, backed by a hidden
 * native date input (positioned over the calendar button) as a
 * progressive-enhancement picker. Emits/accepts the same ISO `YYYY-MM-DD`
 * string a native date input would, so it's a drop-in replacement in
 * existing form state. */

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${m}-${d}`;
}

/** Masks free-typed digits into DD/MM/YYYY as the user types (auto-inserts
 * the `/` separators), without letting them type the separators themselves. */
function maskDisplayInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateField({
  value,
  onChange,
  required,
  ariaLabel,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  const [display, setDisplay] = useState(isoToDisplay(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  function commit(next: string) {
    setDisplay(next);
    const iso = displayToIso(next);
    if (iso) onChange(iso);
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  }

  return (
    <div className="date-field">
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={display}
        aria-label={ariaLabel}
        required={required}
        onChange={(e) => setDisplay(maskDisplayInput(e.target.value))}
        onBlur={(e) => commit(e.target.value)}
      />
      <button
        type="button"
        className="date-field-picker-btn"
        aria-label={t("common.openCalendar")}
        onClick={openPicker}
      >
        <Calendar size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="date-field-native"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(e) => e.target.value && commit(isoToDisplay(e.target.value))}
      />
    </div>
  );
}

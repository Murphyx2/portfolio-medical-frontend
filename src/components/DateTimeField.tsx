import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Same locale problem as `DateField`, extended to date+time: a native
 * `<input type="datetime-local">` displays/edits in the OS/browser's own
 * locale (e.g. `08/22/2026 03:30 PM` on a US-locale machine) with no way to
 * force DD/MM/YYYY HH:mm. Renders a masked text field backed by a hidden
 * native datetime-local input (progressive-enhancement picker), same
 * pattern as `DateField`. Emits/accepts the same "YYYY-MM-DDTHH:mm" string
 * a native datetime-local input would, so it's a drop-in replacement.
 *
 * The hidden input's own picker POPUP still renders in the browser's/OS's
 * locale while open (English month name, MM/DD order, AM/PM clock) --
 * tested and confirmed the `lang` attribute does NOT override this in
 * Chromium (it follows `navigator.language` instead), so this is an
 * accepted, unfixable limitation of using a native input as the picker.
 * The masked text field is what the user actually reads/types, and it's
 * correct regardless. */

function isoToDisplay(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  if (!datePart || !timePart) return "";
  const [y, m, d] = datePart.split("-");
  const [h, min] = timePart.split(":");
  if (!y || !m || !d || !h || !min) return "";
  return `${d}/${m}/${y} ${h}:${min}`;
}

function displayToIso(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(display.trim());
  if (!match) return null;
  const [, d, m, y, h, min] = match;
  const day = Number(d);
  const month = Number(m);
  const hour = Number(h);
  const minute = Number(min);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return `${y}-${m}-${d}T${h}:${min}`;
}

/** Masks free-typed digits into "DD/MM/YYYY HH:mm" as the user types. */
function maskDisplayInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length <= 10) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
}

export function DateTimeField({
  value,
  onChange,
  required,
  ariaLabel,
}: {
  value: string;
  onChange: (isoDateTime: string) => void;
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
    <div className="date-field datetime-field">
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY HH:mm"
        maxLength={16}
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
        type="datetime-local"
        className="date-field-native"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(e) => e.target.value && commit(isoToDisplay(e.target.value))}
      />
    </div>
  );
}

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

export interface HabitStatusOption<S extends string> {
  value: S;
  label: string;
}

/**
 * Segmented single-select pill group for a habit's status (No reg. / Nunca /
 * Ex / Ocasional / Activo, or the actividad-física / sueño equivalents).
 * Visually derived from .ap-chip/.ap-chip.selected but under its own class
 * names since this is radio (one-of-many) semantics, not the multi-select
 * toggle semantics .ap-chip already carries elsewhere. Roving tabindex +
 * arrow-key nav mirrors the Tabs primitive (components/ui.tsx).
 */
export function HabitStatusPills<S extends string>({
  value,
  options,
  onChange,
  disabled,
  warnStatuses,
  name,
}: {
  value: S;
  options: HabitStatusOption<S>[];
  onChange: (v: S) => void;
  disabled?: boolean;
  warnStatuses?: S[];
  name: string;
}) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function selectAndFocus(v: S) {
    if (disabled) return;
    onChange(v);
    buttonRefs.current[v]?.focus();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % options.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = options.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    selectAndFocus(options[nextIndex].value);
  }

  return (
    <div className="habit-status-group" role="radiogroup" aria-label={name}>
      {options.map((opt, index) => {
        const selected = opt.value === value;
        const warn = selected && (warnStatuses ?? []).includes(opt.value);
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[opt.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={`habit-status-pill${selected ? " selected" : ""}${warn ? " warn" : ""}`}
            disabled={disabled}
            onClick={() => selectAndFocus(opt.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

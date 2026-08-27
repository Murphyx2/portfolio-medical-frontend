import { useCallback, useEffect, useRef } from "react";

import { api } from "../services/api";
import type { RecordEntry } from "../services/types";

export interface WorkingEntryFields {
  ta_systolic: string;
  ta_diastolic: string;
  fc: string;
  fr: string;
  weight_lb: string;
  height_cm: string;
  talla_cm: string;
  temperature_c: string;
  glucose: string;
  vitals_notes: string;
  dx: string;
  tx: string;
  observaciones: string;
}

export const EMPTY_WORKING_ENTRY: WorkingEntryFields = {
  ta_systolic: "",
  ta_diastolic: "",
  fc: "",
  fr: "",
  weight_lb: "",
  height_cm: "",
  talla_cm: "",
  temperature_c: "",
  glucose: "",
  vitals_notes: "",
  dx: "",
  tx: "",
  observaciones: "",
};

export function fieldsFromEntry(entry: RecordEntry): WorkingEntryFields {
  return {
    ta_systolic: entry.ta_systolic != null ? String(entry.ta_systolic) : "",
    ta_diastolic: entry.ta_diastolic != null ? String(entry.ta_diastolic) : "",
    fc: entry.fc != null ? String(entry.fc) : "",
    fr: entry.fr != null ? String(entry.fr) : "",
    weight_lb: entry.weight_lb ?? "",
    height_cm: entry.height_cm ?? "",
    talla_cm: entry.talla_cm ?? "",
    temperature_c: entry.temperature_c ?? "",
    glucose: entry.glucose != null ? String(entry.glucose) : "",
    vitals_notes: entry.vitals_notes,
    dx: entry.dx,
    tx: entry.tx,
    observaciones: entry.observaciones,
  };
}

export function hasAnyEntryContent(fields: WorkingEntryFields): boolean {
  return Object.values(fields).some((v) => v.trim() !== "");
}

export function buildEntryBody(fields: WorkingEntryFields): Record<string, unknown> {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    ta_systolic: num(fields.ta_systolic),
    ta_diastolic: num(fields.ta_diastolic),
    fc: num(fields.fc),
    fr: num(fields.fr),
    weight_lb: num(fields.weight_lb),
    height_cm: num(fields.height_cm),
    talla_cm: num(fields.talla_cm),
    temperature_c: num(fields.temperature_c),
    glucose: num(fields.glucose),
    vitals_notes: fields.vitals_notes,
    dx: fields.dx,
    tx: fields.tx,
    observaciones: fields.observaciones,
  };
}

/**
 * Spec §11: "Tab change, ~1.5s debounce after typing, ... -> persist draft."
 * Silent by design (no toast) -- only the explicit "Guardar borrador" button
 * gives feedback, otherwise a toast would fire on nearly every keystroke.
 * Never touches MedicalRecord's last-* cache; that only happens via
 * RecordEntry.complete() on an explicit Guardar. `enabled` must be false
 * while editing the last *completed* entry (that resave path must never
 * spawn a stray draft row).
 */
export function useDraftSave({
  recordId,
  fields,
  enabled,
  onSaved,
  delayMs = 1500,
}: {
  recordId: number;
  fields: WorkingEntryFields;
  enabled: boolean;
  onSaved: (entry: RecordEntry) => void;
  delayMs?: number;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const flush = useCallback(async () => {
    if (!enabled || !hasAnyEntryContent(fieldsRef.current)) return;
    const saved = await api.post<RecordEntry>(
      "/record-entries/draft/",
      { record: recordId, ...buildEntryBody(fieldsRef.current) },
      { silent: true },
    );
    onSaved(saved);
    return saved;
  }, [enabled, recordId, onSaved]);

  const fieldsKey = JSON.stringify(fields);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush().catch(() => {});
    }, delayMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsKey, enabled, delayMs]);

  return { flush };
}

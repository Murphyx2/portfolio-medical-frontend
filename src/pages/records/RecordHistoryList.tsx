import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { FamilyApSnapshotItem, HabitsDraft, RecordEntry } from "../../services/types";
import { formatDateTime } from "../../utils/date";

type TFn = ReturnType<typeof useTranslation>["t"];

const SUBSTANCE_KEYS = ["tabaco", "alcohol", "cafe", "vapeo", "psicoactivas"] as const;
const SUBSTANCE_LABEL_KEYS: Record<(typeof SUBSTANCE_KEYS)[number], string> = {
  tabaco: "habitTabaco",
  alcohol: "habitAlcohol",
  cafe: "habitCafe",
  vapeo: "habitVapeo",
  psicoactivas: "habitPsicoactivas",
};

function cap(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase());
}

function habitStatusOf(h: HabitsDraft | null | undefined, key: (typeof SUBSTANCE_KEYS)[number]): string {
  const v = h?.[key] as { status?: string } | undefined;
  return v?.status ?? "no_registrado";
}

function habitQuantityExtra(v: any, key: (typeof SUBSTANCE_KEYS)[number], t: TFn): string {
  switch (key) {
    case "tabaco":
      return v.cantidad_dia ? `${v.cantidad_dia} ${t("records.habitCigDia")}` : "";
    case "alcohol":
      return v.ud_semana ? `${v.ud_semana} ${t("records.habitUdSemana")}` : "";
    case "cafe":
      return v.tazas_dia ? `${v.tazas_dia} ${t("records.habitTazasDia")}` : "";
    default:
      return "";
  }
}

/** Compact-line "nunca" suppression rule (spec §3): skip no_registrado
 * always; skip nunca UNLESS it changed from a previous non-nunca value, in
 * which case it's shown as a change chip. Distinct from diffEntries, which
 * only decides whether the whole Hábitos section is flagged as changed. */
function shouldShowHabitChipCompact(currStatus: string, prevStatus: string): boolean {
  if (currStatus === "no_registrado") return false;
  if (currStatus !== "nunca") return true;
  return prevStatus !== "nunca" && prevStatus !== "no_registrado";
}

/** Compact Hábitos chip list -- max ~6, caller adds a "+N" overflow chip. */
function habitChipsCompact(e: RecordEntry, prev: RecordEntry | null, t: TFn): string[] {
  const h = e.habits;
  if (!h) return [];
  const chips: string[] = [];

  SUBSTANCE_KEYS.forEach((key) => {
    const status = habitStatusOf(h, key);
    const prevStatus = habitStatusOf(prev?.habits, key);
    if (!shouldShowHabitChipCompact(status, prevStatus)) return;
    const v = (h[key] as any) ?? {};
    let s = `${t(`records.${SUBSTANCE_LABEL_KEYS[key]}`)} · ${t(`records.habitStatus${cap(status)}`)}`;
    const extra = habitQuantityExtra(v, key, t);
    if (extra) s += ` · ${extra}`;
    chips.push(s);
  });

  if (h.actividad_fisica?.status && h.actividad_fisica.status !== "no_registrado") {
    chips.push(`${t("records.habitActividadFisica")} · ${t(`records.habitStatus${cap(h.actividad_fisica.status)}`)}`);
  }
  if (h.sueno?.status && h.sueno.status !== "no_registrado") {
    chips.push(`${t("records.habitSueno")} · ${t(`records.habitStatus${cap(h.sueno.status)}`)}`);
  }
  if (h.patron_alimentario?.tags?.length) {
    chips.push(`${t("records.habitPatronAlimentario")} · ${h.patron_alimentario.tags.join(", ")}`);
  }
  if (h.otros?.length) {
    chips.push(h.otros.map((o) => o.name).join(", "));
  }
  return chips;
}

/** Full Hábitos snapshot for the detail panel -- includes nunca (excludes
 * only no_registrado), no chip cap, matches the mockup's detail text. */
function habitSnapshotFull(e: RecordEntry, t: TFn): string {
  const h = e.habits;
  if (!h) return "";
  const parts: string[] = [];

  SUBSTANCE_KEYS.forEach((key) => {
    const v = h[key] as { status?: string } | undefined;
    if (!v?.status || v.status === "no_registrado") return;
    parts.push(`${t(`records.${SUBSTANCE_LABEL_KEYS[key]}`)} ${t(`records.habitStatus${cap(v.status)}`)}`);
  });
  if (h.actividad_fisica?.status && h.actividad_fisica.status !== "no_registrado") {
    parts.push(`${t("records.habitActividadFisica")} ${t(`records.habitStatus${cap(h.actividad_fisica.status)}`)}`);
  }
  if (h.sueno?.status && h.sueno.status !== "no_registrado") {
    parts.push(`${t("records.habitSueno")} ${t(`records.habitStatus${cap(h.sueno.status)}`)}`);
  }
  if (h.patron_alimentario?.tags?.length) {
    parts.push(`${t("records.habitPatronAlimentario")}: ${h.patron_alimentario.tags.join(", ")}`);
  }
  if (h.otros?.length) {
    parts.push(h.otros.map((o) => `${t("records.dietOtro")}: ${o.name}`).join(" · "));
  }
  return parts.join(" · ");
}

function personalApChips(e: RecordEntry): string[] {
  return e.personal_ap_snapshot.map((s) => s.label);
}

function familyApChips(e: RecordEntry, t: TFn): string[] {
  return e.family_ap_snapshot.map((item: FamilyApSnapshotItem) => {
    const relLabel = item.relationship === "OTRO"
      ? (item.relationship_other || t("records.relationshipOTRO"))
      : t(`records.relationship${item.relationship}`);
    const prefix = item.relative_name || relLabel;
    return `${prefix} — ${item.label}`;
  });
}

export interface VitalCell {
  label: string;
  value: string;
}

/** 8-cell vitals grid -- same cells for compact and detail (spec §3: there's
 * nothing to clamp since 8 is already the max), only non-null cells render.
 * Also reused by RecordVitalsSection.tsx (Datos clínicos collapsed mini-grid)
 * so both surfaces read the exact same 8 cells from an entry's snapshot. */
export function vitalsCells(e: RecordEntry, t: TFn): VitalCell[] {
  const cells: VitalCell[] = [];
  if (e.ta_systolic != null && e.ta_diastolic != null) {
    cells.push({ label: t("records.ta"), value: `${e.ta_systolic}/${e.ta_diastolic} mmHg` });
  }
  if (e.fc != null) cells.push({ label: t("records.fc"), value: `${e.fc} lpm` });
  if (e.fr != null) cells.push({ label: t("records.fr"), value: `${e.fr} rpm` });
  if (e.temperature_c) cells.push({ label: t("records.temperature"), value: `${e.temperature_c} °C` });
  if (e.weight_lb) cells.push({ label: t("records.weight"), value: `${e.weight_lb} lb` });
  if (e.height_cm) cells.push({ label: t("records.height"), value: `${e.height_cm} cm` });
  if (e.imc) cells.push({ label: "IMC", value: Number(e.imc).toFixed(1) });
  if (e.glucose != null) cells.push({ label: t("records.glucose"), value: `${e.glucose} mg/dL` });
  return cells;
}

// ---------------------------------------------------------------------------
// Diff engine -- compares an entry against the chronologically previous
// completed entry (entries[] is newest-first, so prev = entries[i+1]).
// ---------------------------------------------------------------------------

type ChangedSection = "signos" | "habitos" | "apPersonales" | "apFamiliares" | "dx" | "tx" | "observaciones";

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Reduces a HabitsDraft to only the substantive content (drops
 * no_registrado / empty keys) so key-presence-vs-absence noise doesn't
 * register as a change, then compares with order-insensitive arrays. */
function normalizeHabitsForDiff(h: HabitsDraft | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  [...SUBSTANCE_KEYS, "actividad_fisica", "sueno"].forEach((key) => {
    const v = h?.[key as keyof HabitsDraft] as { status?: string } | undefined;
    if (v?.status && v.status !== "no_registrado") out[key] = v;
  });
  if (h?.patron_alimentario?.tags?.length) {
    out.patron_alimentario = [...h.patron_alimentario.tags].sort();
  }
  if (h?.otros?.length) {
    out.otros = [...h.otros]
      .map((o) => ({ name: o.name, note: o.note ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

function habitsChanged(curr: RecordEntry, prev: RecordEntry): boolean {
  if (stableStringify(normalizeHabitsForDiff(curr.habits)) !== stableStringify(normalizeHabitsForDiff(prev.habits))) {
    return true;
  }
  return curr.habits_notes.trim() !== prev.habits_notes.trim();
}

function apSetChanged(curr: string[], prev: string[]): boolean {
  return stableStringify([...curr].sort()) !== stableStringify([...prev].sort());
}

function diffEntries(curr: RecordEntry, prev: RecordEntry | null): Set<ChangedSection> {
  const changed = new Set<ChangedSection>();
  if (!prev) return changed;

  const signosFields: (keyof RecordEntry)[] = [
    "ta_systolic", "ta_diastolic", "fc", "fr", "weight_lb", "height_cm",
    "talla_cm", "temperature_c", "glucose", "vitals_notes", "imc",
  ];
  if (signosFields.some((f) => curr[f] !== prev[f])) changed.add("signos");

  if (habitsChanged(curr, prev)) changed.add("habitos");

  if (apSetChanged(personalApChips(curr), personalApChips(prev))) changed.add("apPersonales");

  const familyKey = (e: RecordEntry) =>
    e.family_ap_snapshot.map((it) => `${it.relationship}|${it.relative_name || it.related_patient_id}|${it.label}`);
  if (apSetChanged(familyKey(curr), familyKey(prev))) changed.add("apFamiliares");

  if (curr.dx.trim() !== prev.dx.trim()) changed.add("dx");
  if (curr.tx.trim() !== prev.tx.trim()) changed.add("tx");
  if (curr.observaciones.trim() !== prev.observaciones.trim()) changed.add("observaciones");

  return changed;
}

function hasVitals(e: RecordEntry): boolean {
  return (
    (e.ta_systolic != null && e.ta_diastolic != null) ||
    e.fc != null || e.fr != null || !!e.temperature_c || !!e.weight_lb ||
    !!e.height_cm || !!e.imc || e.glucose != null
  );
}

function hasAnyContent(e: RecordEntry): boolean {
  return (
    hasVitals(e) ||
    Object.keys(normalizeHabitsForDiff(e.habits)).length > 0 ||
    !!e.habits_notes.trim() ||
    e.personal_ap_snapshot.length > 0 ||
    e.family_ap_snapshot.length > 0 ||
    !!e.dx.trim() ||
    !!e.tx.trim() ||
    !!e.observaciones.trim() ||
    !!e.talla_cm ||
    !!e.vitals_notes.trim()
  );
}

/** Historial tab (Requirements/HistoryTab): completed entries newest first,
 * each card a compact always-visible summary plus a "Ver detalle" panel with
 * the full frozen snapshot, and a "Cambió" chip row diffing against the
 * previous completed entry. "Editar última entrada" renders only on the
 * newest card, gated by canEditLast (computed upstream in RecordFormModal). */
export function RecordHistoryList({
  entries,
  canEditLast,
  onEditLast,
}: {
  entries: RecordEntry[];
  canEditLast: boolean;
  onEditLast: () => void;
}) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (entries.length === 0) {
    return <p className="muted">{t("records.historyEmpty")}</p>;
  }

  return (
    <div className="mc-form record-history-list">
      {entries.map((e, i) => {
        const isLatest = i === 0;
        const prev = entries[i + 1] ?? null;
        const changed = diffEntries(e, prev);
        const vitals = vitalsCells(e, t);
        const habitChips = habitChipsCompact(e, prev, t);
        const habitsNotes = e.habits_notes.trim();
        const personalChips = personalApChips(e);
        const familyChips = familyApChips(e, t);
        const isOpen = expandedId === e.id;
        const showDetailToggle = hasAnyContent(e);
        const shownChips = habitChips.slice(0, 6);
        const overflow = habitChips.length - shownChips.length;
        const resultados: string[] = [];
        if (e.talla_cm) resultados.push(`${t("records.talla")} ${e.talla_cm} cm`);
        if (e.vitals_notes.trim()) resultados.push(e.vitals_notes.trim());

        return (
          <article className={`history-card${isLatest ? " latest" : ""}`} key={e.id}>
            <div className="history-head">
              <div className="history-who">
                <span className="history-chip">{e.author_name}</span>
                <span className="history-when">{e.completed_at ? formatDateTime(e.completed_at) : "—"}</span>
              </div>
              {isLatest && canEditLast && (
                <button type="button" className="history-edit" onClick={onEditLast}>
                  {t("records.editLastEntry")}
                </button>
              )}
            </div>

            {changed.size > 0 && (
              <div className="history-changed">
                <span className="history-changed-lbl">{t("records.changed")}</span>
                {changed.has("signos") && <span className="history-tag">{t("records.sectionSignos")}</span>}
                {changed.has("habitos") && <span className="history-tag">{t("records.habitsChangeSummary")}</span>}
                {changed.has("apPersonales") && <span className="history-tag">{t("records.sectionApPersonales")}</span>}
                {changed.has("apFamiliares") && <span className="history-tag">{t("records.sectionApFamiliares")}</span>}
                {changed.has("dx") && <span className="history-tag">{t("records.dx")}</span>}
                {changed.has("tx") && <span className="history-tag">{t("records.tx")}</span>}
                {changed.has("observaciones") && <span className="history-tag">{t("records.observaciones")}</span>}
              </div>
            )}

            {vitals.length > 0 && (
              <div className="history-sec">
                <div className="history-sec-lbl">{t("records.sectionSignos")}</div>
                <div className="history-vitals">
                  {vitals.map((c) => (
                    <div className="history-v" key={c.label}>
                      <em>{c.label}</em>
                      <b>{c.value}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(shownChips.length > 0 || habitsNotes) && (
              <div className="history-sec">
                <div className="history-sec-lbl">{t("records.habitsChangeSummary")}</div>
                {shownChips.length > 0 && (
                  <div className="history-row-chips">
                    {shownChips.map((c) => (
                      <span className="history-tag" key={c}>{c}</span>
                    ))}
                    {overflow > 0 && (
                      <span className="history-tag ghost">{t("records.historyMoreChips", { count: overflow })}</span>
                    )}
                  </div>
                )}
                {habitsNotes && (
                  <p className="history-notes-line">
                    <span className="k">{t("records.habitsNotesLabel")}</span> · {habitsNotes}
                  </p>
                )}
              </div>
            )}

            {personalChips.length > 0 && (
              <div className="history-sec">
                <div className="history-sec-lbl">{t("records.sectionApPersonales")}</div>
                <div className="history-row-chips">
                  {personalChips.map((c) => (
                    <span className="history-tag" key={c}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {familyChips.length > 0 && (
              <div className="history-sec">
                <div className="history-sec-lbl">{t("records.sectionApFamiliares")}</div>
                <div className="history-row-chips">
                  {familyChips.map((c) => (
                    <span className="history-tag" key={c}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {(e.dx || e.tx || e.observaciones) && (
              <div className="history-dx compact">
                {e.dx && <p><span className="k">{t("records.dx")}</span> · {e.dx}</p>}
                {e.tx && <p><span className="k">{t("records.tx")}</span> · {e.tx}</p>}
                {e.observaciones && <p><span className="k">{t("records.observaciones")}</span> · {e.observaciones}</p>}
              </div>
            )}

            {showDetailToggle && (
              <>
                <button
                  type="button"
                  className="history-more"
                  onClick={() => setExpandedId((prevId) => (prevId === e.id ? null : e.id))}
                >
                  {isOpen ? t("records.hideDetail") : t("records.viewDetail")}
                </button>
                <div className={`history-detail${isOpen ? " open" : ""}`}>
                  <div className="history-sec-lbl">{t("records.habitsChangeSummary")} ({t("records.viewDetail")})</div>
                  <p className="history-muted">
                    {habitSnapshotFull(e, t) || t("records.noRecordThisEntry")}
                    {habitsNotes && ` · ${t("records.habitsNotesLabel")}: ${habitsNotes}`}
                  </p>
                  <div className="history-sec-lbl" style={{ marginTop: "8px" }}>{t("records.sectionApFamiliares")}</div>
                  <p className="history-muted">
                    {familyChips.length > 0 ? familyChips.join(" · ") : t("records.noRecordThisEntry")}
                  </p>
                  {resultados.length > 0 && (
                    <>
                      <div className="history-sec-lbl" style={{ marginTop: "8px" }}>{t("records.sectionSignos")}</div>
                      <p className="history-muted">{resultados.join(" · ")}</p>
                    </>
                  )}
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

import { useTranslation } from "react-i18next";

import { Field } from "../../components/ui";
import type { RecordEntry } from "../../services/types";
import type { WorkingEntryFields } from "../../hooks/useDraftSave";
import { vitalsCells } from "./RecordHistoryList";

type TFn = ReturnType<typeof useTranslation>["t"];

/** Collapsed mini-grid: fixed 8 labels (always rendered) with values pulled
 * from the last COMPLETED entry via the exact same vitalsCells() Historial
 * uses -- missing fields fall back to "—" instead of being omitted, unlike
 * vitalsCells' own filtered-array usage in RecordHistoryList. */
function CollapsedVitalsGrid({ latestCompleted, t }: { latestCompleted: RecordEntry | null; t: TFn }) {
  const cells = latestCompleted ? vitalsCells(latestCompleted, t) : [];
  const byLabel = new Map(cells.map((c) => [c.label, c.value]));
  const fixedLabels = [
    t("records.ta"), t("records.fc"), t("records.fr"), t("records.temperature"),
    t("records.weight"), t("records.height"), "IMC", t("records.glucose"),
  ];
  return (
    <div className="dc-mini-grid">
      {fixedLabels.map((label) => (
        <div className="dc-mini-cell" key={label}>
          <em>{label}</em>
          <b>{byLabel.get(label) ?? "—"}</b>
        </div>
      ))}
    </div>
  );
}

export function RecordVitalsSection({
  workingEntry,
  updateField,
  latestCompleted,
  imcPreview,
  vitalsExpanded,
  onToggleExpanded,
  canEdit,
}: {
  workingEntry: WorkingEntryFields;
  updateField: (patch: Partial<WorkingEntryFields>) => void;
  latestCompleted: RecordEntry | null;
  imcPreview: number | null;
  vitalsExpanded: boolean;
  onToggleExpanded: () => void;
  canEdit: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="dc-section-row">
        <h4>{t("records.vitalsTitle")}</h4>
        <button type="button" className="dc-ghost-btn" onClick={onToggleExpanded}>
          {vitalsExpanded ? t("records.hideVitalsFields") : t("records.registerVitals")}
        </button>
      </div>
      <div className="dc-card">
        {!vitalsExpanded && <CollapsedVitalsGrid latestCompleted={latestCompleted} t={t} />}
        {vitalsExpanded && (
          <>
            <div className="dc-vitals-grid">
              <Field label={`${t("records.ta")} (mmHg)`}>
                <div className="dc-ta-inputs">
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={workingEntry.ta_systolic}
                    onChange={(e) => updateField({ ta_systolic: e.target.value })}
                    disabled={!canEdit}
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={workingEntry.ta_diastolic}
                    onChange={(e) => updateField({ ta_diastolic: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </Field>
              <Field label={`${t("records.fc")} (lpm)`}>
                <input type="number" min={1} max={300} value={workingEntry.fc} onChange={(e) => updateField({ fc: e.target.value })} disabled={!canEdit} />
              </Field>
              <Field label={`${t("records.fr")} (rpm)`}>
                <input type="number" min={1} max={120} value={workingEntry.fr} onChange={(e) => updateField({ fr: e.target.value })} disabled={!canEdit} />
              </Field>
              <Field label={`${t("records.temperature")} (°C)`}>
                <input type="number" min={30} max={45} step={0.1} value={workingEntry.temperature_c} onChange={(e) => updateField({ temperature_c: e.target.value })} disabled={!canEdit} />
              </Field>
              <Field label={`${t("records.weight")} (lb)`}>
                <input type="number" min={0.1} max={1000} step={0.1} value={workingEntry.weight_lb} onChange={(e) => updateField({ weight_lb: e.target.value })} disabled={!canEdit} />
              </Field>
              <Field label={`${t("records.height")} (cm)`}>
                <input type="number" min={20} max={250} step={0.1} value={workingEntry.height_cm} onChange={(e) => updateField({ height_cm: e.target.value })} disabled={!canEdit} />
              </Field>
              <Field label={`${t("records.talla")} (cm)`}>
                <input type="number" min={20} max={250} step={0.1} value={workingEntry.talla_cm} onChange={(e) => updateField({ talla_cm: e.target.value })} disabled={!canEdit} />
              </Field>
              <Field label={`${t("records.glucose")} (mg/dL)`}>
                <input type="number" min={20} max={1000} value={workingEntry.glucose} onChange={(e) => updateField({ glucose: e.target.value })} disabled={!canEdit} />
              </Field>
            </div>
            <div className="dc-vitals-notes">
              <Field label={t("records.vitalsNotes")}>
                <textarea
                  maxLength={500}
                  placeholder={t("records.vitalsNotesPlaceholder")}
                  value={workingEntry.vitals_notes}
                  onChange={(e) => updateField({ vitals_notes: e.target.value })}
                  disabled={!canEdit}
                />
              </Field>
            </div>
          </>
        )}
        {imcPreview != null && <div className="dc-badge">{t("records.imcPreview", { value: imcPreview })}</div>}
      </div>
    </>
  );
}

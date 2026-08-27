import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApMultiSelect, type ApAddPayload } from "../../components/ApMultiSelect";
import { Field, SearchableSelect } from "../../components/ui";
import { api } from "../../services/api";
import { searchPatients } from "../../services/patients";
import type {
  APCategory,
  APType,
  FamilyRelationship,
  MedicalRecord,
  Paginated,
  Patient,
  RecordFamilyCondition,
  RecordPersonalCondition,
} from "../../services/types";

const RELATIONSHIPS: FamilyRelationship[] = [
  "MADRE", "PADRE", "HERMANA", "HERMANO", "HIJA", "HIJO",
  "ABUELA", "ABUELO", "TIA", "TIO", "OTRO",
];

function groupKey(c: RecordFamilyCondition): string {
  return c.related_patient != null ? `p${c.related_patient}` : `n${c.relative_name}|${c.relationship}`;
}

/** AP heredofamiliares section (spec §8): a grouped read view of what's
 * already on the chart (one card per relative, chips removable individually)
 * plus an always-visible add row that can link an existing Patient -- which
 * offers that relative's own personal APs as one-click copyable chips -- or
 * record a relative manually with just a name. */
export function RecordFamilyApSection({
  record,
  apCategories,
  apTypes,
  canEdit,
  onChange,
}: {
  record: MedicalRecord;
  apCategories: APCategory[];
  apTypes: APType[];
  canEdit: boolean;
  onChange: (updater: (r: MedicalRecord) => MedicalRecord) => void;
}) {
  const { t } = useTranslation();
  const [linkedPatient, setLinkedPatient] = useState<Patient | null>(null);
  const [relationship, setRelationship] = useState<FamilyRelationship | "">("");
  const [relationshipOther, setRelationshipOther] = useState("");
  const [relativeName, setRelativeName] = useState("");
  const [relativeConditions, setRelativeConditions] = useState<RecordPersonalCondition[]>([]);
  const [addError, setAddError] = useState("");
  const [addExpanded, setAddExpanded] = useState(false);

  useEffect(() => {
    // Pre-fill the free-text relative name from the patient's on-file
    // guardian the first time the add form opens, so the user isn't forced
    // to retype an identity already captured on the Patient record. Never
    // clobbers in-progress input, never pre-fills Parentesco -- the doctor/
    // nurse still has to pick that themselves.
    if (!addExpanded || linkedPatient || relativeName.trim()) return;
    const guardian = record.patient_info.guardians?.[0];
    if (!guardian) return;
    const fullName = `${guardian.first_name} ${guardian.last_name}`.trim();
    if (!fullName) return;
    const alreadyOnFile = record.family_conditions.some(
      (c) => !c.related_patient && c.relative_name === fullName,
    );
    if (alreadyOnFile) return;
    setRelativeName(fullName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addExpanded]);

  useEffect(() => {
    if (!linkedPatient) {
      setRelativeConditions([]);
      return;
    }
    let cancelled = false;
    api
      .get<Paginated<MedicalRecord>>(`/medical-records/?patient=${linkedPatient.id}&page_size=1`)
      .then((r) => {
        const relRecordId = r.results[0]?.id;
        if (!relRecordId) return { results: [] as RecordPersonalCondition[] };
        return api.get<Paginated<RecordPersonalCondition>>(`/personal-conditions/?record=${relRecordId}&page_size=100`);
      })
      .then((r) => {
        if (!cancelled) setRelativeConditions(r.results);
      })
      .catch(() => {
        if (!cancelled) setRelativeConditions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedPatient]);

  const groups = new Map<string, { conditions: RecordFamilyCondition[]; label: string }>();
  for (const c of record.family_conditions) {
    const key = groupKey(c);
    const relLabel = c.relationship === "OTRO" ? c.relationship_other : t(`records.relationship${c.relationship}`);
    const nameLabel = c.relative_name || "";
    if (!groups.has(key)) groups.set(key, { conditions: [], label: `${relLabel}${nameLabel ? ` — ${nameLabel}` : ""}` });
    groups.get(key)!.conditions.push(c);
  }

  const currentComboConditions = record.family_conditions.filter((c) => {
    if (!relationship) return false;
    if (c.relationship !== relationship) return false;
    return linkedPatient ? c.related_patient === linkedPatient.id : !c.related_patient && c.relative_name === relativeName.trim();
  });

  async function addCondition(payload: ApAddPayload) {
    if (!relationship) {
      setAddError(t("records.relationshipRequired"));
      return;
    }
    if (relationship === "OTRO" && !relationshipOther.trim()) {
      setAddError(t("records.relationshipOtherRequired"));
      return;
    }
    setAddError("");
    const created = await api.post<RecordFamilyCondition>("/family-conditions/", {
      record: record.id,
      related_patient: linkedPatient?.id ?? null,
      relationship,
      relationship_other: relationship === "OTRO" ? relationshipOther.trim() : "",
      relative_name: linkedPatient ? "" : relativeName.trim(),
      ...payload,
    });
    onChange((r) => ({ ...r, family_conditions: [...r.family_conditions, created] }));
  }

  async function removeCondition(id: number) {
    await api.delete(`/family-conditions/${id}/`);
    onChange((r) => ({ ...r, family_conditions: r.family_conditions.filter((c) => c.id !== id) }));
  }

  return (
    <div>
      <div className="record-family-list">
        {groups.size === 0 && <p className="ap-empty-note">{t("records.apEmpty")}</p>}
        {[...groups.entries()].map(([key, group]) => (
          <div className="record-family-row" key={key}>
            <div>
              <b>{group.label}</b>
              <div className="ap-chip-row" style={{ marginTop: "0.35rem" }}>
                {group.conditions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="ap-chip selected"
                    disabled={!canEdit}
                    onClick={() => removeCondition(c.id)}
                  >
                    {c.label} ×
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="ap-section-toggle-row">
          <button type="button" className="btn ghost small" onClick={() => setAddExpanded((v) => !v)}>
            {addExpanded ? t("records.hideFamilyApForm") : t("records.addFamilyAp")}
          </button>
        </div>
      )}

      {canEdit && addExpanded && (
        <div className="record-family-add">
          <div className="form-columns">
            <Field label={t("records.relatedPatient")}>
              <SearchableSelect<Patient>
                value={linkedPatient}
                onSelect={setLinkedPatient}
                onClear={() => setLinkedPatient(null)}
                search={searchPatients}
                placeholder={t("records.patientPickerPlaceholder")}
                getLabel={(p) => p.full_name}
                getSublabel={(p) => p.cedula}
                autoFocus={false}
              />
            </Field>
            <Field label={t("records.relationship")}>
              <select value={relationship} onChange={(e) => setRelationship(e.target.value as FamilyRelationship)}>
                <option value="">—</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>{t(`records.relationship${r}`)}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="form-columns">
            {!linkedPatient && (
              <Field label={t("records.relativeName")}>
                <input value={relativeName} onChange={(e) => setRelativeName(e.target.value)} />
              </Field>
            )}
            {relationship === "OTRO" && (
              <Field label={t("records.relationshipOtherLabel")}>
                <input value={relationshipOther} onChange={(e) => setRelationshipOther(e.target.value)} />
              </Field>
            )}
          </div>
          {linkedPatient && relativeConditions.length > 0 && (
            <div className="ap-category-group">
              <h5 className="ap-category-name">{t("records.relativeOwnAps", { name: linkedPatient.full_name })}</h5>
              <div className="ap-chip-row">
                {relativeConditions.map((c) => {
                  const alreadyCopied = currentComboConditions.some(
                    (cc) => (c.ap_type != null && cc.ap_type === c.ap_type) || (c.is_custom && cc.custom_label === c.custom_label),
                  );
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`ap-chip${alreadyCopied ? " selected" : ""}`}
                      disabled={alreadyCopied}
                      onClick={() => addCondition(c.ap_type != null ? { ap_type: c.ap_type } : { custom_label: c.custom_label })}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {addError && <p className="form-error" role="alert">{addError}</p>}
          <ApMultiSelect
            categories={apCategories}
            types={apTypes}
            conditions={currentComboConditions}
            onAdd={addCondition}
            onRemove={removeCondition}
            disabled={!relationship}
          />
        </div>
      )}
    </div>
  );
}

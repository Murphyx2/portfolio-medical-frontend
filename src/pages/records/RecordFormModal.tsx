import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApMultiSelect } from "../../components/ApMultiSelect";
import { ConfirmDialog, Dialog, Field, MaskedValue, SearchableSelect, Tabs, TabPanel } from "../../components/ui";
import {
  buildEntryBody,
  EMPTY_WORKING_ENTRY,
  fieldsFromEntry,
  hasAnyEntryContent,
  useDraftSave,
  type WorkingEntryFields,
} from "../../hooks/useDraftSave";
import { api, ApiError, showToast } from "../../services/api";
import { searchPatients } from "../../services/patients";
import type { APCategory, APType, MedicalRecord, Paginated, Patient, RecordEntry, RecordPersonalCondition } from "../../services/types";
import { useAuth } from "../../store/auth";
import { can } from "../../utils/can";
import { formatCedula } from "../../utils/cedula";
import { flattenError } from "../../utils/errors";
import { RecordFamilyApSection } from "./RecordFamilyApSection";
import { RecordHabitsSection } from "./RecordHabitsSection";
import { RecordHistoryList } from "./RecordHistoryList";
import { RecordImageGallery } from "./RecordImageGallery";
import { RecordSnapshotHeader } from "./RecordSnapshotHeader";
import { RecordVitalsSection } from "./RecordVitalsSection";
import { RecetasTab } from "./RecetasTab";

type TabKey = "clinical" | "habits" | "antecedentes" | "conclusions" | "historial" | "recetas";
type EntryTargetKind = "draft" | "completed";

const NUMERIC_FIELD_KEYS = [
  "ta_systolic", "ta_diastolic", "fc", "fr", "weight_lb", "height_cm", "talla_cm", "temperature_c", "glucose",
] as const satisfies readonly (keyof WorkingEntryFields)[];

function normalizeNum(v: string): number | null {
  return v.trim() === "" ? null : Number(v);
}

/** Numeric-aware comparison -- a server round-trip reformats "150" into
 * "150.0", which a raw string/JSON compare would wrongly read as "changed".
 * Used for the dirty-close check, so a decimal reformat alone never trips
 * the unsaved-changes warning. */
function fieldsEqual(a: WorkingEntryFields, b: WorkingEntryFields): boolean {
  if (NUMERIC_FIELD_KEYS.some((k) => normalizeNum(a[k]) !== normalizeNum(b[k]))) return false;
  return (
    a.vitals_notes.trim() === b.vitals_notes.trim() &&
    a.dx.trim() === b.dx.trim() &&
    a.tx.trim() === b.tx.trim() &&
    a.observaciones.trim() === b.observaciones.trim() &&
    a.habits_notes.trim() === b.habits_notes.trim() &&
    JSON.stringify(a.habits) === JSON.stringify(b.habits)
  );
}

function computeImcPreview(fields: WorkingEntryFields, record: MedicalRecord): number | null {
  const heightCm = parseFloat(fields.height_cm) || (record.last_height_cm ? parseFloat(record.last_height_cm) : NaN);
  const weightLb = parseFloat(fields.weight_lb) || (record.last_weight_lb ? parseFloat(record.last_weight_lb) : NaN);
  if (!heightCm || !weightLb || Number.isNaN(heightCm) || Number.isNaN(weightLb)) return null;
  const weightKg = weightLb * 0.453592;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * The Expediente Médico modal: patient-picker phase (brand-new expediente,
 * no record yet) or the full chart once a `record` is resolved. Built
 * directly on `Dialog`, not `FormModal` -- spec §6 requires the dirty-close
 * warning to compare the visible form against the *last completed entry*,
 * not "has anything changed since mount", which FormModal's generic dirty
 * tracker can't express.
 */
export function RecordFormModal({
  record,
  recordLoading,
  selectedPatient,
  onSelectPatient,
  onRequestNewPatient,
  focusNewEntry,
  apCategories,
  apTypes,
  maxUploadMb,
  onClose,
  onEntrySaved,
}: {
  record: MedicalRecord | null;
  recordLoading: boolean;
  selectedPatient: Patient | null;
  onSelectPatient: (p: Patient) => void;
  onRequestNewPatient: () => void;
  focusNewEntry: boolean;
  apCategories: APCategory[];
  apTypes: APType[];
  maxUploadMb?: number;
  onClose: () => void;
  onEntrySaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = can(user?.role, "edit", "records");

  if (!record) {
    return (
      <Dialog title={t("records.newRecord")} onClose={onClose} xwide confirmBeforeClose={false}>
        <Field label={t("records.patient")}>
          <SearchableSelect<Patient>
            value={selectedPatient}
            onSelect={onSelectPatient}
            search={searchPatients}
            placeholder={t("records.patientPickerPlaceholder")}
            getLabel={(p) => p.full_name}
            getSublabel={(p) => formatCedula(p.cedula)}
          />
        </Field>
        <button type="button" className="btn ghost small" onClick={onRequestNewPatient}>
          + {t("patients.new")}
        </button>
        {recordLoading && <p className="muted">{t("common.loading")}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <LoadedRecordPhase
      key={record.id}
      record={record}
      focusNewEntry={focusNewEntry}
      canEdit={canEdit}
      apCategories={apCategories}
      apTypes={apTypes}
      maxUploadMb={maxUploadMb}
      onClose={onClose}
      onEntrySaved={onEntrySaved}
    />
  );
}

/** The real chart UI, mounted once `record` is known. Keyed by record id in
 * the parent so switching to a different expediente remounts with fresh
 * internal state instead of carrying over another patient's working entry. */
function LoadedRecordPhase({ record: initialRecord, focusNewEntry, canEdit, apCategories, apTypes, maxUploadMb, onClose, onEntrySaved }: {
  record: MedicalRecord;
  focusNewEntry: boolean;
  canEdit: boolean;
  apCategories: APCategory[];
  apTypes: APType[];
  maxUploadMb?: number;
  onClose: () => void;
  onEntrySaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [record, setRecord] = useState(initialRecord);
  const [activeTab, setActiveTab] = useState<TabKey>(focusNewEntry ? "conclusions" : "clinical");
  const [entries, setEntries] = useState<RecordEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [workingEntry, setWorkingEntry] = useState<WorkingEntryFields>(EMPTY_WORKING_ENTRY);
  // The last state of `workingEntry` known to be safely persisted server-side
  // (as a draft or as the completed entry itself) -- `isDirty` compares
  // against THIS, not always "the record's last completed entry", so that
  // e.g. right after Guardar (workingEntry reset to blank) the form reads as
  // clean instead of permanently "different from what was just saved".
  const [lastSyncedFields, setLastSyncedFields] = useState<WorkingEntryFields>(EMPTY_WORKING_ENTRY);
  const [entryTargetId, setEntryTargetId] = useState<number | null>(null);
  const [entryTargetKind, setEntryTargetKind] = useState<EntryTargetKind>("draft");
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [draftFoundOnOpen, setDraftFoundOnOpen] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [vitalsExpanded, setVitalsExpanded] = useState(focusNewEntry);
  const [personalApExpanded, setPersonalApExpanded] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [confirmingDiscardDraft, setConfirmingDiscardDraft] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<Paginated<RecordEntry>>(`/record-entries/?record=${record.id}&page_size=100`).then((r) => {
      if (cancelled) return;
      setEntries(r.results);
      setEntriesLoaded(true);
      const myDraft = r.results.find((e) => e.status === "DRAFT" && e.author === user?.id);
      if (myDraft) {
        const fields = fieldsFromEntry(myDraft);
        setWorkingEntry(fields);
        setLastSyncedFields(fields);
        setEntryTargetId(myDraft.id);
        setEntryTargetKind("draft");
        setDraftFoundOnOpen(true);
      } else if (focusNewEntry) {
        const prefilled: WorkingEntryFields = {
          ...EMPTY_WORKING_ENTRY,
          ta_systolic: record.last_ta_systolic != null ? String(record.last_ta_systolic) : "",
          ta_diastolic: record.last_ta_diastolic != null ? String(record.last_ta_diastolic) : "",
          fc: record.last_fc != null ? String(record.last_fc) : "",
          fr: record.last_fr != null ? String(record.last_fr) : "",
          weight_lb: record.last_weight_lb ?? "",
          height_cm: record.last_height_cm ?? "",
          glucose: record.last_glucose != null ? String(record.last_glucose) : "",
        };
        setWorkingEntry(prefilled);
        setLastSyncedFields(prefilled);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  const historyEntries = entries.filter((e) => e.status === "COMPLETED");
  const latestCompleted = historyEntries[0] ?? null;
  // Spec §6: draft auto-save never makes the form "clean for close" -- a
  // pending (unfinished) draft always warns, even freshly resumed with zero
  // local edits this session, on top of the ordinary "typed something not
  // yet synced anywhere" case below.
  const hasPendingDraft = entryTargetKind === "draft" && entryTargetId !== null;
  const isDirty = hasPendingDraft || !fieldsEqual(workingEntry, lastSyncedFields);
  const showDraftBanner = draftFoundOnOpen && !draftDismissed && entryTargetKind === "draft";

  const draftSave = useDraftSave({
    recordId: record.id,
    fields: workingEntry,
    enabled: entriesLoaded && entryTargetKind === "draft",
    onSaved: (entry) => {
      setEntryTargetId(entry.id);
      setLastSyncedFields(fieldsFromEntry(entry));
    },
  });

  function updateField(patch: Partial<WorkingEntryFields>) {
    setWorkingEntry((w) => ({ ...w, ...patch }));
  }

  function changeTab(next: TabKey) {
    if (next !== activeTab) draftSave.flush().catch(() => {});
    setActiveTab(next);
  }

  async function refreshRecordAndEntries() {
    const [freshRecord, freshEntries] = await Promise.all([
      api.get<MedicalRecord>(`/medical-records/${record.id}/`),
      api.get<Paginated<RecordEntry>>(`/record-entries/?record=${record.id}&page_size=100`),
    ]);
    setRecord(freshRecord);
    setEntries(freshEntries.results);
    return freshEntries.results;
  }

  async function handleGuardarBorrador() {
    setSaving(true);
    setSaveError("");
    try {
      await draftSave.flush();
      showToast(t("records.toastDraftSaved"));
    } catch (err) {
      setSaveError(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscardDraft() {
    if (entryTargetId) await api.delete(`/record-entries/${entryTargetId}/`);
    setWorkingEntry(EMPTY_WORKING_ENTRY);
    setLastSyncedFields(EMPTY_WORKING_ENTRY);
    setEntryTargetId(null);
    setEntryTargetKind("draft");
    setEntries((prev) => prev.filter((e) => e.id !== entryTargetId));
    setDraftDismissed(true);
    setConfirmingDiscardDraft(false);
  }

  async function handleGuardar() {
    setSaving(true);
    setSaveError("");
    try {
      let targetId = entryTargetId;
      if (!targetId) {
        const created = await api.post<RecordEntry>(
          "/record-entries/draft/",
          { record: record.id, ...buildEntryBody(workingEntry) },
          { silent: true },
        );
        targetId = created.id;
      }
      await api.post<RecordEntry>(`/record-entries/${targetId}/complete/`, buildEntryBody(workingEntry), { silent: true });
      showToast(t("records.toastEntrySaved"));
      await refreshRecordAndEntries();
      setWorkingEntry(EMPTY_WORKING_ENTRY);
      setLastSyncedFields(EMPTY_WORKING_ENTRY);
      setEntryTargetId(null);
      setEntryTargetKind("draft");
      setDraftDismissed(false);
      setActiveTab("historial");
      onEntrySaved();
    } catch (err) {
      setSaveError(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditLast() {
    if (!latestCompleted) return;
    const fields = fieldsFromEntry(latestCompleted);
    setWorkingEntry(fields);
    setLastSyncedFields(fields);
    setEntryTargetId(latestCompleted.id);
    setEntryTargetKind("completed");
    setVitalsExpanded(true);
    setActiveTab("conclusions");
  }

  function requestClose() {
    if (isDirty) setConfirmingExit(true);
    else onClose();
  }

  function updateRecord(updater: (r: MedicalRecord) => MedicalRecord) {
    setRecord((r) => updater(r));
  }

  async function removePersonalCondition(id: number) {
    await api.delete(`/personal-conditions/${id}/`);
    updateRecord((r) => ({ ...r, personal_conditions: r.personal_conditions.filter((c) => c.id !== id) }));
  }

  const imcPreview = computeImcPreview(workingEntry, record);
  const canEditEntries = can(user?.role, "edit", "records");

  return (
    <Dialog
      title={
        <>
          {t("records.title")} · <MaskedValue value={record.patient_info.full_name} />
        </>
      }
      onClose={onClose}
      xwide
      confirmBeforeClose={isDirty}
    >
      <RecordSnapshotHeader record={record} />

      <Tabs
        idPrefix="record"
        active={activeTab}
        onChange={(key) => changeTab(key as TabKey)}
        items={[
          { key: "clinical", label: t("records.tabClinical") },
          { key: "habits", label: t("records.tabHabits") },
          { key: "antecedentes", label: t("records.tabAntecedentes") },
          { key: "conclusions", label: t("records.tabConclusions") },
          { key: "historial", label: t("records.tabHistorial") },
          { key: "recetas", label: t("records.tabRecetas") },
        ]}
      />

      <TabPanel tabKey="habits" active={activeTab} idPrefix="record">
        <RecordHabitsSection
          workingEntry={workingEntry}
          updateField={updateField}
          record={record}
          canEdit={canEdit}
        />

      </TabPanel>

      <TabPanel tabKey="antecedentes" active={activeTab} idPrefix="record">
        <h4>{t("records.apSummaryTitle")}</h4>

        <h5 className="ap-category-name">{t("records.apPersonalTitle")}</h5>
        <div className="ap-section-summary">
          {record.personal_conditions.length === 0 ? (
            <p className="ap-empty-note">{t("records.apSelectedNone")}</p>
          ) : (
            <div className="ap-chip-row">
              {record.personal_conditions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="ap-chip selected"
                  disabled={!canEdit}
                  onClick={() => removePersonalCondition(c.id)}
                >
                  {c.label} ×
                </button>
              ))}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="ap-section-toggle-row">
            <button type="button" className="btn ghost small" onClick={() => setPersonalApExpanded((v) => !v)}>
              {personalApExpanded ? t("records.hidePersonalApForm") : t("records.addPersonalAp")}
            </button>
          </div>
        )}
        {canEdit && personalApExpanded && (
          <ApMultiSelect
            categories={apCategories}
            types={apTypes}
            conditions={record.personal_conditions}
            disabled={!canEdit}
            onAdd={async (payload) => {
              const created = await api.post<RecordPersonalCondition>("/personal-conditions/", { record: record.id, ...payload });
              updateRecord((r) => ({ ...r, personal_conditions: [...r.personal_conditions, created] }));
            }}
            onRemove={removePersonalCondition}
          />
        )}

        <h5 className="ap-category-name">{t("records.apFamilyTitle")}</h5>
        <RecordFamilyApSection
          record={record}
          apCategories={apCategories}
          apTypes={apTypes}
          canEdit={canEdit}
          onChange={updateRecord}
        />
      </TabPanel>

      <TabPanel tabKey="clinical" active={activeTab} idPrefix="record">
        <div className="mc-form">
          <RecordVitalsSection
            workingEntry={workingEntry}
            updateField={updateField}
            latestCompleted={latestCompleted}
            imcPreview={imcPreview}
            vitalsExpanded={vitalsExpanded}
            onToggleExpanded={() => setVitalsExpanded((v) => !v)}
            canEdit={canEdit}
          />
          <RecordImageGallery
            images={record.images}
            recordId={record.id}
            maxUploadMb={maxUploadMb}
            canEdit={canEdit}
            onChanged={setRecord}
          />
        </div>
      </TabPanel>

      <TabPanel tabKey="conclusions" active={activeTab} idPrefix="record">
        {showDraftBanner && (
          <div className="draft-banner">
            <span>{t("records.draftBanner")}</span>
            <div className="draft-banner-actions">
              <button type="button" className="btn ghost small" onClick={() => setDraftDismissed(true)}>
                {t("records.continueDraft")}
              </button>
              <button type="button" className="btn ghost small" onClick={() => setConfirmingDiscardDraft(true)}>
                {t("records.discardDraft")}
              </button>
            </div>
          </div>
        )}

        <div className="mc-form">
          <div className="dc-concl-grid">
            <Field label={t("records.dxLabel")}>
              <textarea placeholder={t("records.dxPlaceholder")} value={workingEntry.dx} onChange={(e) => updateField({ dx: e.target.value })} disabled={!canEdit} />
            </Field>
            <Field label={t("records.txLabel")}>
              <textarea placeholder={t("records.txPlaceholder")} value={workingEntry.tx} onChange={(e) => updateField({ tx: e.target.value })} disabled={!canEdit} />
            </Field>
          </div>
          <div className="dc-observaciones">
            <Field label={t("records.observaciones")}>
              <textarea rows={6} placeholder={t("records.observacionesPlaceholder")} value={workingEntry.observaciones} onChange={(e) => updateField({ observaciones: e.target.value })} disabled={!canEdit} />
            </Field>
            <p className="dc-help">{t("records.observacionesHelp")}</p>
          </div>
        </div>
      </TabPanel>

      <TabPanel tabKey="historial" active={activeTab} idPrefix="record">
        <RecordHistoryList entries={historyEntries} canEditLast={canEditEntries} onEditLast={startEditLast} />
      </TabPanel>

      <TabPanel tabKey="recetas" active={activeTab} idPrefix="record">
        <RecetasTab patient={record.patient_info} />
      </TabPanel>

      {saveError && <p className="form-error" role="alert">{saveError}</p>}

      <div className="modal-actions">
        {canEdit && (
          <>
            <button type="button" className="btn ghost" onClick={handleGuardarBorrador} disabled={saving || !hasAnyEntryContent(workingEntry)}>
              {t("records.saveDraft")}
            </button>
            <button type="button" className="btn primary" onClick={handleGuardar} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </>
        )}
        <button type="button" className="btn ghost" onClick={requestClose}>
          {t("common.close")}
        </button>
      </div>

      {confirmingExit && (
        <ConfirmDialog
          title={t("common.discardChangesTitle")}
          message={t("common.discardChangesMessage")}
          confirmLabel={t("common.discardChanges")}
          danger
          onConfirm={() => {
            setConfirmingExit(false);
            onClose();
          }}
          onCancel={() => setConfirmingExit(false)}
        />
      )}

      {confirmingDiscardDraft && (
        <ConfirmDialog
          title={t("records.discardDraft")}
          message={t("records.discardDraftConfirm")}
          confirmLabel={t("records.discardDraft")}
          danger
          onConfirm={handleDiscardDraft}
          onCancel={() => setConfirmingDiscardDraft(false)}
        />
      )}
    </Dialog>
  );
}

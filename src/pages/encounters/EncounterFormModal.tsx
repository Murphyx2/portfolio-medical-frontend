import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, MaskedValue, SearchableSelect } from "../../components/ui";
import { api, ApiError } from "../../services/api";
import { searchPatients } from "../../services/patients";
import type {
  ARS,
  DoctorProfile,
  Encounter,
  EncounterDiagnosis,
  EncounterPatientSummary,
  EncounterService,
  Patient,
  Room,
  Service,
  ServiceType,
} from "../../services/types";
import { formatCedula } from "../../utils/cedula";
import { flattenError } from "../../utils/errors";
import { toSentenceCase } from "../../utils/text";

const EMPTY_FORM = {
  service_type: 0,
  doctor: 0,
  referring_doctor_name: "",
  room: 0,
  chief_complaint: "",
  priority: "ROUTINE" as Encounter["priority"],
  ars: "",
  ars_program: "",
  authorization_number: "",
  diagnoses: [] as EncounterDiagnosis[],
  services: [] as EncounterService[],
};

const priorityLabel = (p: string) => `encounters.priority${p[0]}${p.slice(1).toLowerCase()}`;

function initialFormFor(editingEncounter: Encounter | null) {
  if (!editingEncounter) return EMPTY_FORM;
  const r = editingEncounter;
  return {
    service_type: r.service_type,
    doctor: r.doctor ?? 0,
    referring_doctor_name: r.referring_doctor_name,
    room: r.room ?? 0,
    chief_complaint: r.chief_complaint,
    priority: r.priority,
    ars: r.ars ? String(r.ars) : "",
    ars_program: r.ars_program ? String(r.ars_program) : "",
    authorization_number: r.authorization_number,
    diagnoses: r.diagnoses,
    services: r.services,
  };
}

/** Create/edit encounter form: patient picker (new encounters only) or a
 * read-only patient name (editing), admission fields, diagnoses/services
 * line-item editors, and coverage (ARS/program) fields that lock to the
 * patient's own values once one is on file. Owns all of its own form state
 * -- the page only supplies the lists it's fed from (doctors/rooms/service
 * types/ARS/services) and the patient it's creating/editing for. */
export function EncounterFormModal({
  editingEncounter,
  selectedPatient,
  setSelectedPatient,
  onRequestNewPatient,
  doctors,
  rooms,
  serviceTypes,
  arsList,
  services,
  onClose,
  onSaved,
}: {
  editingEncounter: Encounter | null;
  selectedPatient: Patient | null;
  setSelectedPatient: (p: Patient | null) => void;
  onRequestNewPatient: () => void;
  doctors: DoctorProfile[];
  rooms: Room[];
  serviceTypes: ServiceType[];
  arsList: ARS[];
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => initialFormFor(editingEncounter));
  const [formError, setFormError] = useState("");

  const patientSummary: EncounterPatientSummary | null = editingEncounter
    ? editingEncounter.patient_info
    : selectedPatient
      ? {
          id: selectedPatient.id,
          full_name: selectedPatient.full_name,
          age: selectedPatient.age,
          gender: selectedPatient.gender,
          cedula: selectedPatient.cedula,
          allergies: selectedPatient.allergies,
          critical_conditions: selectedPatient.critical_conditions,
          ars: selectedPatient.ars,
          ars_name: selectedPatient.ars_name,
          ars_program: selectedPatient.ars_program,
          has_guardian: selectedPatient.has_guardian,
          guardian_cedula: selectedPatient.guardian_cedula,
        }
      : null;

  // ARS/Program are locked to the patient's own values as soon as one is on
  // file -- editable only when the patient doesn't have that information yet
  // (an encounter-only choice in that case, never written back to the patient).
  const arsLocked = patientSummary?.ars != null;
  const arsProgramLocked = patientSummary?.ars_program != null;
  const effectiveArs = arsLocked ? String(patientSummary!.ars) : form.ars;
  const effectiveArsProgram = arsProgramLocked ? String(patientSummary!.ars_program) : form.ars_program;
  const selectedArs = arsList.find((a) => String(a.id) === effectiveArs);

  const selectedServiceType = serviceTypes.find((st) => st.id === form.service_type);
  // Not every service needs a doctor present (e.g. a lab-only visit) --
  // required unless the selected type explicitly says otherwise. Fails
  // safe toward "required" before a type is even picked yet.
  const doctorRequired = !selectedServiceType || selectedServiceType.requires_doctor;
  // Selecting a type narrows the Services section to that type's services.
  const availableServices = form.service_type
    ? services.filter((sv) => sv.type === form.service_type)
    : services;

  function handleServiceTypeChange(newType: number) {
    setForm((f) => ({
      ...f,
      service_type: newType,
      // Drop any already-picked service lines that don't belong to the
      // newly-selected type instead of silently keeping a now-hidden choice.
      services: f.services.filter((s) => {
        const svc = services.find((sv) => sv.id === s.service);
        return svc ? svc.type === newType : true;
      }),
    }));
  }

  function pickDoctor(doctorId: number) {
    const doctor = doctors.find((d) => d.id === doctorId);
    setForm((f) => ({
      ...f,
      doctor: doctorId,
      // Pre-fill from the doctor's default room, but only if the room field
      // is still empty -- never clobber a room the user already picked.
      room: f.room || (doctor?.default_room ?? 0),
    }));
  }

  function addDiagnosis() {
    setForm((f) => ({
      ...f,
      diagnoses: [...f.diagnoses, { description: "", is_primary: f.diagnoses.length === 0 }],
    }));
  }

  function updateDiagnosis(index: number, patch: Partial<EncounterDiagnosis>) {
    setForm((f) => ({
      ...f,
      diagnoses: f.diagnoses.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }));
  }

  function removeDiagnosis(index: number) {
    setForm((f) => ({ ...f, diagnoses: f.diagnoses.filter((_, i) => i !== index) }));
  }

  function addServiceLine() {
    setForm((f) => ({
      ...f,
      services: [
        ...f.services,
        { service: 0, doctor: null, quantity: 1, notes: "", status: "PENDING" },
      ],
    }));
  }

  function updateServiceLine(index: number, patch: Partial<EncounterService>) {
    setForm((f) => ({
      ...f,
      services: f.services.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function removeServiceLine(index: number) {
    setForm((f) => ({ ...f, services: f.services.filter((_, i) => i !== index) }));
  }

  async function submit() {
    const patientId = editingEncounter ? editingEncounter.patient : selectedPatient?.id;
    if (!patientId) {
      setFormError(t("encounters.patientRequired"));
      return;
    }
    if (!form.service_type || (doctorRequired && !form.doctor)) {
      setFormError(t("encounters.typeAndDoctorRequired"));
      return;
    }
    if (!form.services.some((s) => s.service)) {
      setFormError(t("encounters.servicesRequired"));
      return;
    }
    const body = {
      patient: patientId,
      service_type: Number(form.service_type),
      doctor: form.doctor ? Number(form.doctor) : null,
      referring_doctor_name: form.referring_doctor_name,
      room: form.room || null,
      chief_complaint: form.chief_complaint,
      priority: form.priority,
      ars: effectiveArs ? Number(effectiveArs) : null,
      ars_program: effectiveArsProgram ? Number(effectiveArsProgram) : null,
      authorization_number: form.authorization_number,
      diagnoses: form.diagnoses.filter((d) => d.description.trim()),
      services: form.services.filter((s) => s.service),
    };
    try {
      if (editingEncounter) await api.patch(`/encounters/${editingEncounter.id}/`, body);
      else await api.post("/encounters/", body);
      setFormError("");
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <FormModal
      title={editingEncounter ? t("common.edit") : t("encounters.new")}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t("common.save")}
      error={formError}
      wide
    >
      <h4>{t("encounters.sectionPatient")}</h4>
      {editingEncounter ? (
        <p><MaskedValue value={editingEncounter.patient_info.full_name} /></p>
      ) : (
        <>
          <Field label={t("encounters.patient")}>
            <SearchableSelect<Patient>
              value={selectedPatient}
              onSelect={setSelectedPatient}
              search={searchPatients}
              placeholder={t("records.patientPickerPlaceholder")}
              getLabel={(p) => p.full_name}
              getSublabel={(p) => `${formatCedula(p.cedula)} · NSS ${p.nss || "—"}`}
            />
          </Field>
          <button type="button" className="btn ghost small" onClick={onRequestNewPatient}>
            + {t("patients.new")}
          </button>
        </>
      )}

      {patientSummary && (
        <div className="kv-grid encounter-summary-card">
          <div><b>{t("patients.age")}:</b> {patientSummary.age ?? "—"}</div>
          <div><b>{t("patients.gender")}:</b> {patientSummary.gender ?? "—"}</div>
          <div><b>{t("patients.ars")}:</b> {patientSummary.ars_name ?? "—"}</div>
          {patientSummary.allergies && (
            <div className="encounter-alert"><b>{t("patients.allergies")}:</b> <MaskedValue value={patientSummary.allergies} /></div>
          )}
          {patientSummary.critical_conditions && (
            <div className="encounter-alert"><b>{t("patients.criticalConditions")}:</b> <MaskedValue value={patientSummary.critical_conditions} /></div>
          )}
        </div>
      )}

      <h4>{t("encounters.sectionAdmission")}</h4>
      <div className="form-columns">
        <Field label={t("encounters.type")}>
          <select value={form.service_type} onChange={(e) => handleServiceTypeChange(Number(e.target.value))} required>
            <option value={0} disabled>—</option>
            {serviceTypes.map((st) => (
              <option key={st.id} value={st.id}>{toSentenceCase(st.name)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("encounters.doctor")}>
          <select value={form.doctor} onChange={(e) => pickDoctor(Number(e.target.value))} required={doctorRequired}>
            <option value={0} disabled={doctorRequired}>—</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("encounters.room")}>
          <select value={form.room} onChange={(e) => setForm({ ...form, room: Number(e.target.value) })}>
            <option value={0}>—</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("encounters.priority")}>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Encounter["priority"] })}>
            <option value="ROUTINE">{t(priorityLabel("ROUTINE"))}</option>
            <option value="URGENT">{t(priorityLabel("URGENT"))}</option>
            <option value="EMERGENCY">{t(priorityLabel("EMERGENCY"))}</option>
          </select>
        </Field>
      </div>
      <Field label={t("encounters.referringDoctor")}>
        <input value={form.referring_doctor_name} onChange={(e) => setForm({ ...form, referring_doctor_name: e.target.value })} />
      </Field>
      <Field label={t("encounters.chiefComplaint")}>
        <textarea value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} />
      </Field>

      <h4>{t("encounters.sectionDiagnoses")}</h4>
      {form.diagnoses.map((d, i) => (
        <div key={i} className="form-columns encounter-line-row">
          <Field label={t("encounters.diagnosisDescription")}>
            <input value={d.description} onChange={(e) => updateDiagnosis(i, { description: e.target.value })} />
          </Field>
          <label className="show-inactive-toggle">
            <input
              type="radio"
              name="primary-diagnosis"
              checked={d.is_primary}
              onChange={() =>
                setForm((f) => ({
                  ...f,
                  diagnoses: f.diagnoses.map((dd, ii) => ({ ...dd, is_primary: ii === i })),
                }))
              }
            />
            {t("encounters.primary")}
          </label>
          <button type="button" className="btn ghost small" onClick={() => removeDiagnosis(i)}>
            {t("common.delete")}
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={addDiagnosis}>
        + {t("encounters.addDiagnosis")}
      </button>

      <h4>{t("encounters.sectionServices")}</h4>
      {form.services.map((s, i) => (
        <div key={i} className="form-columns encounter-line-row">
          <Field label={t("encounters.service")}>
            <select value={s.service} onChange={(e) => updateServiceLine(i, { service: Number(e.target.value) })}>
              <option value={0} disabled>—</option>
              {availableServices.map((sv) => (
                <option key={sv.id} value={sv.id}>{toSentenceCase(sv.name)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("encounters.quantity")}>
            <input type="number" min={1} value={s.quantity} onChange={(e) => updateServiceLine(i, { quantity: Number(e.target.value) })} />
          </Field>
          <Field label={t("encounters.serviceNotes")}>
            <input value={s.notes} onChange={(e) => updateServiceLine(i, { notes: e.target.value })} />
          </Field>
          <button type="button" className="btn ghost small" onClick={() => removeServiceLine(i)}>
            {t("common.delete")}
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={addServiceLine}>
        + {t("encounters.addService")}
      </button>

      <h4>{t("encounters.sectionCoverage")}</h4>
      {(arsLocked || arsProgramLocked) && (
        <p className="muted">{t("encounters.arsLockedNote")}</p>
      )}
      <div className="form-columns">
        <Field label={t("patients.ars")}>
          <select
            value={effectiveArs}
            disabled={arsLocked}
            onChange={(e) => setForm({ ...form, ars: e.target.value, ars_program: "" })}
          >
            <option value="">—</option>
            {arsList.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("patients.arsProgram")}>
          <select
            value={effectiveArsProgram}
            disabled={arsProgramLocked || !effectiveArs}
            onChange={(e) => setForm({ ...form, ars_program: e.target.value })}
          >
            <option value="">—</option>
            {(selectedArs?.programs ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("encounters.authorizationNumber")}>
          <input value={form.authorization_number} onChange={(e) => setForm({ ...form, authorization_number: e.target.value })} />
        </Field>
      </div>
    </FormModal>
  );
}

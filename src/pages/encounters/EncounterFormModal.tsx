import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, MaskedValue, SearchableSelect } from "../../components/ui";
import { useDoctorServiceFilter } from "../../hooks/useDoctorServiceFilter";
import { api, ApiError } from "../../services/api";
import { searchPatients } from "../../services/patients";
import type {
  ARS,
  DoctorProfile,
  Encounter,
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

const EMPTY_LINE: EncounterService = {
  service: 0,
  doctor: null,
  room: null,
  quantity: 1,
  notes: "",
  status: "PENDING",
  ars_covered: true,
  authorization_number: null,
};

const EMPTY_FORM = {
  chief_complaint: "",
  priority: "ROUTINE" as Encounter["priority"],
  ars: "",
  ars_program: "",
  services: [] as EncounterService[],
};

const priorityLabel = (p: string) => `encounters.priority${p[0]}${p.slice(1).toLowerCase()}`;

function initialFormFor(editingEncounter: Encounter | null) {
  if (!editingEncounter) return EMPTY_FORM;
  const r = editingEncounter;
  return {
    chief_complaint: r.chief_complaint,
    priority: r.priority,
    ars: r.ars ? String(r.ars) : "",
    ars_program: r.ars_program ? String(r.ars_program) : "",
    services: r.services,
  };
}

/** A service's doctor requirement + the doctor room a doctor pre-fills,
 * shared by both auto-fill directions below. */
function requiresDoctorFor(services: Service[], serviceTypes: ServiceType[], serviceId: number): boolean {
  const svc = services.find((sv) => sv.id === serviceId);
  const st = serviceTypes.find((t) => t.id === svc?.type);
  return st?.requires_doctor ?? true;
}

function roomForDoctor(doctor: DoctorProfile): number | null {
  if (doctor.default_room) return doctor.default_room;
  return doctor.rooms_detail.length === 1 ? doctor.rooms_detail[0].id : null;
}

/** Create/edit encounter form: patient picker (new encounters only) or a
 * read-only patient name (editing), diagnoses/services line-item editors,
 * per-line doctor+room admission rows (each service line is its own
 * (service, doctor, room) unit -- a visit can mix several doctors/rooms),
 * and coverage (ARS/program) fields that lock to the patient's own values
 * once one is on file. Owns all of its own form state -- the page only
 * supplies the lists it's fed from (doctors/rooms/service types/ARS/
 * services) and the patient it's creating/editing for.
 *
 * Entry works either direction on the same line: picking a service first
 * auto-fills its doctor+room when exactly one doctor offers it; picking a
 * doctor first auto-fills the service (when the doctor offers exactly one)
 * and room the same way. Each direction only ever touches its own line --
 * previously a single shared doctor/room pair meant picking a doctor
 * silently dropped every other line's already-chosen service. */
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
          guardian_cedula: selectedPatient.guardians[0]?.cedula ?? "",
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

  // The Service type selector is gone from the UI -- derive it from the
  // first selected service's own type instead, purely to feed the
  // requires_doctor flag below (still required by the backend on submit).
  const firstSelectedService = services.find((sv) => sv.id === form.services.find((s) => s.service)?.service);
  const derivedServiceType = serviceTypes.find((st) => st.id === firstSelectedService?.type);

  // Any line whose own service requires a doctor but has none assigned yet
  // -- mirrors the backend's per-line EncounterServiceSerializer check.
  const missingDoctorLine = form.services.find(
    (s) => s.service && requiresDoctorFor(services, serviceTypes, s.service) && !s.doctor,
  );

  function addServiceLine() {
    setForm((f) => ({ ...f, services: [...f.services, { ...EMPTY_LINE }] }));
  }

  function updateServiceLine(index: number, patch: Partial<EncounterService>) {
    setForm((f) => ({
      ...f,
      services: f.services.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  /** Service-first: picking a service auto-fills this line's doctor (and
   * that doctor's room) only when exactly one doctor offers it -- an
   * open-to-anyone service (or one two+ doctors both offer) leaves the
   * doctor field for the user to choose. */
  function updateServiceLineService(index: number, serviceId: number) {
    const patch: Partial<EncounterService> = { service: serviceId };
    if (requiresDoctorFor(services, serviceTypes, serviceId)) {
      const eligible = doctors.filter((d) => d.services.length === 0 || d.services.includes(serviceId));
      const restricted = doctors.filter((d) => d.services.includes(serviceId));
      const onlyDoctor = restricted.length === 1 && eligible.length === 1 ? restricted[0] : null;
      if (onlyDoctor) {
        patch.doctor = onlyDoctor.id;
        patch.room = roomForDoctor(onlyDoctor);
      }
    }
    updateServiceLine(index, patch);
  }

  /** Doctor-first: picking a doctor auto-fills this line's service when the
   * doctor offers exactly one (and the line has none yet), and the room the
   * same way as the service-first direction. */
  function updateServiceLineDoctor(index: number, doctorId: number, currentService: number) {
    const doctor = doctors.find((d) => d.id === doctorId);
    const patch: Partial<EncounterService> = { doctor: doctorId || null };
    if (doctor) {
      if (!currentService && doctor.services_detail.length === 1) {
        patch.service = doctor.services_detail[0].id;
      }
      const room = roomForDoctor(doctor);
      if (room) patch.room = room;
    }
    updateServiceLine(index, patch);
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
    if (!form.services.some((s) => s.service)) {
      setFormError(t("encounters.servicesRequired"));
      return;
    }
    if (!derivedServiceType || missingDoctorLine) {
      setFormError(t("encounters.typeAndDoctorRequired"));
      return;
    }
    const body = {
      patient: patientId,
      service_type: derivedServiceType.id,
      chief_complaint: form.chief_complaint,
      priority: form.priority,
      ars: effectiveArs ? Number(effectiveArs) : null,
      ars_program: effectiveArsProgram ? Number(effectiveArsProgram) : null,
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
      xwide
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

      <h4>{t("encounters.sectionServices")}</h4>
      {form.services.map((s, i) => {
        const { availableServices } = useDoctorServiceFilter({
          doctors,
          services,
          serviceTypes,
          selectedServiceIds: [s.service],
          currentDoctorId: s.doctor ?? 0,
        });
        return (
          <div key={i} className="encounter-line-row">
            <span className="line-order-badge">#{i + 1}</span>
            <Field label={t("encounters.service")}>
              <SearchableSelect<Service>
                value={availableServices.find((sv) => sv.id === s.service) ?? null}
                onSelect={(sv) => updateServiceLineService(i, sv.id)}
                search={async (query) => {
                  const q = query.trim().toLowerCase();
                  const results = q ? availableServices.filter((sv) => sv.name.toLowerCase().includes(q)) : availableServices;
                  return { results, count: results.length };
                }}
                minChars={1}
                placeholder={t("encounters.service")}
                getLabel={(sv) => toSentenceCase(sv.name)}
                getSublabel={(sv) => toSentenceCase(sv.type_name)}
              />
            </Field>
            <Field label={t("encounters.serviceNotes")}>
              <input value={s.notes} onChange={(e) => updateServiceLine(i, { notes: e.target.value })} />
            </Field>
            {s.ars_covered && (
              <Field label={t("encounters.authorizationNumber")}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={s.authorization_number ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      updateServiceLine(i, { authorization_number: null });
                      return;
                    }
                    const n = Number(raw);
                    if (Number.isInteger(n) && n > 0) updateServiceLine(i, { authorization_number: n });
                  }}
                />
              </Field>
            )}
            <label className="line-coverage-toggle">
              <input
                type="checkbox"
                checked={s.ars_covered}
                onChange={(e) =>
                  updateServiceLine(i, {
                    ars_covered: e.target.checked,
                    authorization_number: e.target.checked ? s.authorization_number : null,
                  })
                }
              />
              {t("encounters.arsCovered")}
            </label>
            <button
              type="button"
              className="btn small danger"
              aria-label={t("common.delete")}
              onClick={() => removeServiceLine(i)}
            >
              ×
            </button>
          </div>
        );
      })}
      <button type="button" className="btn ghost small" onClick={addServiceLine}>
        + {t("encounters.addService")}
      </button>

      <h4>{t("encounters.sectionAdmission")}</h4>
      {form.services.map((s, i) => {
        const { availableDoctors, currentDoctor } = useDoctorServiceFilter({
          doctors,
          services,
          serviceTypes,
          selectedServiceIds: [s.service],
          currentDoctorId: s.doctor ?? 0,
        });
        const doctorRequired = s.service ? requiresDoctorFor(services, serviceTypes, s.service) : false;
        const availableRooms =
          currentDoctor && currentDoctor.rooms.length > 0
            ? rooms.filter((rm) => currentDoctor.rooms.includes(rm.id))
            : rooms;
        return (
          <div key={i} className="encounter-admission-row">
            <span className="line-order-badge">#{i + 1}</span>
            <Field label={t("encounters.doctor")}>
              <select
                value={s.doctor ?? 0}
                onChange={(e) => updateServiceLineDoctor(i, Number(e.target.value), s.service)}
                required={doctorRequired}
              >
                <option value={0} disabled={doctorRequired}>—</option>
                {availableDoctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("encounters.room")}>
              <select value={s.room ?? 0} onChange={(e) => updateServiceLine(i, { room: Number(e.target.value) || null })}>
                <option value={0}>—</option>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
          </div>
        );
      })}
      <button type="button" className="btn ghost small" onClick={addServiceLine}>
        + {t("encounters.addDoctor")}
      </button>
      <Field label={t("encounters.priority")}>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Encounter["priority"] })}>
          <option value="ROUTINE">{t(priorityLabel("ROUTINE"))}</option>
          <option value="URGENT">{t(priorityLabel("URGENT"))}</option>
          <option value="EMERGENCY">{t(priorityLabel("EMERGENCY"))}</option>
        </select>
      </Field>
      <Field label={t("encounters.chiefComplaint")}>
        <textarea value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} />
      </Field>

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
      </div>
    </FormModal>
  );
}

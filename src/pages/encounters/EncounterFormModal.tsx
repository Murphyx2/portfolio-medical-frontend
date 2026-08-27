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

const EMPTY_FORM = {
  doctor: 0,
  room: 0,
  chief_complaint: "",
  priority: "ROUTINE" as Encounter["priority"],
  ars: "",
  ars_program: "",
  authorization_number: "",
  services: [] as EncounterService[],
};

const priorityLabel = (p: string) => `encounters.priority${p[0]}${p.slice(1).toLowerCase()}`;

function initialFormFor(editingEncounter: Encounter | null) {
  if (!editingEncounter) return EMPTY_FORM;
  const r = editingEncounter;
  return {
    doctor: r.doctor ?? 0,
    room: r.room ?? 0,
    chief_complaint: r.chief_complaint,
    priority: r.priority,
    ars: r.ars ? String(r.ars) : "",
    ars_program: r.ars_program ? String(r.ars_program) : "",
    authorization_number: r.authorization_number,
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
  // requires_doctor/requires_diagnosis flags below (still required by the
  // backend on submit).
  const firstSelectedService = services.find((sv) => sv.id === form.services.find((s) => s.service)?.service);
  const derivedServiceType = serviceTypes.find((st) => st.id === firstSelectedService?.type);
  // Not every service needs a doctor present (e.g. a lab-only visit) --
  // required unless the derived type explicitly says otherwise. Fails safe
  // toward "required" before any service is picked yet.
  const doctorRequired = !derivedServiceType || derivedServiceType.requires_doctor;

  const { isDoctorBoundService, eligibleForDoctor, availableDoctors, availableServices, currentDoctor } =
    useDoctorServiceFilter({
      doctors,
      services,
      serviceTypes,
      selectedServiceIds: form.services.map((s) => s.service),
      currentDoctorId: form.doctor,
    });

  // Room dropdown: mirrors the hook's service narrowing above, using the
  // doctor's assigned rooms instead -- Encounter-specific, not part of the
  // shared hook.
  const availableRooms =
    currentDoctor && currentDoctor.rooms.length > 0
      ? rooms.filter((rm) => currentDoctor.rooms.includes(rm.id))
      : rooms;

  function pickDoctor(doctorId: number) {
    const doctor = doctors.find((d) => d.id === doctorId);
    setForm((f) => {
      const restrictedToServices = doctor && doctor.services.length > 0;
      const nextServices = restrictedToServices
        ? f.services.filter((s) => !s.service || !isDoctorBoundService(s.service) || doctor!.services.includes(s.service))
        : f.services;
      const hasServicePicked = nextServices.some((s) => s.service);

      // Drop an already-picked room the new doctor isn't assigned to,
      // then auto-fill if the doctor has exactly one room and none is set.
      let nextRoom = f.room;
      if (doctor && doctor.rooms.length > 0 && nextRoom && !doctor.rooms.includes(nextRoom)) {
        nextRoom = 0;
      }
      if (!nextRoom && doctor?.rooms_detail.length === 1) {
        nextRoom = doctor.rooms_detail[0].id;
      }

      return {
        ...f,
        doctor: doctorId,
        room: nextRoom,
        // Auto-fill a single service line only if the doctor offers
        // exactly one service and nothing has been picked yet.
        services:
          !hasServicePicked && doctor?.services_detail.length === 1
            ? [{ service: doctor.services_detail[0].id, doctor: null, quantity: 1, notes: "", status: "PENDING" }]
            : nextServices,
      };
    });
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
    setForm((f) => {
      const nextServices = f.services.map((s, i) => (i === index ? { ...s, ...patch } : s));
      const doctor = doctors.find((d) => d.id === f.doctor);
      return {
        ...f,
        services: nextServices,
        doctor: eligibleForDoctor(doctor, nextServices.map((s) => s.service)) ? f.doctor : 0,
      };
    });
  }

  function removeServiceLine(index: number) {
    setForm((f) => {
      const nextServices = f.services.filter((_, i) => i !== index);
      const doctor = doctors.find((d) => d.id === f.doctor);
      return {
        ...f,
        services: nextServices,
        doctor: eligibleForDoctor(doctor, nextServices.map((s) => s.service)) ? f.doctor : 0,
      };
    });
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
    if (!derivedServiceType || (doctorRequired && !form.doctor)) {
      setFormError(t("encounters.typeAndDoctorRequired"));
      return;
    }
    const body = {
      patient: patientId,
      service_type: derivedServiceType.id,
      doctor: form.doctor ? Number(form.doctor) : null,
      room: form.room || null,
      chief_complaint: form.chief_complaint,
      priority: form.priority,
      ars: effectiveArs ? Number(effectiveArs) : null,
      ars_program: effectiveArsProgram ? Number(effectiveArsProgram) : null,
      authorization_number: form.authorization_number,
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

      <h4>{t("encounters.sectionServices")}</h4>
      {form.services.map((s, i) => (
        <div key={i} className="form-columns encounter-line-row">
          <Field label={t("encounters.service")}>
            <SearchableSelect<Service>
              value={availableServices.find((sv) => sv.id === s.service) ?? null}
              onSelect={(sv) => updateServiceLine(i, { service: sv.id })}
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
          <button type="button" className="btn ghost small" onClick={() => removeServiceLine(i)}>
            {t("common.delete")}
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={addServiceLine}>
        + {t("encounters.addService")}
      </button>

      <h4>{t("encounters.sectionAdmission")}</h4>
      <div className="form-columns">
        <Field label={t("encounters.doctor")}>
          <select value={form.doctor} onChange={(e) => pickDoctor(Number(e.target.value))} required={doctorRequired}>
            <option value={0} disabled={doctorRequired}>—</option>
            {availableDoctors.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("encounters.room")}>
          <select value={form.room} onChange={(e) => setForm({ ...form, room: Number(e.target.value) })}>
            <option value={0}>—</option>
            {availableRooms.map((r) => (
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
        <Field label={t("encounters.authorizationNumber")}>
          <input value={form.authorization_number} onChange={(e) => setForm({ ...form, authorization_number: e.target.value })} />
        </Field>
      </div>
    </FormModal>
  );
}

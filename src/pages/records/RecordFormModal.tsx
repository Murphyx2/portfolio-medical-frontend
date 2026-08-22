import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, SearchableSelect } from "../../components/ui";
import { api, ApiError } from "../../services/api";
import { searchPatients } from "../../services/patients";
import type { Patient } from "../../services/types";
import { formatCedula } from "../../utils/cedula";
import { formatDate } from "../../utils/date";
import { flattenError } from "../../utils/errors";

const EMPTY_RECORD = {
  patient: 0,
  title: "",
  diagnosis: "",
  treatment: "",
  medicine_and_doses: "",
  notes: "",
};

export function recordTitleFor(patient: Patient): string {
  return `${patient.full_name} — ${formatDate(new Date())}`;
}

function initialFormFor(initialPatient: Patient | null) {
  if (!initialPatient) return EMPTY_RECORD;
  return { ...EMPTY_RECORD, patient: initialPatient.id, title: recordTitleFor(initialPatient) };
}

/** "New record" form: a patient picker (pre-filled from `initialPatient`,
 * either the list's default first patient or a deep-link's looked-up
 * patient) plus the core record fields. Owns its own form state -- the page
 * only supplies which patient to start from and what to do once saved. */
export function RecordFormModal({
  initialPatient,
  onClose,
  onSaved,
}: {
  initialPatient: Patient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient);
  const [form, setForm] = useState(() => initialFormFor(initialPatient));
  const [formError, setFormError] = useState("");

  function pickPatient(p: Patient) {
    setSelectedPatient(p);
    setForm({ ...form, patient: p.id, title: recordTitleFor(p) });
  }

  async function submit() {
    setFormError("");
    try {
      await api.post("/medical-records/", {
        ...form,
        patient: Number(form.patient),
      });
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <FormModal
      title={t("records.newRecord")}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t("common.save")}
      error={formError}
    >
      <Field label={t("records.patient")}>
        <SearchableSelect<Patient>
          value={selectedPatient}
          onSelect={pickPatient}
          search={searchPatients}
          placeholder={t("records.patientPickerPlaceholder")}
          getLabel={(p) => p.full_name}
          getSublabel={(p) => formatCedula(p.cedula)}
        />
      </Field>
      <Field label={t("records.recordTitle")}>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </Field>
      <Field label={t("records.diagnosis")}>
        <textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
      </Field>
      <Field label={t("records.treatment")}>
        <textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} />
      </Field>
      <Field label={t("records.medicineAndDoses")}>
        <textarea value={form.medicine_and_doses} onChange={(e) => setForm({ ...form, medicine_and_doses: e.target.value })} />
      </Field>
      <Field label={t("records.notes")}>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormModal>
  );
}

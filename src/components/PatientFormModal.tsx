import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { DateField } from "./DateField";
import { Field, FormModal } from "./ui";
import { api, ApiError } from "../services/api";
import type { ARS, MedicalCenter, Paginated, Patient } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";
import { formatCedula } from "../utils/cedula";
import { formatPhone, formatPhoneInput, isValidPhone, isValidRequiredPhone, stripToDigits } from "../utils/phone";

const EMPTY = {
  first_name: "",
  last_name: "",
  birth_date: "",
  gender: "",
  phone: "",
  address: "",
  email: "",
  cedula: "",
  nss: "",
  ars: "",
  ars_program: "",
  center: "",
  has_guardian: true,
  guardian_first_name: "",
  guardian_last_name: "",
  guardian_cedula: "",
  guardian_nss: "",
  guardian_phone: "",
  allergies: "",
  critical_conditions: "",
};

// Client-side mirror of the backend's age arithmetic, used only to decide
// whether to show the Guardian/Parent section -- the server remains the
// source of truth via PatientSerializer.validate(). Returns null (rather
// than throwing) on an empty/unparseable date so the section just stays
// hidden instead of crashing the form.
function calcAge(birthDateStr: string): number | null {
  if (!birthDateStr) return null;
  const bd = new Date(birthDateStr);
  if (Number.isNaN(bd.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const beforeBirthday =
    today.getMonth() < bd.getMonth() ||
    (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate());
  if (beforeBirthday) age--;
  return age;
}

/** Reusable patient create/edit form, shared by Patients.tsx and Encounters.tsx
 * (the latter's "+ New Patient" picker action). Self-contained: fetches its
 * own ARS/center reference lists rather than requiring the parent to. */
export function PatientFormModal({
  patient,
  onClose,
  onSaved,
}: {
  patient?: Patient | null;
  onClose: () => void;
  onSaved: (patient: Patient) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEditCenter = user?.role === "ADMIN";
  const [arsList, setArsList] = useState<ARS[]>([]);
  const [centersList, setCentersList] = useState<MedicalCenter[]>([]);
  const [form, setForm] = useState(() =>
    patient
      ? {
          first_name: patient.first_name,
          last_name: patient.last_name,
          birth_date: patient.birth_date ?? "",
          gender: patient.gender,
          phone: formatPhone(patient.phone),
          address: patient.address,
          email: patient.email,
          cedula: patient.cedula,
          nss: patient.nss,
          ars: patient.ars ? String(patient.ars) : "",
          ars_program: patient.ars_program ? String(patient.ars_program) : "",
          center: patient.center ? String(patient.center) : "",
          has_guardian: patient.has_guardian,
          guardian_first_name: patient.guardian_first_name,
          guardian_last_name: patient.guardian_last_name,
          guardian_cedula: patient.guardian_cedula,
          guardian_nss: patient.guardian_nss,
          guardian_phone: formatPhone(patient.guardian_phone),
          allergies: patient.allergies,
          critical_conditions: patient.critical_conditions,
        }
      : EMPTY,
  );
  const [phoneError, setPhoneError] = useState("");
  const [guardianPhoneError, setGuardianPhoneError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    api
      .get<Paginated<ARS>>("/ars/?page_size=100")
      .then((r) => setArsList(r.results))
      .catch(() => {});
    api
      .get<Paginated<MedicalCenter>>("/centers/?page_size=100")
      .then((r) => {
        setCentersList(r.results);
        if (!patient) {
          const defaultCenter = r.results.find((c) => c.is_default);
          if (defaultCenter) setForm((f) => ({ ...f, center: String(defaultCenter.id) }));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedArs = arsList.find((a) => String(a.id) === form.ars);
  const isMinor = (calcAge(form.birth_date) ?? 99) < 18;

  async function submit() {
    if (!isValidPhone(form.phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    if (isMinor && form.has_guardian && !isValidRequiredPhone(form.guardian_phone)) {
      setGuardianPhoneError(t("common.phoneInvalid"));
      return;
    }
    const body = {
      ...form,
      birth_date: form.birth_date || null,
      phone: form.phone.replace(/\D/g, ""),
      cedula: form.cedula.replace(/\D/g, ""),
      guardian_cedula: form.guardian_cedula.replace(/\D/g, ""),
      guardian_phone: form.guardian_phone.replace(/\D/g, ""),
      ars: form.ars ? Number(form.ars) : null,
      ars_program: form.ars_program ? Number(form.ars_program) : null,
      center: form.center ? Number(form.center) : null,
    };
    try {
      const saved = patient
        ? await api.patch<Patient>(`/patients/${patient.id}/`, body)
        : await api.post<Patient>("/patients/", body);
      setFormError("");
      onSaved(saved);
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <FormModal
      title={patient ? t("common.edit") : t("patients.new")}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t("common.save")}
      error={formError}
      wide
    >
      <div className="form-columns">
        <div>
          <h4>{t("patients.sectionIdentity")}</h4>
          <Field label={t("patients.firstName")}>
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </Field>
          <Field label={t("patients.lastName")}>
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </Field>
          <Field label={t("patients.cedula")}>
            <input
              value={form.cedula}
              placeholder="000-0000000-0"
              inputMode="numeric"
              maxLength={13}
              required={!isMinor || !form.has_guardian}
              onChange={(e) => setForm({ ...form, cedula: formatCedula(e.target.value) })}
            />
          </Field>
          <Field label={t("patients.birthDate")}>
            <DateField
              value={form.birth_date}
              onChange={(isoDate) => setForm({ ...form, birth_date: isoDate })}
              required
            />
          </Field>
          <Field label={t("patients.gender")}>
            <select
              value={form.gender}
              required
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="" disabled>
                {t("patients.selectGender")}
              </option>
              <option value="MALE">{t("patients.genderMale")}</option>
              <option value="FEMALE">{t("patients.genderFemale")}</option>
            </select>
          </Field>
        </div>

        <div>
          <h4>{t("patients.sectionInsurance")}</h4>
          <Field label={t("patients.nss")}>
            <input
              value={form.nss}
              inputMode="numeric"
              maxLength={11}
              onChange={(e) => setForm({ ...form, nss: stripToDigits(e.target.value).slice(0, 11) })}
            />
          </Field>
          <Field label={t("patients.ars")}>
            <select
              value={form.ars}
              onChange={(e) => setForm({ ...form, ars: e.target.value, ars_program: "" })}
            >
              <option value="">—</option>
              {arsList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("patients.arsProgram")}>
            <select
              value={form.ars_program}
              onChange={(e) => setForm({ ...form, ars_program: e.target.value })}
              disabled={!form.ars}
            >
              <option value="">—</option>
              {(selectedArs?.programs ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("patients.center")}>
            <select
              value={form.center}
              disabled={!canEditCenter}
              onChange={(e) => setForm({ ...form, center: e.target.value })}
            >
              <option value="">—</option>
              {centersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {isMinor && (
        <>
          <h4>{t("patients.sectionGuardian")}</h4>
          <label className="show-inactive-toggle">
            <input
              type="checkbox"
              checked={form.has_guardian}
              onChange={(e) => setForm({ ...form, has_guardian: e.target.checked })}
            />
            {t("patients.guardianCheckbox")}
          </label>
          {form.has_guardian && (
            <>
              <div className="form-columns">
                <Field label={t("patients.guardianFirstName")}>
                  <input
                    value={form.guardian_first_name}
                    required
                    onChange={(e) => setForm({ ...form, guardian_first_name: e.target.value })}
                  />
                </Field>
                <Field label={t("patients.guardianLastName")}>
                  <input
                    value={form.guardian_last_name}
                    required
                    onChange={(e) => setForm({ ...form, guardian_last_name: e.target.value })}
                  />
                </Field>
              </div>
              <div className="form-columns">
                <Field label={t("patients.guardianCedula")}>
                  <input
                    value={form.guardian_cedula}
                    placeholder="000-0000000-0"
                    inputMode="numeric"
                    maxLength={13}
                    required
                    onChange={(e) => setForm({ ...form, guardian_cedula: formatCedula(e.target.value) })}
                  />
                </Field>
                <Field label={t("patients.guardianPhone")}>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.guardian_phone}
                    placeholder="(809) 555-1212"
                    maxLength={14}
                    required
                    onChange={(e) => {
                      setForm({ ...form, guardian_phone: formatPhoneInput(e.target.value) });
                      setGuardianPhoneError("");
                    }}
                  />
                  {guardianPhoneError && <span className="field-error">{guardianPhoneError}</span>}
                </Field>
              </div>
              <Field label={t("patients.guardianNss")}>
                <input
                  value={form.guardian_nss}
                  inputMode="numeric"
                  maxLength={11}
                  onChange={(e) => setForm({ ...form, guardian_nss: stripToDigits(e.target.value).slice(0, 11) })}
                />
              </Field>
            </>
          )}
        </>
      )}

      <h4>{t("patients.sectionContact")}</h4>
      <div className="form-columns">
        <Field label={t("patients.phone")}>
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            placeholder="(809) 555-1212"
            maxLength={14}
            onChange={(e) => {
              setForm({ ...form, phone: formatPhoneInput(e.target.value) });
              setPhoneError("");
            }}
          />
          {phoneError && <span className="field-error">{phoneError}</span>}
        </Field>
        <Field label={t("patients.email")}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t("patients.address")}>
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </Field>

      <h4>{t("patients.sectionClinical")}</h4>
      <div className="form-columns">
        <Field label={t("patients.allergies")}>
          <textarea
            value={form.allergies}
            rows={2}
            onChange={(e) => setForm({ ...form, allergies: e.target.value })}
          />
        </Field>
        <Field label={t("patients.criticalConditions")}>
          <textarea
            value={form.critical_conditions}
            rows={2}
            onChange={(e) => setForm({ ...form, critical_conditions: e.target.value })}
          />
        </Field>
      </div>
    </FormModal>
  );
}

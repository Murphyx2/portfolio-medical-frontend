import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Field } from "./ui";
import type { PatientGuardian } from "../services/types";
import { formatCedula } from "../utils/cedula";
import { formatPhoneInput, stripToDigits } from "../utils/phone";

const EMPTY_GUARDIAN: PatientGuardian = {
  first_name: "",
  last_name: "",
  cedula: "",
  nss: "",
  phone: "",
};

/** Growable list of guardian/tutor entries -- a patient may have more than
 * one (e.g. both parents) on file. Mirrors PhoneNumberListField's add/remove
 * shape, but each row is a small field group instead of one input. Values
 * carry raw digits for cedula/phone (same convention as the rest of this
 * form); formatting is display-only via formatCedula/formatPhoneInput. */
export function GuardianListField({
  values,
  onChange,
  phoneErrors,
  onPhoneErrorClear,
}: {
  values: PatientGuardian[];
  onChange: (next: PatientGuardian[]) => void;
  phoneErrors: Record<number, string>;
  onPhoneErrorClear: (index: number) => void;
}) {
  const { t } = useTranslation();

  function updateAt(index: number, patch: Partial<PatientGuardian>) {
    onChange(values.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="guardian-list-field">
      {values.map((guardian, index) => (
        <div className="guardian-list-row" key={index}>
          <div className="form-columns">
            <Field label={t("patients.guardianFirstName")}>
              <input
                value={guardian.first_name}
                required
                onChange={(e) => updateAt(index, { first_name: e.target.value })}
              />
            </Field>
            <Field label={t("patients.guardianLastName")}>
              <input
                value={guardian.last_name}
                required
                onChange={(e) => updateAt(index, { last_name: e.target.value })}
              />
            </Field>
          </div>
          <div className="form-columns">
            <Field label={t("patients.guardianCedula")}>
              <input
                value={formatCedula(guardian.cedula)}
                placeholder="000-0000000-0"
                inputMode="numeric"
                maxLength={13}
                required
                onChange={(e) => updateAt(index, { cedula: stripToDigits(e.target.value).slice(0, 11) })}
              />
            </Field>
            <Field label={t("patients.guardianPhone")}>
              <input
                type="tel"
                inputMode="tel"
                value={formatPhoneInput(guardian.phone)}
                placeholder="(809) 555-1212"
                maxLength={14}
                required
                aria-invalid={!!phoneErrors[index]}
                aria-describedby={phoneErrors[index] ? `guardian-phone-error-${index}` : undefined}
                onChange={(e) => {
                  updateAt(index, { phone: stripToDigits(e.target.value) });
                  onPhoneErrorClear(index);
                }}
              />
              {phoneErrors[index] && (
                <span id={`guardian-phone-error-${index}`} className="field-error" role="alert">
                  {phoneErrors[index]}
                </span>
              )}
            </Field>
          </div>
          <div className="form-columns">
            <Field label={t("patients.guardianNss")}>
              <input
                value={guardian.nss}
                inputMode="numeric"
                maxLength={11}
                onChange={(e) => updateAt(index, { nss: stripToDigits(e.target.value).slice(0, 11) })}
              />
            </Field>
            <div className="guardian-list-remove">
              <button
                type="button"
                className="phone-list-remove-btn"
                aria-label={t("patients.removeGuardian")}
                onClick={() => removeAt(index)}
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={() => onChange([...values, { ...EMPTY_GUARDIAN }])}>
        <Plus size={14} strokeWidth={1.75} aria-hidden="true" /> {t("patients.addGuardian")}
      </button>
    </div>
  );
}

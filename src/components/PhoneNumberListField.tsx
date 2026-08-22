import { Plus, X } from "lucide-react";

import { formatPhoneInput } from "../utils/phone";

/** Growable list of "additional phone number" rows -- add/remove, each
 * masked the same way the primary phone field is. Value/onChange work on
 * plain strings (not the API's `{id, phone}` shape); the owning form
 * converts to/from `ExtraPhone[]` on load/submit. */
export function PhoneNumberListField({
  values,
  onChange,
  addLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  function updateAt(index: number, next: string) {
    onChange(values.map((v, i) => (i === index ? next : v)));
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="phone-list-field">
      {values.map((value, index) => (
        <div className="phone-list-row" key={index}>
          <input
            type="tel"
            inputMode="tel"
            value={value}
            placeholder="(809) 555-1212"
            maxLength={14}
            onChange={(e) => updateAt(index, formatPhoneInput(e.target.value))}
          />
          <button
            type="button"
            className="phone-list-remove-btn"
            aria-label="Remove phone number"
            onClick={() => removeAt(index)}
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={() => onChange([...values, ""])}>
        <Plus size={14} strokeWidth={1.75} aria-hidden="true" /> {addLabel}
      </button>
    </div>
  );
}

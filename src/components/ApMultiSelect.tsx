import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { APCategory, APType } from "../services/types";

export interface ApConditionLike {
  id: number;
  ap_type: number | null;
  custom_label: string;
  is_custom: boolean;
}

export interface ApAddPayload {
  ap_type?: number;
  custom_label?: string;
}

/**
 * Category-grouped chip multi-select for the AP (Antecedentes Patológicos)
 * catalog -- shared by the personal and family AP sections. Each catalog
 * item is one toggle chip (selected = already on the chart); a separate
 * "Otro" row lets the clinician add repeatable free-text items. Deliberately
 * stateless about persistence: `onAdd`/`onRemove` are invoked per item and
 * the parent decides which endpoint that maps to (RecordPersonalCondition
 * vs. RecordFamilyCondition).
 */
export function ApMultiSelect({
  categories,
  types,
  conditions,
  onAdd,
  onRemove,
  disabled,
}: {
  categories: APCategory[];
  types: APType[];
  conditions: ApConditionLike[];
  onAdd: (payload: ApAddPayload) => void;
  onRemove: (id: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [customText, setCustomText] = useState("");

  const conditionByType = new Map(
    conditions.filter((c) => c.ap_type != null).map((c) => [c.ap_type as number, c]),
  );
  const customConditions = conditions.filter((c) => c.is_custom);

  function toggleType(typeId: number) {
    if (disabled) return;
    const existing = conditionByType.get(typeId);
    if (existing) onRemove(existing.id);
    else onAdd({ ap_type: typeId });
  }

  function addCustom() {
    const label = customText.trim();
    if (!label || disabled) return;
    onAdd({ custom_label: label });
    setCustomText("");
  }

  const visibleCategories = categories.filter((cat) => types.some((ty) => ty.category === cat.id));

  return (
    <div className="ap-multiselect">
      {visibleCategories.length === 0 && customConditions.length === 0 && (
        <p className="ap-empty-note">{t("records.apCatalogEmpty")}</p>
      )}
      {visibleCategories.map((cat) => (
        <div className="ap-category-group" key={cat.id}>
          <h5 className="ap-category-name">{cat.name}</h5>
          <div className="ap-chip-row" role="group" aria-label={cat.name}>
            {types
              .filter((ty) => ty.category === cat.id)
              .map((ty) => {
                const selected = conditionByType.has(ty.id);
                return (
                  <button
                    key={ty.id}
                    type="button"
                    className={`ap-chip${selected ? " selected" : ""}`}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => toggleType(ty.id)}
                  >
                    {ty.name}
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      <div className="ap-category-group">
        <h5 className="ap-category-name">{t("records.apOther")}</h5>
        {customConditions.length > 0 && (
          <div className="ap-chip-row" role="group" aria-label={t("records.apOther")}>
            {customConditions.map((c) => (
              <button
                key={c.id}
                type="button"
                className="ap-chip selected"
                aria-pressed="true"
                disabled={disabled}
                onClick={() => onRemove(c.id)}
              >
                {c.custom_label} ×
              </button>
            ))}
          </div>
        )}
        {!disabled && (
          <div className="ap-custom-add">
            <input
              value={customText}
              placeholder={t("records.apOtherPlaceholder")}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" className="btn ghost small" onClick={addCustom}>
              + {t("records.apAddCustom")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

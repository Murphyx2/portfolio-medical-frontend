import { useTranslation } from "react-i18next";

import { Field } from "../../components/ui";
import { FRECUENCIA_OPTIONS, UNIDAD_TOMA_OPTIONS, renderDosisTexto } from "../../services/prescriptions";
import type { DosisFrecuenciaTipo, DosisJson } from "../../services/types";

const FREE_TEXT_TYPE: DosisFrecuenciaTipo = "libre";
/** Frecuencia kinds that need an "n" number input alongside the select
 * (Cada n horas / n vez-veces al día / Cada n días) -- "una_vez_semana" and
 * "libre" don't take one. */
const N_FIELD_TYPES: DosisFrecuenciaTipo[] = ["cada_n_horas", "n_veces_dia", "cada_n_dias"];

/**
 * Dosis subcomponent of the Receta composer (RECETAS_REQUIREMENTS.md §7):
 * unidades/unidad de toma, a frecuencia picker that never locks the doctor
 * into 4/6/12-hour presets (a "texto libre" escape hatch covers anything
 * else, e.g. `30-0-10 UD`), and a live preview of the exact string the PDF
 * will print. Purely controlled -- the parent line array in
 * RecetaComposerModal owns the actual `dosis_json`/`dosis_texto` state.
 */
export function DoseBuilder({ value, onChange, disabled }: {
  value: DosisJson;
  onChange: (dosis: DosisJson) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  function patch(next: Partial<DosisJson>) {
    onChange({ ...value, ...next });
  }

  const preview = renderDosisTexto(value);

  return (
    <div className="dose-builder">
      <div className="dose-builder-row">
        <Field label={t("prescriptions.unidadesPorToma")}>
          <input
            type="number"
            min={1}
            value={value.unidades_por_toma}
            onChange={(e) => patch({ unidades_por_toma: Number(e.target.value) || 1 })}
            disabled={disabled}
          />
        </Field>
        <Field label={t("prescriptions.unidadDeToma")}>
          <select
            value={value.unidad_toma}
            onChange={(e) => patch({ unidad_toma: e.target.value })}
            disabled={disabled}
          >
            {UNIDAD_TOMA_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="dose-builder-row">
        <Field label={t("prescriptions.frecuencia")}>
          <select
            value={value.frecuencia_tipo}
            onChange={(e) => patch({ frecuencia_tipo: e.target.value as DosisFrecuenciaTipo })}
            disabled={disabled}
          >
            {FRECUENCIA_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {t(`prescriptions.frecuenciaOptions.${f}`)}
              </option>
            ))}
          </select>
        </Field>
        {N_FIELD_TYPES.includes(value.frecuencia_tipo) && (
          <Field label={t("prescriptions.frecuenciaN")}>
            <input
              type="number"
              min={1}
              value={value.frecuencia_n ?? ""}
              onChange={(e) => patch({ frecuencia_n: e.target.value ? Number(e.target.value) : null })}
              disabled={disabled}
            />
          </Field>
        )}
      </div>

      {value.frecuencia_tipo === FREE_TEXT_TYPE && (
        <Field label={t("prescriptions.frecuenciaTextoLibre")}>
          <input
            type="text"
            value={value.frecuencia_texto_libre}
            placeholder="30-0-10 UD"
            onChange={(e) => patch({ frecuencia_texto_libre: e.target.value })}
            disabled={disabled}
          />
        </Field>
      )}

      <label>
        <input
          type="checkbox"
          checked={value.uso_continuo}
          onChange={(e) => patch({ uso_continuo: e.target.checked })}
          disabled={disabled}
        />{" "}
        {t("prescriptions.usoContinuo")}
      </label>

      <div className="dose-builder-preview">{preview || t("prescriptions.dosisPreviewEmpty")}</div>
    </div>
  );
}

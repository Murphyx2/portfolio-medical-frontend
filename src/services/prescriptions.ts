import { api } from "./api";
import type {
  DosisFrecuenciaTipo,
  DosisJson,
  Medicine,
  MedicineConcentracionUnidad,
  MedicineForma,
  MedicineViaAdministracion,
  Paginated,
} from "./types";

/** Shared with Medicamentos (Medicines.tsx) so the composer's Forma/Vía
 * pick-lists and the catalog's own form fields never drift apart -- one
 * source of truth for the enum's display order. */
export const FORMA_OPTIONS: MedicineForma[] = [
  "TABLETA",
  "CAPSULA",
  "JARABE",
  "GOTAS",
  "CREMA",
  "UNGUENTO",
  "AMPOLLA",
  "VIAL",
  "INHALADOR",
  "PARCHE",
  "SUSPENSION",
  "SUPOSITORIO",
  "OTRO",
];

export const VIA_OPTIONS: MedicineViaAdministracion[] = [
  "ORAL",
  "SUBLINGUAL",
  "SC",
  "IM",
  "IV",
  "TOPICA",
  "OFTALMICA",
  "OTICA",
  "NASAL",
  "INHALATORIA",
  "RECTAL",
  "OTRO",
];

/** Medicine lookup for the Receta composer's line search -- same
 * genérico+comercial substring search Medicamentos already exposes
 * (`search_fields` on the ViewSet), byte-identical shape to
 * `patients.ts::searchPatients` so `SearchableSelect<Medicine>` drops in the
 * same way the patient/doctor pickers do. */
export function searchMedicines(q: string): Promise<{ results: Medicine[]; count: number }> {
  return api
    .get<Paginated<Medicine>>(`/medicines/?page_size=20${q ? `&search=${encodeURIComponent(q)}` : ""}`)
    .then((r) => ({ results: r.results, count: r.count }))
    .catch(() => ({ results: [], count: 0 }));
}

export const EMPTY_DOSIS: DosisJson = {
  unidades_por_toma: 1,
  unidad_toma: "TAB",
  frecuencia_tipo: "cada_n_horas",
  frecuencia_n: 12,
  frecuencia_texto_libre: "",
  uso_continuo: false,
};

/** Renders the exact printed Dosis line (RECETAS_REQUIREMENTS.md §7) from a
 * dose-builder selection -- shared by DoseBuilder's live preview and
 * RecetaComposerModal's line summaries so both read the same string the PDF
 * will print. */
export function renderDosisTexto(d: DosisJson): string {
  const unidades = d.unidades_por_toma || 1;
  const unidad = d.unidad_toma || "";
  let frase: string;
  switch (d.frecuencia_tipo) {
    case "cada_n_horas":
      frase = `C/${d.frecuencia_n || 1} HORAS`;
      break;
    case "n_veces_dia":
      frase = (d.frecuencia_n || 1) === 1 ? "AL DIA" : `${d.frecuencia_n} VECES AL DIA`;
      break;
    case "cada_n_dias":
      frase = `CADA ${d.frecuencia_n || 1} DIAS`;
      break;
    case "una_vez_semana":
      frase = "UNA VEZ POR SEMANA";
      break;
    case "libre":
    default:
      return `${d.frecuencia_texto_libre || ""}${d.uso_continuo ? " (USO CONTINUO)" : ""}`.trim();
  }
  const base = `${unidades} ${unidad} ${frase}`.replace(/\s+/g, " ").trim();
  return d.uso_continuo ? `${base} (USO CONTINUO)` : base;
}

export const FRECUENCIA_OPTIONS: DosisFrecuenciaTipo[] = [
  "cada_n_horas",
  "n_veces_dia",
  "cada_n_dias",
  "una_vez_semana",
  "libre",
];

export const UNIDAD_TOMA_OPTIONS = ["TAB", "CAP", "ml", "gotas", "UD", "aplicación", "otro"] as const;

/** Sensible default "Unidad de toma" per forma farmacéutica -- applied only
 * when the dose builder is still at its untouched default, never
 * overwriting a value the user already picked (RECETAS follow-up: "if the
 * medicine by default is Tableta, Unidad a tomar should be Tab by
 * default"). Forms with no obvious single default (OTRO, or a forma that
 * isn't set yet) are omitted -- the caller leaves the field alone. */
export const FORMA_TO_UNIDAD_TOMA: Partial<Record<MedicineForma, (typeof UNIDAD_TOMA_OPTIONS)[number]>> = {
  TABLETA: "TAB",
  CAPSULA: "CAP",
  JARABE: "ml",
  SUSPENSION: "ml",
  GOTAS: "gotas",
  CREMA: "aplicación",
  UNGUENTO: "aplicación",
  INHALADOR: "aplicación",
  PARCHE: "aplicación",
  AMPOLLA: "ml",
  VIAL: "ml",
  SUPOSITORIO: "UD",
};

/** Same list Medicamentos already uses for concentracion_unidad -- exported
 * here so the composer's line editor can share it instead of a free-text
 * input (a typo here changes what the printed prescription says). */
export const UNIDAD_CONCENTRACION_OPTIONS: MedicineConcentracionUnidad[] = [
  "mg",
  "mcg",
  "g",
  "ml",
  "UI",
  "UI/ml",
  "%",
  "mg/ml",
  "OTRO",
];

/** Narrows which concentration units make pharmacological sense for a given
 * forma (a Tableta is never measured in ml) -- "OTRO" always stays
 * available in every mapping as an escape hatch, and an unset/OTRO forma
 * falls back to the full unrestricted list, so this narrows to plausible
 * units without ever hard-blocking a genuine edge case. */
export const FORMA_TO_UNIDADES: Partial<Record<MedicineForma, MedicineConcentracionUnidad[]>> = {
  TABLETA: ["mg", "mcg", "g", "UI", "OTRO"],
  CAPSULA: ["mg", "mcg", "g", "UI", "OTRO"],
  JARABE: ["mg/ml", "%", "OTRO"],
  SUSPENSION: ["mg/ml", "%", "OTRO"],
  GOTAS: ["mg/ml", "mcg", "%", "OTRO"],
  CREMA: ["%", "mg", "OTRO"],
  UNGUENTO: ["%", "mg", "OTRO"],
  AMPOLLA: ["mg/ml", "mg", "UI", "UI/ml", "OTRO"],
  VIAL: ["mg/ml", "UI", "UI/ml", "mg", "OTRO"],
  INHALADOR: ["mcg", "mg", "OTRO"],
  PARCHE: ["mg", "mcg", "OTRO"],
  SUPOSITORIO: ["mg", "g", "OTRO"],
};

export function unidadesForForma(forma: MedicineForma): MedicineConcentracionUnidad[] {
  return FORMA_TO_UNIDADES[forma] ?? UNIDAD_CONCENTRACION_OPTIONS;
}

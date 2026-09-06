import type { MedicineForma, MedicineViaAdministracion } from "./types";

/** Display-order source of truth for Medicamentos' Forma/Vía pick-lists. */
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

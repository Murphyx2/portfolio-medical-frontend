import type { Role } from "../services/types";

// Spanish-only: "DOCTOR" reads as "Doctor/a" to cover masculine/feminine.
// English is left exactly as the caller already renders it (raw enum, or a
// backend-supplied label passed via `fallback`) -- no en.json keys needed.
const ROLE_LABELS_ES: Record<Role, string> = {
  ADMIN: "Administrador",
  DOCTOR: "Doctor/a",
  RECEPTIONIST: "Recepcionista",
  IT: "TI",
  NURSE: "Enfermero/a",
  CENTER_MANAGER: "Gerente de centro",
};

export function roleLabel(role: string | undefined, language: string, fallback: string = role ?? ""): string {
  if (!role) return "";
  if (language.startsWith("es")) return ROLE_LABELS_ES[role as Role] ?? fallback;
  return fallback;
}

import { api } from "./api";
import type { Paginated, Patient } from "./types";

/** Shared patient lookup for `SearchableSelect` pickers -- byte-identical
 * callback previously duplicated in Encounters.tsx, Records.tsx, and
 * Appointments.tsx. */
export function searchPatients(q: string): Promise<{ results: Patient[]; count: number }> {
  return api
    .get<Paginated<Patient>>(`/patients/?page_size=50${q ? `&search=${encodeURIComponent(q)}` : ""}`)
    .then((r) => ({ results: r.results, count: r.count }))
    .catch(() => ({ results: [], count: 0 }));
}

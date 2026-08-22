/** App-wide date display format: DD/MM/YYYY, regardless of browser/OS
 * locale. Deliberately not Intl/toLocaleDateString-based -- those follow
 * whatever locale the browser reports, which this app no longer wants to
 * leave to chance. */
export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Same DD/MM/YYYY date prefix, followed by the locale's own time-of-day
 * formatting (unchanged -- only the date part needed fixing). */
export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${formatDate(date)}, ${date.toLocaleTimeString()}`;
}

/** Local (not UTC) today as YYYY-MM-DD -- day-scoped list filters (Encounters,
 * Appointments) must match the browser's own "today", not a UTC one that
 * could be a day off depending on the visitor's timezone. */
export function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftLocalISO(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nextLocalISO(dateStr: string): string {
  return shiftLocalISO(dateStr, 1);
}

export function prevLocalISO(dateStr: string): string {
  return shiftLocalISO(dateStr, -1);
}

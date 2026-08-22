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

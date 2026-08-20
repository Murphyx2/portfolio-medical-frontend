/** Service names/types are stored upper-case (e.g. "CONSULTA DE MEDICINA
 * FAMILIAR Y COMUNITARIA"); rendered verbatim that reads as shouting. This
 * converts to sentence case for display only -- the stored value is never
 * touched. */
export function toSentenceCase(value: string): string {
  const lower = value.toLowerCase();
  return lower.replace(/(^|[.!?]\s+)([a-záéíóúñ])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

import { translateApiMessage } from "./apiErrorTranslations";

export function flattenError(message: string): string {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (typeof parsed === "string") return translateApiMessage(parsed);
    if (parsed && typeof parsed === "object") {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        const raw = Array.isArray(value) ? value.join(" ") : String(value);
        lines.push(`${key}: ${translateApiMessage(raw)}`);
      }
      return lines.join("\n");
    }
  } catch {
    /* not JSON */
  }
  return translateApiMessage(message);
}

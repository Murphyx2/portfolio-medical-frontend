export function flattenError(message: string): string {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        lines.push(`${key}: ${Array.isArray(value) ? value.join(" ") : String(value)}`);
      }
      return lines.join("\n");
    }
  } catch {
    /* not JSON */
  }
  return message;
}

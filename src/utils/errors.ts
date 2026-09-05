import i18n from "../i18n";
import { translateApiMessage } from "./apiErrorTranslations";
import { ApiError } from "../services/api";

/** Raw DRF field names -> the i18n key already used for that field's own
 * label elsewhere in the UI, so a nested validation error reads with the
 * same wording the user sees on the form instead of the Python identifier
 * (e.g. "authorization_number" -> "N.º de autorización"). */
const FIELD_LABEL_KEYS: Record<string, string> = {
  services: "encounters.sectionServices",
  service: "encounters.service",
  doctor: "encounters.doctor",
  room: "encounters.room",
  quantity: "encounters.quantity",
  notes: "encounters.serviceNotes",
  authorization_number: "encounters.authorizationNumber",
};

function fieldLabel(key: string): string {
  const i18nKey = FIELD_LABEL_KEYS[key];
  return i18nKey ? i18n.t(i18nKey) : key;
}

/** Flattens a DRF error payload -- a string, a list of message strings, or
 * an arbitrarily nested object (a list-serializer field like `services`
 * reports its per-item errors keyed by string index, e.g. {"0": {...}}) --
 * into one readable "Field label: message" line per leaf, translating leaf
 * messages and swapping raw field keys/list indices for human labels. */
function flattenValue(value: unknown, path: string[]): string[] {
  if (typeof value === "string") {
    return [formatLine(path, translateApiMessage(value))];
  }
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) {
      return value.map((v) => formatLine(path, translateApiMessage(v as string)));
    }
    return value.flatMap((v, idx) => flattenValue(v, [...path, i18n.t("common.lineNumber", { n: idx + 1 })]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) => {
      const segment = /^\d+$/.test(key) ? i18n.t("common.lineNumber", { n: Number(key) + 1 }) : fieldLabel(key);
      return flattenValue(v, [...path, segment]);
    });
  }
  return [formatLine(path, translateApiMessage(String(value)))];
}

function formatLine(path: string[], message: string): string {
  return path.length ? `${path.join(" – ")}: ${message}` : message;
}

/** The one line repeated at ~54 call sites across the app:
 * `err instanceof ApiError ? flattenError(err.message) : String(err)`.
 * Collapses every `catch (err)`/`.catch((err) => ...)` block down to
 * `apiErrorMessage(err)`, no behavior change. */
export function apiErrorMessage(err: unknown): string {
  return err instanceof ApiError ? flattenError(err.message) : String(err);
}

export function flattenError(message: string): string {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (typeof parsed === "string") return translateApiMessage(parsed);
    if (parsed && typeof parsed === "object") {
      return flattenValue(parsed, []).join("\n");
    }
  } catch {
    /* not JSON */
  }
  return translateApiMessage(message);
}

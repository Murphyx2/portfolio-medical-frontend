import i18n from "../i18n";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

let accessToken: string | null = null;

type ToastListener = (message: string) => void;
const toastListeners = new Set<ToastListener>();

/** Subscribe to save/delete success toasts fired from `request()` below.
 * Returns an unsubscribe function. There is exactly one subscriber in
 * practice (the `<ToastHost>` mounted once in `Layout`), but this stays a
 * pub/sub rather than a single callback so api.ts never needs to know
 * whether a UI is mounted yet. */
export function onMutationSuccess(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

function notifyMutationSuccess(method: string): void {
  const message =
    method === "DELETE" ? i18n.t("common.toastDeleted") : i18n.t("common.toastSaved");
  toastListeners.forEach((listener) => listener(message));
}

/** Fires a toast with caller-chosen copy instead of the generic
 * Guardado/Eliminado one -- used together with `silent` request options
 * where a spec mandates specific wording (e.g. Expedientes Médicos'
 * "Borrador guardado" / "Entrada guardada"). */
export function showToast(message: string): void {
  toastListeners.forEach((listener) => listener(message));
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(access: string | null): void {
  accessToken = access;
}

export interface RequestOptions extends RequestInit {
  /** Suppresses the automatic Guardado/Eliminado toast for this call --
   * used where the caller fires its own toast via `showToast` instead (e.g.
   * Records' draft autosave, which must stay silent, and its explicit save
   * actions, which use spec-mandated copy instead of the generic one). */
  silent?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  retry = true,
): Promise<T> {
  const { silent, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, false);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.detail ?? JSON.stringify(body);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(message, res.status);
  }

  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && !silent) notifyMutationSuccess(method);

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!res.ok) {
      setAccessToken(null);
      return false;
    }
    const data = (await res.json()) as { access: string };
    setAccessToken(data.access);
    return true;
  } catch {
    return false;
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Single-flight token refresh. The access token is held in memory and the
 * refresh token lives in an httpOnly cookie (H-03). When an access token
 * expires several concurrent requests 401 at once; they all share this ONE
 * refresh call (the server rotates the cookie exactly once); each waiting
 * request then retries with the new in-memory access token.
 */
export function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const match = /filename="?([^";]+)"?/i.exec(value);
  return match ? match[1] : null;
}

/** POSTs a JSON body and expects a binary (xlsx/zip) response instead of
 * JSON -- used by Reportes' Generar/Generar paquete actions. No existing
 * download path in this codebase to mirror; kept as a thin, single-purpose
 * addition alongside `upload()` rather than reworking `request()` to branch
 * on response type. */
export async function downloadBlob(
  path: string,
  body: unknown,
  retry = true,
): Promise<{ blob: Blob; filename: string | null }> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return downloadBlob(path, body, false);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const errBody = await res.json();
      message = errBody.detail ?? JSON.stringify(errBody);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();
  const filename = filenameFromContentDisposition(res.headers.get("Content-Disposition"));
  return { blob, filename };
}

export async function upload<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  notifyMutationSuccess("POST");
  return (await res.json()) as T;
}

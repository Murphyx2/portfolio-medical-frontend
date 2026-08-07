const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

let accessToken: string | null = null;

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

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${apiBase}${path}`, {
    ...options,
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
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, { ...options, method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, { ...options, method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

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
  return (await res.json()) as T;
}

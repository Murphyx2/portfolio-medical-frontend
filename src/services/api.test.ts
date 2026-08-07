/**
 * Regression tests for the single-flight token refresh (frontend token race).
 *
 * The access token lives 15 minutes and the refresh token is single-use
 * (SimpleJWT ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION). When the access
 * token expires, several concurrent requests 401 at once; they must share ONE
 * refresh call so the token rotates exactly once and every request retries with
 * the new access token.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, getAccessToken, getRefreshToken } from "./api";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  } as unknown as Response;
}

function setupFetch(
  routes: Record<string, (call: number) => { status: number; body: unknown }>,
) {
  const counts = new Map<string, number>();
  const calls: { path: string; auth: string | null }[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://localhost").pathname;
    const n = (counts.get(path) ?? 0) + 1;
    counts.set(path, n);
    const headers = init?.headers ? new Headers(init.headers as HeadersInit) : new Headers();
    calls.push({ path, auth: headers.get("Authorization") });
    const { status, body } = routes[path](n);
    return jsonResponse(status, body);
  });
  vi.stubGlobal("fetch", mock);
  return { mock, calls };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("mc_access", "old-access");
  localStorage.setItem("mc_refresh", "old-refresh");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("api token refresh (single-flight)", () => {
  it("shares ONE refresh call across concurrent 401s and retries each with the new token", async () => {
    const { calls } = setupFetch({
      "/api/centers/": (n) =>
        n <= 2
          ? { status: 401, body: { detail: "Token is invalid or expired" } }
          : { status: 200, body: { results: [], count: 0 } },
      "/api/auth/token/refresh/": () => ({
        status: 200,
        body: { access: "new-access", refresh: "new-refresh" },
      }),
    });

    const [a, b] = await Promise.all([api.get("/centers/"), api.get("/centers/")]);

    expect(a).toEqual({ results: [], count: 0 });
    expect(b).toEqual({ results: [], count: 0 });
    expect(calls.filter((c) => c.path === "/api/auth/token/refresh/")).toHaveLength(1);
    // both requests retried with the rotated access token
    expect(
      calls.filter((c) => c.path === "/api/centers/" && c.auth === "Bearer new-access"),
    ).toHaveLength(2);
    expect(getAccessToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("new-refresh");
  });

  it("clears tokens once and rejects all requests when the refresh itself fails", async () => {
    const { calls } = setupFetch({
      "/api/centers/": () => ({ status: 401, body: { detail: "Token is invalid or expired" } }),
      "/api/auth/token/refresh/": () => ({ status: 401, body: { detail: "Token is invalid or expired" } }),
    });

    const results = await Promise.allSettled([api.get("/centers/"), api.get("/centers/")]);

    for (const r of results) {
      expect(r.status).toBe("rejected");
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
    }
    expect(calls.filter((c) => c.path === "/api/auth/token/refresh/")).toHaveLength(1);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

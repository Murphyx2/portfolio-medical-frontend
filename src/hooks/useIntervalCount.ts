import { useEffect, useState } from "react";

import { api } from "../services/api";

const POLL_INTERVAL_MS = 60_000;

/** Fetches `.count` from `path` on mount, then every POLL_INTERVAL_MS while
 * mounted. Pass `null` to skip entirely (e.g. the user can't view that
 * resource). Fails silently and keeps the last-known count -- a stale or
 * missing nav badge isn't worth a toast. */
export function useIntervalCount(path: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!path) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function fetchCount() {
      try {
        const data = await api.get<{ count: number }>(path as string, { signal: controller.signal });
        if (!cancelled) setCount(data.count);
      } catch {
        // silent -- keep last-known count
      }
    }

    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [path]);

  return count;
}

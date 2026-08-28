import { useCallback, useEffect, useState } from "react";

import { api } from "../services/api";
import type { Appointment, Paginated } from "../services/types";

/** Requests `/appointments/` at the API's own page-size cap (200, see
 * `apps/core/pagination.py::DefaultPagination.max_page_size`) and follows
 * `next` until every appointment in `[rangeStart, rangeEnd)` has been
 * collected -- a busy month easily exceeds one page, and Calendar mode
 * needs the full set (unlike the table's single paginated page). */
async function fetchAllInRange(rangeStart: Date, rangeEnd: Date, signal: AbortSignal): Promise<Appointment[]> {
  const results: Appointment[] = [];
  let path: string | null =
    `/appointments/?date_time__gte=${encodeURIComponent(rangeStart.toISOString())}` +
    `&date_time__lt=${encodeURIComponent(rangeEnd.toISOString())}&page_size=200`;

  while (path) {
    const page: Paginated<Appointment> = await api.get<Paginated<Appointment>>(path, { signal });
    results.push(...page.results);
    if (page.next) {
      // `next` is an absolute URL from DRF's pagination; re-resolve it
      // against `/appointments/` so it goes back through `api.get` (which
      // owns auth headers / 401-refresh / apiBase) instead of fetching it
      // directly.
      const nextUrl = new URL(page.next, window.location.origin);
      path = `/appointments/?${nextUrl.searchParams.toString()}`;
    } else {
      path = null;
    }
  }
  return results;
}

/**
 * Fetches every appointment in `[rangeStart, rangeEnd)` for Calendar mode
 * (month/week/day views need the complete set, not one paginated page).
 * Refetches whenever the range changes. Search filtering over the fetched
 * set happens client-side in the caller -- no per-keystroke refetch.
 */
export function useCalendarAppointments(rangeStart: Date, rangeEnd: Date) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  const load = useCallback(
    (signal: AbortSignal) => {
      setLoading(true);
      setError(false);
      fetchAllInRange(new Date(rangeStartMs), new Date(rangeEndMs), signal)
        .then((all) => setAppointments(all))
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(true);
        })
        .finally(() => setLoading(false));
    },
    [rangeStartMs, rangeEndMs],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => {
    const controller = new AbortController();
    load(controller.signal);
  }, [load]);

  return { appointments, loading, error, reload };
}

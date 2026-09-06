import { useCallback, useEffect, useState } from "react";

import { api } from "../services/api";
import type { Paginated } from "../services/types";
import { useListControls, type InitialSort } from "./useListControls";

export interface UseListPageOptions {
  initialSort?: InitialSort;
  /** Extra query params merged into `query()`'s extra -- e.g. Encounters'
   * date/status filters, Rooms' `room_type` filter. Recomputed every render
   * (a plain object, not memoized) since `qs` itself is already recomputed
   * every render the same way `useListControls` consumers always did. */
  extraParams?: Record<string, string>;
}

/**
 * Deepens `useListControls` into the full per-page list-loading contract
 * shared byte-identically across the 13 paginated list pages: owns `rows`,
 * the admin-only `showInactive` toggle, and the `load` callback (fetch +
 * `Math.ceil(count/pageSize)` page-clamp) wired to `useEffect(load, [load])`.
 *
 * Returns every `useListControls` field plus `rows`/`setRows`,
 * `showInactive`/`setShowInactive`, and `load` -- pages that need the raw
 * sort state for their own purposes (Patients' client-side sort override)
 * still have `sortKey`/`sortDir`/`handleSort` available alongside it.
 */
export function useListPage<T>(endpoint: string, options?: UseListPageOptions) {
  const [rows, setRows] = useState<T[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const controls = useListControls(options?.initialSort);
  const { page, setPage, pageSize, setCount, query, runList } = controls;

  const qs = query({
    include_inactive: showInactive ? "true" : "",
    ...(options?.extraParams ?? {}),
  });

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<T>>(`${endpoint}?${qs}`, { signal }))
      .then((r) => {
        if (!r) return;
        setRows(r.results);
        setCount(r.count);
        const total = Math.ceil(r.count / pageSize);
        if (total > 0 && page > total) setPage(total);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, page, pageSize, setCount, setPage, runList, endpoint]);

  useEffect(load, [load]);

  return { ...controls, rows, setRows, showInactive, setShowInactive, load };
}

import { useCallback, useEffect, useRef, useState } from "react";

export type SortDir = "asc" | "desc";

export const MIN_SEARCH_CHARS = 3;

export interface InitialSort {
  key: string;
  dir: SortDir;
}

/**
 * Shared state for the 8 paginated list pages: pagination, page-size, the
 * top search bar (server-side, debounced 300ms or immediate on Enter, active
 * from the 3rd character) and per-column sorting (asc -> desc -> clear on
 * repeated clicks).
 *
 * `runList` performs the fetch in the background: the previous in-flight
 * request is aborted (no stale-response overwrites) and the full-page spinner
 * (`initialLoading`) only shows on the very first load — re-searches, sorting
 * and page changes keep the current rows visible while the new results load.
 */
export function useListControls(initialSort?: InitialSort) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir | null>(initialSort?.dir ?? null);
  const [initialLoading, setInitialLoading] = useState(true);
  const debounceRef = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(debounceRef.current);
  }, [search]);

  function searchSubmit() {
    window.clearTimeout(debounceRef.current);
    setDebouncedSearch(search.trim());
  }

  const activeSearch = debouncedSearch.length >= MIN_SEARCH_CHARS ? debouncedSearch : "";

  useEffect(() => {
    setPage(1);
  }, [activeSearch, sortKey, sortDir, pageSize]);

  function changePageSize(size: number) {
    setPageSize(size);
  }

  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    }
  }

  const runList = useCallback(
    async <T,>(fetcher: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await fetcher(controller.signal);
        return data;
      } catch (err) {
        if (controller.signal.aborted) return null;
        throw err;
      } finally {
        if (abortRef.current === controller) setInitialLoading(false);
      }
    },
    [],
  );

  function query(extra: Record<string, string> = {}): string {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    if (sortKey && sortDir) {
      params.set("ordering", (sortDir === "desc" ? "-" : "") + sortKey);
    }
    if (activeSearch) params.set("search", activeSearch);
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return params.toString();
  }

  return {
    page,
    setPage,
    pageSize,
    count,
    setCount,
    search,
    setSearch,
    searchSubmit,
    sortKey,
    sortDir,
    handleSort,
    changePageSize,
    initialLoading,
    runList,
    query,
  };
}

import { useEffect, useState } from "react";

export type SortDir = "asc" | "desc";

export interface InitialSort {
  key: string;
  dir: SortDir;
}

/**
 * Shared state for the 7 paginated list pages: pagination, page-size, the
 * top search bar (server-side, debounced, active from the 4th character) and
 * per-column sorting (asc -> desc -> clear on repeated clicks).
 */
export function useListControls(initialSort?: InitialSort) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir | null>(initialSort?.dir ?? null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const activeSearch = debouncedSearch.length >= 4 ? debouncedSearch : "";

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
    sortKey,
    sortDir,
    handleSort,
    changePageSize,
    query,
  };
}

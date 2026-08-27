import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Pagination, SearchBar, Spinner, Table, type Column, type SortDir } from "./ui";

export interface ListPageProps<T extends { id: number }> {
  initialLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  searchSubmit: () => void;
  /** Extra toolbar controls rendered before the search bar (e.g. Encounters'
   * date filter). */
  toolbarBefore?: ReactNode;
  /** Extra toolbar controls rendered after the search bar, before the
   * show-inactive toggle (e.g. Rooms' type filter, Encounters' status
   * filter). */
  toolbarAfter?: ReactNode;
  isAdmin: boolean;
  showInactive: boolean;
  onToggleInactive: (value: boolean) => void;
  page: number;
  count: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  columns: Column<T>[];
  /** Adds the standard admin-only "active" status badge column after the
   * caller's own columns. Default true, but the column only renders when
   * `activeAccessor` is also supplied -- pages that build their own status
   * column inline (Users' unconditional `is_active` column, Appointments'
   * differently-labelled one) simply omit `activeAccessor` and get nothing
   * extra here. Encounters passes `showActiveColumn={false}` explicitly
   * (uses row styling via `isInactive` instead of a status column). */
  showActiveColumn?: boolean;
  activeAccessor?: (row: T) => boolean;
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void | Promise<void>;
  onRestore?: (row: T) => void | Promise<void>;
  extraActions?: (row: T) => ReactNode;
  isInactive?: (row: T) => boolean;
  getRowLabel?: (row: T) => string;
  emptyLabel?: string;
  sortKey?: string | null;
  sortDir?: SortDir | null;
  onSort?: (key: string) => void;
}

/**
 * Shared shell for the paginated list pages: full-page spinner gate
 * (`initialLoading`), toolbar (optional extra controls + search + admin-only
 * "show inactive" toggle), doubled `Pagination` (top and bottom, identical
 * props both times), and `Table` -- absorbs the wiring that used to be
 * copy-pasted byte-identically across all 13 list pages. Each page still
 * owns its own columns, row actions, form modals, and detail dialogs; only
 * the list/toolbar/pagination shell lives here.
 *
 * Extension points (see `ARCHITECTURE_REFACTOR_PLAN.md` F1 notes for the
 * full rationale): `toolbarBefore`/`toolbarAfter` for extra filters,
 * `showActiveColumn`/`activeAccessor` for the admin status column,
 * `sortKey`/`sortDir`/`onSort` are plain pass-through props so a page can
 * substitute its own (Patients' client-side sort), and omitting
 * `onEdit`/`onDelete`/`onRestore` opts a page out of `Table`'s built-in
 * delete/restore confirm entirely (Appointments drives its own `ConfirmDialog`
 * via a custom `actions` column instead).
 */
export function ListPage<T extends { id: number }>({
  initialLoading,
  search,
  setSearch,
  searchSubmit,
  toolbarBefore,
  toolbarAfter,
  isAdmin,
  showInactive,
  onToggleInactive,
  page,
  count,
  pageSize,
  onPageChange,
  onPageSizeChange,
  columns,
  showActiveColumn = true,
  activeAccessor,
  rows,
  onEdit,
  onDelete,
  onRestore,
  extraActions,
  isInactive,
  getRowLabel,
  emptyLabel,
  sortKey,
  sortDir,
  onSort,
}: ListPageProps<T>) {
  const { t } = useTranslation();

  if (initialLoading) return <Spinner />;

  const activeColumn: Column<T>[] =
    showActiveColumn && activeAccessor
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (row: T) => (
              <span className={`badge status-${activeAccessor(row) ? "active" : "inactive"}`}>
                {activeAccessor(row) ? t("common.active") : t("common.inactive")}
              </span>
            ),
          },
        ]
      : [];

  const fullColumns = [...columns, ...activeColumn];

  return (
    <>
      <div className="list-toolbar">
        {toolbarBefore}
        <SearchBar
          value={search}
          onChange={setSearch}
          onSubmit={searchSubmit}
          placeholder={t("common.searchPlaceholder")}
          label={t("common.search")}
        />
        {toolbarAfter}
        {isAdmin && (
          <label className="show-inactive-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => onToggleInactive(e.target.checked)}
            />
            {t("common.showInactive")}
          </label>
        )}
      </div>
      <Pagination page={page} count={count} pageSize={pageSize} onChange={onPageChange} onPageSizeChange={onPageSizeChange} />
      <Table
        columns={fullColumns}
        rows={rows}
        onEdit={onEdit}
        onDelete={onDelete}
        onRestore={onRestore}
        extraActions={extraActions}
        isInactive={isInactive}
        getRowLabel={getRowLabel}
        emptyLabel={emptyLabel}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />
      <Pagination page={page} count={count} pageSize={pageSize} onChange={onPageChange} onPageSizeChange={onPageSizeChange} />
    </>
  );
}

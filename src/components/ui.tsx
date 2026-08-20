import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { MIN_SEARCH_CHARS } from "../hooks/useListControls";
import { ApiError, onMutationSuccess } from "../services/api";
import { flattenError } from "../utils/errors";
import { toSentenceCase } from "../utils/text";

function actionErrorMessage(err: unknown): string {
  return err instanceof ApiError ? flattenError(err.message) : String(err);
}

/** Shared "confirm before running a row action" state machine -- extracted
 * so pages with more confirm types than Table's built-in delete/restore
 * (Appointments' complete/cancel, Encounters' admit/complete/cancel) don't
 * each hand-roll their own confirming/error/pending triple. Table itself
 * keeps its own internal copy for delete/restore since it owns that flow
 * end-to-end; this is for pages driving `ConfirmDialog` themselves. */
export function useRowConfirm<K extends string, T>() {
  const [confirming, setConfirming] = useState<{ type: K; row: T } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function open(type: K, row: T) {
    setConfirming({ type, row });
    setError("");
  }

  function close() {
    setConfirming(null);
    setError("");
  }

  async function run(handler: (type: K, row: T) => void | Promise<void>) {
    if (!confirming) return;
    setPending(true);
    setError("");
    try {
      await handler(confirming.type, confirming.row);
      setConfirming(null);
    } catch (err) {
      setError(actionErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return { confirming, error, pending, open, close, run };
}

export function Page({ title, actions, children }: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="page-head">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

const DIALOG_FOCUSABLE_SELECTOR =
  "input, select, textarea, button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])";

/**
 * Shared dialog shell: drag-release-safe backdrop close, role="dialog" +
 * aria-modal + aria-labelledby, initial focus + focus-restore-on-close, a
 * Tab/Shift+Tab focus trap, and Escape-to-close. `preventClose` suppresses
 * Escape/backdrop-close (e.g. while a submit is in flight) without touching
 * the focus trap. Composed by FormModal; also used directly by dialogs that
 * don't fit the single-submit/cancel shape (e.g. Records' detail view).
 */
export function Dialog({ title, onClose, children, wide, preventClose }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  preventClose?: boolean;
}) {
  const pressOnBackdrop = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const focusable = modal?.querySelector<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR);
    (focusable ?? modal)?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (preventClose) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusables = Array.from(modal.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, preventClose]);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressOnBackdrop.current && e.target === e.currentTarget && !preventClose) {
          pressOnBackdrop.current = false;
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={wide ? "modal wide" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          pressOnBackdrop.current = false;
          e.stopPropagation();
        }}
      >
        <h3 id={titleId}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function FormModal({ title, onClose, onSubmit, children, submitLabel, error, wide }: {
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog title={title} onClose={onClose} preventClose={submitting} wide={wide}>
      <form onSubmit={handleSubmit}>
        {children}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? t("common.saving") : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Confirmation dialog for destructive/reversible row actions (delete,
 * restore). Built on the shared `Dialog` shell instead of `window.confirm`
 * so it inherits the app's own visual language, and shows API errors inline
 * instead of `window.alert` — a native OS dialog otherwise breaks out of
 * the design system at the exact moment a destructive action is confirmed.
 */
export function ConfirmDialog({ title, message, confirmLabel, danger, error, pending, onConfirm, onCancel, children }: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  error?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog title={title} onClose={onCancel} preventClose={pending}>
      <p>{message}</p>
      {children}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className={danger ? "btn danger" : "btn primary"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? t("common.saving") : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  sortKey?: string;
  align?: "center";
}

export type SortDir = "asc" | "desc";

export function Table<T extends { id: number }>({
  columns,
  rows,
  onEdit,
  onDelete,
  onRestore,
  isInactive,
  getRowLabel,
  emptyLabel,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void | Promise<void>;
  onRestore?: (row: T) => void | Promise<void>;
  isInactive?: (row: T) => boolean;
  /** Human-readable label for a row, interpolated into the delete/restore confirm message. Falls back to the row id. */
  getRowLabel?: (row: T) => string;
  emptyLabel?: string;
  sortKey?: string | null;
  sortDir?: SortDir | null;
  onSort?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const hasActions = Boolean(onEdit || onDelete || onRestore);
  const [confirming, setConfirming] = useState<{ type: "delete" | "restore"; row: T } | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);

  function closeConfirm() {
    setConfirming(null);
    setActionError("");
  }

  async function runConfirmedAction() {
    if (!confirming) return;
    const handler = confirming.type === "delete" ? onDelete : onRestore;
    if (!handler) return;
    setActionPending(true);
    setActionError("");
    try {
      await handler(confirming.row);
      setConfirming(null);
    } catch (err) {
      setActionError(actionErrorMessage(err));
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => {
              const sortable = Boolean(c.sortKey && onSort);
              const active = sortable && sortKey === c.sortKey && (sortDir === "asc" || sortDir === "desc");
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={c.align === "center" ? "col-center" : undefined}
                  aria-sort={
                    sortable
                      ? active
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={`th-sort${active ? " active" : ""}`}
                      onClick={() => onSort!(c.sortKey!)}
                    >
                      {c.header}
                      <span className="sort-arrow">
                        {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
            {hasActions && <th scope="col" className="col-center">{t("common.actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (hasActions ? 1 : 0)} className="muted">
                {emptyLabel ?? t("common.noData")}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === "center" ? "col-center" : undefined}>
                  {c.render ? c.render(row) : String((row as never)[c.key] ?? "")}
                </td>
              ))}
              {hasActions && (
                <td className="col-center">
                  <div className="row-actions">
                    {onEdit && (
                      <button
                        className="btn small"
                        onClick={() => onEdit(row)}
                        aria-label={`${t("common.edit")} ${getRowLabel?.(row) ?? row.id}`}
                      >
                        {t("common.edit")}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="btn small danger"
                        onClick={() => setConfirming({ type: "delete", row })}
                        aria-label={`${t("common.delete")} ${getRowLabel?.(row) ?? row.id}`}
                      >
                        {t("common.delete")}
                      </button>
                    )}
                    {onRestore && isInactive?.(row) && (
                      <button
                        className="btn small"
                        onClick={() => setConfirming({ type: "restore", row })}
                        aria-label={`${t("common.restore")} ${getRowLabel?.(row) ?? row.id}`}
                      >
                        {t("common.restore")}
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {confirming && (
        <ConfirmDialog
          title={confirming.type === "delete" ? t("common.delete") : t("common.restore")}
          message={t(
            confirming.type === "delete" ? "common.deleteConfirmNamed" : "common.restoreConfirmNamed",
            { name: getRowLabel?.(confirming.row) ?? String(confirming.row.id) },
          )}
          confirmLabel={confirming.type === "delete" ? t("common.delete") : t("common.restore")}
          danger={confirming.type === "delete"}
          error={actionError}
          pending={actionPending}
          onConfirm={runConfirmedAction}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}

export function Spinner() {
  const { t } = useTranslation();
  return <div className="page-center muted">{t("common.loading")}</div>;
}

export function MaskedValue({ value }: { value?: string | null }) {
  const { t } = useTranslation();
  if (!value) return <>{"—"}</>;
  if (!value.includes("•")) return <>{value}</>;
  const label = t("common.maskedTooltip");
  return (
    <span className="masked-value" title={label}>
      <svg
        className="masked-value-icon"
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <rect x="3.5" y="7" width="9" height="6.5" rx="1.25" />
        <path d="M5.5 7V4.75a2.5 2.5 0 0 1 5 0V7" />
      </svg>
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

/** Compact display of a doctor's offered services inside a table cell: up to
 * `max` quiet chips, then a single muted "+N" overflow chip carrying a
 * native title tooltip with the rest -- keeps a long list from turning the
 * row into a wall of tags. Renders a muted dash when there are none. */
export function ServiceChipList({ items, max = 3 }: { items: { id: number; name: string }[]; max?: number }) {
  const { t } = useTranslation();
  if (!items.length) return <span className="muted">{"—"}</span>;
  const visible = items.slice(0, max);
  const overflow = items.slice(max);
  return (
    <span className="service-chip-list">
      {visible.map((s) => (
        <span key={s.id} className="service-chip">
          {toSentenceCase(s.name)}
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          className="service-chip service-chip-overflow"
          title={overflow.map((s) => toSentenceCase(s.name)).join(", ")}
        >
          {t("doctors.moreServices", { count: overflow.length })}
        </span>
      )}
    </span>
  );
}

interface ServicePickItem {
  id: number;
  simon: string;
  name: string;
  type: number;
  type_name: string;
}

/** Shared "pick from active services" checkbox list, used by both the
 * Doctors create/edit form (ADMIN) and the standalone "manage services"
 * action (ADMIN/CENTER_MANAGER) -- one implementation of the picker, two
 * entry points, since those two roles reach it through different surfaces.
 *
 * Owns its own live search + type filter (client-side -- the services list
 * is already fully fetched, so no server round-trip is needed); filtering
 * only affects what's *displayed*, never `selected`, so a doctor's already-
 * chosen service is never silently dropped just because it scrolled out of
 * the current search/filter view. */
export function ServiceCheckboxList({
  services,
  selected,
  onChange,
}: {
  services: ServicePickItem[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const types = useMemo(() => {
    const seen = new Map<number, string>();
    services.forEach((s) => seen.set(s.type, s.type_name));
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (typeFilter && String(s.type) !== typeFilter) return false;
      if (!q) return true;
      return (
        s.simon.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.type_name.toLowerCase().includes(q)
      );
    });
  }, [services, search, typeFilter]);

  if (!services.length) return <p className="muted">{t("doctors.noServices")}</p>;
  return (
    <div>
      <div className="list-toolbar service-picker-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder={t("common.searchPlaceholder")} label={t("common.search")} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t("doctors.allServiceTypes")}</option>
          {types.map((ty) => (
            <option key={ty.id} value={ty.id}>
              {toSentenceCase(ty.name)}
            </option>
          ))}
        </select>
      </div>
      <div className="service-checkbox-list">
        {filtered.length === 0 && <p className="muted">{t("doctors.noServicesMatch")}</p>}
        {filtered.map((s) => (
          <label key={s.id} className="service-checkbox-row">
            <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
            <span className="service-checkbox-info">
              <span>
                {toSentenceCase(s.name)} <span className="service-checkbox-simon">#{s.simon}</span>
              </span>
              <span className="cell-sublabel">{toSentenceCase(s.type_name)}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Marker shown before a guardian's cedula (icon + tooltip + sr-only label,
 * same mechanism as MaskedValue's lock icon) so staff don't mistake it for
 * the patient's own document. Shared by Patients.tsx and Encounters.tsx,
 * wherever a minor's guardian cedula is displayed in place of their own. */
export function GuardianCedulaIcon() {
  const { t } = useTranslation();
  const label = t("patients.guardianCedulaTooltip");
  return (
    <span className="masked-value" title={label}>
      <svg
        className="masked-value-icon"
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="8" cy="5.5" r="2.5" />
        <path d="M3 13c0-2.7 2.2-4.75 5-4.75s5 2.05 5 4.75" />
      </svg>
      <span className="sr-only">{label}: </span>
    </span>
  );
}

export function SearchBar({ value, onChange, placeholder, label, onSubmit }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  onSubmit?: () => void;
}) {
  return (
    <div className="search-bar">
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />
    </div>
  );
}

export function SearchableSelect<T extends { id: number }>({
  value,
  onSelect,
  search,
  placeholder,
  getLabel,
  getSublabel,
  minChars = MIN_SEARCH_CHARS,
}: {
  value: T | null;
  onSelect: (item: T) => void;
  search: (query: string) => Promise<{ results: T[]; count: number }>;
  placeholder: string;
  getLabel: (item: T) => string;
  getSublabel?: (item: T) => string;
  minChars?: number;
}) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  // Total matches on the server, not just this page -- lets the dropdown
  // say "showing 20 of 57" instead of silently truncating with no
  // indication more results exist (the bug this was added to fix).
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const below = query.trim().length > 0 && query.trim().length < minChars;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim();
        if (q.length >= minChars || q.length === 0) {
          const { results, count } = await search(q);
          if (!cancelled) {
            setItems(results);
            setTotalCount(count);
          }
        } else {
          if (!cancelled) {
            setItems([]);
            setTotalCount(0);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, query, search, minChars]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditing(false);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function startEdit() {
    setEditing(true);
    setOpen(true);
    setQuery("");
  }

  function pick(item: T) {
    onSelect(item);
    setEditing(false);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="searchable-select" ref={wrapRef}>
      {!editing && value ? (
        <button type="button" className="searchable-select-trigger" onClick={startEdit}>
          <span className="searchable-select-value">
            <span className="searchable-select-label">{getLabel(value)}</span>
            {getSublabel && (
              <span className="searchable-select-sublabel">{getSublabel(value)}</span>
            )}
          </span>
          <span className="searchable-select-caret" aria-hidden="true">
            ▾
          </span>
        </button>
      ) : (
        <div className="searchable-select-input-wrap">
          <input
            className="searchable-select-input"
            autoFocus
            value={query}
            placeholder={value ? getLabel(value) : placeholder}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setEditing(true);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setOpen(false);
              }
            }}
          />
          {open && (
            <ul className="searchable-select-list">
              {below && <li className="muted">{t("common.minChars")}</li>}
              {!below && loading && <li className="muted">{t("common.loading")}</li>}
              {!below && !loading && items.length === 0 && (
                <li className="muted">{t("common.noData")}</li>
              )}
              {!below &&
                !loading &&
                items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="searchable-select-option"
                      onClick={() => pick(item)}
                    >
                      <span className="searchable-select-option-label">{getLabel(item)}</span>
                      {getSublabel && (
                        <span className="searchable-select-option-sublabel">
                          {getSublabel(item)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              {!below && !loading && totalCount > items.length && (
                <li className="muted">
                  {t("common.searchResultsLimited", { shown: items.length, count: totalCount })}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [50, 75, 100];

function pageItems(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...wanted]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const items: (number | "...")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) items.push("...");
    items.push(n);
    prev = n;
  }
  return items;
}

export function Pagination({ page, count, pageSize, onChange, onPageSizeChange }: {
  page: number;
  count: number;
  pageSize: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const { t } = useTranslation();
  const total = Math.ceil(count / pageSize);
  const multi = total > 1;
  return (
    <div className="pagination">
      {multi && (
        <nav className="pagination-nav" aria-label={t("pagination.nav")}>
          <button
            type="button"
            className="btn small"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            {t("pagination.prev")}
          </button>
          {pageItems(page, total).map((item, i) =>
            item === "..." ? (
              <span key={`ellipsis-${i}`} className="pagination-ellipsis">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`btn small${item === page ? " primary" : ""}`}
                disabled={item === page}
                onClick={() => onChange(item)}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            className="btn small"
            disabled={page >= total}
            onClick={() => onChange(page + 1)}
          >
            {t("pagination.next")}
          </button>
        </nav>
      )}
      <select
        className="pagination-size"
        aria-label={t("pagination.perPageLabel")}
        value={pageSize}
        onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {t("pagination.perPage", { size: n })}
          </option>
        ))}
      </select>
      {multi && (
        <span className="pagination-info">
          {t("pagination.pageOf", { page, total })} · {t("pagination.records", { count })}
        </span>
      )}
    </div>
  );
}

interface Toast {
  id: number;
  message: string;
}

let toastId = 0;

/** Mounted once in `Layout`. Every successful save/delete/upload across the
 * app fires a toast from `api.ts`'s `onMutationSuccess` subscription -- the
 * app previously gave zero positive confirmation that a mutating action
 * landed, so this is wired centrally rather than per page. */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return onMutationSuccess((message) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    });
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.message}
        </div>
      ))}
    </div>
  );
}

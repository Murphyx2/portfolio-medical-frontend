import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { MIN_SEARCH_CHARS } from "../hooks/useListControls";

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

export function FormModal({ title, onClose, onSubmit, children, submitLabel, error }: {
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  error?: string;
  children: ReactNode;
}) {
  const pressOnBackdrop = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const { t } = useTranslation();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const focusable = modal?.querySelector<HTMLElement>(
      "input, select, textarea, button, [href], [tabindex]:not([tabindex='-1'])"
    );
    (focusable ?? modal)?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

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
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressOnBackdrop.current && e.target === e.currentTarget && !submitting) {
          pressOnBackdrop.current = false;
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="modal"
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
      </div>
    </div>
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
  header: string;
  render?: (row: T) => ReactNode;
  sortKey?: string;
}

export type SortDir = "asc" | "desc";

export function Table<T extends { id: number }>({
  columns,
  rows,
  onEdit,
  onDelete,
  emptyLabel,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyLabel?: string;
  sortKey?: string | null;
  sortDir?: SortDir | null;
  onSort?: (key: string) => void;
}) {
  const { t } = useTranslation();
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
            {(onEdit || onDelete) && <th>{t("common.actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="muted">
                {emptyLabel ?? t("common.noData")}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : String((row as never)[c.key] ?? "")}</td>
              ))}
              {(onEdit || onDelete) && (
                <td className="row-actions">
                  {onEdit && (
                    <button className="btn small" onClick={() => onEdit(row)}>
                      {t("common.edit")}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="btn small danger"
                      onClick={() => window.confirm(t("common.deleteConfirm")) && onDelete(row)}
                    >
                      {t("common.delete")}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
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
  search: (query: string) => Promise<T[]>;
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
          const results = await search(q);
          if (!cancelled) setItems(results);
        } else {
          if (!cancelled) setItems([]);
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

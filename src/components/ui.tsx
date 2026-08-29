import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { MIN_SEARCH_CHARS } from "../hooks/useListControls";
import type { SortDir } from "../hooks/useListControls";
export type { SortDir };
import { ApiError, onMutationSuccess } from "../services/api";
import { flattenError } from "../utils/errors";

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

export function Page({ title, actions, children, card }: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Wraps the head + children in the shared list-page card surface
   * (white, bordered, radius) used by every list module. Dashboard and
   * other non-list pages omit this and keep the plain bare layout. */
  card?: boolean;
}) {
  const head = (
    <div className="page-head">
      <h2>{title}</h2>
      {actions}
    </div>
  );
  if (card) {
    return (
      <section>
        <div className="list-page-card">
          {head}
          {children}
        </div>
      </section>
    );
  }
  return (
    <section>
      {head}
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
export function Dialog({ title, onClose, children, wide, xwide, preventClose, confirmBeforeClose }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  xwide?: boolean;
  preventClose?: boolean;
  /** When true, backdrop-click and Escape no longer close immediately --
   * they raise a "discard changes?" ConfirmDialog first (the explicit
   * Cancel/Close button, driven separately by the caller, is unaffected).
   * `FormModal` sets this once the form has any unsaved input. */
  confirmBeforeClose?: boolean;
}) {
  const { t } = useTranslation();
  const pressOnBackdrop = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [confirmingExit, setConfirmingExit] = useState(false);

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
        if (confirmBeforeClose) setConfirmingExit(true);
        else onClose();
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
  }, [onClose, preventClose, confirmBeforeClose]);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressOnBackdrop.current && e.target === e.currentTarget && !preventClose) {
          pressOnBackdrop.current = false;
          if (confirmBeforeClose) setConfirmingExit(true);
          else onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={xwide ? "modal xwide" : wide ? "modal wide" : "modal"}
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
      {confirmingExit && (
        <ConfirmDialog
          title={t("common.discardChangesTitle")}
          message={t("common.discardChangesMessage")}
          confirmLabel={t("common.discardChanges")}
          danger
          onConfirm={() => {
            setConfirmingExit(false);
            onClose();
          }}
          onCancel={() => setConfirmingExit(false)}
        />
      )}
    </div>
  );
}

export function FormModal({ title, onClose, onSubmit, children, submitLabel, error, wide, xwide }: {
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  error?: string;
  wide?: boolean;
  xwide?: boolean;
  children: ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  // Set on the first change/input/click anywhere in `children` (not the
  // error banner or Cancel/Submit footer, which sit outside this tracked
  // region) -- an untouched form still closes immediately on backdrop-click
  // or Escape; one with any interaction asks for confirmation first. Cancel
  // stays an immediate, no-prompt exit regardless, since it's a deliberate
  // action rather than an accidental dismissal.
  const [dirty, setDirty] = useState(false);
  const { t } = useTranslation();

  function markDirty() {
    if (!dirty) setDirty(true);
  }

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
    <Dialog title={title} onClose={onClose} preventClose={submitting} confirmBeforeClose={dirty} wide={wide} xwide={xwide}>
      <form onSubmit={handleSubmit}>
        <div onChangeCapture={markDirty} onInputCapture={markDirty} onClickCapture={markDirty}>
          {children}
        </div>
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

export interface TabItem {
  key: string;
  label: string;
}

/**
 * WAI-ARIA tabs pattern (roving tabindex: only the active tab is in the tab
 * order, Left/Right/Home/End move focus+selection together) -- no existing
 * precedent in this codebase, first used by the Expediente modal. Renders
 * only the tablist strip; pair each tab with a `TabPanel` of the same
 * `idPrefix`/key rendered by the caller so panel content can be conditional
 * (e.g. only mounting the active tab's fields).
 */
export function Tabs({ items, active, onChange, idPrefix = "tab" }: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  idPrefix?: string;
}) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function selectAndFocus(key: string) {
    onChange(key);
    buttonRefs.current[key]?.focus();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    selectAndFocus(items[nextIndex].key);
  }

  return (
    <div className="tabs" role="tablist">
      {items.map((item, i) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            ref={(el) => {
              buttonRefs.current[item.key] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.key}`}
            aria-selected={isActive}
            aria-controls={`${idPrefix}-panel-${item.key}`}
            tabIndex={isActive ? 0 : -1}
            className={`tab${isActive ? " active" : ""}`}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Content panel paired with one `Tabs` tab -- unmounts (rather than just
 * hiding) inactive panels, since the Expediente modal's tabs hold live form
 * state that lives in the parent regardless of which panel is mounted. */
export function TabPanel({ tabKey, active, idPrefix = "tab", children }: {
  tabKey: string;
  active: string;
  idPrefix?: string;
  children: ReactNode;
}) {
  if (active !== tabKey) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tabKey}`}
      aria-labelledby={`${idPrefix}-tab-${tabKey}`}
      tabIndex={0}
      className="tab-panel"
    >
      {children}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  sortKey?: string;
  align?: "center" | "right";
}

export function Table<T extends { id: number }>({
  columns,
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
}: {
  columns: Column<T>[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void | Promise<void>;
  onRestore?: (row: T) => void | Promise<void>;
  /** Extra row-action content rendered ahead of Edit/Delete/Restore inside
   * the same Acciones cell (e.g. Records' "Nueva entrada" button), instead
   * of forcing callers to add their own standalone column. */
  extraActions?: (row: T) => ReactNode;
  isInactive?: (row: T) => boolean;
  /** Human-readable label for a row, interpolated into the delete/restore confirm message. Falls back to the row id. */
  getRowLabel?: (row: T) => string;
  emptyLabel?: string;
  sortKey?: string | null;
  sortDir?: SortDir | null;
  onSort?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const hasActions = Boolean(onEdit || onDelete || onRestore || extraActions);
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
                  className={c.align === "center" ? "col-center" : c.align === "right" ? "col-align-right" : undefined}
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
            {hasActions && <th scope="col" className="col-center col-actions">{t("common.actions")}</th>}
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
                <td className="col-center col-actions">
                  <RowActionsMenu
                    ariaLabel={getRowLabel?.(row) ?? String(row.id)}
                    primary={
                      <>
                        {extraActions?.(row)}
                        {onEdit && (
                          <button
                            className="btn small"
                            onClick={() => onEdit(row)}
                            aria-label={`${t("common.edit")} ${getRowLabel?.(row) ?? row.id}`}
                          >
                            {t("common.edit")}
                          </button>
                        )}
                      </>
                    }
                    items={[
                      ...(onDelete
                        ? [
                            {
                              key: "delete",
                              label: t("common.delete"),
                              danger: true,
                              onClick: () => setConfirming({ type: "delete", row }),
                            },
                          ]
                        : []),
                      ...(onRestore && isInactive?.(row)
                        ? [
                            {
                              key: "restore",
                              label: t("common.restore"),
                              onClick: () => setConfirming({ type: "restore", row }),
                            },
                          ]
                        : []),
                    ]}
                  />
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
  onClear,
  search,
  placeholder,
  getLabel,
  getSublabel,
  minChars = MIN_SEARCH_CHARS,
  autoFocus = true,
}: {
  value: T | null;
  onSelect: (item: T) => void;
  /** When provided, a "×" clear button renders next to a filled value so
   * the selection can be reset to null without picking a replacement. */
  onClear?: () => void;
  search: (query: string) => Promise<{ results: T[]; count: number }>;
  placeholder: string;
  getLabel: (item: T) => string;
  getSublabel?: (item: T) => string;
  minChars?: number;
  // Defaults to true (a lone empty field, e.g. Patient search, should grab
  // focus when its modal opens). Pass false when multiple empty instances
  // render together -- only one can hold real DOM focus, but every mounted
  // `autoFocus` input still fires its own onFocus, opening every field's
  // dropdown list at once (see Appointments.tsx's Doctor/Service fields).
  autoFocus?: boolean;
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
        <div className="searchable-select-filled">
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
          {onClear && (
            <button
              type="button"
              className="searchable-select-clear"
              aria-label={t("common.clear")}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div className="searchable-select-input-wrap">
          <input
            className="searchable-select-input"
            autoFocus={autoFocus}
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

export interface RowActionsMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  /** Renders in red -- for Eliminar/Desactivar/Cancelar/etc. */
  danger?: boolean;
  icon?: ReactNode;
}

/**
 * Shared "Editar + ⋯ Más" row-actions pattern: up to two always-visible
 * `primary` buttons, everything else collapsed into an overflow menu so a
 * row never grows past two buttons wide (list-pages redesign). Callers own
 * all permission logic -- this renders exactly the items it's given, it
 * never itself decides what's allowed. Outside-click/Escape-close mirrors
 * `SearchableSelect`'s existing pattern above.
 */
export function RowActionsMenu({ primary, items, ariaLabel }: {
  primary?: ReactNode;
  items: RowActionsMenuItem[];
  ariaLabel: string;
}) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPanelPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        wrapRef.current &&
        !wrapRef.current.contains(target) &&
        !(panelRef.current && panelRef.current.contains(target))
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      // A scroll anywhere (the table's own horizontal/vertical scroll
      // included) can leave the portaled panel's fixed position stale --
      // simplest correct behavior is to just close it, matching common
      // dropdown UX elsewhere. `capture: true` so this fires for scroll on
      // any scrollable ancestor, not just window itself.
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div className="row-actions">
      {primary}
      {items.length > 0 && (
        <div className="row-actions-menu" ref={wrapRef}>
          <button
            ref={triggerRef}
            type="button"
            className="row-actions-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t("common.more") + " " + ariaLabel}
            onClick={() => (open ? setOpen(false) : openMenu())}
          >
            ⋯
          </button>
          {open &&
            panelPos &&
            createPortal(
              <div
                ref={panelRef}
                className="row-actions-menu-panel"
                role="menu"
                style={{ top: panelPos.top, right: panelPos.right }}
              >
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className={`row-actions-menu-item${item.danger ? " danger" : ""}`}
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </div>
      )}
    </div>
  );
}

export const PAGE_SIZE_OPTIONS = [50, 75, 100];

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

export function Pagination({ page, count, pageSize, onChange, onPageSizeChange, layout = "full" }: {
  page: number;
  count: number;
  pageSize: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** "full" (default) renders nav + page-size select + info text, used
   * anywhere Pagination is the only pagination UI on the page. "nav-only"
   * renders just the prev/next/page-number nav -- used at the bottom of
   * ListPage, where the page-size select and result count already live in
   * the toolbar row so they aren't duplicated. */
  layout?: "full" | "nav-only";
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
      {layout === "full" && (
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
      )}
      {multi && (
        <span className="pagination-info">
          {layout === "full"
            ? `${t("pagination.pageOf", { page, total })} · ${t("pagination.records", { count })}`
            : t("pagination.pageOf", { page, total })}
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

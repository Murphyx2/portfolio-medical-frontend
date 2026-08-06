import { useRef } from "react";
import type { ReactNode } from "react";

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

export function FormModal({ title, onClose, onSubmit, children, submitLabel }: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  children: ReactNode;
}) {
  const pressOnBackdrop = useRef(false);
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressOnBackdrop.current && e.target === e.currentTarget) {
          pressOnBackdrop.current = false;
          onClose();
        }
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {children}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {submitLabel}
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
}

export function Table<T extends { id: number }>({
  columns,
  rows,
  onEdit,
  onDelete,
  emptyLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyLabel?: string;
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key}>{c.header}</th>
          ))}
          {(onEdit || onDelete) && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="muted">
              {emptyLabel ?? "No data"}
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
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    className="btn small danger"
                    onClick={() => window.confirm("Delete this record?") && onDelete(row)}
                  >
                    Delete
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Spinner() {
  return <div className="page-center muted">Loading...</div>;
}

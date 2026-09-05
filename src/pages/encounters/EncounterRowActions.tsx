import { useTranslation } from "react-i18next";

import { RowActionsMenu, type RowActionsMenuItem } from "../../components/ui";
import type { Encounter } from "../../services/types";

export type EncounterConfirmAction = "admit" | "cancel" | "complete" | "delete" | "restore";

/** Row-action button cluster for the Encounters list's `actions` column:
 * edit/admit/complete/cancel/"Open Record"/delete/restore, each individually
 * gated by role capability (`canManage`/`canDelete`/`isAdmin`, from F2's
 * `can()`) and by the row's own status (`canEditRow`). */
export function EncounterRowActions({
  row,
  canManage,
  canDelete,
  isAdmin,
  canViewRecords,
  onEdit,
  onConfirm,
  onOpenRecord,
}: {
  row: Encounter;
  canManage: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  canViewRecords: boolean;
  onEdit: (row: Encounter) => void;
  onConfirm: (type: EncounterConfirmAction, row: Encounter) => void;
  onOpenRecord: (row: Encounter) => void;
}) {
  const { t } = useTranslation();

  const canEditRow =
    canManage &&
    row.status !== "COMPLETED" &&
    row.status !== "CANCELLED" &&
    !row.services.some((s) => s.status === "COMPLETED");

  // Editar and the status-transition action (Admitir for DRAFT, Completar
  // for ACTIVE) are both always-visible primaries when they apply -- never
  // more than 2 render together for a given status. Abrir expediente is a
  // visible primary only when Editar doesn't apply (mainly COMPLETED/
  // CANCELLED rows); when Editar IS shown, Abrir expediente is still
  // reachable, just relocated into ⋯ instead of dropped.
  const showAdmit = canManage && row.status === "DRAFT";
  const showComplete = canManage && row.status === "ACTIVE";
  const showOpenRecordPrimary = canViewRecords && !canEditRow;

  const items: RowActionsMenuItem[] = [
    ...(canViewRecords && canEditRow
      ? [{ key: "openRecord", label: t("encounters.openRecord"), onClick: () => onOpenRecord(row) }]
      : []),
    ...(canManage && (row.status === "DRAFT" || row.status === "ACTIVE")
      ? [{ key: "cancel", label: t("encounters.cancel"), danger: true, onClick: () => onConfirm("cancel", row) }]
      : []),
    ...(canDelete && row.active
      ? [{ key: "delete", label: t("common.delete"), danger: true, onClick: () => onConfirm("delete", row) }]
      : []),
    ...(isAdmin && !row.active
      ? [{ key: "restore", label: t("common.restore"), onClick: () => onConfirm("restore", row) }]
      : []),
  ];

  return (
    <RowActionsMenu
      ariaLabel={String(row.id)}
      primary={
        <>
          {canEditRow && (
            <button className="btn small ghost" onClick={() => onEdit(row)}>{t("common.edit")}</button>
          )}
          {showAdmit && (
            <button className="btn small" onClick={() => onConfirm("admit", row)}>{t("encounters.admit")}</button>
          )}
          {showComplete && (
            <button className="btn small" onClick={() => onConfirm("complete", row)}>{t("encounters.complete")}</button>
          )}
          {showOpenRecordPrimary && (
            <button className="btn small ghost" onClick={() => onOpenRecord(row)}>
              {t("encounters.openRecord")}
            </button>
          )}
        </>
      }
      items={items}
    />
  );
}

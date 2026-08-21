import { useTranslation } from "react-i18next";

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
  onEdit,
  onConfirm,
  onOpenRecord,
}: {
  row: Encounter;
  canManage: boolean;
  canDelete: boolean;
  isAdmin: boolean;
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

  return (
    <div className="row-actions">
      {canEditRow && (
        <button className="btn small ghost" onClick={() => onEdit(row)}>{t("common.edit")}</button>
      )}
      {canManage && row.status === "DRAFT" && (
        <button className="btn small" onClick={() => onConfirm("admit", row)}>{t("encounters.admit")}</button>
      )}
      {canManage && row.status === "ACTIVE" && (
        <button className="btn small" onClick={() => onConfirm("complete", row)}>{t("encounters.complete")}</button>
      )}
      {canManage && (row.status === "DRAFT" || row.status === "ACTIVE") && (
        <button className="btn small danger" onClick={() => onConfirm("cancel", row)}>{t("encounters.cancel")}</button>
      )}
      <button className="btn small ghost" onClick={() => onOpenRecord(row)}>
        {t("encounters.openRecord")}
      </button>
      {canDelete && row.active && (
        <button className="btn small danger" onClick={() => onConfirm("delete", row)}>{t("common.delete")}</button>
      )}
      {isAdmin && !row.active && (
        <button className="btn small" onClick={() => onConfirm("restore", row)}>{t("common.restore")}</button>
      )}
    </div>
  );
}

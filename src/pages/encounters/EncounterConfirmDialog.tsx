import { useTranslation } from "react-i18next";

import { ConfirmDialog, Field } from "../../components/ui";
import type { useEncounterConfirmAction } from "./useEncounterConfirmAction";

/** Presentational half of the confirm-action state machine: renders the
 * `ConfirmDialog` (and, for "cancel", its reason field) driven entirely by
 * `useEncounterConfirmAction`'s state -- including switching its copy to the
 * "admit anyway?" prompt while `conflictPrompt` is set. */
export function EncounterConfirmDialog({
  state,
}: {
  state: ReturnType<typeof useEncounterConfirmAction>;
}) {
  const { t } = useTranslation();
  const { confirming, confirmCopy, conflictPrompt, cancelReason, setCancelReason, actionError, actionPending, runConfirmedAction, closeConfirm } = state;

  if (!confirming || !confirmCopy) return null;

  return (
    <ConfirmDialog
      title={confirmCopy.title}
      message={conflictPrompt ? t("encounters.activeConflictConfirm") : confirmCopy.message}
      confirmLabel={conflictPrompt ? t("encounters.admitAnyway") : confirmCopy.confirmLabel}
      danger={confirmCopy.danger}
      error={actionError}
      pending={actionPending}
      onConfirm={runConfirmedAction}
      onCancel={closeConfirm}
    >
      {confirming.type === "cancel" && (
        <Field label={t("encounters.cancelReason")}>
          <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </Field>
      )}
    </ConfirmDialog>
  );
}

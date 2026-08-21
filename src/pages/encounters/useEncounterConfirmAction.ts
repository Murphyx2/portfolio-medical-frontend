import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, ApiError } from "../../services/api";
import type { Encounter } from "../../services/types";
import { flattenError } from "../../utils/errors";
import type { EncounterConfirmAction } from "./EncounterRowActions";

/**
 * The Encounters list's 5-way confirm-action state machine: admit / cancel /
 * complete / delete / restore, all funneled through one `ConfirmDialog`.
 * Includes the admit-conflict-retry special case -- on a DRAFT encounter's
 * admit attempt coming back with `ACTIVE_ENCOUNTER_EXISTS` (the patient
 * already has another active encounter today), the same dialog switches to
 * an "admit anyway?" prompt and the next confirm click retries with
 * `override_conflict: true` instead of surfacing it as a hard error.
 *
 * Kept byte-identical to the pre-extraction inline implementation -- this is
 * the single riskiest piece of F3's extraction.
 */
export function useEncounterConfirmAction(load: () => void) {
  const { t } = useTranslation();

  const [confirming, setConfirming] = useState<{ type: EncounterConfirmAction; row: Encounter } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  // True once an admit attempt has come back with ACTIVE_ENCOUNTER_EXISTS --
  // the same ConfirmDialog switches to an "admit anyway?" prompt so the next
  // confirm click retries with override_conflict:true.
  const [conflictPrompt, setConflictPrompt] = useState(false);

  function openConfirm(type: EncounterConfirmAction, row: Encounter) {
    setConfirming({ type, row });
  }

  function closeConfirm() {
    setConfirming(null);
    setCancelReason("");
    setActionError("");
    setConflictPrompt(false);
  }

  async function runConfirmedAction() {
    if (!confirming) return;
    const { type, row } = confirming;
    setActionPending(true);
    setActionError("");
    try {
      if (type === "delete") {
        await api.delete(`/encounters/${row.id}/`);
      } else if (type === "cancel") {
        await api.post(`/encounters/${row.id}/cancel/`, { reason: cancelReason });
      } else if (type === "admit") {
        await api.post(`/encounters/${row.id}/admit/`, conflictPrompt ? { override_conflict: true } : {});
      } else {
        await api.post(`/encounters/${row.id}/${type}/`, {});
      }
      setConfirming(null);
      setCancelReason("");
      setConflictPrompt(false);
      load();
    } catch (err) {
      const message = err instanceof ApiError ? flattenError(err.message) : String(err);
      // The admit action returns this specific message when the patient
      // already has another active encounter today (code
      // ACTIVE_ENCOUNTER_EXISTS) -- offer to override instead of just
      // showing the error, since it's a soft warning, not a hard block.
      if (type === "admit" && !conflictPrompt && message.includes("already has an active encounter")) {
        setConflictPrompt(true);
      } else {
        setActionError(message);
      }
    } finally {
      setActionPending(false);
    }
  }

  const confirmCopy = confirming
    ? (() => {
        const { type, row } = confirming;
        const patient = row.patient_info.full_name;
        switch (type) {
          case "admit":
            return { title: t("encounters.admit"), message: t("encounters.admitConfirm", { patient }), confirmLabel: t("encounters.admit"), danger: false };
          case "cancel":
            return { title: t("encounters.cancel"), message: t("encounters.cancelConfirm", { patient }), confirmLabel: t("encounters.cancel"), danger: true };
          case "complete":
            return { title: t("encounters.complete"), message: t("encounters.completeConfirm", { patient }), confirmLabel: t("encounters.complete"), danger: false };
          case "delete":
            return { title: t("common.delete"), message: t("common.deleteConfirmNamed", { name: patient }), confirmLabel: t("common.delete"), danger: true };
          case "restore":
            return { title: t("common.restore"), message: t("common.restoreConfirmNamed", { name: patient }), confirmLabel: t("common.restore"), danger: false };
        }
      })()
    : null;

  return {
    confirming,
    cancelReason,
    setCancelReason,
    actionError,
    actionPending,
    conflictPrompt,
    confirmCopy,
    openConfirm,
    closeConfirm,
    runConfirmedAction,
  };
}

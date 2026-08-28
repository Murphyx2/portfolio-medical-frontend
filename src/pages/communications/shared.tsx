import { HardHat } from "lucide-react";
import type { TFunction } from "i18next";

import type { CommunicationsDeliveryStatus, CommunicationsKind, CommunicationsMessageStatus } from "../../services/types";

/** Small shared bits reused by Communications.tsx / ComposeMessage.tsx /
 * CommunicationsTemplates.tsx / CommunicationsSettingsPage.tsx -- kind/status
 * label lookups and a plain badge, mirroring the `.badge`/status-* classes
 * already used for Appointment/Encounter status pills (src/index.css). */

/** Shown at the top of every Comunicaciones page while the module is still
 * being hardened post-launch (see infra/PROGRESS.md) -- remove once the
 * module has had a full production soak (delivery-webhook wiring, live
 * WhatsApp send verification, etc). */
export function UnderConstructionBanner({ t }: { t: TFunction }) {
  return (
    <div className="under-construction-banner" role="status">
      <HardHat size={16} aria-hidden="true" />
      <span>{t("communications.underConstruction")}</span>
    </div>
  );
}

export function kindLabel(t: TFunction, kind: CommunicationsKind): string {
  return t(`communications.kind.${kind}` as never, { defaultValue: kind });
}

const DANGER_STATUSES = new Set(["FAILED", "CANCELLED", "UNDELIVERABLE", "OPTED_OUT"]);
const WARNING_STATUSES = new Set(["PARTIAL", "QUEUED", "SENDING"]);

export function StatusBadge({
  status,
  t,
}: {
  status: CommunicationsMessageStatus | CommunicationsDeliveryStatus;
  t: TFunction;
}) {
  const cls = DANGER_STATUSES.has(status)
    ? "badge status-cancelled"
    : WARNING_STATUSES.has(status)
      ? "badge settings-readonly-badge"
      : "badge";
  return (
    <span className={cls}>{t(`communications.status.${status}` as never, { defaultValue: status })}</span>
  );
}

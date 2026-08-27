import { useTranslation } from "react-i18next";

import type { RecordEntry } from "../../services/types";
import { formatDateTime } from "../../utils/date";

function vitalsSummaryLine(e: RecordEntry, t: (key: string) => string): string {
  const parts: string[] = [];
  if (e.ta_systolic != null && e.ta_diastolic != null) parts.push(`${t("records.ta")} ${e.ta_systolic}/${e.ta_diastolic} mmHg`);
  if (e.fc != null) parts.push(`${t("records.fc")} ${e.fc} lpm`);
  if (e.fr != null) parts.push(`${t("records.fr")} ${e.fr} rpm`);
  if (e.weight_lb) parts.push(`${t("records.weight")} ${e.weight_lb} lb`);
  if (e.height_cm) parts.push(`${t("records.height")} ${e.height_cm} cm`);
  if (e.talla_cm) parts.push(`${t("records.talla")} ${e.talla_cm} cm`);
  if (e.temperature_c) parts.push(`${t("records.temperature")} ${e.temperature_c} °C`);
  if (e.glucose != null) parts.push(`${t("records.glucose")} ${e.glucose} mg/dL`);
  if (e.imc) parts.push(`IMC ${e.imc}`);
  return parts.join(" · ");
}

/** Append-only Historial tab (spec §12): completed entries newest first,
 * each card showing author + timestamp, that visit's non-empty vitals, an
 * AP-change summary from the frozen snapshot, and Dx/Tx/Observaciones.
 * "Editar última entrada" is rendered only on the newest card, by the
 * caller (RecordFormModal owns the edit-target state machine). */
export function RecordHistoryList({
  entries,
  canEditLast,
  onEditLast,
}: {
  entries: RecordEntry[];
  canEditLast: boolean;
  onEditLast: () => void;
}) {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return <p className="muted">{t("records.historyEmpty")}</p>;
  }

  return (
    <div className="record-history-list">
      {entries.map((e, i) => {
        const isLatest = i === 0;
        const vitalsLine = vitalsSummaryLine(e, t);
        const apLabels = [...e.personal_ap_snapshot, ...e.family_ap_snapshot].map((s) => s.label);
        return (
          <div className={`record-history-card${isLatest ? " latest" : ""}`} key={e.id}>
            <div className="record-history-meta">
              <span>
                {e.author_name} · {e.completed_at ? formatDateTime(e.completed_at) : "—"}
              </span>
              {isLatest && canEditLast && (
                <button type="button" className="btn ghost small" onClick={onEditLast}>
                  {t("records.editLastEntry")}
                </button>
              )}
            </div>
            <div className="record-history-body">
              {vitalsLine && <div className="record-history-vitals">{vitalsLine}</div>}
              {apLabels.length > 0 && (
                <div className="record-history-vitals">
                  {t("records.apChangeSummary")}: {apLabels.join(", ")}
                </div>
              )}
              {e.dx && <div><b>{t("records.dx")}:</b> {e.dx}</div>}
              {e.tx && <div><b>{t("records.tx")}:</b> {e.tx}</div>}
              {e.observaciones && <div><b>{t("records.observaciones")}:</b> {e.observaciones}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

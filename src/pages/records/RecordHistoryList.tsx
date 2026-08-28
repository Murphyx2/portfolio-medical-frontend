import { useTranslation } from "react-i18next";

import type { RecordEntry } from "../../services/types";
import { formatDateTime } from "../../utils/date";

type TFn = ReturnType<typeof useTranslation>["t"];

function vitalsSummaryLine(e: RecordEntry, t: TFn): string {
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

function cap(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase());
}

/** One line per completed card listing only recorded (non-no_registrado)
 * habits, reading from the entry's own frozen `habits` JSON -- not
 * MedicalRecord.habits_snapshot, which is the living/current cache, not
 * this historical entry's record (spec §8). */
function habitsSummaryLine(e: RecordEntry, t: TFn): string {
  const h = e.habits;
  if (!h) return "";
  const parts: string[] = [];

  const substance = (key: "tabaco" | "alcohol" | "cafe" | "vapeo" | "psicoactivas", labelKey: string, extra?: (v: any) => string) => {
    const v = h[key] as { status?: string } | undefined;
    if (!v || !v.status || v.status === "no_registrado") return;
    let s = `${t(`records.${labelKey}`)} ${t(`records.habitStatus${cap(v.status)}`)}`;
    if (extra) {
      const e2 = extra(v);
      if (e2) s += ` ${e2}`;
    }
    parts.push(s);
  };

  substance("tabaco", "habitTabaco", (v) => {
    const bits: string[] = [];
    if (v.cantidad_dia) bits.push(`${v.cantidad_dia} ${t("records.habitCigDia")}`);
    if (v.cantidad_dia && v.tiempo_anios) {
      const py = ((v.cantidad_dia / 20) * v.tiempo_anios).toFixed(1);
      bits.push(`(${t("records.packYearsBadge", { value: py })})`);
    }
    return bits.join(" ");
  });
  substance("alcohol", "habitAlcohol", (v) => (v.ud_semana ? `${v.ud_semana} ${t("records.habitUdSemana")}` : ""));
  substance("cafe", "habitCafe", (v) => (v.tazas_dia ? `${v.tazas_dia} ${t("records.habitTazasDia")}` : ""));
  substance("vapeo", "habitVapeo");
  substance("psicoactivas", "habitPsicoactivas");

  const actividad = h.actividad_fisica;
  if (actividad?.status && actividad.status !== "no_registrado") {
    parts.push(`${t("records.habitActividadFisica")} ${t(`records.habitStatus${cap(actividad.status)}`)}`);
  }
  const sueno = h.sueno;
  if (sueno?.status && sueno.status !== "no_registrado") {
    parts.push(`${t("records.habitSueno")} ${t(`records.habitStatus${cap(sueno.status)}`)}`);
  }
  if (h.patron_alimentario?.tags?.length) {
    parts.push(`${t("records.habitPatronAlimentario")}: ${h.patron_alimentario.tags.join(", ")}`);
  }
  if (h.otros?.length) {
    parts.push(h.otros.map((o) => o.name).join(", "));
  }

  return parts.length ? `${t("records.habitsChangeSummary")}: ${parts.join(" · ")}` : "";
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
        const habitsLine = habitsSummaryLine(e, t);
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
              {habitsLine && <div className="record-history-vitals">{habitsLine}</div>}
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

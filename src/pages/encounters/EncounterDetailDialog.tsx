import { useTranslation } from "react-i18next";

import { Dialog, MaskedValue } from "../../components/ui";
import type { Encounter } from "../../services/types";
import { toSentenceCase } from "../../utils/text";
import { GuardianAwareCedula } from "./guardianCedula";

const statusLabelKey = (s: string) => `encounters.status${s[0]}${s.slice(1).toLowerCase()}`;
const priorityLabelKey = (p: string) => `encounters.priority${p[0]}${p.slice(1).toLowerCase()}`;

/** Read-only "full admission details" dialog opened by clicking a row's
 * patient name or cedula in the list. */
export function EncounterDetailDialog({ detail, onClose }: { detail: Encounter; onClose: () => void }) {
  const { t } = useTranslation();
  const statusLabel = (s: string) => t(statusLabelKey(s));
  const priorityLabel = (p: string) => t(priorityLabelKey(p));

  return (
    <Dialog
      title={
        <>
          {detail.encounter_number ?? t("encounters.title")} · <MaskedValue value={detail.patient_info.full_name} />
        </>
      }
      onClose={onClose}
      wide
    >
      <div className="encounter-detail-badges">
        <span className={`badge status-${detail.status.toLowerCase()}`}>{statusLabel(detail.status)}</span>
        <span className={`badge status-${detail.priority.toLowerCase()}`}>{priorityLabel(detail.priority)}</span>
      </div>

      <div className="form-columns">
        <div>
          <h4>{t("encounters.sectionPatient")}</h4>
          <div className="kv-grid">
            <div><b>{t("patients.age")}:</b> {detail.patient_info.age ?? "—"}</div>
            <div><b>{t("patients.gender")}:</b> {detail.patient_info.gender || "—"}</div>
            <div>
              <b>{t("patients.cedula")}:</b>{" "}
              <GuardianAwareCedula info={detail.patient_info} />
            </div>
            <div><b>{t("patients.ars")}:</b> {detail.patient_info.ars_name ?? "—"}</div>
            {detail.patient_info.allergies && (
              <div className="encounter-alert"><b>{t("patients.allergies")}:</b> <MaskedValue value={detail.patient_info.allergies} /></div>
            )}
            {detail.patient_info.critical_conditions && (
              <div className="encounter-alert"><b>{t("patients.criticalConditions")}:</b> <MaskedValue value={detail.patient_info.critical_conditions} /></div>
            )}
          </div>
        </div>
        <div>
          <h4>{t("encounters.sectionAdmission")}</h4>
          <div className="kv-grid">
            <div><b>{t("encounters.doctor")}:</b> {detail.doctor_info?.full_name ?? "—"}</div>
            <div><b>{t("encounters.type")}:</b> {toSentenceCase(detail.service_type_name)}</div>
            <div><b>{t("encounters.room")}:</b> {detail.room_name ?? "—"}</div>
            <div><b>{t("encounters.referringDoctor")}:</b> {detail.referring_doctor_name || "—"}</div>
            <div><b>{t("encounters.createdAt")}:</b> {new Date(detail.created_at).toLocaleString()}</div>
            {detail.admitted_at && <div><b>{t("encounters.admit")}:</b> {new Date(detail.admitted_at).toLocaleString()}</div>}
            {detail.completed_at && <div><b>{t("encounters.complete")}:</b> {new Date(detail.completed_at).toLocaleString()}</div>}
            {detail.cancel_reason && <div><b>{t("encounters.cancelReason")}:</b> {detail.cancel_reason}</div>}
          </div>
        </div>
      </div>

      <h4>{t("encounters.chiefComplaint")}</h4>
      <p>{detail.chief_complaint || "—"}</p>

      <h4>{t("encounters.sectionDiagnoses")}</h4>
      {detail.diagnoses.length === 0 ? (
        <p className="muted">{t("common.noData")}</p>
      ) : (
        <div className="log-list">
          {detail.diagnoses.map((d, i) => (
            <div key={d.id ?? i} className="log-entry">
              {d.description}
              {d.is_primary && <span className="badge status-active encounter-inline-badge">{t("encounters.primary")}</span>}
            </div>
          ))}
        </div>
      )}

      <h4>{t("encounters.sectionServices")}</h4>
      {detail.services.length === 0 ? (
        <p className="muted">{t("common.noData")}</p>
      ) : (
        <div className="log-list">
          {detail.services.map((s, i) => (
            <div key={s.id ?? i} className="log-entry">
              <b>{s.service_name}</b> × {s.quantity}{" "}
              <span className={`badge status-${s.status.toLowerCase()} encounter-inline-badge`}>{statusLabel(s.status)}</span>
              {s.doctor_name && <div className="muted">{s.doctor_name}</div>}
              {s.notes && <div className="muted">{s.notes}</div>}
            </div>
          ))}
        </div>
      )}

      <h4>{t("encounters.sectionCoverage")}</h4>
      <div className="kv-grid">
        <div><b>{t("patients.ars")}:</b> {detail.ars_name ?? "—"}</div>
        <div><b>{t("patients.arsProgram")}:</b> {detail.ars_program_name ?? "—"}</div>
        <div><b>{t("encounters.authorizationNumber")}:</b> {detail.authorization_number || "—"}</div>
      </div>

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>{t("common.close")}</button>
      </div>
    </Dialog>
  );
}

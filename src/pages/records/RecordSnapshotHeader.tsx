import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { MaskedValue } from "../../components/ui";
import type { MedicalRecord } from "../../services/types";
import { formatCedula } from "../../utils/cedula";
import { calculateAge, formatDate, formatDateTime } from "../../utils/date";

function withUnitAndDate(t: (k: string, o?: Record<string, unknown>) => string, value: string | null, unit: string, at: string | null): string {
  if (value == null || value === "") return t("records.noRecordShort");
  return `${value} ${unit} · ${at ? formatDateTime(at) : "—"}`;
}

/** Read-only snapshot header at the top of the Expediente modal (spec §7) --
 * patient identity, age/DOB, and each vital's last known value + the date it
 * was taken. Always sourced from the MedicalRecord's cached last_* fields,
 * never from whatever is currently being typed in the vitals form below. */
export function RecordSnapshotHeader({ record }: { record: MedicalRecord }) {
  const { t } = useTranslation();
  const patient = record.patient_info;
  const age = calculateAge(patient.birth_date);
  const isMinor = age != null && age < 18;

  const taText =
    record.last_ta_systolic != null && record.last_ta_diastolic != null
      ? `${record.last_ta_systolic}/${record.last_ta_diastolic} mmHg · ${record.last_ta_at ? formatDateTime(record.last_ta_at) : "—"}`
      : t("records.noRecordShort");

  return (
    <div className="record-snapshot">
      <h4 className="record-snapshot-name">
        <MaskedValue value={patient.full_name} />
      </h4>
      <div className="record-snapshot-grid">
        <SnapshotItem label={t("patients.nss")} value={<MaskedValue value={patient.nss} />} />
        <SnapshotItem label={t("patients.cedula")} value={<MaskedValue value={patient.cedula ? formatCedula(patient.cedula) : ""} />} />
        <SnapshotItem
          label={t("patients.gender")}
          value={patient.gender === "MALE" ? t("patients.genderMale") : patient.gender === "FEMALE" ? t("patients.genderFemale") : "—"}
        />
        <SnapshotItem label={t("records.age")} value={age != null ? String(age) : "—"} />
        <SnapshotItem label={t("patients.birthDate")} value={patient.birth_date ? formatDate(patient.birth_date) : "—"} />
        <SnapshotItem label={t("records.lastVisit")} value={record.last_visit_at ? formatDateTime(record.last_visit_at) : t("records.noRecordShort")} />
        <SnapshotItem label={t("records.lastHeight")} value={withUnitAndDate(t, record.last_height_cm, "cm", record.last_height_at)} />
        <SnapshotItem label={t("records.lastWeight")} value={withUnitAndDate(t, record.last_weight_lb, "lb", record.last_weight_at)} />
        <SnapshotItem label={t("records.lastTa")} value={taText} />
        <SnapshotItem label={t("records.lastFc")} value={withUnitAndDate(t, record.last_fc != null ? String(record.last_fc) : null, "lpm", record.last_fc_at)} />
        <SnapshotItem label={t("records.lastFr")} value={withUnitAndDate(t, record.last_fr != null ? String(record.last_fr) : null, "rpm", record.last_fr_at)} />
        <SnapshotItem label={t("records.lastImc")} value={withUnitAndDate(t, record.last_imc, "", record.last_imc_at)} />
        <SnapshotItem label={t("records.lastGlucose")} value={withUnitAndDate(t, record.last_glucose != null ? String(record.last_glucose) : null, "mg/dL", record.last_glucose_at)} />
      </div>

      {isMinor && (
        <div className="record-guardian-section">
          <h5 className="ap-category-name">{t("records.guardianSection")}</h5>
          {patient.guardians.length === 0 ? (
            <p className="muted">{t("records.noGuardianData")}</p>
          ) : (
            <div className="record-guardian-list">
              {patient.guardians.map((g, i) => (
                <div className="record-guardian-row" key={g.id ?? i}>
                  {g.first_name} {g.last_name} · {t("patients.cedula")} <MaskedValue value={formatCedula(g.cedula)} /> ·{" "}
                  {t("patients.nss")} <MaskedValue value={g.nss} /> · {t("records.guardianPhone")} {g.phone || "—"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SnapshotItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="record-snapshot-item">
      <span className="record-snapshot-label">{label}</span>
      <span className="record-snapshot-value">{value}</span>
    </div>
  );
}

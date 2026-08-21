import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Dialog, Field, MaskedValue } from "../../components/ui";
import { ApiError } from "../../services/api";
import type { ConsultationLog, MedicalRecord } from "../../services/types";
import { flattenError } from "../../utils/errors";

const EMPTY_LOG_FIELDS = { subjective: "", objective: "", assessment: "", plan: "", notes: "" };

export interface LogFields {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  notes: string;
}

/** Single dialog combining a record's core fields, its image gallery +
 * upload form, and its SOAP consultation-log list + new-log form -- kept as
 * one component (they're genuinely one dialog covering one record), but the
 * network calls themselves (`onUploadImage`/`onCreateLog`) are named
 * handlers owned by the page (source of truth for `detail`/`logs`, so it can
 * refetch and update them after a mutation) and merely invoked here; this
 * component only owns its own transient form-input state. */
export function RecordDetailWithLogs({
  detail,
  logs,
  onClose,
  canCreate,
  onUploadImage,
  onCreateLog,
}: {
  detail: MedicalRecord;
  logs: ConsultationLog[];
  onClose: () => void;
  canCreate: boolean;
  onUploadImage: (file: File, caption: string) => Promise<void>;
  onCreateLog: (fields: LogFields) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [imageError, setImageError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [logForm, setLogForm] = useState<LogFields>(EMPTY_LOG_FIELDS);
  const [logFormError, setLogFormError] = useState("");

  async function handleUpload() {
    if (!imageFile || uploading) return;
    setImageError("");
    setUploading(true);
    try {
      await onUploadImage(imageFile, caption);
      setImageFile(null);
      setCaption("");
    } catch (err) {
      setImageError(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateLog(e: FormEvent) {
    e.preventDefault();
    setLogFormError("");
    try {
      await onCreateLog(logForm);
      setLogForm(EMPTY_LOG_FIELDS);
    } catch (err) {
      setLogFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <Dialog
      title={
        <>
          {t("records.title")} · <MaskedValue value={detail.patient_info.full_name} />
        </>
      }
      onClose={onClose}
      wide
    >
      <p className="muted record-subtitle">{detail.title}</p>
      <div className="kv-grid">
        <div><b>{t("records.diagnosis")}:</b> {detail.diagnosis || "—"}</div>
        <div><b>{t("records.treatment")}:</b> {detail.treatment || "—"}</div>
        <div><b>{t("records.medicineAndDoses")}:</b> {detail.medicine_and_doses || "—"}</div>
        <div><b>{t("records.notes")}:</b> {detail.notes || "—"}</div>
      </div>

      <h4>{t("records.images")}</h4>
      {detail.images.length === 0 && <p className="muted">{t("common.noData")}</p>}
      <div className="image-grid">
        {detail.images.map((img) => (
          <a key={img.id} href={img.image_url ?? "#"} target="_blank" rel="noreferrer">
            <img src={img.image_url ?? ""} alt={img.caption} loading="lazy" />
          </a>
        ))}
      </div>
      {canCreate && (
        <div className="upload-row">
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} disabled={uploading} />
          <input
            placeholder={t("records.caption")}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={uploading}
          />
          <button className="btn primary" onClick={handleUpload} disabled={!imageFile || uploading}>
            {uploading ? t("common.saving") : t("records.uploadImage")}
          </button>
        </div>
      )}
      {imageError && (
        <p className="form-error" role="alert">
          {imageError}
        </p>
      )}

      <h4>{t("records.newLog")}</h4>
      {logs.length > 0 ? (
        <div className="log-list">
          {logs.map((log) => (
            <div key={log.id} className="log-entry">
              <b>{log.doctor_name} · {new Date(log.date).toLocaleString()}</b>
              <div><b>S:</b> {log.subjective}</div>
              <div><b>O:</b> {log.objective}</div>
              <div><b>A:</b> {log.assessment}</div>
              <div><b>P:</b> {log.plan}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{t("common.noData")}</p>
      )}
      {canCreate && (
        <form className="log-form" onSubmit={handleCreateLog}>
          <Field label={t("records.subjective")}>
            <textarea value={logForm.subjective} onChange={(e) => setLogForm({ ...logForm, subjective: e.target.value })} />
          </Field>
          <Field label={t("records.objective")}>
            <textarea value={logForm.objective} onChange={(e) => setLogForm({ ...logForm, objective: e.target.value })} />
          </Field>
          <Field label={t("records.assessment")}>
            <textarea value={logForm.assessment} onChange={(e) => setLogForm({ ...logForm, assessment: e.target.value })} />
          </Field>
          <Field label={t("records.plan")}>
            <textarea value={logForm.plan} onChange={(e) => setLogForm({ ...logForm, plan: e.target.value })} />
          </Field>
          {logFormError && (
            <p className="form-error" role="alert">
              {logFormError}
            </p>
          )}
          <button type="submit" className="btn primary">{t("common.save")}</button>
        </form>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>{t("common.close")}</button>
      </div>
    </Dialog>
  );
}

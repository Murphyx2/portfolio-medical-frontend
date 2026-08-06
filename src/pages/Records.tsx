import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, Spinner, Table, type Column } from "../components/ui";
import { api, upload } from "../services/api";
import type { ConsultationLog, MedicalRecord, Paginated, Patient } from "../services/types";
import { useAuth } from "../store/auth";

const PAGE_SIZE = 100;

const EMPTY_RECORD = {
  patient: 0,
  title: "",
  diagnosis: "",
  treatment: "",
  medicine_and_doses: "",
  notes: "",
};

const EMPTY_LOG = {
  patient: 0,
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  notes: "",
};

export function Records() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canCreate = user?.role === "DOCTOR" || user?.role === "NURSE" || user?.role === "ADMIN";
  const [rows, setRows] = useState<MedicalRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<MedicalRecord | null>(null);
  const pressOnBackdrop = useRef(false);
  const [logs, setLogs] = useState<ConsultationLog[]>([]);
  const [modal, setModal] = useState<"record" | "log" | null>(null);
  const [form, setForm] = useState(EMPTY_RECORD);
  const [logForm, setLogForm] = useState(EMPTY_LOG);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<MedicalRecord>>(`/medical-records/?ordering=-date&page=${page}&page_size=${PAGE_SIZE}`)
      .then((r) => {
        setRows(r.results);
        setCount(r.count);
        const total = Math.ceil(r.count / PAGE_SIZE);
        if (total > 0 && page > total) setPage(total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
    api.get<Paginated<Patient>>("/patients/?page_size=100").then((r) => setPatients(r.results)).catch(() => {});
  }, [load]);

  async function openDetail(rec: MedicalRecord) {
    const full = await api.get<MedicalRecord>(`/medical-records/${rec.id}/`);
    setDetail(full);
    api
      .get<Paginated<ConsultationLog>>(`/consultation-logs/?patient=${rec.patient}&page_size=20`)
      .then((r) => setLogs(r.results))
      .catch(() => setLogs([]));
    setLogForm({ ...EMPTY_LOG, patient: rec.patient });
  }

  async function createRecord() {
    await api.post("/medical-records/", {
      ...form,
      patient: Number(form.patient),
    });
    setModal(null);
    load();
  }

  async function createLog(e: FormEvent) {
    e.preventDefault();
    await api.post("/consultation-logs/", { ...logForm, patient: Number(logForm.patient) });
    setModal(null);
    if (detail) {
      api.get<Paginated<ConsultationLog>>(`/consultation-logs/?patient=${detail.patient}&page_size=20`).then((r) => setLogs(r.results));
    }
  }

  async function uploadImage() {
    if (!detail || !imageFile) return;
    const fd = new FormData();
    fd.append("record", String(detail.id));
    fd.append("image", imageFile);
    fd.append("caption", caption);
    await upload("/images/", fd);
    setImageFile(null);
    setCaption("");
    const full = await api.get<MedicalRecord>(`/medical-records/${detail.id}/`);
    setDetail(full);
  }

  const columns: Column<MedicalRecord>[] = [
    {
      key: "patient",
      header: t("records.patient"),
      render: (r) => (
        <button type="button" className="row-link" onClick={() => openDetail(r)}>
          {r.patient_info.full_name}
        </button>
      ),
    },
    { key: "title", header: t("records.title") },
    { key: "date", header: t("records.date"), render: (r) => new Date(r.date).toLocaleString() },
    { key: "created_by_name", header: t("records.doctor") },
  ];

  return (
    <Page
      title={t("records.title")}
      actions={
        canCreate && (
          <button
            className="btn primary"
            onClick={() => { setForm({ ...EMPTY_RECORD, patient: patients[0]?.id ?? 0 }); setModal("record"); }}
          >
            + {t("records.newRecord")}
          </button>
        )
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <>
          <Pagination page={page} count={count} pageSize={PAGE_SIZE} onChange={setPage} />
          <Table columns={columns} rows={rows} />
          <Pagination page={page} count={count} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}

      {detail && (
        <div
          className="modal-backdrop"
          onPointerDown={(e) => {
            pressOnBackdrop.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (pressOnBackdrop.current && e.target === e.currentTarget) {
              pressOnBackdrop.current = false;
              setDetail(null);
            }
          }}
        >
          <div
            className="modal wide"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              pressOnBackdrop.current = false;
              e.stopPropagation();
            }}
          >
            <h3>
              {t("records.title")} · {detail.patient_info.full_name}
            </h3>
            <p className="muted record-subtitle">{detail.title}</p>
            <div className="kv-grid">
              <div><b>{t("records.diagnosis")}:</b> {detail.diagnosis || "—"}</div>
              <div><b>{t("records.treatment")}:</b> {detail.treatment || "—"}</div>
              <div><b>{t("records.medicineAndDoses")}:</b> {detail.medicine_and_doses || "—"}</div>
              <div><b>{t("records.notes")}:</b> {detail.notes || "—"}</div>
            </div>

            <h4>{t("records.images")}</h4>
            <div className="image-grid">
              {detail.images.map((img) => (
                <a key={img.id} href={img.image_url ?? "#"} target="_blank" rel="noreferrer">
                  <img src={img.image_url ?? ""} alt={img.caption} />
                </a>
              ))}
            </div>
            {canCreate && (
              <div className="upload-row">
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                <input placeholder={t("records.caption")} value={caption} onChange={(e) => setCaption(e.target.value)} />
                <button className="btn primary" onClick={uploadImage} disabled={!imageFile}>
                  {t("records.uploadImage")}
                </button>
              </div>
            )}

            <h4>{t("records.newLog")}</h4>
            {logs.length > 0 && (
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
            )}
            {canCreate && (
              <form className="log-form" onSubmit={createLog}>
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
                <button type="submit" className="btn primary">{t("common.save")}</button>
              </form>
            )}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "record" && (
        <FormModal
          title={t("records.newRecord")}
          onClose={() => setModal(null)}
          onSubmit={createRecord}
          submitLabel={t("common.save")}
        >
          <Field label={t("records.patient")}>
            <select value={form.patient} onChange={(e) => setForm({ ...form, patient: Number(e.target.value) })} required>
              <option value={0} disabled>—</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("records.title")}>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <Field label={t("records.diagnosis")}>
            <textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          </Field>
          <Field label={t("records.treatment")}>
            <textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} />
          </Field>
          <Field label={t("records.medicineAndDoses")}>
            <textarea value={form.medicine_and_doses} onChange={(e) => setForm({ ...form, medicine_and_doses: e.target.value })} />
          </Field>
          <Field label={t("records.notes")}>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

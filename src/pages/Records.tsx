import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Dialog, Field, FormModal, MaskedValue, Page, Pagination, SearchableSelect, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError, upload } from "../services/api";
import type { ConsultationLog, MedicalRecord, Paginated, Patient } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";

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

function formatCedula(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

function recordTitleFor(patient: Patient): string {
  return `${patient.full_name} — ${new Date().toLocaleDateString()}`;
}

export function Records() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canCreate = user?.role === "DOCTOR" || user?.role === "NURSE" || user?.role === "ADMIN";
  const isAdmin = user?.role === "ADMIN";
  const [showInactive, setShowInactive] = useState(false);
  const [rows, setRows] = useState<MedicalRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [detail, setDetail] = useState<MedicalRecord | null>(null);
  const [logs, setLogs] = useState<ConsultationLog[]>([]);
  const [modal, setModal] = useState<"record" | "log" | null>(null);
  const [form, setForm] = useState(EMPTY_RECORD);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [logForm, setLogForm] = useState(EMPTY_LOG);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [recordFormError, setRecordFormError] = useState("");
  const [logFormError, setLogFormError] = useState("");
  const [imageError, setImageError] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const {
    page,
    setPage,
    pageSize,
    count,
    setCount,
    search,
    setSearch,
    searchSubmit,
    sortKey,
    sortDir,
    handleSort,
    changePageSize,
    initialLoading,
    runList,
    query,
  } = useListControls({ key: "date", dir: "desc" });

  const qs = query({ include_inactive: showInactive ? "true" : "" });

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<MedicalRecord>>(`/medical-records/?${qs}`, { signal }))
      .then((r) => {
        if (!r) return;
        setRows(r.results);
        setCount(r.count);
        const total = Math.ceil(r.count / pageSize);
        if (total > 0 && page > total) setPage(total);
      })
      .catch(() => {});
  }, [qs, page, pageSize, setCount, setPage, runList]);

  useEffect(load, [load]);

  useEffect(() => {
    // Patient options for the "new record" picker: fetched once, not on
    // every page/sort/search change (unlike `load`, which re-runs then).
    api.get<Paginated<Patient>>("/patients/?page_size=100").then((r) => setPatients(r.results)).catch(() => {});
  }, []);

  async function openDetail(rec: MedicalRecord) {
    setLogForm({ ...EMPTY_LOG, patient: rec.patient });
    setLogFormError("");
    setImageError("");
    setOpeningId(rec.id);
    try {
      // Independent requests (neither depends on the other's result): fire
      // them concurrently instead of waiting for the record detail before
      // starting the logs fetch.
      const [full, logsResult] = await Promise.all([
        api.get<MedicalRecord>(`/medical-records/${rec.id}/`),
        api
          .get<Paginated<ConsultationLog>>(`/consultation-logs/?patient=${rec.patient}&page_size=20`)
          .catch(() => ({ results: [] as ConsultationLog[] })),
      ]);
      setDetail(full);
      setLogs(logsResult.results);
    } finally {
      setOpeningId(null);
    }
  }

  async function createRecord() {
    setRecordFormError("");
    try {
      await api.post("/medical-records/", {
        ...form,
        patient: Number(form.patient),
      });
      setModal(null);
      load();
    } catch (err) {
      setRecordFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function createLog(e: FormEvent) {
    e.preventDefault();
    setLogFormError("");
    try {
      await api.post("/consultation-logs/", { ...logForm, patient: Number(logForm.patient) });
      setLogForm({ ...EMPTY_LOG, patient: logForm.patient });
      if (detail) {
        const r = await api.get<Paginated<ConsultationLog>>(`/consultation-logs/?patient=${detail.patient}&page_size=20`);
        setLogs(r.results);
      }
    } catch (err) {
      setLogFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function uploadImage() {
    if (!detail || !imageFile || uploading) return;
    setImageError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("record", String(detail.id));
      fd.append("image", imageFile);
      fd.append("caption", caption);
      await upload("/images/", fd);
      setImageFile(null);
      setCaption("");
      const full = await api.get<MedicalRecord>(`/medical-records/${detail.id}/`);
      setDetail(full);
    } catch (err) {
      setImageError(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function removeRecord(rec: MedicalRecord) {
    await api.delete(`/medical-records/${rec.id}/`);
    load();
  }

  async function restoreRecord(rec: MedicalRecord) {
    await api.post(`/medical-records/${rec.id}/restore/`, {});
    load();
  }

  const openDetailLink = (rec: MedicalRecord) => (
    <button type="button" className="row-link" disabled={openingId === rec.id} onClick={() => openDetail(rec)}>
      {openingId === rec.id ? t("common.loading") : <MaskedValue value={rec.patient_info.full_name} />}
    </button>
  );

  const columns: Column<MedicalRecord>[] = [
    {
      key: "full_name",
      header: t("records.patient"),
      sortKey: "patient__search_name",
      render: (r) => openDetailLink(r),
    },
    {
      key: "cedula",
      header: t("patients.cedula"),
      render: (r) => (
        <button type="button" className="row-link" disabled={openingId === r.id} onClick={() => openDetail(r)}>
          <MaskedValue
            value={
              r.patient_info.cedula
                ? r.patient_info.cedula.includes("•")
                  ? r.patient_info.cedula
                  : formatCedula(r.patient_info.cedula)
                : ""
            }
          />
        </button>
      ),
    },
    {
      key: "nss",
      header: t("patients.nss"),
      render: (r) => (
        <button type="button" className="row-link" disabled={openingId === r.id} onClick={() => openDetail(r)}>
          <MaskedValue value={r.patient_info.nss} />
        </button>
      ),
    },
    { key: "title", header: t("records.recordTitle"), sortKey: "title" },
    { key: "date", header: t("records.date"), sortKey: "date", render: (r) => new Date(r.date).toLocaleString() },
    { key: "created_by_name", header: t("records.doctor"), sortKey: "created_by__username" },
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (r: MedicalRecord) => (
              <span className={`badge status-${r.active ? "active" : "inactive"}`}>
                {r.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<MedicalRecord>,
        ]
      : []),
  ];

  function openRecordForm() {
    const initial = patients[0] ?? null;
    setSelectedPatient(initial);
    setForm({
      ...EMPTY_RECORD,
      patient: initial?.id ?? 0,
      title: initial ? recordTitleFor(initial) : "",
    });
    setRecordFormError("");
    setModal("record");
  }

  function pickPatient(p: Patient) {
    setSelectedPatient(p);
    setForm({ ...form, patient: p.id, title: recordTitleFor(p) });
  }

  const searchPatients = useCallback((q: string): Promise<Patient[]> => {
    return api
      .get<Paginated<Patient>>(`/patients/?page_size=20${q ? `&search=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.results)
      .catch(() => []);
  }, []);

  return (
    <Page
      title={t("records.title")}
      actions={
        canCreate && (
          <button className="btn primary" onClick={openRecordForm}>
            + {t("records.newRecord")}
          </button>
        )
      }
    >
      {initialLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="list-toolbar">
            <SearchBar
              value={search}
              onChange={setSearch}
              onSubmit={searchSubmit}
              placeholder={t("common.searchPlaceholder")}
              label={t("common.search")}
            />
            {isAdmin && (
              <label className="show-inactive-toggle">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                {t("common.showInactive")}
              </label>
            )}
          </div>
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          <Table
            columns={columns}
            rows={rows}
            onDelete={canCreate ? removeRecord : undefined}
            onRestore={isAdmin ? restoreRecord : undefined}
            getRowLabel={(r) => r.patient_info.full_name}
            isInactive={(r) => !r.active}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

      {detail && (
        <Dialog
          title={
            <>
              {t("records.title")} · <MaskedValue value={detail.patient_info.full_name} />
            </>
          }
          onClose={() => setDetail(null)}
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
              <button className="btn primary" onClick={uploadImage} disabled={!imageFile || uploading}>
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
              {logFormError && (
                <p className="form-error" role="alert">
                  {logFormError}
                </p>
              )}
              <button type="submit" className="btn primary">{t("common.save")}</button>
            </form>
          )}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setDetail(null)}>{t("common.close")}</button>
          </div>
        </Dialog>
      )}

      {modal === "record" && (
        <FormModal
          title={t("records.newRecord")}
          onClose={() => setModal(null)}
          onSubmit={createRecord}
          submitLabel={t("common.save")}
          error={recordFormError}
        >
          <Field label={t("records.patient")}>
            <SearchableSelect<Patient>
              value={selectedPatient}
              onSelect={pickPatient}
              search={searchPatients}
              placeholder={t("records.patientPickerPlaceholder")}
              getLabel={(p) => p.full_name}
              getSublabel={(p) => formatCedula(p.cedula)}
            />
          </Field>
          <Field label={t("records.recordTitle")}>
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

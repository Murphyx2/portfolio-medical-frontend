import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Page } from "../components/ui";
import { RecordDetailWithLogs, type LogFields } from "./records/RecordDetailWithLogs";
import { RecordFormModal } from "./records/RecordFormModal";
import { RecordList } from "./records/RecordList";
import { useListPage } from "../hooks/useListPage";
import { api, upload } from "../services/api";
import { getUploadLimits } from "../services/settings";
import type { ConsultationLog, MedicalRecord, Paginated, Patient } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";

export function Records() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = can(user?.role, "create", "records");
  const canDelete = can(user?.role, "delete", "records");
  const canManageApTypes = can(user?.role, "edit", "recordApTypes");
  const isAdmin = can(user?.role, "restore", "records");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [maxUploadMb, setMaxUploadMb] = useState<number | undefined>(undefined);
  const [detail, setDetail] = useState<MedicalRecord | null>(null);
  const [logs, setLogs] = useState<ConsultationLog[]>([]);
  const [modal, setModal] = useState<"record" | null>(null);
  const [formInitialPatient, setFormInitialPatient] = useState<Patient | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const {
    rows,
    page,
    setPage,
    pageSize,
    count,
    search,
    setSearch,
    searchSubmit,
    sortKey,
    sortDir,
    handleSort,
    changePageSize,
    initialLoading,
    showInactive,
    setShowInactive,
    load,
  } = useListPage<MedicalRecord>("/medical-records/", { initialSort: { key: "date", dir: "desc" } });

  useEffect(() => {
    // Patient options for the "new record" picker: fetched once, not on
    // every page/sort/search change (unlike `load`, which re-runs then).
    api.get<Paginated<Patient>>("/patients/?page_size=100").then((r) => setPatients(r.results)).catch(() => {});
  }, []);

  useEffect(() => {
    // Fetched once for the image-upload pre-check in RecordDetailWithLogs;
    // failing silently just skips the client-side check and leaves the
    // server's own validation (same configured limit) as the fallback.
    if (canCreate) getUploadLimits().then((r) => setMaxUploadMb(r.max_image_upload_mb)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(rec: MedicalRecord) {
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

  useEffect(() => {
    // Arriving from Encounters.tsx's "Open Record" action (?patient=<id>):
    // jump straight to that patient's most recent record, or -- if they
    // don't have one yet -- open the "new record" form pre-filled for them,
    // instead of leaving the visitor to search the list manually. This is
    // the single home for this cross-page handoff pattern -- deliberately
    // kept at the page level, not inside any extracted component.
    const patientId = searchParams.get("patient");
    if (!patientId) return;
    (async () => {
      try {
        const existing = await api.get<Paginated<MedicalRecord>>(
          `/medical-records/?patient=${patientId}&page_size=1`,
        );
        if (existing.results.length > 0) {
          await openDetail(existing.results[0]);
          return;
        }
        if (!canCreate) return;
        const patient = await api.get<Patient>(`/patients/${patientId}/`);
        setFormInitialPatient(patient);
        setModal("record");
      } catch {
        /* patient/records lookup failed -- leave the list view as-is */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function uploadImage(file: File, caption: string) {
    if (!detail) return;
    const fd = new FormData();
    fd.append("record", String(detail.id));
    fd.append("image", file);
    fd.append("caption", caption);
    await upload("/images/", fd);
    const full = await api.get<MedicalRecord>(`/medical-records/${detail.id}/`);
    setDetail(full);
  }

  async function createLog(fields: LogFields) {
    if (!detail) return;
    await api.post("/consultation-logs/", { ...fields, patient: detail.patient });
    const r = await api.get<Paginated<ConsultationLog>>(`/consultation-logs/?patient=${detail.patient}&page_size=20`);
    setLogs(r.results);
  }

  async function removeRecord(rec: MedicalRecord) {
    await api.delete(`/medical-records/${rec.id}/`);
    load();
  }

  async function restoreRecord(rec: MedicalRecord) {
    await api.post(`/medical-records/${rec.id}/restore/`, {});
    load();
  }

  function openRecordForm() {
    setFormInitialPatient(patients[0] ?? null);
    setModal("record");
  }

  return (
    <Page
      title={t("records.title")}
      actions={
        <div className="page-actions-stack">
          {canCreate && (
            <button className="btn primary" onClick={openRecordForm}>
              + {t("records.newRecord")}
            </button>
          )}
          {canManageApTypes && (
            <button className="btn ghost" onClick={() => navigate("/records/types")}>
              {t("records.manageApTypes")}
            </button>
          )}
        </div>
      }
    >
      <RecordList
        initialLoading={initialLoading}
        search={search}
        setSearch={setSearch}
        searchSubmit={searchSubmit}
        isAdmin={isAdmin}
        showInactive={showInactive}
        onToggleInactive={setShowInactive}
        page={page}
        count={count}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={changePageSize}
        rows={rows}
        onDelete={canDelete ? removeRecord : undefined}
        onRestore={isAdmin ? restoreRecord : undefined}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        openDetail={openDetail}
        openingId={openingId}
      />

      {detail && (
        <RecordDetailWithLogs
          key={detail.id}
          detail={detail}
          logs={logs}
          onClose={() => setDetail(null)}
          canCreate={canCreate}
          onUploadImage={uploadImage}
          onCreateLog={createLog}
          maxUploadMb={maxUploadMb}
        />
      )}

      {modal === "record" && (
        <RecordFormModal
          initialPatient={formInitialPatient}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </Page>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PatientFormModal } from "../components/PatientFormModal";
import { Page } from "../components/ui";
import { RecordFormModal } from "./records/RecordFormModal";
import { RecordList } from "./records/RecordList";
import { useListPage } from "../hooks/useListPage";
import { api } from "../services/api";
import { getUploadLimits } from "../services/settings";
import type { APCategory, APType, MedicalRecord, Paginated, Patient } from "../services/types";
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
  const [maxUploadMb, setMaxUploadMb] = useState<number | undefined>(undefined);
  const [apCategories, setApCategories] = useState<APCategory[]>([]);
  const [apTypes, setApTypes] = useState<APType[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<MedicalRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [focusNewEntry, setFocusNewEntry] = useState(false);
  const [patientModal, setPatientModal] = useState(false);
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
  } = useListPage<MedicalRecord>("/medical-records/", { initialSort: { key: "last_visit_at", dir: "desc" } });

  useEffect(() => {
    if (canCreate) getUploadLimits().then((r) => setMaxUploadMb(r.max_image_upload_mb)).catch(() => {});
    api.get<Paginated<APCategory>>("/ap-categories/?page_size=100").then((r) => setApCategories(r.results)).catch(() => {});
    api.get<Paginated<APType>>("/ap-types/?page_size=200").then((r) => setApTypes(r.results)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** One living expediente per patient (§9 of the plan): resolves to the
   * patient's existing MedicalRecord if one exists, or creates the bare
   * anchor row otherwise -- shared by the patient-picker's onSelect, the
   * "Crear paciente" return path, and the ?patient= deep link, so none of
   * them can ever attempt a second POST /medical-records/ for the same
   * patient (the backend's uniqueness constraint would reject it anyway). */
  async function resolveRecordForPatient(patient: Patient) {
    setSelectedPatient(patient);
    setRecordLoading(true);
    try {
      const existing = await api.get<Paginated<MedicalRecord>>(`/medical-records/?patient=${patient.id}&page_size=1`);
      if (existing.results.length > 0) {
        setActiveRecord(existing.results[0]);
      } else if (canCreate) {
        const created = await api.post<MedicalRecord>("/medical-records/", { patient: patient.id });
        setActiveRecord(created);
        load();
      }
    } finally {
      setRecordLoading(false);
    }
  }

  useEffect(() => {
    // Arriving from Encounters.tsx's "Open Record" action (?patient=<id>):
    // jump straight to that patient's expediente instead of leaving the
    // visitor to search the list manually.
    const patientId = searchParams.get("patient");
    if (!patientId) return;
    (async () => {
      try {
        const patient = await api.get<Patient>(`/patients/${patientId}/`);
        setModalOpen(true);
        setFocusNewEntry(false);
        await resolveRecordForPatient(patient);
      } catch {
        /* patient lookup failed -- leave the list view as-is */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openNew() {
    setActiveRecord(null);
    setSelectedPatient(null);
    setFocusNewEntry(false);
    setModalOpen(true);
  }

  function openRow(row: MedicalRecord, opts?: { newEntry?: boolean }) {
    setActiveRecord(row);
    setSelectedPatient(null);
    setFocusNewEntry(Boolean(opts?.newEntry));
    setModalOpen(true);
  }

  async function removeRecord(rec: MedicalRecord) {
    await api.delete(`/medical-records/${rec.id}/`);
    load();
  }

  async function restoreRecord(rec: MedicalRecord) {
    await api.post(`/medical-records/${rec.id}/restore/`, {});
    load();
  }

  return (
    <Page
      title={t("records.title")}
      actions={
        <div className="page-actions-stack">
          {canCreate && (
            <button className="btn primary" onClick={openNew}>
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
        openDetail={openRow}
        canCreateEntry={canCreate}
      />

      {modalOpen && (
        <RecordFormModal
          record={activeRecord}
          recordLoading={recordLoading}
          selectedPatient={selectedPatient}
          onSelectPatient={resolveRecordForPatient}
          onRequestNewPatient={() => setPatientModal(true)}
          focusNewEntry={focusNewEntry}
          apCategories={apCategories}
          apTypes={apTypes}
          maxUploadMb={maxUploadMb}
          onClose={() => setModalOpen(false)}
          onEntrySaved={load}
        />
      )}

      {patientModal && (
        <PatientFormModal
          onClose={() => setPatientModal(false)}
          onSaved={(p) => {
            setPatientModal(false);
            resolveRecordForPatient(p);
          }}
        />
      )}
    </Page>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { DateNavigator } from "../components/DateNavigator";
import { ListPage } from "../components/ListPage";
import { PatientFormModal } from "../components/PatientFormModal";
import { MaskedValue, Page, type Column } from "../components/ui";
import { EncounterConfirmDialog } from "./encounters/EncounterConfirmDialog";
import { EncounterDetailDialog } from "./encounters/EncounterDetailDialog";
import { EncounterFormModal } from "./encounters/EncounterFormModal";
import { EncounterRowActions } from "./encounters/EncounterRowActions";
import { useEncounterConfirmAction } from "./encounters/useEncounterConfirmAction";
import { GuardianAwareCedula } from "./encounters/guardianCedula";
import { useListPage } from "../hooks/useListPage";
import { api } from "../services/api";
import type {
  ARS,
  DoctorProfile,
  Encounter,
  Paginated,
  Patient,
  Room,
  Service,
  ServiceType,
} from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { formatDate, formatDateTime, nextLocalISO, todayLocalISO } from "../utils/date";
import { toSentenceCase } from "../utils/text";

export function Encounters() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = can(user?.role, "manage", "encounters");
  const isAdmin = can(user?.role, "restore", "encounters");
  const canDelete = can(user?.role, "delete", "encounters");
  const canViewRecords = can(user?.role, "view", "records");

  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [arsList, setArsList] = useState<ARS[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(todayLocalISO);
  const [detail, setDetail] = useState<Encounter | null>(null);

  const [modal, setModal] = useState(false);
  const [editingEncounter, setEditingEncounter] = useState<Encounter | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientModal, setPatientModal] = useState(false);

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
  } = useListPage<Encounter>("/encounters/", {
    initialSort: { key: "created_at", dir: "desc" },
    extraParams: {
      status: statusFilter,
      created_at__gte: `${dateFilter}T00:00:00`,
      created_at__lt: `${nextLocalISO(dateFilter)}T00:00:00`,
    },
  });

  const confirmAction = useEncounterConfirmAction(load);

  useEffect(() => {
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100").then((r) => setDoctors(r.results)).catch(() => {});
    api.get<Paginated<Room>>("/rooms/?page_size=100").then((r) => setRooms(r.results)).catch(() => {});
    api.get<Paginated<ServiceType>>("/service-types/?page_size=100").then((r) => setServiceTypes(r.results)).catch(() => {});
    api.get<Paginated<ARS>>("/ars/?page_size=100").then((r) => setArsList(r.results)).catch(() => {});
    api.get<Paginated<Service>>("/services/?page_size=200").then((r) => setServices(r.results)).catch(() => {});
  }, []);

  function openNew() {
    setEditingEncounter(null);
    setSelectedPatient(null);
    setModal(true);
  }

  function openEdit(r: Encounter) {
    setEditingEncounter(r);
    setSelectedPatient(null);
    setModal(true);
  }

  const statusLabel = (s: string) => t(`encounters.status${s[0]}${s.slice(1).toLowerCase()}`);
  const priorityLabel = (p: string) => t(`encounters.priority${p[0]}${p.slice(1).toLowerCase()}`);

  // Matches Patients.tsx's click-to-detail pattern: the patient name opens a
  // read-only "full admission details" dialog instead of cramming doctor
  // full name, referring doctor, diagnoses, services, coverage,
  // and timestamps into the list table.
  const openDetailLink = (r: Encounter, content: ReactNode) => (
    <button type="button" className="row-link" onClick={() => setDetail(r)}>
      {content}
    </button>
  );

  const columns: Column<Encounter>[] = [
    {
      key: "encounter_number",
      header: <span title={t("encounters.numberFormatHint")}>{t("encounters.number")}</span>,
      render: (r) => r.encounter_number ?? "—",
    },
    {
      key: "patient",
      header: t("encounters.patient"),
      sortKey: "patient__search_name",
      render: (r) => openDetailLink(r, <MaskedValue value={r.patient_info.full_name} />),
    },
    {
      key: "cedula",
      header: t("encounters.cedula"),
      render: (r) => openDetailLink(r, <GuardianAwareCedula info={r.patient_info} />),
    },
    { key: "doctor", header: t("encounters.doctor"), sortKey: "doctor__code", render: (r) => r.doctor_info?.full_name ?? "—" },
    {
      key: "services",
      header: t("encounters.sectionServices"),
      render: (r) => (r.services.length ? r.services.map((s) => toSentenceCase(s.service_name ?? "")).join(", ") : "—"),
    },
    { key: "room_name", header: t("encounters.room"), render: (r) => r.room_name ?? "—" },
    { key: "priority", header: t("encounters.priority"), sortKey: "priority", render: (r) => <span className={`badge status-${r.priority.toLowerCase()}`}>{priorityLabel(r.priority)}</span> },
    { key: "status", header: t("common.status"), sortKey: "status", render: (r) => <span className={`badge status-${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span> },
    { key: "created_at", header: t("encounters.createdAt"), sortKey: "created_at", render: (r) => formatDateTime(r.created_at) },
    {
      key: "actions",
      header: t("common.actions"),
      align: "center",
      render: (r) => (
        <EncounterRowActions
          row={r}
          canManage={canManage}
          canDelete={canDelete}
          isAdmin={isAdmin}
          canViewRecords={canViewRecords}
          onEdit={openEdit}
          onConfirm={confirmAction.openConfirm}
          onOpenRecord={(row) => navigate(`/records?patient=${row.patient}`)}
        />
      ),
    },
  ];

  return (
    <Page
      title={t("encounters.title")}
      actions={
        canManage && (
          <button className="btn primary" onClick={openNew}>
            + {t("encounters.new")}
          </button>
        )
      }
    >
      <ListPage<Encounter>
        initialLoading={initialLoading}
        search={search}
        setSearch={setSearch}
        searchSubmit={searchSubmit}
        toolbarBefore={
          <DateNavigator
            value={dateFilter}
            onChange={(isoDate) => setDateFilter(isoDate || todayLocalISO())}
            ariaLabel={t("encounters.date")}
          />
        }
        toolbarAfter={
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("encounters.allStatuses")}</option>
            {(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const).map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        }
        isAdmin={isAdmin}
        showInactive={showInactive}
        onToggleInactive={setShowInactive}
        page={page}
        count={count}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={changePageSize}
        columns={columns}
        showActiveColumn={false}
        rows={rows}
        getRowLabel={(r) => r.encounter_number ?? r.patient_info.full_name}
        isInactive={(r) => !r.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        emptyLabel={t("encounters.noDataForDate", { date: formatDate(`${dateFilter}T00:00:00`) })}
      />

      {modal && (
        <EncounterFormModal
          key={editingEncounter?.id ?? "new"}
          editingEncounter={editingEncounter}
          selectedPatient={selectedPatient}
          setSelectedPatient={setSelectedPatient}
          onRequestNewPatient={() => setPatientModal(true)}
          doctors={doctors}
          rooms={rooms}
          serviceTypes={serviceTypes}
          arsList={arsList}
          services={services}
          onClose={() => setModal(false)}
          onSaved={() => {
            setModal(false);
            load();
          }}
        />
      )}

      {detail && (
        <EncounterDetailDialog
          detail={detail}
          onClose={() => setDetail(null)}
          canViewRecords={canViewRecords}
          onOpenRecord={(row) => navigate(`/records?patient=${row.patient}`)}
        />
      )}

      {patientModal && (
        <PatientFormModal
          onClose={() => setPatientModal(false)}
          onSaved={(p) => {
            setPatientModal(false);
            setSelectedPatient(p);
          }}
        />
      )}

      <EncounterConfirmDialog state={confirmAction} />
    </Page>
  );
}

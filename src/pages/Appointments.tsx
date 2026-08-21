import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ListPage } from "../components/ListPage";
import { ConfirmDialog, Field, FormModal, SearchableSelect, useRowConfirm, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import { searchPatients } from "../services/patients";
import type {
  Appointment,
  DoctorProfile,
  MedicalCenter,
  Paginated,
  Patient,
} from "../services/types";
import { useAuth } from "../store/auth";
import { formatCedula } from "../utils/cedula";
import { flattenError } from "../utils/errors";

const EMPTY = { patient: 0, doctor: 0, center: 0, date_time: "", duration_minutes: 30, notes: "" };

export function Appointments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "DOCTOR" || user?.role === "RECEPTIONIST" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN" || user?.role === "DOCTOR";
  const isAdmin = user?.role === "ADMIN";
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [centers, setCenters] = useState<MedicalCenter[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const confirm = useRowConfirm<"complete" | "cancel" | "delete" | "restore", Appointment>();
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
  } = useListPage<Appointment>("/appointments/", { initialSort: { key: "date_time", dir: "asc" } });

  useEffect(() => {
    // Form-picker options: fetched once, not on every page/sort/search
    // change (unlike `load`, which re-runs then). Patients are looked up
    // on demand instead (SearchableSelect), not preloaded in bulk.
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100").then((r) => setDoctors(r.results)).catch(() => {});
    api.get<Paginated<MedicalCenter>>("/centers/?page_size=100").then((r) => setCenters(r.results)).catch(() => {});
  }, []);

  function pickPatient(p: Patient) {
    setSelectedPatient(p);
    setForm({ ...form, patient: p.id });
  }

  async function submit() {
    setFormError("");
    try {
      await api.post("/appointments/", {
        ...form,
        patient: Number(form.patient),
        doctor: Number(form.doctor),
        center: Number(form.center) || null,
        date_time: new Date(form.date_time).toISOString(),
      });
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function runConfirmedAction() {
    await confirm.run(async (type, row) => {
      if (type === "delete") {
        await api.delete(`/appointments/${row.id}/`);
      } else {
        await api.post(`/appointments/${row.id}/${type}/`, {});
      }
      load();
    });
  }

  const confirmCopy = confirm.confirming
    ? (() => {
        const { type, row } = confirm.confirming!;
        const time = new Date(row.date_time).toLocaleString();
        const patient = row.patient_info.full_name;
        switch (type) {
          case "complete":
            return { title: t("appointments.complete"), message: t("appointments.completeConfirm", { patient, time }), confirmLabel: t("appointments.complete"), danger: false };
          case "cancel":
            return { title: t("appointments.cancel"), message: t("appointments.cancelConfirm", { patient, time }), confirmLabel: t("appointments.cancel"), danger: true };
          case "delete":
            return { title: t("common.delete"), message: t("common.deleteConfirmNamed", { name: patient }), confirmLabel: t("common.delete"), danger: true };
          case "restore":
            return { title: t("common.restore"), message: t("common.restoreConfirmNamed", { name: patient }), confirmLabel: t("common.restore"), danger: false };
        }
      })()
    : null;

  const statusLabel = (s: string) => t(`appointments.status${s[0]}${s.slice(1).toLowerCase()}`);

  const columns: Column<Appointment>[] = [
    { key: "date_time", header: t("appointments.dateTime"), sortKey: "date_time", render: (r) => new Date(r.date_time).toLocaleString() },
    { key: "patient", header: t("appointments.patient"), sortKey: "patient__search_name", render: (r) => r.patient_info.full_name },
    { key: "doctor", header: t("appointments.doctor"), sortKey: "doctor__user__last_name", render: (r) => r.doctor_info.full_name },
    { key: "center", header: t("appointments.center"), sortKey: "center__name", render: (r) => r.center_name ?? "—" },
    { key: "created_by_name", header: t("appointments.createdBy") },
    { key: "status", header: t("common.status"), sortKey: "status", render: (r) => <span className={`badge status-${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span> },
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.active"),
            render: (r: Appointment) => (
              <span className={`badge status-${r.active ? "active" : "inactive"}`}>
                {r.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<Appointment>,
        ]
      : []),
    {
      key: "actions",
      header: t("common.actions"),
      align: "center",
      render: (r) => (
        <div className="row-actions">
          {canManage && r.status === "SCHEDULED" && (
            <>
              <button className="btn small" onClick={() => confirm.open("complete", r)}>{t("appointments.complete")}</button>
              <button className="btn small danger" onClick={() => confirm.open("cancel", r)}>{t("appointments.cancel")}</button>
            </>
          )}
          {canDelete && r.active && (
            <button className="btn small danger" onClick={() => confirm.open("delete", r)}>{t("common.delete")}</button>
          )}
          {isAdmin && !r.active && (
            <button className="btn small" onClick={() => confirm.open("restore", r)}>
              {t("common.restore")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page
      title={t("appointments.title")}
      actions={
        canManage && (
          <button className="btn primary" onClick={() => { setForm(EMPTY); setSelectedPatient(null); setFormError(""); setModal(true); }}>
            + {t("appointments.new")}
          </button>
        )
      }
    >
      <ListPage<Appointment>
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
        columns={columns}
        rows={rows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={t("appointments.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("appointments.patient")}>
            <SearchableSelect<Patient>
              value={selectedPatient}
              onSelect={pickPatient}
              search={searchPatients}
              placeholder={t("records.patientPickerPlaceholder")}
              getLabel={(p) => p.full_name}
              getSublabel={(p) => `${formatCedula(p.cedula)} · NSS ${p.nss || "—"}`}
            />
          </Field>
          <Field label={t("appointments.doctor")}>
            <select value={form.doctor} onChange={(e) => setForm({ ...form, doctor: Number(e.target.value) })} required>
              <option value={0} disabled>—</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("appointments.center")}>
            <select value={form.center} onChange={(e) => setForm({ ...form, center: Number(e.target.value) })}>
              <option value={0}>—</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("appointments.dateTime")}>
            <input
              type="datetime-local"
              value={form.date_time}
              onChange={(e) => setForm({ ...form, date_time: e.target.value })}
              required
            />
          </Field>
          <Field label={t("appointments.duration")}>
            <input
              type="number"
              min={5}
              step={5}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("appointments.notes")}>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </FormModal>
      )}

      {confirm.confirming && confirmCopy && (
        <ConfirmDialog
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.confirmLabel}
          danger={confirmCopy.danger}
          error={confirm.error}
          pending={confirm.pending}
          onConfirm={runConfirmedAction}
          onCancel={confirm.close}
        />
      )}
    </Page>
  );
}

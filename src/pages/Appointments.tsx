import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, SearchableSelect, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type {
  Appointment,
  DoctorProfile,
  MedicalCenter,
  Paginated,
  Patient,
} from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";

const EMPTY = { patient: 0, doctor: 0, center: 0, date_time: "", duration_minutes: 30, notes: "" };

function formatCedula(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

export function Appointments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "DOCTOR" || user?.role === "RECEPTIONIST" || user?.role === "ADMIN";
  const isAdmin = user?.role === "ADMIN";
  const [showInactive, setShowInactive] = useState(false);
  const [rows, setRows] = useState<Appointment[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [centers, setCenters] = useState<MedicalCenter[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [actioningId, setActioningId] = useState<number | null>(null);
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
  } = useListControls({ key: "date_time", dir: "asc" });

  const qs = query({ include_inactive: showInactive ? "true" : "" });

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<Appointment>>(`/appointments/?${qs}`, { signal }))
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
    // Form-picker options: fetched once, not on every page/sort/search
    // change (unlike `load`, which re-runs then). Patients are looked up
    // on demand instead (SearchableSelect), not preloaded in bulk.
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100").then((r) => setDoctors(r.results)).catch(() => {});
    api.get<Paginated<MedicalCenter>>("/centers/?page_size=100").then((r) => setCenters(r.results)).catch(() => {});
  }, []);

  const searchPatients = useCallback((q: string): Promise<Patient[]> => {
    return api
      .get<Paginated<Patient>>(`/patients/?page_size=20${q ? `&search=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.results)
      .catch(() => []);
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

  async function cancel(a: Appointment) {
    const time = new Date(a.date_time).toLocaleString();
    if (!window.confirm(t("appointments.cancelConfirm", { patient: a.patient_info.full_name, time }))) return;
    setActioningId(a.id);
    try {
      await api.post(`/appointments/${a.id}/cancel/`, {});
      load();
    } catch (err) {
      window.alert(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setActioningId(null);
    }
  }

  async function complete(a: Appointment) {
    const time = new Date(a.date_time).toLocaleString();
    if (!window.confirm(t("appointments.completeConfirm", { patient: a.patient_info.full_name, time }))) return;
    setActioningId(a.id);
    try {
      await api.post(`/appointments/${a.id}/complete/`, {});
      load();
    } catch (err) {
      window.alert(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setActioningId(null);
    }
  }

  async function removeAppointment(a: Appointment) {
    if (!window.confirm(t("common.deleteConfirm"))) return;
    setActioningId(a.id);
    try {
      await api.delete(`/appointments/${a.id}/`);
      load();
    } catch (err) {
      window.alert(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setActioningId(null);
    }
  }

  async function restoreAppointment(a: Appointment) {
    setActioningId(a.id);
    try {
      await api.post(`/appointments/${a.id}/restore/`, {});
      load();
    } catch (err) {
      window.alert(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setActioningId(null);
    }
  }

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
      render: (r) => (
        <>
          {canManage && r.status === "SCHEDULED" && (
            <>
              <button className="btn small" onClick={() => complete(r)} disabled={actioningId === r.id}>{t("appointments.complete")}</button>
              <button className="btn small danger" onClick={() => cancel(r)} disabled={actioningId === r.id}>{t("appointments.cancel")}</button>
            </>
          )}
          {canManage && r.active && (
            <button className="btn small danger" onClick={() => removeAppointment(r)} disabled={actioningId === r.id}>{t("common.delete")}</button>
          )}
          {isAdmin && !r.active && (
            <button
              className="btn small"
              onClick={() => window.confirm(t("common.restoreConfirm")) && restoreAppointment(r)}
              disabled={actioningId === r.id}
            >
              {t("common.restore")}
            </button>
          )}
        </>
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
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

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
    </Page>
  );
}

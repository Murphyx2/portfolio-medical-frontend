import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api } from "../services/api";
import type {
  Appointment,
  DoctorProfile,
  MedicalCenter,
  Paginated,
  Patient,
} from "../services/types";
import { useAuth } from "../store/auth";

const EMPTY = { patient: 0, doctor: 0, center: 0, date_time: "", duration_minutes: 30, notes: "" };

export function Appointments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "DOCTOR" || user?.role === "RECEPTIONIST" || user?.role === "ADMIN";
  const [rows, setRows] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [centers, setCenters] = useState<MedicalCenter[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
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

  const qs = query();

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

  useEffect(() => {
    load();
    api.get<Paginated<Patient>>("/patients/?page_size=100").then((r) => setPatients(r.results)).catch(() => {});
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100").then((r) => setDoctors(r.results)).catch(() => {});
    api.get<Paginated<MedicalCenter>>("/centers/?page_size=100").then((r) => setCenters(r.results)).catch(() => {});
  }, [load]);

  async function submit() {
    await api.post("/appointments/", {
      ...form,
      patient: Number(form.patient),
      doctor: Number(form.doctor),
      center: Number(form.center) || null,
      date_time: new Date(form.date_time).toISOString(),
    });
    setModal(false);
    load();
  }

  async function cancel(a: Appointment) {
    await api.post(`/appointments/${a.id}/cancel/`, {});
    load();
  }

  async function complete(a: Appointment) {
    await api.post(`/appointments/${a.id}/complete/`, {});
    load();
  }

  const statusLabel = (s: string) => t(`appointments.status${s[0]}${s.slice(1).toLowerCase()}`);

  const columns: Column<Appointment>[] = [
    { key: "date_time", header: t("appointments.dateTime"), sortKey: "date_time", render: (r) => new Date(r.date_time).toLocaleString() },
    { key: "patient", header: t("appointments.patient"), sortKey: "patient__search_name", render: (r) => r.patient_info.full_name },
    { key: "doctor", header: t("appointments.doctor"), sortKey: "doctor__user__last_name", render: (r) => r.doctor_info.full_name },
    { key: "center", header: t("appointments.center"), sortKey: "center__name", render: (r) => r.center_name ?? "—" },
    { key: "status", header: t("common.status"), sortKey: "status", render: (r) => <span className={`badge status-${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span> },
    {
      key: "actions",
      header: t("common.actions"),
      render: (r) => (
        <>
          {canManage && r.status === "SCHEDULED" && (
            <>
              <button className="btn small" onClick={() => complete(r)}>{t("appointments.complete")}</button>
              <button className="btn small danger" onClick={() => cancel(r)}>{t("appointments.cancel")}</button>
            </>
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
          <button className="btn primary" onClick={() => { setForm(EMPTY); setModal(true); }}>
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
        >
          <Field label={t("appointments.patient")}>
            <select value={form.patient} onChange={(e) => setForm({ ...form, patient: Number(e.target.value) })} required>
              <option value={0} disabled>—</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
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

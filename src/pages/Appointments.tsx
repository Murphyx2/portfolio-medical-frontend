import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { DateNavigator } from "../components/DateNavigator";
import { DateTimeField } from "../components/DateTimeField";
import { ListPage } from "../components/ListPage";
import { PatientFormModal } from "../components/PatientFormModal";
import { ConfirmDialog, Field, FormModal, MaskedValue, SearchableSelect, useRowConfirm, Page, type Column } from "../components/ui";
import { useDoctorServiceFilter } from "../hooks/useDoctorServiceFilter";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import { formatPhone } from "../utils/phone";
import { searchPatients } from "../services/patients";
import type {
  Appointment,
  DoctorProfile,
  Paginated,
  Patient,
  Service,
  ServiceType,
} from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { formatCedula } from "../utils/cedula";
import { formatDateTime, nextLocalISO, todayLocalISO } from "../utils/date";
import { flattenError } from "../utils/errors";

const EMPTY = { patient: 0, doctor: 0, service: 0, date_time: "", notes: "" };

// Renders an ISO timestamp as the local "YYYY-MM-DDTHH:mm" value a
// `datetime-local` input expects, so editing an existing appointment
// prefills the picker in the visitor's own timezone (mirrors `submit()`'s
// own `new Date(form.date_time).toISOString()` round-trip back out).
function toDateTimeLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Appointments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canCreate = can(user?.role, "create", "appointments");
  const canEdit = can(user?.role, "edit", "appointments");
  const canComplete = can(user?.role, "complete", "appointments");
  const canCancel = can(user?.role, "cancel", "appointments");
  const canDelete = can(user?.role, "delete", "appointments");
  const isAdmin = can(user?.role, "restore", "appointments");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientModal, setPatientModal] = useState(false);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [dateFilter, setDateFilter] = useState(todayLocalISO);
  const [modal, setModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const confirm = useRowConfirm<"complete" | "delete" | "restore", Appointment>();
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
  } = useListPage<Appointment>("/appointments/", {
    initialSort: { key: "date_time", dir: "asc" },
    extraParams: {
      date_time__gte: `${dateFilter}T00:00:00`,
      date_time__lt: `${nextLocalISO(dateFilter)}T00:00:00`,
    },
  });

  const { availableDoctors, availableServices } = useDoctorServiceFilter({
    doctors,
    services,
    serviceTypes,
    selectedServiceIds: [form.service],
    currentDoctorId: form.doctor,
  });

  useEffect(() => {
    // Form-picker options: fetched once, not on every page/sort/search
    // change (unlike `load`, which re-runs then). Patients are looked up
    // on demand instead (SearchableSelect), not preloaded in bulk.
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100").then((r) => setDoctors(r.results)).catch(() => {});
    api.get<Paginated<Service>>("/services/?page_size=200").then((r) => setServices(r.results)).catch(() => {});
    api.get<Paginated<ServiceType>>("/service-types/?page_size=100").then((r) => setServiceTypes(r.results)).catch(() => {});
  }, []);

  function pickDoctor(doctorId: number) {
    setForm((f) => {
      const doctor = doctors.find((d) => d.id === doctorId);
      const serviceStillValid = doctor && doctor.services.length > 0 ? doctor.services.includes(f.service) : true;
      return {
        ...f,
        doctor: doctorId,
        service: serviceStillValid ? f.service : 0,
      };
    });
  }

  function pickPatient(p: Patient) {
    setSelectedPatient(p);
    setForm({ ...form, patient: p.id });
  }

  function openEdit(a: Appointment) {
    setEditingAppointment(a);
    setSelectedPatient(null);
    setForm({
      patient: a.patient,
      doctor: a.doctor,
      service: a.service ?? 0,
      date_time: toDateTimeLocalInput(a.date_time),
      notes: a.notes,
    });
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    const body = {
      patient: Number(form.patient),
      doctor: Number(form.doctor),
      service: Number(form.service),
      date_time: new Date(form.date_time).toISOString(),
      notes: form.notes,
    };
    try {
      if (editingAppointment) await api.patch(`/appointments/${editingAppointment.id}/`, body);
      else await api.post("/appointments/", body);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  function openReschedule(a: Appointment) {
    setRescheduleTarget(a);
    setRescheduleDateTime(toDateTimeLocalInput(a.date_time));
    setRescheduleError("");
  }

  async function submitReschedule() {
    if (!rescheduleTarget) return;
    setRescheduleError("");
    try {
      await api.post(`/appointments/${rescheduleTarget.id}/reschedule/`, {
        date_time: new Date(rescheduleDateTime).toISOString(),
      });
      setRescheduleTarget(null);
      load();
    } catch (err) {
      setRescheduleError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  function openCancel(a: Appointment) {
    setCancelTarget(a);
    setCancelReason("");
    setCancelError("");
  }

  async function submitCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError(t("appointments.cancelReasonRequired"));
      return;
    }
    setCancelError("");
    try {
      await api.post(`/appointments/${cancelTarget.id}/cancel/`, { reason: cancelReason.trim() });
      setCancelTarget(null);
      load();
    } catch (err) {
      setCancelError(err instanceof ApiError ? flattenError(err.message) : String(err));
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
        const time = formatDateTime(row.date_time);
        const patient = row.patient_info.full_name;
        switch (type) {
          case "complete":
            return { title: t("appointments.complete"), message: t("appointments.completeConfirm", { patient, time }), confirmLabel: t("appointments.complete"), danger: false };
          case "delete":
            return { title: t("common.delete"), message: t("common.deleteConfirmNamed", { name: patient }), confirmLabel: t("common.delete"), danger: true };
          case "restore":
            return { title: t("common.restore"), message: t("common.restoreConfirmNamed", { name: patient }), confirmLabel: t("common.restore"), danger: false };
        }
      })()
    : null;

  const statusLabel = (s: string) => t(`appointments.status${s[0]}${s.slice(1).toLowerCase()}`);

  const columns: Column<Appointment>[] = [
    { key: "date_time", header: t("appointments.dateTime"), sortKey: "date_time", render: (r) => formatDateTime(r.date_time) },
    { key: "patient", header: t("appointments.patient"), sortKey: "patient__search_name", render: (r) => r.patient_info.full_name },
    { key: "doctor", header: t("appointments.doctor"), sortKey: "doctor__user__last_name", render: (r) => r.doctor_info.full_name },
    { key: "service", header: t("appointments.service"), render: (r) => r.service_detail?.name ?? "—" },
    { key: "phone", header: t("appointments.phone"), render: (r) => <MaskedValue value={formatPhone(r.patient_info.phone)} /> },
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
          {canEdit && r.active && (
            <button className="btn small ghost" onClick={() => openEdit(r)}>{t("common.edit")}</button>
          )}
          {canEdit && r.status === "SCHEDULED" && (
            <button className="btn small ghost" onClick={() => openReschedule(r)}>{t("appointments.reschedule")}</button>
          )}
          {canComplete && r.status === "SCHEDULED" && (
            <button className="btn small" onClick={() => confirm.open("complete", r)}>{t("appointments.complete")}</button>
          )}
          {canCancel && r.status === "SCHEDULED" && (
            <button className="btn small danger" onClick={() => openCancel(r)}>{t("appointments.cancel")}</button>
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
        canCreate && (
          <button
            className="btn primary"
            onClick={() => { setEditingAppointment(null); setForm(EMPTY); setSelectedPatient(null); setFormError(""); setModal(true); }}
          >
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
        toolbarBefore={
          <DateNavigator
            value={dateFilter}
            onChange={(isoDate) => setDateFilter(isoDate || todayLocalISO())}
            ariaLabel={t("appointments.date")}
          />
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
        rows={rows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editingAppointment ? t("common.edit") : t("appointments.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          {editingAppointment ? (
            <p><MaskedValue value={editingAppointment.patient_info.full_name} /></p>
          ) : (
            <>
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
              <button type="button" className="btn ghost small" onClick={() => setPatientModal(true)}>
                + {t("patients.new")}
              </button>
            </>
          )}
          <Field label={t("appointments.doctor")}>
            <select value={form.doctor} onChange={(e) => pickDoctor(Number(e.target.value))} required>
              <option value={0} disabled>—</option>
              {availableDoctors.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("appointments.service")}>
            <select value={form.service} onChange={(e) => setForm({ ...form, service: Number(e.target.value) })} required>
              <option value={0} disabled>—</option>
              {availableServices.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("appointments.dateTime")}>
            <DateTimeField
              value={form.date_time}
              onChange={(v) => setForm({ ...form, date_time: v })}
              ariaLabel={t("appointments.dateTime")}
              required
            />
          </Field>
          <Field label={t("appointments.notes")}>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </FormModal>
      )}

      {patientModal && (
        <PatientFormModal
          onClose={() => setPatientModal(false)}
          onSaved={(p) => { setPatientModal(false); pickPatient(p); }}
        />
      )}

      {rescheduleTarget && (
        <FormModal
          title={t("appointments.reschedule")}
          onClose={() => setRescheduleTarget(null)}
          onSubmit={submitReschedule}
          submitLabel={t("common.save")}
          error={rescheduleError}
        >
          <Field label={t("appointments.dateTime")}>
            <DateTimeField
              value={rescheduleDateTime}
              onChange={setRescheduleDateTime}
              ariaLabel={t("appointments.dateTime")}
              required
            />
          </Field>
        </FormModal>
      )}

      {cancelTarget && (
        <FormModal
          title={t("appointments.cancel")}
          onClose={() => setCancelTarget(null)}
          onSubmit={submitCancel}
          submitLabel={t("appointments.cancel")}
          error={cancelError}
        >
          <Field label={t("appointments.cancelReason")}>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
            />
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

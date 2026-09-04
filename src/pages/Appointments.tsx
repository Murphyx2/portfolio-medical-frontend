import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AppointmentCalendar, getVisibleRange } from "../components/AppointmentCalendar";
import { DateNavigator } from "../components/DateNavigator";
import { DateTimeField } from "../components/DateTimeField";
import { ListPage } from "../components/ListPage";
import { PatientFormModal } from "../components/PatientFormModal";
import {
  ConfirmDialog,
  Dialog,
  Field,
  FormModal,
  MaskedValue,
  RowActionsMenu,
  SearchableSelect,
  SearchBar,
  useRowConfirm,
  Page,
  type Column,
  type RowActionsMenuItem,
} from "../components/ui";
import { useCalendarAppointments } from "../hooks/useCalendarAppointments";
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
  Role,
  Service,
  ServiceType,
} from "../services/types";
import { useAuth } from "../store/auth";
import { can, canEditAppointment } from "../utils/can";
import { formatCedula } from "../utils/cedula";
import { formatDateTime, nextLocalISO, todayLocalISO } from "../utils/date";
import { flattenError } from "../utils/errors";
import { toSentenceCase } from "../utils/text";

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

// `value` is the "YYYY-MM-DDTHH:mm" shape DateTimeField emits -- `new
// Date(...)` parses it in the browser's local timezone, matching how the
// field displays it.
function isPastLocal(value: string): boolean {
  return !!value && new Date(value) < new Date();
}

const genderLabelKeys: Record<string, string> = {
  MALE: "patients.genderMale",
  FEMALE: "patients.genderFemale",
};

/** "Enviar recordatorio WhatsApp" (Requirements/Communications §7.3 manual
 * resend). Disabled with a tooltip when the patient has no phone/opt-in
 * (`patient_info.whatsapp_opt_in` -- backend nested serializer field, may be
 * absent on older cached responses, treated as false when missing). */
function WhatsappReminderButton({ appointment }: { appointment: Appointment }) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const eligible = Boolean(appointment.patient_info.whatsapp_opt_in && appointment.patient_info.phone);

  async function send() {
    setSending(true);
    setMessage("");
    try {
      await api.post(`/appointments/${appointment.id}/send_whatsapp_reminder/`, {});
      setMessage(t("communications.appointmentReminder.queued"));
    } catch (err) {
      setMessage(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <span title={eligible ? undefined : t("communications.appointmentReminder.disabled")}>
      <button className="btn small ghost" disabled={!eligible || sending} onClick={send}>
        {t("communications.appointmentReminder.send")}
      </button>
      {message && <span className="muted"> {message}</span>}
    </span>
  );
}

/** Read-only "appointment details" dialog opened by clicking a row's
 * patient name or date/time cell — mirrors the click-to-detail pattern in
 * Patients.tsx / Encounters.tsx, giving a full view without forcing users
 * through the Edit form just to look. */
export function AppointmentDetailsDialog({
  appointment,
  onClose,
  showActions,
  canEdit,
  role,
  canConfirm,
  canComplete,
  canCancel,
  canDelete,
  isAdmin,
  onEdit,
  onReschedule,
  onConfirm,
  onComplete,
  onCancel,
  onDelete,
  onRestore,
}: {
  appointment: Appointment;
  onClose: () => void;
  /** Renders the same row-actions the table's "actions" column shows
   * (Edit/Reschedule/Confirm/Complete/Cancel/Delete/Restore), for Calendar
   * mode where events are too small to carry buttons of their own. When
   * omitted/false, behavior is byte-for-byte identical to before this prop
   * existed -- List mode's usage must not pass it. */
  showActions?: boolean;
  canEdit?: boolean;
  /** Requesting user's role, used only for the Edit button's status-aware
   * check (canEditAppointment) -- COMPLETED appointments are locked to
   * ADMIN/CENTER_MANAGER regardless of the base `canEdit` permission. */
  role?: Role;
  canConfirm?: boolean;
  canComplete?: boolean;
  canCancel?: boolean;
  canDelete?: boolean;
  isAdmin?: boolean;
  onEdit?: (a: Appointment) => void;
  onReschedule?: (a: Appointment) => void;
  onConfirm?: (a: Appointment) => void;
  onComplete?: (a: Appointment) => void;
  onCancel?: (a: Appointment) => void;
  onDelete?: (a: Appointment) => void;
  onRestore?: (a: Appointment) => void;
}) {
  const { t } = useTranslation();
  const statusLabel = (s: string) => t(`appointments.status${s[0]}${s.slice(1).toLowerCase()}`);
  const genderLabelKey = genderLabelKeys[appointment.patient_info.gender];
  const genderLabel = genderLabelKey ? t(genderLabelKey) : undefined;

  return (
    <Dialog title={t("appointments.details")} onClose={onClose} wide>
      <div className="encounter-detail-badges">
        <span className={`badge status-${appointment.status.toLowerCase()}`}>{statusLabel(appointment.status)}</span>
      </div>

      <div className="form-columns">
        <div>
          <h4>{t("appointments.patient")}</h4>
          <div className="kv-grid">
            <div><b>{t("common.name")}:</b> <MaskedValue value={appointment.patient_info.full_name} /></div>
            <div><b>{t("appointments.phone")}:</b> <MaskedValue value={formatPhone(appointment.patient_info.phone)} /></div>
            {genderLabel && <div><b>{t("patients.gender")}:</b> {genderLabel}</div>}
          </div>
        </div>
        <div>
          <h4>{t("appointments.dateTime")}</h4>
          <div className="kv-grid">
            <div><b>{t("appointments.doctor")}:</b> {appointment.doctor_info.full_name}</div>
            <div><b>{t("appointments.service")}:</b> {appointment.service_detail?.name ?? "—"}</div>
            <div><b>{t("appointments.dateTime")}:</b> {formatDateTime(appointment.date_time)}</div>
            <div><b>{t("appointments.duration")}:</b> {appointment.duration_minutes}</div>
            <div><b>{t("appointments.center")}:</b> {appointment.center_name ?? "—"}</div>
          </div>
        </div>
      </div>

      <h4>{t("appointments.notes")}</h4>
      <p>{appointment.notes || "—"}</p>

      {appointment.status === "CANCELLED" && (
        <>
          <h4>{t("appointments.cancelReason")}</h4>
          <p>{appointment.cancel_reason || "—"}</p>
        </>
      )}

      <div className="kv-grid">
        <div><b>{t("appointments.createdBy")}:</b> {appointment.created_by_name}</div>
        <div><b>{t("appointments.createdAt")}:</b> {formatDateTime(appointment.created_at)}</div>
      </div>

      <div className="modal-actions">
        {showActions && (
          <div className="row-actions">
            {canEditAppointment(role, appointment.status) && appointment.active && (
              <button className="btn small ghost" onClick={() => onEdit?.(appointment)}>{t("common.edit")}</button>
            )}
            {canEdit && (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") && (
              <button className="btn small ghost" onClick={() => onReschedule?.(appointment)}>{t("appointments.reschedule")}</button>
            )}
            {canConfirm && appointment.status === "SCHEDULED" && (
              <button className="btn small" onClick={() => onConfirm?.(appointment)}>{t("appointments.confirm")}</button>
            )}
            {canComplete && appointment.status === "CONFIRMED" && (
              <button className="btn small" onClick={() => onComplete?.(appointment)}>{t("appointments.complete")}</button>
            )}
            {canCancel && (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") && (
              <button className="btn small danger" onClick={() => onCancel?.(appointment)}>{t("appointments.cancel")}</button>
            )}
            {can(role, "sendManualReminder", "communications") &&
              (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") && (
                <WhatsappReminderButton appointment={appointment} />
              )}
            {canDelete && appointment.active && (
              <button className="btn small danger" onClick={() => onDelete?.(appointment)}>{t("common.delete")}</button>
            )}
            {isAdmin && !appointment.active && (
              <button className="btn small" onClick={() => onRestore?.(appointment)}>{t("common.restore")}</button>
            )}
          </div>
        )}
        <button type="button" className="btn ghost" onClick={onClose}>{t("common.close")}</button>
      </div>
    </Dialog>
  );
}

export function Appointments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Locks the Doctor field to the logged-in doctor's own profile (mirrors
  // RecetaComposerModal's isDoctorRole handling) so useDoctorServiceFilter
  // has a doctor to narrow against from the very first render, instead of
  // showing every service until the doctor manually re-picks themselves.
  const isDoctorRole = user?.role === "DOCTOR";
  const canCreate = can(user?.role, "create", "appointments");
  const canEdit = can(user?.role, "edit", "appointments");
  const canConfirm = can(user?.role, "confirm", "appointments");
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
  const [dateTimeError, setDateTimeError] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleDateTimeError, setRescheduleDateTimeError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [detailsTarget, setDetailsTarget] = useState<Appointment | null>(null);
  // Calendar mode: List and Calendar are two independent views over the
  // same data (default view is Calendar, per the plan) -- List keeps
  // today's exact single-day/table/pagination UI below, Calendar renders
  // AppointmentCalendar instead and fetches its own wider date range.
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [calendarRange, setCalendarRange] = useState(() => getVisibleRange(new Date(), "month"));
  const [calendarSearch, setCalendarSearch] = useState("");
  const [calendarDetailsTarget, setCalendarDetailsTarget] = useState<Appointment | null>(null);
  const {
    appointments: calendarAppointments,
    loading: calendarLoading,
    reload: reloadCalendar,
  } = useCalendarAppointments(calendarRange.start, calendarRange.end);
  const confirm = useRowConfirm<"confirm" | "complete" | "delete" | "restore", Appointment>();
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

  // Client-side substring filter over the already-fetched calendar range --
  // no per-keystroke refetch (unlike List mode's server-side search).
  const filteredCalendarAppointments = useMemo(() => {
    const q = calendarSearch.trim().toLowerCase();
    if (!q) return calendarAppointments;
    return calendarAppointments.filter(
      (a) =>
        a.patient_info.full_name.toLowerCase().includes(q) ||
        a.doctor_info.full_name.toLowerCase().includes(q) ||
        (a.service_detail?.name ?? "").toLowerCase().includes(q),
    );
  }, [calendarAppointments, calendarSearch]);

  const { availableDoctors, availableServices } = useDoctorServiceFilter({
    doctors,
    services,
    serviceTypes,
    selectedServiceIds: [form.service],
    currentDoctorId: form.doctor,
  });

  const myDoctorId = isDoctorRole ? (doctors.find((d) => d.user_id === user?.id)?.id ?? 0) : 0;

  useEffect(() => {
    // Form-picker options: fetched once, not on every page/sort/search
    // change (unlike `load`, which re-runs then). Patients are looked up
    // on demand instead (SearchableSelect), not preloaded in bulk.
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100").then((r) => setDoctors(r.results)).catch(() => {});
    api.get<Paginated<Service>>("/services/?page_size=200").then((r) => setServices(r.results)).catch(() => {});
    api.get<Paginated<ServiceType>>("/service-types/?page_size=100").then((r) => setServiceTypes(r.results)).catch(() => {});
  }, []);

  // Doctor profiles load asynchronously and the "+ New appointment" button
  // may already have opened the form before that resolves -- catch up here
  // once `doctors` arrives, same "only while still unset" guard the
  // composer's own auto-resolve relies on so this never clobbers an
  // in-progress edit.
  useEffect(() => {
    if (isDoctorRole && myDoctorId && modal && !editingAppointment && form.doctor === 0) {
      setForm((f) => ({ ...f, doctor: myDoctorId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctors, modal]);

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
    setDateTimeError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    if (!form.doctor) {
      setFormError(t("appointments.doctorRequired"));
      return;
    }
    if (!form.service) {
      setFormError(t("appointments.serviceRequired"));
      return;
    }
    const originalDateTime = editingAppointment ? toDateTimeLocalInput(editingAppointment.date_time) : null;
    if (form.date_time !== originalDateTime && isPastLocal(form.date_time)) {
      setDateTimeError(t("appointments.dateTimePast"));
      return;
    }
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
      reloadCalendar();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  function openReschedule(a: Appointment) {
    setRescheduleTarget(a);
    setRescheduleDateTime(toDateTimeLocalInput(a.date_time));
    setRescheduleError("");
    setRescheduleDateTimeError("");
  }

  async function submitReschedule() {
    if (!rescheduleTarget) return;
    setRescheduleError("");
    const originalDateTime = toDateTimeLocalInput(rescheduleTarget.date_time);
    if (rescheduleDateTime !== originalDateTime && isPastLocal(rescheduleDateTime)) {
      setRescheduleDateTimeError(t("appointments.dateTimePast"));
      return;
    }
    try {
      await api.post(`/appointments/${rescheduleTarget.id}/reschedule/`, {
        date_time: new Date(rescheduleDateTime).toISOString(),
      });
      setRescheduleTarget(null);
      load();
      reloadCalendar();
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
      reloadCalendar();
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
      reloadCalendar();
    });
  }

  const confirmCopy = confirm.confirming
    ? (() => {
        const { type, row } = confirm.confirming!;
        const time = formatDateTime(row.date_time);
        const patient = row.patient_info.full_name;
        switch (type) {
          case "confirm":
            return { title: t("appointments.confirm"), message: t("appointments.confirmConfirm", { patient, time }), confirmLabel: t("appointments.confirm"), danger: false };
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

  // Matches Patients.tsx/Encounters.tsx's click-to-detail pattern: the
  // patient name and date/time cells open a read-only details dialog
  // instead of forcing users through the Edit form just to look.
  const openDetailLink = (r: Appointment, content: ReactNode) => (
    <button type="button" className="row-link" onClick={() => setDetailsTarget(r)}>
      {content}
    </button>
  );

  // Calendar mode's details dialog (`showActions`) reuses the exact same
  // handlers as the table's row-actions column below -- wrapped so picking
  // an action first closes the details dialog it was opened from, instead
  // of leaving it stacked underneath the edit/reschedule/cancel/confirm
  // dialog that opens next.
  function fromCalendarDetails<T extends unknown[]>(fn: (...args: T) => void) {
    return (...args: T) => {
      setCalendarDetailsTarget(null);
      fn(...args);
    };
  }

  const columns: Column<Appointment>[] = [
    { key: "date_time", header: t("appointments.dateTime"), sortKey: "date_time", render: (r) => openDetailLink(r, formatDateTime(r.date_time)) },
    { key: "patient", header: t("appointments.patient"), sortKey: "patient__search_name", render: (r) => openDetailLink(r, r.patient_info.full_name) },
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
      render: (r) => {
        const items: RowActionsMenuItem[] = [
          ...(canEdit && (r.status === "SCHEDULED" || r.status === "CONFIRMED")
            ? [{ key: "reschedule", label: t("appointments.reschedule"), onClick: () => openReschedule(r) }]
            : []),
          ...(canConfirm && r.status === "SCHEDULED"
            ? [{ key: "confirm", label: t("appointments.confirm"), onClick: () => confirm.open("confirm", r) }]
            : []),
          ...(canComplete && r.status === "CONFIRMED"
            ? [{ key: "complete", label: t("appointments.complete"), onClick: () => confirm.open("complete", r) }]
            : []),
          ...(canCancel && (r.status === "SCHEDULED" || r.status === "CONFIRMED")
            ? [{ key: "cancel", label: t("appointments.cancel"), danger: true, onClick: () => openCancel(r) }]
            : []),
          ...(canDelete && r.active
            ? [{ key: "delete", label: t("common.delete"), danger: true, onClick: () => confirm.open("delete", r) }]
            : []),
          ...(isAdmin && !r.active
            ? [{ key: "restore", label: t("common.restore"), onClick: () => confirm.open("restore", r) }]
            : []),
        ];
        return (
          <RowActionsMenu
            ariaLabel={r.patient_info.full_name}
            primary={
              canEditAppointment(user?.role, r.status) && r.active && (
                <button className="btn small ghost" onClick={() => openEdit(r)}>{t("common.edit")}</button>
              )
            }
            items={items}
          />
        );
      },
    },
  ];

  const viewToggle = (
    <div className="view-toggle" role="tablist" aria-label={t("appointments.viewToggle")}>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "calendar"}
        className={viewMode === "calendar" ? "view-toggle-btn active" : "view-toggle-btn"}
        onClick={() => setViewMode("calendar")}
      >
        {t("appointments.viewCalendar")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "list"}
        className={viewMode === "list" ? "view-toggle-btn active" : "view-toggle-btn"}
        onClick={() => setViewMode("list")}
      >
        {t("appointments.viewList")}
      </button>
    </div>
  );

  return (
    <Page
      card
      title={t("appointments.title")}
      actions={
        canCreate && (
          <button
            className="btn primary"
            onClick={() => { setEditingAppointment(null); setForm({ ...EMPTY, doctor: myDoctorId }); setSelectedPatient(null); setFormError(""); setDateTimeError(""); setModal(true); }}
          >
            + {t("appointments.new")}
          </button>
        )
      }
    >
      {viewMode === "list" ? (
        <ListPage<Appointment>
          initialLoading={initialLoading}
          search={search}
          setSearch={setSearch}
          searchSubmit={searchSubmit}
          toolbarStart={viewToggle}
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
      ) : (
        <>
          <div className="list-toolbar">
            {viewToggle}
            <SearchBar
              value={calendarSearch}
              onChange={setCalendarSearch}
              placeholder={t("common.searchPlaceholder")}
              label={t("common.search")}
            />
            {calendarLoading && <span className="calendar-loading">{t("common.loading")}</span>}
          </div>
          <AppointmentCalendar
            appointments={filteredCalendarAppointments}
            onSelectAppointment={(a) => setCalendarDetailsTarget(a)}
            onRangeChange={setCalendarRange}
          />
        </>
      )}

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
            {isDoctorRole ? (
              <p className="receta-patient-info">
                <strong>{doctors.find((d) => d.id === form.doctor)?.full_name ?? "—"}</strong>
              </p>
            ) : (
              <SearchableSelect<DoctorProfile>
                value={availableDoctors.find((d) => d.id === form.doctor) ?? null}
                onSelect={(d) => pickDoctor(d.id)}
                search={async (query) => {
                  const q = query.trim().toLowerCase();
                  const results = q ? availableDoctors.filter((d) => d.full_name.toLowerCase().includes(q)) : availableDoctors;
                  return { results, count: results.length };
                }}
                minChars={1}
                placeholder={t("appointments.doctor")}
                getLabel={(d) => d.full_name}
                autoFocus={false}
              />
            )}
          </Field>
          <Field label={t("appointments.service")}>
            <SearchableSelect<Service>
              value={availableServices.find((s) => s.id === form.service) ?? null}
              onSelect={(s) => setForm({ ...form, service: s.id })}
              search={async (query) => {
                const q = query.trim().toLowerCase();
                const results = q ? availableServices.filter((s) => s.name.toLowerCase().includes(q)) : availableServices;
                return { results, count: results.length };
              }}
              minChars={1}
              placeholder={t("appointments.service")}
              getLabel={(s) => toSentenceCase(s.name)}
              getSublabel={(s) => toSentenceCase(s.type_name)}
              autoFocus={false}
            />
          </Field>
          <Field label={t("appointments.dateTime")}>
            <DateTimeField
              value={form.date_time}
              onChange={(v) => { setForm({ ...form, date_time: v }); setDateTimeError(""); }}
              ariaLabel={t("appointments.dateTime")}
              min={editingAppointment ? undefined : new Date().toISOString().slice(0, 16)}
              required
            />
            {dateTimeError && <span className="field-error">{dateTimeError}</span>}
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
              onChange={(v) => { setRescheduleDateTime(v); setRescheduleDateTimeError(""); }}
              ariaLabel={t("appointments.dateTime")}
              min={new Date().toISOString().slice(0, 16)}
              required
            />
            {rescheduleDateTimeError && <span className="field-error">{rescheduleDateTimeError}</span>}
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

      {detailsTarget && (
        <AppointmentDetailsDialog appointment={detailsTarget} onClose={() => setDetailsTarget(null)} />
      )}

      {calendarDetailsTarget && (
        <AppointmentDetailsDialog
          appointment={calendarDetailsTarget}
          onClose={() => setCalendarDetailsTarget(null)}
          showActions
          canEdit={canEdit}
          role={user?.role}
          canConfirm={canConfirm}
          canComplete={canComplete}
          canCancel={canCancel}
          canDelete={canDelete}
          isAdmin={isAdmin}
          onEdit={fromCalendarDetails(openEdit)}
          onReschedule={fromCalendarDetails(openReschedule)}
          onConfirm={fromCalendarDetails((a) => confirm.open("confirm", a))}
          onComplete={fromCalendarDetails((a) => confirm.open("complete", a))}
          onCancel={fromCalendarDetails(openCancel)}
          onDelete={fromCalendarDetails((a) => confirm.open("delete", a))}
          onRestore={fromCalendarDetails((a) => confirm.open("restore", a))}
        />
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

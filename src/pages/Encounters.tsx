import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PatientFormModal } from "../components/PatientFormModal";
import {
  ConfirmDialog,
  Field,
  FormModal,
  MaskedValue,
  Page,
  Pagination,
  SearchableSelect,
  SearchBar,
  Spinner,
  Table,
  type Column,
} from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type {
  ARS,
  DoctorProfile,
  Encounter,
  EncounterDiagnosis,
  EncounterPatientSummary,
  EncounterService,
  EncounterType,
  Paginated,
  Patient,
  Room,
  Service,
} from "../services/types";
import { useAuth } from "../store/auth";
import { formatCedula } from "../utils/cedula";
import { flattenError } from "../utils/errors";

const EMPTY_FORM = {
  encounter_type: 0,
  doctor: 0,
  referring_doctor_name: "",
  room: 0,
  chief_complaint: "",
  priority: "ROUTINE" as Encounter["priority"],
  ars: "",
  ars_program: "",
  authorization_number: "",
  diagnoses: [] as EncounterDiagnosis[],
  services: [] as EncounterService[],
};

type ConfirmAction = "admit" | "cancel" | "complete" | "delete" | "restore";

export function Encounters() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "DOCTOR" ||
    user?.role === "RECEPTIONIST" ||
    user?.role === "NURSE" ||
    user?.role === "CENTER_MANAGER";
  const isAdmin = user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN" || user?.role === "IT";

  const [rows, setRows] = useState<Encounter[]>([]);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [encounterTypes, setEncounterTypes] = useState<EncounterType[]>([]);
  const [arsList, setArsList] = useState<ARS[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const [modal, setModal] = useState(false);
  const [editingEncounter, setEditingEncounter] = useState<Encounter | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientModal, setPatientModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [confirming, setConfirming] = useState<{ type: ConfirmAction; row: Encounter } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  // True once an admit attempt has come back with ACTIVE_ENCOUNTER_EXISTS --
  // the same ConfirmDialog switches to an "admit anyway?" prompt so the next
  // confirm click retries with override_conflict:true.
  const [conflictPrompt, setConflictPrompt] = useState(false);

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
  } = useListControls({ key: "created_at", dir: "desc" });

  const qs = query({ include_inactive: showInactive ? "true" : "", status: statusFilter });

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<Encounter>>(`/encounters/?${qs}`, { signal }))
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
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100").then((r) => setDoctors(r.results)).catch(() => {});
    api.get<Paginated<Room>>("/rooms/?page_size=100").then((r) => setRooms(r.results)).catch(() => {});
    api.get<Paginated<EncounterType>>("/encounter-types/?page_size=100").then((r) => setEncounterTypes(r.results)).catch(() => {});
    api.get<Paginated<ARS>>("/ars/?page_size=100").then((r) => setArsList(r.results)).catch(() => {});
    api.get<Paginated<Service>>("/services/?page_size=200").then((r) => setServices(r.results)).catch(() => {});
  }, []);

  const searchPatients = useCallback((q: string): Promise<Patient[]> => {
    return api
      .get<Paginated<Patient>>(`/patients/?page_size=20${q ? `&search=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.results)
      .catch(() => []);
  }, []);

  const selectedArs = arsList.find((a) => String(a.id) === form.ars);

  const patientSummary: EncounterPatientSummary | null = editingEncounter
    ? editingEncounter.patient_info
    : selectedPatient
      ? {
          id: selectedPatient.id,
          full_name: selectedPatient.full_name,
          age: selectedPatient.age,
          gender: selectedPatient.gender,
          cedula: selectedPatient.cedula,
          allergies: selectedPatient.allergies,
          critical_conditions: selectedPatient.critical_conditions,
          ars_name: selectedPatient.ars_name,
        }
      : null;

  function openNew() {
    setEditingEncounter(null);
    setSelectedPatient(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModal(true);
  }

  function openEdit(r: Encounter) {
    setEditingEncounter(r);
    setSelectedPatient(null);
    setForm({
      encounter_type: r.encounter_type,
      doctor: r.doctor,
      referring_doctor_name: r.referring_doctor_name,
      room: r.room ?? 0,
      chief_complaint: r.chief_complaint,
      priority: r.priority,
      ars: r.ars ? String(r.ars) : "",
      ars_program: r.ars_program ? String(r.ars_program) : "",
      authorization_number: r.authorization_number,
      diagnoses: r.diagnoses,
      services: r.services,
    });
    setFormError("");
    setModal(true);
  }

  function pickDoctor(doctorId: number) {
    const doctor = doctors.find((d) => d.id === doctorId);
    setForm((f) => ({
      ...f,
      doctor: doctorId,
      // Pre-fill from the doctor's default room, but only if the room field
      // is still empty -- never clobber a room the user already picked.
      room: f.room || (doctor?.default_room ?? 0),
    }));
  }

  function addDiagnosis() {
    setForm((f) => ({
      ...f,
      diagnoses: [...f.diagnoses, { description: "", is_primary: f.diagnoses.length === 0 }],
    }));
  }

  function updateDiagnosis(index: number, patch: Partial<EncounterDiagnosis>) {
    setForm((f) => ({
      ...f,
      diagnoses: f.diagnoses.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }));
  }

  function removeDiagnosis(index: number) {
    setForm((f) => ({ ...f, diagnoses: f.diagnoses.filter((_, i) => i !== index) }));
  }

  function addServiceLine() {
    setForm((f) => ({
      ...f,
      services: [
        ...f.services,
        { service: 0, doctor: null, quantity: 1, notes: "", status: "PENDING" },
      ],
    }));
  }

  function updateServiceLine(index: number, patch: Partial<EncounterService>) {
    setForm((f) => ({
      ...f,
      services: f.services.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function removeServiceLine(index: number) {
    setForm((f) => ({ ...f, services: f.services.filter((_, i) => i !== index) }));
  }

  async function submit() {
    const patientId = editingEncounter ? editingEncounter.patient : selectedPatient?.id;
    if (!patientId) {
      setFormError(t("encounters.patientRequired"));
      return;
    }
    if (!form.encounter_type || !form.doctor) {
      setFormError(t("encounters.typeAndDoctorRequired"));
      return;
    }
    const body = {
      patient: patientId,
      encounter_type: Number(form.encounter_type),
      doctor: Number(form.doctor),
      referring_doctor_name: form.referring_doctor_name,
      room: form.room || null,
      chief_complaint: form.chief_complaint,
      priority: form.priority,
      ars: form.ars ? Number(form.ars) : null,
      ars_program: form.ars_program ? Number(form.ars_program) : null,
      authorization_number: form.authorization_number,
      diagnoses: form.diagnoses.filter((d) => d.description.trim()),
      services: form.services.filter((s) => s.service),
    };
    try {
      if (editingEncounter) await api.patch(`/encounters/${editingEncounter.id}/`, body);
      else await api.post("/encounters/", body);
      setFormError("");
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  function closeConfirm() {
    setConfirming(null);
    setCancelReason("");
    setActionError("");
    setConflictPrompt(false);
  }

  async function runConfirmedAction() {
    if (!confirming) return;
    const { type, row } = confirming;
    setActionPending(true);
    setActionError("");
    try {
      if (type === "delete") {
        await api.delete(`/encounters/${row.id}/`);
      } else if (type === "cancel") {
        await api.post(`/encounters/${row.id}/cancel/`, { reason: cancelReason });
      } else if (type === "admit") {
        await api.post(`/encounters/${row.id}/admit/`, conflictPrompt ? { override_conflict: true } : {});
      } else {
        await api.post(`/encounters/${row.id}/${type}/`, {});
      }
      setConfirming(null);
      setCancelReason("");
      setConflictPrompt(false);
      load();
    } catch (err) {
      const message = err instanceof ApiError ? flattenError(err.message) : String(err);
      // The admit action returns this specific message when the patient
      // already has another active encounter today (code
      // ACTIVE_ENCOUNTER_EXISTS) -- offer to override instead of just
      // showing the error, since it's a soft warning, not a hard block.
      if (type === "admit" && !conflictPrompt && message.includes("already has an active encounter")) {
        setConflictPrompt(true);
      } else {
        setActionError(message);
      }
    } finally {
      setActionPending(false);
    }
  }

  const statusLabel = (s: string) => t(`encounters.status${s[0]}${s.slice(1).toLowerCase()}`);
  const priorityLabel = (p: string) => t(`encounters.priority${p[0]}${p.slice(1).toLowerCase()}`);

  const canEditRow = (r: Encounter) =>
    canManage &&
    r.status !== "COMPLETED" &&
    r.status !== "CANCELLED" &&
    !r.services.some((s) => s.status === "COMPLETED");

  const confirmCopy = confirming
    ? (() => {
        const { type, row } = confirming;
        const patient = row.patient_info.full_name;
        switch (type) {
          case "admit":
            return { title: t("encounters.admit"), message: t("encounters.admitConfirm", { patient }), confirmLabel: t("encounters.admit"), danger: false };
          case "cancel":
            return { title: t("encounters.cancel"), message: t("encounters.cancelConfirm", { patient }), confirmLabel: t("encounters.cancel"), danger: true };
          case "complete":
            return { title: t("encounters.complete"), message: t("encounters.completeConfirm", { patient }), confirmLabel: t("encounters.complete"), danger: false };
          case "delete":
            return { title: t("common.delete"), message: t("common.deleteConfirmNamed", { name: patient }), confirmLabel: t("common.delete"), danger: true };
          case "restore":
            return { title: t("common.restore"), message: t("common.restoreConfirmNamed", { name: patient }), confirmLabel: t("common.restore"), danger: false };
        }
      })()
    : null;

  const columns: Column<Encounter>[] = [
    { key: "encounter_number", header: t("encounters.number"), render: (r) => r.encounter_number ?? "—" },
    { key: "patient", header: t("encounters.patient"), sortKey: "patient__search_name", render: (r) => <MaskedValue value={r.patient_info.full_name} /> },
    { key: "doctor", header: t("encounters.doctor"), sortKey: "doctor__user__last_name", render: (r) => r.doctor_info.full_name },
    { key: "encounter_type_name", header: t("encounters.type") },
    { key: "room_name", header: t("encounters.room"), render: (r) => r.room_name ?? "—" },
    { key: "priority", header: t("encounters.priority"), sortKey: "priority", render: (r) => <span className={`badge status-${r.priority.toLowerCase()}`}>{priorityLabel(r.priority)}</span> },
    { key: "status", header: t("common.status"), sortKey: "status", render: (r) => <span className={`badge status-${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span> },
    { key: "created_at", header: t("encounters.createdAt"), sortKey: "created_at", render: (r) => new Date(r.created_at).toLocaleString() },
    {
      key: "actions",
      header: t("common.actions"),
      render: (r) => (
        <>
          {canEditRow(r) && (
            <button className="btn small ghost" onClick={() => openEdit(r)}>{t("common.edit")}</button>
          )}
          {canManage && r.status === "DRAFT" && (
            <button className="btn small" onClick={() => setConfirming({ type: "admit", row: r })}>{t("encounters.admit")}</button>
          )}
          {canManage && r.status === "ACTIVE" && (
            <button className="btn small" onClick={() => setConfirming({ type: "complete", row: r })}>{t("encounters.complete")}</button>
          )}
          {canManage && (r.status === "DRAFT" || r.status === "ACTIVE") && (
            <button className="btn small danger" onClick={() => setConfirming({ type: "cancel", row: r })}>{t("encounters.cancel")}</button>
          )}
          <button className="btn small ghost" onClick={() => navigate(`/records?patient=${r.patient}`)}>
            {t("encounters.openRecord")}
          </button>
          {canDelete && r.active && (
            <button className="btn small danger" onClick={() => setConfirming({ type: "delete", row: r })}>{t("common.delete")}</button>
          )}
          {isAdmin && !r.active && (
            <button className="btn small" onClick={() => setConfirming({ type: "restore", row: r })}>{t("common.restore")}</button>
          )}
        </>
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
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t("encounters.allStatuses")}</option>
              {(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const).map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
            {isAdmin && (
              <label className="show-inactive-toggle">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                {t("common.showInactive")}
              </label>
            )}
          </div>
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          <Table
            columns={columns}
            rows={rows}
            getRowLabel={(r) => r.encounter_number ?? r.patient_info.full_name}
            isInactive={(r) => !r.active}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

      {modal && (
        <FormModal
          title={editingEncounter ? t("common.edit") : t("encounters.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
          wide
        >
          <h4>{t("encounters.sectionPatient")}</h4>
          {editingEncounter ? (
            <p><MaskedValue value={editingEncounter.patient_info.full_name} /></p>
          ) : (
            <>
              <Field label={t("encounters.patient")}>
                <SearchableSelect<Patient>
                  value={selectedPatient}
                  onSelect={setSelectedPatient}
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

          {patientSummary && (
            <div className="kv-grid encounter-summary-card">
              <div><b>{t("patients.age")}:</b> {patientSummary.age ?? "—"}</div>
              <div><b>{t("patients.gender")}:</b> {patientSummary.gender ?? "—"}</div>
              <div><b>{t("patients.ars")}:</b> {patientSummary.ars_name ?? "—"}</div>
              {patientSummary.allergies && (
                <div className="encounter-alert"><b>{t("patients.allergies")}:</b> <MaskedValue value={patientSummary.allergies} /></div>
              )}
              {patientSummary.critical_conditions && (
                <div className="encounter-alert"><b>{t("patients.criticalConditions")}:</b> <MaskedValue value={patientSummary.critical_conditions} /></div>
              )}
            </div>
          )}

          <h4>{t("encounters.sectionAdmission")}</h4>
          <div className="form-columns">
            <Field label={t("encounters.type")}>
              <select value={form.encounter_type} onChange={(e) => setForm({ ...form, encounter_type: Number(e.target.value) })} required>
                <option value={0} disabled>—</option>
                {encounterTypes.map((et) => (
                  <option key={et.id} value={et.id}>{et.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("encounters.doctor")}>
              <select value={form.doctor} onChange={(e) => pickDoctor(Number(e.target.value))} required>
                <option value={0} disabled>—</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("encounters.room")}>
              <select value={form.room} onChange={(e) => setForm({ ...form, room: Number(e.target.value) })}>
                <option value={0}>—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("encounters.priority")}>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Encounter["priority"] })}>
                <option value="ROUTINE">{priorityLabel("ROUTINE")}</option>
                <option value="URGENT">{priorityLabel("URGENT")}</option>
                <option value="EMERGENCY">{priorityLabel("EMERGENCY")}</option>
              </select>
            </Field>
          </div>
          <Field label={t("encounters.referringDoctor")}>
            <input value={form.referring_doctor_name} onChange={(e) => setForm({ ...form, referring_doctor_name: e.target.value })} />
          </Field>
          <Field label={t("encounters.chiefComplaint")}>
            <textarea value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} />
          </Field>

          <h4>{t("encounters.sectionDiagnoses")}</h4>
          {form.diagnoses.map((d, i) => (
            <div key={i} className="form-columns encounter-line-row">
              <Field label={t("encounters.diagnosisDescription")}>
                <input value={d.description} onChange={(e) => updateDiagnosis(i, { description: e.target.value })} />
              </Field>
              <label className="show-inactive-toggle">
                <input
                  type="radio"
                  name="primary-diagnosis"
                  checked={d.is_primary}
                  onChange={() =>
                    setForm((f) => ({
                      ...f,
                      diagnoses: f.diagnoses.map((dd, ii) => ({ ...dd, is_primary: ii === i })),
                    }))
                  }
                />
                {t("encounters.primary")}
              </label>
              <button type="button" className="btn ghost small" onClick={() => removeDiagnosis(i)}>
                {t("common.delete")}
              </button>
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={addDiagnosis}>
            + {t("encounters.addDiagnosis")}
          </button>

          <h4>{t("encounters.sectionServices")}</h4>
          {form.services.map((s, i) => (
            <div key={i} className="form-columns encounter-line-row">
              <Field label={t("encounters.service")}>
                <select value={s.service} onChange={(e) => updateServiceLine(i, { service: Number(e.target.value) })}>
                  <option value={0} disabled>—</option>
                  {services.map((sv) => (
                    <option key={sv.id} value={sv.id}>{sv.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("encounters.quantity")}>
                <input type="number" min={1} value={s.quantity} onChange={(e) => updateServiceLine(i, { quantity: Number(e.target.value) })} />
              </Field>
              <Field label={t("encounters.serviceNotes")}>
                <input value={s.notes} onChange={(e) => updateServiceLine(i, { notes: e.target.value })} />
              </Field>
              <button type="button" className="btn ghost small" onClick={() => removeServiceLine(i)}>
                {t("common.delete")}
              </button>
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={addServiceLine}>
            + {t("encounters.addService")}
          </button>

          <h4>{t("encounters.sectionCoverage")}</h4>
          <div className="form-columns">
            <Field label={t("patients.ars")}>
              <select value={form.ars} onChange={(e) => setForm({ ...form, ars: e.target.value, ars_program: "" })}>
                <option value="">—</option>
                {arsList.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("patients.arsProgram")}>
              <select value={form.ars_program} onChange={(e) => setForm({ ...form, ars_program: e.target.value })} disabled={!form.ars}>
                <option value="">—</option>
                {(selectedArs?.programs ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("encounters.authorizationNumber")}>
              <input value={form.authorization_number} onChange={(e) => setForm({ ...form, authorization_number: e.target.value })} />
            </Field>
          </div>
        </FormModal>
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

      {confirming && confirmCopy && (
        <ConfirmDialog
          title={confirmCopy.title}
          message={conflictPrompt ? t("encounters.activeConflictConfirm") : confirmCopy.message}
          confirmLabel={conflictPrompt ? t("encounters.admitAnyway") : confirmCopy.confirmLabel}
          danger={confirmCopy.danger}
          error={actionError}
          pending={actionPending}
          onConfirm={runConfirmedAction}
          onCancel={closeConfirm}
        >
          {confirming.type === "cancel" && (
            <Field label={t("encounters.cancelReason")}>
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </Field>
          )}
        </ConfirmDialog>
      )}
    </Page>
  );
}

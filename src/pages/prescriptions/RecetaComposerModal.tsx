import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog, Dialog, Field, SearchableSelect } from "../../components/ui";
import { api, ApiError, openBlobInNewTab } from "../../services/api";
import { searchPatients } from "../../services/patients";
import { EMPTY_DOSIS, renderDosisTexto, searchMedicines } from "../../services/prescriptions";
import type {
  DoctorProfile,
  DosisJson,
  MedicalCenter,
  Medicine,
  Paginated,
  Patient,
  Receta,
  RecetaLinea,
  Service,
} from "../../services/types";
import { useAuth } from "../../store/auth";
import { calculateAge } from "../../utils/date";
import { flattenError } from "../../utils/errors";
import { DoseBuilder } from "./DoseBuilder";

/** One in-progress línea in the composer -- superset of `RecetaLinea` with a
 * few UI-only fields (the resolved `Medicine` object for display, a local
 * `key` for React lists) that never go on the wire. */
interface LineDraft {
  key: string;
  medicamento: Medicine | null;
  fueraDeCatalogo: boolean;
  nombreLibre: string;
  cantidad: string;
  concentracionValor: string;
  unidad: string;
  via: string;
  forma: string;
  dosis: DosisJson;
  indicacionExtra: string;
}

function makeKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyLine(): LineDraft {
  return {
    key: makeKey(),
    medicamento: null,
    fueraDeCatalogo: false,
    nombreLibre: "",
    cantidad: "1",
    concentracionValor: "",
    unidad: "",
    via: "",
    forma: "",
    dosis: { ...EMPTY_DOSIS },
    indicacionExtra: "",
  };
}

/** "YYYY-MM-DDTHH:mm" for right now, in local time -- `DateTimeField`'s
 * expected shape, same idea as `utils/date.ts::todayLocalISO` but including
 * the time-of-day (Fecha defaults to now per §7). */
function nowLocalDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minimal shape the composer needs from a "locked" patient (opened from the
 * Expediente, which only carries `PatientLite` on `MedicalRecord.patient_info`,
 * not the full `Patient`) -- both `Patient` and `PatientLite` structurally
 * satisfy this, so the same prop accepts either without extra mapping. */
interface PatientRef {
  id: number;
  full_name: string;
  birth_date: string | null;
  gender: string;
}

/** Reverse of `lineToPayload`, used to hydrate the composer when reopening
 * an existing draft (§3: "Editar" on a Borrador row) -- `medicine` is the
 * already-resolved `Medicine` object for a catalog line (null for a
 * fuera_de_catalogo line, or when the medicine could no longer be resolved,
 * in which case the line falls back to a free-text display of its saved
 * nombre_impreso so nothing is silently lost). */
function payloadLineToDraft(l: RecetaLinea, medicine: Medicine | null): LineDraft {
  const fueraDeCatalogo = l.fuera_de_catalogo || (!l.medicamento || !medicine);
  return {
    key: makeKey(),
    medicamento: fueraDeCatalogo ? null : medicine,
    fueraDeCatalogo,
    nombreLibre: fueraDeCatalogo ? l.nombre_impreso : "",
    cantidad: String(l.cantidad ?? 1),
    concentracionValor: l.concentracion_valor,
    unidad: l.unidad,
    via: l.via,
    forma: l.forma,
    dosis: l.dosis_json && Object.keys(l.dosis_json).length ? l.dosis_json : { ...EMPTY_DOSIS },
    indicacionExtra: l.indicacion_extra,
  };
}

function lineToPayload(l: LineDraft, orden: number): Omit<RecetaLinea, "id"> {
  const nombre_impreso = l.fueraDeCatalogo
    ? l.nombreLibre.trim()
    : l.medicamento?.commercial_name || l.medicamento?.generic_name || "";
  return {
    medicamento: l.fueraDeCatalogo ? null : l.medicamento?.id ?? null,
    nombre_impreso,
    cantidad: l.cantidad ? Number(l.cantidad) : 0,
    concentracion_valor: l.concentracionValor,
    unidad: l.unidad,
    via: l.via,
    forma: l.forma,
    fuera_de_catalogo: l.fueraDeCatalogo,
    dosis_json: l.dosis,
    dosis_texto: renderDosisTexto(l.dosis),
    indicacion_extra: l.indicacionExtra,
    uso_continuo: l.dosis.uso_continuo,
    orden,
  };
}

/**
 * The Receta composer (RECETAS_REQUIREMENTS.md §7): letterhead preview,
 * patient/médico/fechas, a lines repeater (each line pairs a catalog medicine
 * or free text with the `DoseBuilder`), and Guardar borrador / Emitir y ver
 * PDF / Cerrar. Opened either locked to a given patient (Expediente's
 * "Nueva receta") or with an open, editable patient picker (Medicamentos'
 * header button) -- `lockedPatient` selects which.
 */
export function RecetaComposerModal({ lockedPatient, initialReceta, onClose, onSaved }: {
  /** Non-null when opened from the Expediente -- the patient field renders
   * as a locked read-only display instead of a `SearchableSelect`. */
  lockedPatient: PatientRef | null;
  /** Non-null when reopening a saved Borrador for editing (§3) -- prefills
   * every field below instead of starting a brand-new draft. */
  initialReceta?: Receta | null;
  onClose: () => void;
  /** Called after a successful Guardar borrador or Emitir, so the caller can
   * refresh whatever list/tab is showing recetas. */
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isDoctorRole = user?.role === "DOCTOR";

  const [patient, setPatient] = useState<Patient | null>(null);
  const patientRef: PatientRef | null = lockedPatient ?? patient;
  const [center, setCenter] = useState<MedicalCenter | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [medico, setMedico] = useState<DoctorProfile | null>(null);
  // Never user-editable (§2, requirements §7: "Fecha -- default now"; the
  // Cita/Admisión-linked override is out of scope for this slice) -- fixed
  // at "now" for a brand-new draft, or the receta's own saved value when
  // reopening an existing one, so re-editing a draft never silently redates
  // it.
  const [fecha] = useState(initialReceta?.fecha ?? nowLocalDateTime());
  const [proximaCitaAt, setProximaCitaAt] = useState(
    initialReceta?.proxima_cita_at ? initialReceta.proxima_cita_at.slice(0, 16) : "",
  );
  const [crearCita, setCrearCita] = useState(false);
  const [servicio, setServicio] = useState<Service | null>(null);
  const [lineas, setLineas] = useState<LineDraft[]>([emptyLine()]);
  const [recetaId, setRecetaId] = useState<number | null>(initialReceta?.id ?? null);
  const [hydrating, setHydrating] = useState(!!initialReceta);

  const [dirty, setDirty] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [proximaCitaError, setProximaCitaError] = useState("");

  useEffect(() => {
    api
      .get<MedicalCenter[]>("/centers-letterhead/")
      .then((results) => {
        const mine = results.find((c) => c.id === user?.center) ?? results.find((c) => c.is_default);
        setCenter(mine ?? results[0] ?? null);
      })
      .catch(() => {});
    api
      .get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100")
      .then((r) => {
        setDoctors(r.results);
        const target = initialReceta
          ? r.results.find((d) => d.id === initialReceta.medico)
          : r.results.find((d) => d.user_id === user?.id);
        if (target) setMedico(target);
      })
      .catch(() => {});
    api
      .get<Paginated<Service>>("/services/?page_size=200")
      .then((r) => setServices(r.results))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate the lines repeater from an existing draft (§3) -- resolves each
  // catalog line's full Medicine object (the saved receta only stores its
  // id) so SearchableSelect has something to display; a line whose medicine
  // can no longer be resolved (deleted/deactivated since) falls back to a
  // free-text display of its already-snapshotted nombre_impreso rather than
  // silently dropping it.
  useEffect(() => {
    if (!initialReceta) return;
    const medicineIds = Array.from(
      new Set(initialReceta.lineas.filter((l) => !l.fuera_de_catalogo && l.medicamento != null).map((l) => l.medicamento as number)),
    );
    Promise.all(medicineIds.map((id) => api.get<Medicine>(`/medicines/${id}/`).catch(() => null)))
      .then((resolved) => {
        const byId = new Map(medicineIds.map((id, i) => [id, resolved[i]]));
        const sorted = [...initialReceta.lineas].sort((a, b) => a.orden - b.orden);
        setLineas(
          sorted.map((l) => payloadLineToDraft(l, l.medicamento != null ? (byId.get(l.medicamento) ?? null) : null)),
        );
      })
      .finally(() => setHydrating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    markDirty();
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    markDirty();
    setLineas((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    markDirty();
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function moveLine(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= lineas.length) return;
    markDirty();
    setLineas((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function pickMedicine(key: string, medicine: Medicine) {
    updateLine(key, {
      medicamento: medicine,
      fueraDeCatalogo: false,
      concentracionValor: medicine.concentracion_valor,
      unidad: medicine.concentracion_unidad,
      via: medicine.via_pred,
      forma: medicine.forma,
    });
  }

  function toggleFueraDeCatalogo(key: string, value: boolean) {
    updateLine(key, value ? { fueraDeCatalogo: true, medicamento: null } : { fueraDeCatalogo: false });
  }

  function buildPayload(estado: "BORRADOR") {
    return {
      patient: patientRef!.id,
      centro: center!.id,
      medico: medico!.id,
      fecha: fecha ? `${fecha}:00` : new Date().toISOString(),
      proxima_cita_at: proximaCitaAt ? `${proximaCitaAt}:00` : null,
      estado,
      lineas: lineas.map((l, i) => lineToPayload(l, i)),
    };
  }

  function validateBase(): string {
    if (!patientRef) return t("prescriptions.errorPatientRequired");
    if (!medico) return t("prescriptions.errorMedicoRequired");
    if (!center) return t("prescriptions.errorCenterRequired");
    return "";
  }

  async function saveDraft(): Promise<Receta | null> {
    const err = validateBase();
    if (err) {
      setFormError(err);
      return null;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = buildPayload("BORRADOR");
      const saved = recetaId
        ? await api.patch<Receta>(`/recetas/${recetaId}/`, payload)
        : await api.post<Receta>("/recetas/", payload);
      setRecetaId(saved.id);
      setDirty(false);
      return saved;
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleGuardarBorrador() {
    const saved = await saveDraft();
    if (saved) {
      onSaved();
    }
  }

  async function handleEmitir() {
    setProximaCitaError("");
    if (crearCita && !servicio) {
      setFormError(t("prescriptions.errorServicioRequired"));
      return;
    }
    const hasValidLine = lineas.some(
      (l) => (l.fueraDeCatalogo ? l.nombreLibre.trim() : l.medicamento) && l.cantidad && renderDosisTexto(l.dosis),
    );
    if (!hasValidLine) {
      setFormError(t("prescriptions.errorLineRequired"));
      return;
    }
    const saved = await saveDraft();
    if (!saved) return;
    setEmitting(true);
    setFormError("");
    try {
      await api.post(`/recetas/${saved.id}/emitir/`, {
        crear_cita: crearCita,
        proxima_cita_at: proximaCitaAt ? `${proximaCitaAt}:00` : undefined,
        servicio: crearCita ? servicio?.id : undefined,
      });
      await openBlobInNewTab(`/recetas/${saved.id}/pdf/`);
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const flat = flattenError(err.message);
        if (flat.toLowerCase().includes("horario")) {
          setProximaCitaError(flat);
        } else {
          setFormError(flat);
        }
      } else {
        setFormError(String(err));
      }
    } finally {
      setEmitting(false);
    }
  }

  function requestClose() {
    if (dirty) setConfirmingExit(true);
    else onClose();
  }

  const age = calculateAge(patientRef?.birth_date);
  const genderLabel =
    patientRef?.gender === "MALE"
      ? t("patients.genderMale")
      : patientRef?.gender === "FEMALE"
        ? t("patients.genderFemale")
        : "—";

  return (
    <Dialog
      title={recetaId ? t("prescriptions.editReceta") : t("prescriptions.newReceta")}
      onClose={requestClose}
      xwide
      preventClose={saving || emitting}
    >
      {hydrating ? (
        <p className="muted">{t("common.loading")}</p>
      ) : (
      <div className="receta-prototype" onChangeCapture={markDirty} onInputCapture={markDirty}>
        {center && (
          <div className="receta-letterhead">
            <div className="receta-letterhead-name">
              {center.nombre_legal || center.name}
              {center.nombre_corto && <> — <span className="receta-letterhead-short">{center.nombre_corto}</span></>}
            </div>
            {center.rnc && <div className="receta-letterhead-line">RNC: {center.rnc}</div>}
            {center.address && <div className="receta-letterhead-line">{center.address}</div>}
            {center.phones.length > 0 && (
              <div className="receta-letterhead-line">Tel: {center.phones.map((p) => p.number).join(" / ")}</div>
            )}
            {center.emails.length > 0 && (
              <div className="receta-letterhead-line">E-mail: {center.emails.map((e) => e.email).join(" / ")}</div>
            )}
          </div>
        )}

        <Field label={t("appointments.patient")}>
          {lockedPatient ? (
            <p className="receta-patient-info">
              <strong>{lockedPatient.full_name}</strong>
            </p>
          ) : (
            <SearchableSelect<Patient>
              value={patient}
              onSelect={(p) => {
                setPatient(p);
                markDirty();
              }}
              search={searchPatients}
              placeholder={t("records.patientPickerPlaceholder")}
              getLabel={(p) => p.full_name}
              getSublabel={(p) => p.cedula}
            />
          )}
        </Field>
        {patientRef && (
          <p className="receta-patient-info">
            <span>{t("records.age")}: {age != null ? age : "—"}</span>
            <span>{t("patients.gender")}: {genderLabel}</span>
          </p>
        )}

        <Field label={t("appointments.doctor")}>
          {isDoctorRole ? (
            <p className="receta-patient-info">
              <strong>{medico?.full_name ?? "—"}</strong>
            </p>
          ) : (
            <SearchableSelect<DoctorProfile>
              value={medico}
              onSelect={(d) => {
                setMedico(d);
                markDirty();
              }}
              search={async (query) => {
                const q = query.trim().toLowerCase();
                const results = q ? doctors.filter((d) => d.full_name.toLowerCase().includes(q)) : doctors;
                return { results, count: results.length };
              }}
              minChars={0}
              placeholder={t("appointments.doctor")}
              getLabel={(d) => d.full_name}
              autoFocus={false}
            />
          )}
        </Field>

        <Field label={t("prescriptions.proximaCita")}>
          <input type="datetime-local" value={proximaCitaAt} onChange={(e) => setProximaCitaAt(e.target.value)} />
        </Field>
        {proximaCitaError && <span className="field-error">{proximaCitaError}</span>}

        <label>
          <input type="checkbox" checked={crearCita} onChange={(e) => setCrearCita(e.target.checked)} />{" "}
          {t("prescriptions.crearCitaCalendario")}
        </label>

        {crearCita && (
          <Field label={t("prescriptions.servicioProximaCita")}>
            <SearchableSelect<Service>
              value={servicio}
              onSelect={setServicio}
              search={async (query) => {
                const q = query.trim().toLowerCase();
                const results = q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services;
                return { results, count: results.length };
              }}
              minChars={0}
              placeholder={t("appointments.service")}
              getLabel={(s) => s.name}
              autoFocus={false}
            />
          </Field>
        )}

        <h4>{t("prescriptions.lineas")}</h4>
        <div className="receta-lines">
          {lineas.map((line, i) => (
            <div className="receta-line-card" key={line.key}>
              <div className="receta-line-head">
                <span>{t("prescriptions.linea", { n: i + 1 })}</span>
                <div className="receta-line-actions">
                  <button type="button" className="btn ghost small" disabled={i === 0} onClick={() => moveLine(i, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    disabled={i === lineas.length - 1}
                    onClick={() => moveLine(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    disabled={lineas.length === 1}
                    onClick={() => removeLine(line.key)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>

              <Field label={t("prescriptions.medicamento")}>
                {line.fueraDeCatalogo ? (
                  <input
                    type="text"
                    value={line.nombreLibre}
                    placeholder={t("prescriptions.nombreLibre") as string}
                    onChange={(e) => updateLine(line.key, { nombreLibre: e.target.value })}
                    required
                  />
                ) : (
                  <SearchableSelect<Medicine>
                    value={line.medicamento}
                    onSelect={(m) => pickMedicine(line.key, m)}
                    search={searchMedicines}
                    minChars={2}
                    placeholder={t("prescriptions.medicamento")}
                    getLabel={(m) => m.commercial_name || m.generic_name}
                    getSublabel={(m) => m.generic_name}
                    autoFocus={false}
                  />
                )}
              </Field>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => toggleFueraDeCatalogo(line.key, !line.fueraDeCatalogo)}
              >
                {line.fueraDeCatalogo ? t("prescriptions.buscarCatalogo") : t("prescriptions.otroMedicamento")}
              </button>

              <div className="receta-line-grid">
                <Field label={t("prescriptions.cantidad")}>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={line.cantidad}
                    onChange={(e) => updateLine(line.key, { cantidad: e.target.value })}
                  />
                </Field>
                <Field label={t("prescriptions.via")}>
                  <input type="text" value={line.via} onChange={(e) => updateLine(line.key, { via: e.target.value })} />
                </Field>
                <Field label={t("prescriptions.concentracion")}>
                  <div className="inline-field-group">
                    <input
                      type="text"
                      value={line.concentracionValor}
                      onChange={(e) => updateLine(line.key, { concentracionValor: e.target.value })}
                    />
                    <input
                      type="text"
                      value={line.unidad}
                      placeholder={t("prescriptions.abreviacion") as string}
                      onChange={(e) => updateLine(line.key, { unidad: e.target.value })}
                    />
                  </div>
                </Field>
                <Field label={t("prescriptions.formaFarmaceutica")}>
                  <input type="text" value={line.forma} onChange={(e) => updateLine(line.key, { forma: e.target.value })} />
                </Field>
              </div>

              <div className="field">
                <span>{t("prescriptions.dosis")}</span>
                <DoseBuilder value={line.dosis} onChange={(dosis) => updateLine(line.key, { dosis })} />
              </div>

              <Field label={t("prescriptions.indicacionExtra")}>
                <input
                  type="text"
                  value={line.indicacionExtra}
                  onChange={(e) => updateLine(line.key, { indicacionExtra: e.target.value })}
                />
              </Field>
            </div>
          ))}
        </div>
        <button type="button" className="btn ghost small" onClick={addLine}>
          + {t("prescriptions.agregarLinea")}
        </button>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={handleGuardarBorrador} disabled={saving || emitting}>
            {saving ? t("common.saving") : t("prescriptions.guardarBorrador")}
          </button>
          <button type="button" className="btn primary" onClick={handleEmitir} disabled={saving || emitting}>
            {emitting ? t("common.saving") : t("prescriptions.emitirYVerPdf")}
          </button>
          <button type="button" className="btn ghost" onClick={requestClose} disabled={saving || emitting}>
            {t("prescriptions.cerrar")}
          </button>
        </div>
      </div>
      )}

      {confirmingExit && (
        <ConfirmDialog
          title={t("common.discardChangesTitle")}
          message={t("common.discardChangesMessage")}
          confirmLabel={t("common.discardChanges")}
          danger
          onConfirm={() => {
            setConfirmingExit(false);
            onClose();
          }}
          onCancel={() => setConfirmingExit(false)}
        />
      )}
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "../../components/ui";
import { api, ApiError, openBlobInNewTab } from "../../services/api";
import { RecetaComposerModal } from "../prescriptions/RecetaComposerModal";
import type { DoctorProfile, Paginated, PatientLite, Receta, RecetaEstado } from "../../services/types";
import { useAuth } from "../../store/auth";
import { can } from "../../utils/can";
import { formatDateTime } from "../../utils/date";
import { flattenError } from "../../utils/errors";

// The 1-hour "Guardar cambios" window (RecetaComposerModal/backend
// Receta.editable_by_within_window) -- an EMITIDA receta stays editable by
// its own doctor for this long after emitida_at; Admin bypasses it entirely.
const EDIT_WINDOW_MS = 60 * 60 * 1000;

function withinEditWindow(r: Receta): boolean {
  return !!r.emitida_at && Date.now() - new Date(r.emitida_at).getTime() <= EDIT_WINDOW_MS;
}

function estadoBadgeClass(estado: RecetaEstado): string {
  // Borrador maps onto the same neutral/"not final yet" pill as Draft
  // elsewhere; Emitida reuses the green "final/successful" pill; Anulada
  // reuses the red danger/cancelled pill -- no new hue for this feature
  // (design directive: BORRADOR/EMITIDA/ANULADA are not a new color family).
  if (estado === "EMITIDA") return "badge status-completed";
  if (estado === "ANULADA") return "badge status-cancelled";
  return "badge status-draft";
}

/**
 * Recetas tab inside the Expediente modal (RECETAS_REQUIREMENTS.md §6):
 * fetches this patient's recetas, renders a compact row list (mirrors
 * RecordHistoryList's row structure rather than the full `Table` component,
 * since this lives inside a tab panel already), and hosts the "Nueva receta"
 * entry point + composer modal.
 */
export function RecetasTab({ patient }: { patient: PatientLite }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canCreate = can(user?.role, "edit", "recetas");

  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  // Only gates the very first fetch -- `load()` is also called as `onSaved`
  // while the composer modal is open (e.g. after Guardar borrador), and
  // re-showing a full-tab loading state on every such refresh used to
  // unmount the whole tab (composer included), silently discarding whatever
  // was on screen even though the save itself had already succeeded.
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  // "new" opens a brand-new draft; a Receta object reopens that draft for
  // editing (§3); null means the composer is closed.
  const [composerTarget, setComposerTarget] = useState<Receta | "new" | null>(null);
  const [anulando, setAnulando] = useState<Receta | null>(null);
  const [anularError, setAnularError] = useState("");
  const [anularPending, setAnularPending] = useState(false);
  const [rowError, setRowError] = useState("");
  // Anulada rows are hidden by default (they're a soft-void, not a delete --
  // the PDF stays for audit per RECETAS_REQUIREMENTS.md §10 -- but shouldn't
  // clutter the working list); any role that can view this tab at all may
  // toggle them back into view, it's not restricted to who may create.
  const [showAnuladas, setShowAnuladas] = useState(false);

  function load() {
    setError("");
    Promise.all([
      api.get<Paginated<Receta>>(`/recetas/?patient=${patient.id}&page_size=100`),
      api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100"),
    ])
      .then(([r, d]) => {
        setRecetas(r.results);
        setDoctors(d.results);
      })
      .catch((err) => setError(err instanceof ApiError ? flattenError(err.message) : String(err)))
      .finally(() => setInitialLoading(false));
  }

  useEffect(load, [patient.id]);

  function doctorName(id: number): string {
    return doctors.find((d) => d.id === id)?.full_name ?? "—";
  }

  async function verPdf(r: Receta) {
    setRowError("");
    try {
      await openBlobInNewTab(`/recetas/${r.id}/pdf/`);
    } catch (err) {
      setRowError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function duplicar(r: Receta) {
    setRowError("");
    try {
      await api.post(`/recetas/${r.id}/duplicar/`, {});
      load();
    } catch (err) {
      setRowError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function confirmAnular() {
    if (!anulando) return;
    setAnularPending(true);
    setAnularError("");
    try {
      await api.post(`/recetas/${anulando.id}/anular/`, {});
      setAnulando(null);
      load();
    } catch (err) {
      setAnularError(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setAnularPending(false);
    }
  }

  // A doctor may not reopen or void a colleague's receta -- Admin can act on
  // any of them (RECETAS_REQUIREMENTS.md §10: Anular is "Author or Admin";
  // extended the same way to Editar, since re-editing someone else's
  // in-progress draft carries the same concern).
  function isAuthorOrAdmin(r: Receta): boolean {
    return user?.role === "ADMIN" || r.created_by === user?.id;
  }

  // The `guardar_cambios` window additionally recognizes the prescribing
  // médico (not just whoever technically created the row) as an owner,
  // mirroring Receta.editable_by_within_window on the backend.
  function isOwningDoctor(r: Receta): boolean {
    return doctors.find((d) => d.id === r.medico)?.user_id === user?.id;
  }

  function canAnular(r: Receta): boolean {
    return r.estado !== "ANULADA" && isAuthorOrAdmin(r);
  }

  function canEditar(r: Receta): boolean {
    if (!canCreate) return false;
    if (r.estado === "BORRADOR") return isAuthorOrAdmin(r);
    if (r.estado === "EMITIDA") {
      return user?.role === "ADMIN" || ((isAuthorOrAdmin(r) || isOwningDoctor(r)) && withinEditWindow(r));
    }
    return false;
  }

  const visibleRecetas = recetas.filter((r) => showAnuladas || r.estado !== "ANULADA");

  if (initialLoading) return <p className="muted">{t("common.loading")}</p>;

  return (
    <div className="receta-prototype">
      <div className="dc-section-row">
        <h4>{t("records.tabRecetas")}</h4>
        {canCreate && (
          <button type="button" className="dc-ghost-btn" onClick={() => setComposerTarget("new")}>
            + {t("prescriptions.newReceta")}
          </button>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {rowError && <p className="form-error" role="alert">{rowError}</p>}

      {recetas.some((r) => r.estado === "ANULADA") && (
        <label className="show-inactive-toggle">
          <input type="checkbox" checked={showAnuladas} onChange={(e) => setShowAnuladas(e.target.checked)} />{" "}
          {t("prescriptions.mostrarAnuladas")}
        </label>
      )}

      {visibleRecetas.length === 0 ? (
        <div className="recetas-tab-empty">
          {canCreate && (
            <div className="dc-add-tile" onClick={() => setComposerTarget("new")} role="button" tabIndex={0}>
              +
            </div>
          )}
          <p>{t("prescriptions.noRecetas")}</p>
        </div>
      ) : (
        <div className="recetas-tab-list">
          {visibleRecetas.map((r) => (
            <div className="receta-row" key={r.id}>
              <div className="receta-row-info">
                <span>{formatDateTime(r.fecha)}</span>
                <span>{doctorName(r.medico)}</span>
                <span>{t("prescriptions.lineCount", { count: r.lineas.length })}</span>
                <span className={estadoBadgeClass(r.estado)}>{t(`prescriptions.estado.${r.estado}`)}</span>
              </div>
              <div className="receta-row-actions">
                {canEditar(r) && (
                  <button type="button" className="btn ghost small" onClick={() => setComposerTarget(r)}>
                    {t("common.edit")}
                  </button>
                )}
                {r.estado === "EMITIDA" && (
                  <>
                    <button type="button" className="btn ghost small" onClick={() => verPdf(r)}>
                      {t("prescriptions.verPdf")}
                    </button>
                    <button type="button" className="btn ghost small" onClick={() => verPdf(r)}>
                      {t("prescriptions.imprimir")}
                    </button>
                  </>
                )}
                <button type="button" className="btn ghost small" onClick={() => duplicar(r)}>
                  {t("prescriptions.duplicar")}
                </button>
                {canAnular(r) && (
                  <button type="button" className="btn ghost small" onClick={() => setAnulando(r)}>
                    {t("prescriptions.anular")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {composerTarget && (
        <RecetaComposerModal
          lockedPatient={patient}
          initialReceta={composerTarget === "new" ? null : composerTarget}
          onClose={() => setComposerTarget(null)}
          onSaved={load}
        />
      )}

      {anulando && (
        <ConfirmDialog
          title={t("prescriptions.anular")}
          message={t("prescriptions.confirmAnular")}
          confirmLabel={t("prescriptions.anular")}
          danger
          error={anularError}
          pending={anularPending}
          onConfirm={confirmAnular}
          onCancel={() => {
            setAnulando(null);
            setAnularError("");
          }}
        />
      )}
    </div>
  );
}

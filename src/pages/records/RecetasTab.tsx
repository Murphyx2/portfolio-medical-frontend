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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [anulando, setAnulando] = useState<Receta | null>(null);
  const [anularError, setAnularError] = useState("");
  const [anularPending, setAnularPending] = useState(false);
  const [rowError, setRowError] = useState("");

  function load() {
    setLoading(true);
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
      .finally(() => setLoading(false));
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

  function canAnular(r: Receta): boolean {
    if (r.estado === "ANULADA") return false;
    return user?.role === "ADMIN" || r.created_by === user?.id;
  }

  if (loading) return <p className="muted">{t("common.loading")}</p>;

  return (
    <>
      <div className="dc-section-row">
        <h4>{t("records.tabRecetas")}</h4>
        {canCreate && (
          <button type="button" className="dc-ghost-btn" onClick={() => setComposerOpen(true)}>
            + {t("prescriptions.newReceta")}
          </button>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {rowError && <p className="form-error" role="alert">{rowError}</p>}

      {recetas.length === 0 ? (
        <div className="recetas-tab-empty">
          {canCreate && (
            <div className="dc-add-tile" onClick={() => setComposerOpen(true)} role="button" tabIndex={0}>
              +
            </div>
          )}
          <p>{t("prescriptions.noRecetas")}</p>
        </div>
      ) : (
        <div className="recetas-tab-list">
          {recetas.map((r) => (
            <div className="receta-row" key={r.id}>
              <div className="receta-row-info">
                <span>{formatDateTime(r.fecha)}</span>
                <span>{doctorName(r.medico)}</span>
                <span>{t("prescriptions.lineCount", { count: r.lineas.length })}</span>
                <span className={estadoBadgeClass(r.estado)}>{t(`prescriptions.estado.${r.estado}`)}</span>
              </div>
              <div className="receta-row-actions">
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

      {composerOpen && (
        <RecetaComposerModal
          lockedPatient={patient}
          onClose={() => setComposerOpen(false)}
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
    </>
  );
}

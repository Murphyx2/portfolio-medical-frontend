import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import { RecetaComposerModal } from "./prescriptions/RecetaComposerModal";
import type {
  Medicine,
  MedicineConcentracionUnidad,
  MedicineForma,
  MedicineViaAdministracion,
} from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";

const FORMA_OPTIONS: MedicineForma[] = [
  "TABLETA",
  "CAPSULA",
  "JARABE",
  "GOTAS",
  "CREMA",
  "UNGUENTO",
  "AMPOLLA",
  "VIAL",
  "INHALADOR",
  "PARCHE",
  "SUSPENSION",
  "SUPOSITORIO",
  "OTRO",
];

const VIA_OPTIONS: MedicineViaAdministracion[] = [
  "ORAL",
  "SUBLINGUAL",
  "SC",
  "IM",
  "IV",
  "TOPICA",
  "OFTALMICA",
  "OTICA",
  "NASAL",
  "INHALATORIA",
  "RECTAL",
  "OTRO",
];

const UNIDAD_OPTIONS: MedicineConcentracionUnidad[] = [
  "mg",
  "mcg",
  "g",
  "ml",
  "UI",
  "UI/ml",
  "%",
  "mg/ml",
  "OTRO",
];

const EMPTY = {
  generic_name: "",
  commercial_name: "",
  forma: "" as MedicineForma,
  via_pred: "" as MedicineViaAdministracion,
  concentracion_valor: "",
  concentracion_unidad: "" as MedicineConcentracionUnidad,
  concentracion_unidad_otro: "",
};

export function Medicines() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, "edit", "medicines");
  const canDelete = can(user?.role, "delete", "medicines");
  const isAdmin = can(user?.role, "restore", "medicines");
  const canCreateReceta = can(user?.role, "edit", "recetas");
  const [modal, setModal] = useState(false);
  const [recetaModal, setRecetaModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
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
  } = useListPage<Medicine>("/medicines/");

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(m: Medicine) {
    setForm({
      generic_name: m.generic_name,
      commercial_name: m.commercial_name,
      forma: m.forma,
      via_pred: m.via_pred,
      concentracion_valor: m.concentracion_valor,
      concentracion_unidad: m.concentracion_unidad,
      concentracion_unidad_otro: m.concentracion_unidad_otro,
    });
    setEditId(m.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    try {
      if (editId) await api.patch(`/medicines/${editId}/`, form);
      else await api.post("/medicines/", form);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(m: Medicine) {
    await api.delete(`/medicines/${m.id}/`);
    load();
  }

  async function restore(m: Medicine) {
    await api.post(`/medicines/${m.id}/restore/`, {});
    load();
  }

  const columns: Column<Medicine>[] = [
    { key: "generic_name", header: t("medicines.genericName"), sortKey: "generic_name" },
    { key: "commercial_name", header: t("medicines.commercialName"), sortKey: "commercial_name" },
    { key: "concentration", header: t("medicines.concentration"), sortKey: "concentration" },
    {
      key: "forma",
      header: t("medicines.forma"),
      sortKey: "forma",
      render: (r) => (r.forma ? t(`medicines.formaOptions.${r.forma}`) : "—"),
    },
    {
      key: "via_pred",
      header: t("medicines.viaPred"),
      sortKey: "via_pred",
      render: (r) => (r.via_pred ? t(`medicines.viaOptions.${r.via_pred}`) : "—"),
    },
  ];

  return (
    <Page
      card
      title={t("medicines.title")}
      actions={
        <>
          {canCreateReceta && (
            <button className="btn ghost" onClick={() => setRecetaModal(true)}>
              + {t("prescriptions.newReceta")}
            </button>
          )}
          {canWrite && (
            <button className="btn primary" onClick={openNew}>
              + {t("medicines.new")}
            </button>
          )}
        </>
      }
    >
      <ListPage<Medicine>
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
        activeAccessor={(m) => m.active}
        rows={rows}
        onEdit={canWrite ? openEdit : undefined}
        onDelete={canDelete ? remove : undefined}
        onRestore={isAdmin ? restore : undefined}
        getRowLabel={(m) => m.commercial_name || m.generic_name}
        isInactive={(m) => !m.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("medicines.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("medicines.genericName")}>
            <input value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} required />
          </Field>
          <Field label={t("medicines.commercialName")}>
            <input value={form.commercial_name} onChange={(e) => setForm({ ...form, commercial_name: e.target.value })} required />
          </Field>
          <Field label={t("medicines.forma")}>
            <select value={form.forma} onChange={(e) => setForm({ ...form, forma: e.target.value as MedicineForma })}>
              <option value="">{t("medicines.selectOption")}</option>
              {FORMA_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {t(`medicines.formaOptions.${f}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("medicines.viaPred")}>
            <select value={form.via_pred} onChange={(e) => setForm({ ...form, via_pred: e.target.value as MedicineViaAdministracion })}>
              <option value="">{t("medicines.selectOption")}</option>
              {VIA_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {t(`medicines.viaOptions.${v}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("medicines.concentration")}>
            <div className="inline-field-group">
              <input
                value={form.concentracion_valor}
                onChange={(e) => setForm({ ...form, concentracion_valor: e.target.value })}
                placeholder={t("medicines.concentracionValor") as string}
              />
              <select
                value={form.concentracion_unidad}
                onChange={(e) =>
                  setForm({ ...form, concentracion_unidad: e.target.value as MedicineConcentracionUnidad })
                }
              >
                <option value="">{t("medicines.selectOption")}</option>
                {UNIDAD_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {t(`medicines.unidadOptions.${u}`)}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          {form.concentracion_unidad === "OTRO" && (
            <Field label={t("medicines.concentracionUnidadOtro")}>
              <input
                value={form.concentracion_unidad_otro}
                onChange={(e) => setForm({ ...form, concentracion_unidad_otro: e.target.value })}
              />
            </Field>
          )}
        </FormModal>
      )}

      {recetaModal && (
        <RecetaComposerModal lockedPatient={null} onClose={() => setRecetaModal(false)} onSaved={() => {}} />
      )}
    </Page>
  );
}

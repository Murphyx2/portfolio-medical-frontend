import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { ServiceType } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";

const EMPTY = { name: "", requires_doctor: false, requires_diagnosis: true };

export function ServiceTypes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = can(user?.role, "edit", "serviceTypes");
  const isAdmin = can(user?.role, "restore", "serviceTypes");
  const [modal, setModal] = useState(false);
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
  } = useListPage<ServiceType>("/service-types/");

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(t: ServiceType) {
    setForm({
      name: t.name,
      requires_doctor: t.requires_doctor,
      requires_diagnosis: t.requires_diagnosis,
    });
    setEditId(t.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    try {
      if (editId) await api.patch(`/service-types/${editId}/`, form);
      else await api.post("/service-types/", form);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(t: ServiceType) {
    await api.delete(`/service-types/${t.id}/`);
    load();
  }

  async function restore(t: ServiceType) {
    await api.post(`/service-types/${t.id}/restore/`, {});
    load();
  }

  const columns: Column<ServiceType>[] = [
    { key: "name", header: t("serviceTypes.name"), sortKey: "name" },
    {
      key: "requires_doctor",
      header: t("serviceTypes.requiresDoctor"),
      render: (row) => (
        <span className={`badge status-${row.requires_doctor ? "active" : "inactive"}`}>
          {row.requires_doctor ? t("common.yes") : t("common.no")}
        </span>
      ),
    },
    {
      key: "requires_diagnosis",
      header: t("serviceTypes.requiresDiagnosis"),
      render: (row) => (
        <span className={`badge status-${row.requires_diagnosis ? "active" : "inactive"}`}>
          {row.requires_diagnosis ? t("common.yes") : t("common.no")}
        </span>
      ),
    },
  ];

  return (
    <Page
      title={t("serviceTypes.title")}
      actions={
        <div className="page-actions-stack">
          {canEdit && (
            <button className="btn primary" onClick={openNew}>
              + {t("serviceTypes.new")}
            </button>
          )}
          <button className="btn ghost" onClick={() => navigate("/services")}>
            {t("serviceTypes.back")}
          </button>
        </div>
      }
    >
      <ListPage<ServiceType>
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
        activeAccessor={(row) => row.active}
        rows={rows}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={canEdit ? remove : undefined}
        onRestore={isAdmin ? restore : undefined}
        getRowLabel={(row) => row.name}
        isInactive={(row) => !row.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("serviceTypes.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("serviceTypes.name")}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <label className="show-inactive-toggle">
            <input
              type="checkbox"
              checked={form.requires_doctor}
              onChange={(e) => setForm({ ...form, requires_doctor: e.target.checked })}
            />
            {t("serviceTypes.requiresDoctor")}
          </label>
          <label className="show-inactive-toggle">
            <input
              type="checkbox"
              checked={form.requires_diagnosis}
              onChange={(e) => setForm({ ...form, requires_diagnosis: e.target.checked })}
            />
            {t("serviceTypes.requiresDiagnosis")}
          </label>
        </FormModal>
      )}
    </Page>
  );
}

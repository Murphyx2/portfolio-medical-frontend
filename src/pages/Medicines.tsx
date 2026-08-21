import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { Medicine } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";

const EMPTY = { generic_name: "", commercial_name: "", concentration: "" };

export function Medicines() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "ADMIN" || user?.role === "IT" || user?.role === "RECEPTIONIST";
  const canDelete = user?.role === "ADMIN" || user?.role === "IT";
  const isAdmin = user?.role === "ADMIN";
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
  } = useListPage<Medicine>("/medicines/");

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(m: Medicine) {
    setForm({ generic_name: m.generic_name, commercial_name: m.commercial_name, concentration: m.concentration });
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
  ];

  return (
    <Page
      title={t("medicines.title")}
      actions={
        canWrite && (
          <button className="btn primary" onClick={openNew}>
            + {t("medicines.new")}
          </button>
        )
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
          <Field label={t("medicines.concentration")}>
            <input
              value={form.concentration}
              onChange={(e) => setForm({ ...form, concentration: e.target.value })}
              placeholder="500 mg"
            />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

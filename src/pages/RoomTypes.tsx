import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { RoomType } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";

const EMPTY = { name: "" };

export function RoomTypes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = can(user?.role, "create", "roomTypes");
  const canEdit = can(user?.role, "edit", "roomTypes");
  const canDelete = can(user?.role, "delete", "roomTypes");
  const isAdmin = can(user?.role, "restore", "roomTypes");
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
  } = useListPage<RoomType>("/room-types/");

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(t: RoomType) {
    setForm({ name: t.name });
    setEditId(t.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    try {
      if (editId) await api.patch(`/room-types/${editId}/`, form);
      else await api.post("/room-types/", form);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(t: RoomType) {
    await api.delete(`/room-types/${t.id}/`);
    load();
  }

  async function restore(t: RoomType) {
    await api.post(`/room-types/${t.id}/restore/`, {});
    load();
  }

  const columns: Column<RoomType>[] = [
    { key: "name", header: t("roomTypes.name"), sortKey: "name" },
  ];

  return (
    <Page
      title={t("roomTypes.title")}
      actions={
        <div className="page-actions-stack">
          {canCreate && (
            <button className="btn primary" onClick={openNew}>
              + {t("roomTypes.new")}
            </button>
          )}
          <button className="btn ghost" onClick={() => navigate("/rooms")}>
            {t("roomTypes.back")}
          </button>
        </div>
      }
    >
      <ListPage<RoomType>
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
        onDelete={canDelete ? remove : undefined}
        onRestore={isAdmin ? restore : undefined}
        getRowLabel={(row) => row.name}
        isInactive={(row) => !row.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("roomTypes.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("roomTypes.name")}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

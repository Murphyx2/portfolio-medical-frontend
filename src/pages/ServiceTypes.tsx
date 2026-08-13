import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Field, FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { Paginated, ServiceType } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";

const EMPTY = { name: "" };

export function ServiceTypes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === "ADMIN" || user?.role === "CENTER_MANAGER";
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<ServiceType[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [showInactive, setShowInactive] = useState(false);
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
  } = useListControls();

  const qs = query({ include_inactive: showInactive ? "true" : "" });

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<ServiceType>>(`/service-types/?${qs}`, { signal }))
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

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(t: ServiceType) {
    setForm({ name: t.name });
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
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (row: ServiceType) => (
              <span className={`badge status-${row.active ? "active" : "inactive"}`}>
                {row.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<ServiceType>,
        ]
      : []),
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
            {isAdmin && (
              <label className="show-inactive-toggle">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                {t("common.showInactive")}
              </label>
            )}
          </div>
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          <Table
            columns={columns}
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
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

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
        </FormModal>
      )}
    </Page>
  );
}

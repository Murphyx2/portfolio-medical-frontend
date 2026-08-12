import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { Medicine, Paginated } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";

const EMPTY = { generic_name: "", commercial_name: "", concentration: "" };

export function Medicines() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "IT";
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<Medicine[]>([]);
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
    runList((signal) => api.get<Paginated<Medicine>>(`/medicines/?${qs}`, { signal }))
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
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (m: Medicine) => (
              <span className={`badge status-${m.active ? "active" : "inactive"}`}>
                {m.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<Medicine>,
        ]
      : []),
  ];

  return (
    <Page
      title={t("medicines.title")}
      actions={
        canEdit && (
          <button className="btn primary" onClick={openNew}>
            + {t("medicines.new")}
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
            getRowLabel={(m) => m.commercial_name || m.generic_name}
            isInactive={(m) => !m.active}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

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
            <input value={form.concentration} onChange={(e) => setForm({ ...form, concentration: e.target.value })} />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

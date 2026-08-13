import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Field, FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { Paginated, Service, ServiceType } from "../services/types";
import { useAuth } from "../store/auth";
import { formatCurrencyDOP } from "../utils/currency";
import { flattenError } from "../utils/errors";

const EMPTY = { simon: "", name: "", type: 0, co_pago: "", privado: "" };

export function Services() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === "ADMIN" || user?.role === "CENTER_MANAGER";
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<Service[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
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
    runList((signal) => api.get<Paginated<Service>>(`/services/?${qs}`, { signal }))
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
    // Type options: fetched once, not on every page/sort/search change.
    api.get<Paginated<ServiceType>>("/service-types/?page_size=100").then((r) => setTypes(r.results)).catch(() => {});
  }, []);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(s: Service) {
    setForm({ simon: s.simon, name: s.name, type: s.type, co_pago: s.co_pago, privado: s.privado });
    setEditId(s.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    try {
      const body = { ...form, type: Number(form.type) };
      if (editId) await api.patch(`/services/${editId}/`, body);
      else await api.post("/services/", body);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(s: Service) {
    await api.delete(`/services/${s.id}/`);
    load();
  }

  async function restore(s: Service) {
    await api.post(`/services/${s.id}/restore/`, {});
    load();
  }

  // If the service being edited references a type no longer in the
  // active-only fetched list (deactivated after the service was created),
  // keep it selectable so the form doesn't silently drop it.
  const typeOptions =
    editId && form.type && !types.some((ty) => ty.id === form.type)
      ? [...types, { id: form.type, name: rows.find((r) => r.id === editId)?.type_name ?? "—", active: false }]
      : types;

  function onSimonChange(value: string) {
    setForm({ ...form, simon: value.replace(/\D/g, "").slice(0, 6) });
  }

  const columns: Column<Service>[] = [
    { key: "simon", header: t("services.simon"), sortKey: "simon" },
    { key: "name", header: t("services.name"), sortKey: "name" },
    { key: "type_name", header: t("services.type") },
    { key: "co_pago", header: t("services.coPago"), sortKey: "co_pago", render: (s) => formatCurrencyDOP(s.co_pago) },
    { key: "privado", header: t("services.privado"), sortKey: "privado", render: (s) => formatCurrencyDOP(s.privado) },
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (s: Service) => (
              <span className={`badge status-${s.active ? "active" : "inactive"}`}>
                {s.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<Service>,
        ]
      : []),
  ];

  return (
    <Page
      title={t("services.title")}
      actions={
        canEdit && (
          <div className="page-actions-stack">
            <button className="btn primary" onClick={openNew}>
              + {t("services.new")}
            </button>
            <button className="btn ghost" onClick={() => navigate("/services/types")}>
              {t("services.manageTypes")}
            </button>
          </div>
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
            getRowLabel={(s) => s.name}
            isInactive={(s) => !s.active}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("services.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("services.simon")}>
            <input value={form.simon} onChange={(e) => onSimonChange(e.target.value)} required maxLength={6} placeholder="123456" />
          </Field>
          <Field label={t("services.name")}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t("services.type")}>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: Number(e.target.value) })} required>
              <option value={0} disabled>—</option>
              {typeOptions.map((ty) => (
                <option key={ty.id} value={ty.id}>{ty.name}</option>
              ))}
            </select>
          </Field>
          <Field label={`${t("services.coPago")} (RD$)`}>
            <input type="number" min={0} step="0.01" value={form.co_pago} onChange={(e) => setForm({ ...form, co_pago: e.target.value })} required />
          </Field>
          <Field label={`${t("services.privado")} (RD$)`}>
            <input type="number" min={0} step="0.01" value={form.privado} onChange={(e) => setForm({ ...form, privado: e.target.value })} required />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

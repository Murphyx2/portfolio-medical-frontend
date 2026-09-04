import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api } from "../services/api";
import type { Paginated, Service, ServiceType } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { formatCurrencyDOP } from "../utils/currency";
import { apiErrorMessage } from "../utils/errors";

const EMPTY = { simon: "", name: "", type: 0, co_pago: "", privado: "" };

export function Services() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = can(user?.role, "edit", "services");
  const isAdmin = can(user?.role, "restore", "services");
  const [types, setTypes] = useState<ServiceType[]>([]);
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
  } = useListPage<Service>("/services/");

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
      setFormError(apiErrorMessage(err));
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
    { key: "co_pago", header: t("services.coPago"), sortKey: "co_pago", align: "right", render: (s) => formatCurrencyDOP(s.co_pago) },
    { key: "privado", header: t("services.privado"), sortKey: "privado", align: "right", render: (s) => formatCurrencyDOP(s.privado) },
  ];

  return (
    <Page
      card
      title={t("services.title")}
      actions={
        canEdit && (
          <div className="page-actions-row">
            <button className="btn ghost" onClick={() => navigate("/services/types")}>
              {t("services.manageTypes")}
            </button>
            <button className="btn ghost" onClick={() => navigate("/services/prices")}>
              {t("services.managePrices")}
            </button>
            <button className="btn primary" onClick={openNew}>
              + {t("services.new")}
            </button>
          </div>
        )
      }
    >
      <ListPage<Service>
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
        activeAccessor={(s) => s.active}
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
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
              required
            />
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

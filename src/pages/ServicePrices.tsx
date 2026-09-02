import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { ARS, Paginated, Service, ServicePrice } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { formatCurrencyDOP } from "../utils/currency";
import { flattenError } from "../utils/errors";

const EMPTY = { service: 0, ars: 0, ars_program: 0, co_pago: "" };

export function ServicePrices() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = can(user?.role, "edit", "servicePrices");
  const isAdmin = can(user?.role, "restore", "servicePrices");
  const [services, setServices] = useState<Service[]>([]);
  const [arsList, setArsList] = useState<ARS[]>([]);
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
  } = useListPage<ServicePrice>("/service-prices/");

  useEffect(() => {
    // Options for the two selects: fetched once, not on every page/sort/search change.
    api.get<Paginated<Service>>("/services/?page_size=200").then((r) => setServices(r.results)).catch(() => {});
    api.get<Paginated<ARS>>("/ars/?page_size=200").then((r) => setArsList(r.results)).catch(() => {});
  }, []);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(p: ServicePrice) {
    setForm({ service: p.service, ars: p.ars, ars_program: p.ars_program ?? 0, co_pago: p.co_pago });
    setEditId(p.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    try {
      const body = {
        service: Number(form.service),
        ars: Number(form.ars),
        ars_program: form.ars_program ? Number(form.ars_program) : null,
        co_pago: form.co_pago,
      };
      if (editId) await api.patch(`/service-prices/${editId}/`, body);
      else await api.post("/service-prices/", body);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(p: ServicePrice) {
    await api.delete(`/service-prices/${p.id}/`);
    load();
  }

  async function restore(p: ServicePrice) {
    await api.post(`/service-prices/${p.id}/restore/`, {});
    load();
  }

  const programOptions = arsList.find((a) => a.id === form.ars)?.programs ?? [];

  const columns: Column<ServicePrice>[] = [
    { key: "service_name", header: t("servicePrices.service") },
    { key: "ars_name", header: t("servicePrices.ars") },
    {
      key: "ars_program_name",
      header: t("servicePrices.program"),
      render: (p) => p.ars_program_name ?? t("servicePrices.allPrograms"),
    },
    {
      key: "co_pago",
      header: t("services.coPago"),
      sortKey: "co_pago",
      align: "right",
      render: (p) => formatCurrencyDOP(p.co_pago),
    },
  ];

  return (
    <Page
      card
      title={t("servicePrices.title")}
      actions={
        <div className="page-actions-row">
          <button className="btn ghost" onClick={() => navigate("/services")}>
            {t("serviceTypes.back")}
          </button>
          {canEdit && (
            <button className="btn primary" onClick={openNew}>
              + {t("servicePrices.new")}
            </button>
          )}
        </div>
      }
    >
      <p className="muted">{t("servicePrices.hint")}</p>

      <ListPage<ServicePrice>
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
        activeAccessor={(p) => p.active}
        rows={rows}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={canEdit ? remove : undefined}
        onRestore={isAdmin ? restore : undefined}
        getRowLabel={(p) => `${p.service_name} @ ${p.ars_name}`}
        isInactive={(p) => !p.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("servicePrices.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("servicePrices.service")}>
            <select
              value={form.service}
              onChange={(e) => setForm({ ...form, service: Number(e.target.value) })}
              required
            >
              <option value={0} disabled>—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("servicePrices.ars")}>
            <select
              value={form.ars}
              onChange={(e) => setForm({ ...form, ars: Number(e.target.value), ars_program: 0 })}
              required
            >
              <option value={0} disabled>—</option>
              {arsList.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("servicePrices.program")}>
            <select
              value={form.ars_program}
              onChange={(e) => setForm({ ...form, ars_program: Number(e.target.value) })}
              disabled={!form.ars}
            >
              <option value={0}>{t("servicePrices.allPrograms")}</option>
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label={`${t("services.coPago")} (RD$)`}>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.co_pago}
              onChange={(e) => setForm({ ...form, co_pago: e.target.value })}
              required
            />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

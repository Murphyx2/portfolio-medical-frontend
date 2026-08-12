import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { MedicalCenter, Paginated } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";
import { formatPhone, formatPhoneInput, isValidRequiredPhone } from "../utils/phone";

const EMPTY = { name: "", code: "", address: "", phone: "", email: "" };

export function Centers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "IT";
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<MedicalCenter[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState("");
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
    runList((signal) => api.get<Paginated<MedicalCenter>>(`/centers/?${qs}`, { signal }))
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
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  function openEdit(c: MedicalCenter) {
    setForm({ name: c.name, code: c.code, address: c.address, phone: formatPhone(c.phone), email: c.email });
    setEditId(c.id);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  async function submit() {
    if (!isValidRequiredPhone(form.phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    setFormError("");
    const body = { ...form, phone: form.phone.replace(/\D/g, "") };
    try {
      if (editId) await api.patch(`/centers/${editId}/`, body);
      else await api.post("/centers/", body);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(c: MedicalCenter) {
    await api.delete(`/centers/${c.id}/`);
    load();
  }

  async function restore(c: MedicalCenter) {
    await api.post(`/centers/${c.id}/restore/`, {});
    load();
  }

  const columns: Column<MedicalCenter>[] = [
    { key: "name", header: t("centers.name"), sortKey: "name" },
    { key: "code", header: t("centers.code"), sortKey: "code" },
    { key: "address", header: t("centers.address"), sortKey: "address" },
    { key: "phone", header: t("centers.phone"), sortKey: "phone", render: (r) => formatPhone(r.phone) },
    { key: "email", header: t("centers.email"), sortKey: "email" },
    { key: "doctor_count", header: t("centers.doctorsCount"), sortKey: "doctor_count" },
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (r: MedicalCenter) => (
              <span className={`badge status-${r.active ? "active" : "inactive"}`}>
                {r.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<MedicalCenter>,
        ]
      : []),
  ];

  return (
    <Page
      title={t("centers.title")}
      actions={
        canEdit && (
          <button className="btn primary" onClick={openNew}>
            + {t("centers.new")}
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
            getRowLabel={(r) => r.name}
            isInactive={(r) => !r.active}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("centers.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("centers.name")}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t("centers.code")}>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </Field>
          <Field label={t("centers.address")}>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          </Field>
          <Field label={t("centers.phone")}>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              placeholder="(809) 555-1212"
              maxLength={14}
              onChange={(e) => {
                setForm({ ...form, phone: formatPhoneInput(e.target.value) });
                setPhoneError("");
              }}
              required
            />
            {phoneError && <span className="field-error">{phoneError}</span>}
          </Field>
          <Field label={t("centers.email")}>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

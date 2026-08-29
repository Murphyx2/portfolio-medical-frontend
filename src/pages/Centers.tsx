import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { MedicalCenter } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";
import { formatPhone, formatPhoneInput, isValidRequiredPhone } from "../utils/phone";

const EMPTY = { name: "", code: "", address: "", phone: "", email: "", is_default: false };

export function Centers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = can(user?.role, "edit", "centers");
  const isAdmin = can(user?.role, "restore", "centers");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState("");
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
  } = useListPage<MedicalCenter>("/centers/");

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  function openEdit(c: MedicalCenter) {
    setForm({
      name: c.name,
      code: c.code,
      address: c.address,
      phone: formatPhone(c.phone),
      email: c.email,
      is_default: c.is_default,
    });
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
    {
      key: "code",
      header: t("centers.code"),
      sortKey: "code",
      render: (r) => (
        <span>
          {r.code}
          {r.is_default && <span className="cell-sublabel">{t("centers.defaultLabel")}</span>}
        </span>
      ),
    },
    { key: "address", header: t("centers.address"), sortKey: "address" },
    { key: "phone", header: t("centers.phone"), sortKey: "phone", render: (r) => formatPhone(r.phone) },
    { key: "email", header: t("centers.email"), sortKey: "email" },
    { key: "doctor_count", header: t("centers.doctorsCount"), sortKey: "doctor_count" },
  ];

  return (
    <Page
      card
      title={t("centers.title")}
      actions={
        canEdit && (
          <button className="btn primary" onClick={openNew}>
            + {t("centers.new")}
          </button>
        )
      }
    >
      <ListPage<MedicalCenter>
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
        activeAccessor={(r) => r.active}
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
          <label className="show-inactive-toggle">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            {t("centers.isDefault")}
          </label>
        </FormModal>
      )}
    </Page>
  );
}

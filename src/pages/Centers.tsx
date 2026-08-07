import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, Spinner, Table, type Column } from "../components/ui";
import { api } from "../services/api";
import type { MedicalCenter, Paginated } from "../services/types";
import { useAuth } from "../store/auth";
import { formatPhone, formatPhoneInput, isValidRequiredPhone } from "../utils/phone";

const EMPTY = { name: "", code: "", address: "", phone: "", email: "" };

export function Centers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "IT";
  const [rows, setRows] = useState<MedicalCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<MedicalCenter>>(`/centers/?page=${page}&page_size=${pageSize}`)
      .then((r) => {
        setRows(r.results);
        setCount(r.count);
        const total = Math.ceil(r.count / pageSize);
        if (total > 0 && page > total) setPage(total);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  useEffect(load, [load]);

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setPhoneError("");
    setModal(true);
  }

  function openEdit(c: MedicalCenter) {
    setForm({ name: c.name, code: c.code, address: c.address, phone: formatPhone(c.phone), email: c.email });
    setEditId(c.id);
    setPhoneError("");
    setModal(true);
  }

  async function submit() {
    if (!isValidRequiredPhone(form.phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    const body = { ...form, phone: form.phone.replace(/\D/g, "") };
    if (editId) await api.patch(`/centers/${editId}/`, body);
    else await api.post("/centers/", body);
    setModal(false);
    load();
  }

  async function remove(c: MedicalCenter) {
    await api.delete(`/centers/${c.id}/`);
    load();
  }

  const columns: Column<MedicalCenter>[] = [
    { key: "name", header: t("centers.name") },
    { key: "code", header: t("centers.code") },
    { key: "address", header: t("centers.address") },
    { key: "phone", header: t("centers.phone"), render: (r) => formatPhone(r.phone) },
    { key: "email", header: t("centers.email") },
    { key: "doctor_count", header: t("centers.doctorsCount") },
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
      {loading ? (
        <Spinner />
      ) : (
        <>
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          <Table
            columns={columns}
            rows={rows}
            onEdit={canEdit ? openEdit : undefined}
            onDelete={canEdit ? remove : undefined}
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

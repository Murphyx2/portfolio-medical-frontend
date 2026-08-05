import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Spinner, Table, type Column } from "../components/ui";
import { api } from "../services/api";
import type { MedicalCenter, Paginated } from "../services/types";
import { useAuth } from "../store/auth";

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

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<MedicalCenter>>("/centers/?page_size=100")
      .then((r) => setRows(r.results))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setModal(true);
  }

  function openEdit(c: MedicalCenter) {
    setForm({ name: c.name, code: c.code, address: c.address, phone: c.phone, email: c.email });
    setEditId(c.id);
    setModal(true);
  }

  async function submit() {
    if (editId) await api.patch(`/centers/${editId}/`, form);
    else await api.post("/centers/", form);
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
    { key: "phone", header: t("centers.phone") },
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
        <Table
          columns={columns}
          rows={rows}
          onEdit={canEdit ? openEdit : undefined}
          onDelete={canEdit ? remove : undefined}
        />
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
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </Field>
          <Field label={t("centers.email")}>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

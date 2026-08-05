import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Spinner, Table, type Column } from "../components/ui";
import { api } from "../services/api";
import type { Medicine, Paginated } from "../services/types";
import { useAuth } from "../store/auth";

const EMPTY = { generic_name: "", commercial_name: "", concentration: "" };

export function Medicines() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "IT";
  const [rows, setRows] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<Medicine>>("/medicines/?page_size=100")
      .then((r) => setRows(r.results))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setModal(true);
  }

  function openEdit(m: Medicine) {
    setForm({ generic_name: m.generic_name, commercial_name: m.commercial_name, concentration: m.concentration });
    setEditId(m.id);
    setModal(true);
  }

  async function submit() {
    if (editId) await api.patch(`/medicines/${editId}/`, form);
    else await api.post("/medicines/", form);
    setModal(false);
    load();
  }

  async function remove(m: Medicine) {
    await api.delete(`/medicines/${m.id}/`);
    load();
  }

  const columns: Column<Medicine>[] = [
    { key: "generic_name", header: t("medicines.genericName") },
    { key: "commercial_name", header: t("medicines.commercialName") },
    { key: "concentration", header: t("medicines.concentration") },
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
          title={editId ? t("common.edit") : t("medicines.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
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

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Spinner, Table, type Column } from "../components/ui";
import { api } from "../services/api";
import type { ARS, Paginated, Patient } from "../services/types";

const EMPTY = {
  first_name: "",
  last_name: "",
  birth_date: "",
  gender: "UNSPECIFIED",
  phone: "",
  address: "",
  email: "",
  cedula: "",
  nss: "",
  ars: "",
  ars_program: "",
};

export function Patients() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Patient[]>([]);
  const [arsList, setArsList] = useState<ARS[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<Patient>>("/patients/?page_size=100")
      .then((r) => setRows(r.results))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    api
      .get<Paginated<ARS>>("/ars/?page_size=100")
      .then((r) => setArsList(r.results))
      .catch(() => {});
  }, []);

  const selectedArs = arsList.find((a) => String(a.id) === form.ars);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setModal(true);
  }

  function openEdit(p: Patient) {
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      birth_date: p.birth_date ?? "",
      gender: p.gender,
      phone: p.phone,
      address: p.address,
      email: p.email,
      cedula: p.cedula,
      nss: p.nss,
      ars: p.ars ? String(p.ars) : "",
      ars_program: p.ars_program ? String(p.ars_program) : "",
    });
    setEditId(p.id);
    setModal(true);
  }

  async function submit() {
    const body = {
      ...form,
      birth_date: form.birth_date || null,
      ars: form.ars ? Number(form.ars) : null,
      ars_program: form.ars_program ? Number(form.ars_program) : null,
    };
    if (editId) await api.patch(`/patients/${editId}/`, body);
    else await api.post("/patients/", body);
    setModal(false);
    load();
  }

  async function remove(p: Patient) {
    await api.delete(`/patients/${p.id}/`);
    load();
  }

  const columns: Column<Patient>[] = [
    { key: "full_name", header: t("common.name"), render: (r) => r.full_name },
    { key: "age", header: t("patients.age"), render: (r) => (r.age ?? "-") },
    { key: "gender", header: t("patients.gender") },
    { key: "phone", header: t("patients.phone") },
    { key: "email", header: t("common.email") },
    { key: "cedula", header: t("patients.cedula") },
    { key: "nss", header: t("patients.nss") },
    { key: "ars_name", header: t("patients.ars") },
    { key: "ars_program_name", header: t("patients.arsProgram") },
  ];

  return (
    <Page
      title={t("patients.title")}
      actions={
        <button className="btn primary" onClick={openNew}>
          + {t("patients.new")}
        </button>
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <Table columns={columns} rows={rows} onEdit={openEdit} onDelete={remove} />
      )}

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("patients.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
        >
          <Field label={t("patients.firstName")}>
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </Field>
          <Field label={t("patients.lastName")}>
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </Field>
          <Field label={t("patients.birthDate")}>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </Field>
          <Field label={t("patients.gender")}>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="MALE">{t("patients.genderMale")}</option>
              <option value="FEMALE">{t("patients.genderFemale")}</option>
              <option value="OTHER">{t("patients.genderOther")}</option>
              <option value="UNSPECIFIED">—</option>
            </select>
          </Field>
          <Field label={t("patients.phone")}>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label={t("patients.cedula")}>
            <input
              value={form.cedula}
              placeholder="000-0000000-0"
              onChange={(e) => setForm({ ...form, cedula: e.target.value })}
            />
          </Field>
          <Field label={t("patients.nss")}>
            <input
              value={form.nss}
              onChange={(e) => setForm({ ...form, nss: e.target.value })}
            />
          </Field>
          <Field label={t("patients.address")}>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label={t("patients.email")}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label={t("patients.ars")}>
            <select
              value={form.ars}
              onChange={(e) => setForm({ ...form, ars: e.target.value, ars_program: "" })}
            >
              <option value="">—</option>
              {arsList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("patients.arsProgram")}>
            <select
              value={form.ars_program}
              onChange={(e) => setForm({ ...form, ars_program: e.target.value })}
              disabled={!form.ars}
            >
              <option value="">—</option>
              {(selectedArs?.programs ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

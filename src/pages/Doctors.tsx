import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Spinner, Table, type Column } from "../components/ui";
import { api } from "../services/api";
import type { DoctorProfile, Paginated, User } from "../services/types";
import { useAuth } from "../store/auth";

const EMPTY = { user: 0, specialty: "", license_number: "", contact_phone: "", contact_email: "", bio: "" };

export function Doctors() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "IT";
  const [rows, setRows] = useState<DoctorProfile[]>([]);
  const [userOptions, setUserOptions] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=100")
      .then((r) => setRows(r.results))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.get<Paginated<User>>("/auth/users/?page_size=200").then((r) => setUserOptions(r.results)).catch(() => {});
  }, [load]);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setModal(true);
  }

  function openEdit(d: DoctorProfile) {
    setForm({
      user: d.user_id,
      specialty: d.specialty,
      license_number: d.license_number,
      contact_phone: d.contact_phone,
      contact_email: d.contact_email,
      bio: d.bio,
    });
    setEditId(d.id);
    setModal(true);
  }

  async function submit() {
    if (editId) await api.patch(`/doctors/profiles/${editId}/`, form);
    else await api.post("/doctors/profiles/", form);
    setModal(false);
    load();
  }

  async function remove(d: DoctorProfile) {
    await api.delete(`/doctors/profiles/${d.id}/`);
    load();
  }

  const columns: Column<DoctorProfile>[] = [
    { key: "full_name", header: t("doctors.fullName") },
    { key: "specialty", header: t("doctors.specialty") },
    { key: "license_number", header: t("doctors.license") },
    { key: "contact_phone", header: t("doctors.contactPhone") },
    { key: "contact_email", header: t("doctors.contactEmail") },
  ];

  return (
    <Page
      title={t("doctors.title")}
      actions={
        canEdit && (
          <button className="btn primary" onClick={openNew}>
            + {t("doctors.new")}
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
          title={editId ? t("common.edit") : t("doctors.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
        >
          <Field label={t("doctors.user")}>
            <select
              value={form.user}
              onChange={(e) => setForm({ ...form, user: Number(e.target.value) })}
              required
            >
              <option value={0} disabled>
                —
              </option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.role})
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("doctors.specialty")}>
            <input
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              required
            />
          </Field>
          <Field label={t("doctors.license")}>
            <input
              value={form.license_number}
              onChange={(e) => setForm({ ...form, license_number: e.target.value })}
              required
            />
          </Field>
          <Field label={t("doctors.contactPhone")}>
            <input
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              required
            />
          </Field>
          <Field label={t("doctors.contactEmail")}>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </Field>
          <Field label={t("doctors.bio")}>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

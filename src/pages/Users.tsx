import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Spinner, Table, type Column } from "../components/ui";
import { RoleGate } from "../components/guards";
import { api } from "../services/api";
import type { Paginated, User } from "../services/types";

const EMPTY = { username: "", email: "", first_name: "", last_name: "", password: "", role: "RECEPTIONIST" };

export function Users() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [roles, setRoles] = useState<{ value: string; label: string }[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<User>>("/auth/users/?page_size=100")
      .then((r) => setRows(r.results))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.get<{ value: string; label: string }[]>("/auth/users/roles/").then(setRoles).catch(() => {});
  }, [load]);

  async function submit() {
    await api.post("/auth/users/", form);
    setModal(false);
    load();
  }

  async function remove(u: User) {
    await api.delete(`/auth/users/${u.id}/`);
    load();
  }

  const columns: Column<User>[] = [
    { key: "username", header: t("users.username") },
    { key: "full_name", header: t("common.name") },
    { key: "email", header: t("users.email") },
    { key: "role", header: t("users.role") },
    { key: "is_active", header: t("users.active"), render: (r) => (r.is_active ? "✓" : "—") },
  ];

  return (
    <RoleGate roles={["ADMIN", "IT"]}>
      <Page
        title={t("users.title")}
        actions={
          <button className="btn primary" onClick={() => { setForm(EMPTY); setModal(true); }}>
            + {t("users.new")}
          </button>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table columns={columns} rows={rows} onDelete={remove} />
        )}

        {modal && (
          <FormModal
            title={t("users.new")}
            onClose={() => setModal(false)}
            onSubmit={submit}
            submitLabel={t("common.save")}
          >
            <Field label={t("users.username")}>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </Field>
            <Field label={t("users.password")}>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </Field>
            <Field label={t("users.firstName")}>
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Field>
            <Field label={t("users.lastName")}>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Field>
            <Field label={t("users.email")}>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label={t("users.role")}>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </FormModal>
        )}
      </Page>
    </RoleGate>
  );
}

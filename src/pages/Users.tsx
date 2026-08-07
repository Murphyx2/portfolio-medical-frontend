import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { RoleGate } from "../components/guards";
import { useListControls } from "../hooks/useListControls";
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
  const {
    page,
    setPage,
    pageSize,
    count,
    setCount,
    search,
    setSearch,
    sortKey,
    sortDir,
    handleSort,
    changePageSize,
    query,
  } = useListControls();

  const qs = query();

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<User>>(`/auth/users/?${qs}`)
      .then((r) => {
        setRows(r.results);
        setCount(r.count);
        const total = Math.ceil(r.count / pageSize);
        if (total > 0 && page > total) setPage(total);
      })
      .finally(() => setLoading(false));
  }, [qs, page, pageSize, setCount, setPage]);

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
    { key: "username", header: t("users.username"), sortKey: "username" },
    { key: "full_name", header: t("common.name"), sortKey: "first_name" },
    { key: "email", header: t("users.email"), sortKey: "email" },
    { key: "role", header: t("users.role"), sortKey: "role" },
    { key: "is_active", header: t("users.active"), sortKey: "is_active", render: (r) => (r.is_active ? "✓" : "—") },
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
          <>
            <div className="list-toolbar">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder={t("common.searchPlaceholder")}
                label={t("common.search")}
              />
            </div>
            <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
            <Table
              columns={columns}
              rows={rows}
              onDelete={remove}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          </>
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

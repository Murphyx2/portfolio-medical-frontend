import { useEffect, useState } from "react";
import { History, KeyRound, Unlock, UserCheck, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ListPage } from "../components/ListPage";
import {
  ConfirmDialog,
  Dialog,
  Field,
  FormModal,
  Page,
  RowActionsMenu,
  useRowConfirm,
  type Column,
  type RowActionsMenuItem,
} from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { AuditLogEntry, MedicalCenter, Paginated, User } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { formatDateTime } from "../utils/date";
import { flattenError } from "../utils/errors";
import { roleLabel } from "../utils/roleLabel";

const EMPTY = { username: "", email: "", first_name: "", last_name: "", password: "", role: "RECEPTIONIST", center: "" };
const ACTIVITY_PAGE_SIZE = 20;

type ConfirmType = "deactivate" | "activate" | "unlock";

export function Users() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = can(user?.role, "assignAdminRole", "users");
  const canEdit = can(user?.role, "edit", "users");
  const canDeactivate = can(user?.role, "delete", "users");
  const canUnlock = can(user?.role, "unlock", "users");
  const canChangePassword = can(user?.role, "changePassword", "users");
  const canViewActivity = can(user?.role, "viewActivity", "users");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [roles, setRoles] = useState<{ value: string; label: string }[]>([]);
  const [centers, setCenters] = useState<MedicalCenter[]>([]);
  const [formError, setFormError] = useState("");

  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [activityTarget, setActivityTarget] = useState<User | null>(null);
  const [activityRows, setActivityRows] = useState<AuditLogEntry[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityCount, setActivityCount] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);

  const confirm = useRowConfirm<ConfirmType, User>();

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
  } = useListPage<User>("/auth/users/");

  // Non-admins (IT) may not assign the ADMIN role — the backend rejects it,
  // but omitting it from the picker prevents the error instead of just
  // explaining it after submit.
  const availableRoles = isAdmin ? roles : roles.filter((r) => r.value !== "ADMIN");

  useEffect(() => {
    // Role choices for the "new user" form: fetched once, not on every
    // page/sort/search change (unlike `load`, which re-runs then).
    api.get<{ value: string; label: string }[]>("/auth/users/roles/").then(setRoles).catch(() => {});
    api
      .get<Paginated<MedicalCenter>>("/centers/?page_size=100")
      .then((r) => setCenters(r.results))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activityTarget) return;
    let cancelled = false;
    setActivityLoading(true);
    api
      .get<Paginated<AuditLogEntry>>(`/auth/users/${activityTarget.id}/activity/?page=${activityPage}`)
      .then((r) => {
        if (cancelled) return;
        setActivityRows(r.results);
        setActivityCount(r.count);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activityTarget, activityPage]);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(u: User) {
    setForm({
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      password: "",
      role: u.role,
      center: u.center ? String(u.center) : "",
    });
    setEditId(u.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    try {
      if (editId) {
        const { username, email, first_name, last_name, role, center } = form;
        await api.patch(`/auth/users/${editId}/`, {
          username,
          email,
          first_name,
          last_name,
          role,
          center: role === "CENTER_MANAGER" && center ? Number(center) : null,
        });
      } else {
        await api.post("/auth/users/", {
          ...form,
          center: form.role === "CENTER_MANAGER" && form.center ? Number(form.center) : null,
        });
      }
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  function openPasswordReset(u: User) {
    setPasswordTarget(u);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  }

  async function submitPasswordReset() {
    if (!passwordTarget) return;
    if (newPassword !== confirmPassword) {
      setPasswordError(t("users.passwordMismatch"));
      return;
    }
    setPasswordError("");
    try {
      await api.post(`/auth/users/${passwordTarget.id}/set_password/`, { password: newPassword });
      setPasswordTarget(null);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  function openActivity(u: User) {
    setActivityTarget(u);
    setActivityPage(1);
    setActivityRows([]);
    setActivityCount(0);
  }

  async function runConfirmedAction() {
    await confirm.run(async (type, row) => {
      if (type === "deactivate") await api.delete(`/auth/users/${row.id}/`);
      else if (type === "activate") await api.post(`/auth/users/${row.id}/restore/`, {});
      else await api.post(`/auth/users/${row.id}/unlock/`, {});
      load();
    });
  }

  const confirmCopy = confirm.confirming
    ? (() => {
        const { type, row } = confirm.confirming!;
        const name = row.full_name || row.username;
        switch (type) {
          case "deactivate":
            return { title: t("users.deactivate"), message: t("users.deactivateConfirmNamed", { name }), confirmLabel: t("users.deactivate"), danger: true };
          case "activate":
            return { title: t("users.activate"), message: t("users.activateConfirmNamed", { name }), confirmLabel: t("users.activate"), danger: false };
          case "unlock":
            return { title: t("users.unlock"), message: t("users.unlockConfirmNamed", { name }), confirmLabel: t("users.unlock"), danger: false };
        }
      })()
    : null;

  const columns: Column<User>[] = [
    { key: "username", header: t("users.username"), sortKey: "username" },
    { key: "full_name", header: t("common.name"), sortKey: "first_name" },
    { key: "email", header: t("users.email"), sortKey: "email" },
    { key: "role", header: t("users.role"), sortKey: "role", render: (r) => roleLabel(r.role, i18n.language) },
    {
      key: "status",
      header: t("common.status"),
      sortKey: "is_active",
      render: (r) => {
        const state = !r.is_active ? "inactive" : r.is_locked ? "locked" : "active";
        const label = !r.is_active ? t("common.inactive") : r.is_locked ? t("users.locked") : t("common.active");
        return <span className={`badge status-${state}`}>{label}</span>;
      },
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "center",
      render: (r) => {
        const name = r.full_name || r.username;
        const items: RowActionsMenuItem[] = [
          ...(canUnlock && r.is_active && r.is_locked
            ? [{ key: "unlock", label: t("users.unlock"), icon: <Unlock size={14} aria-hidden="true" />, onClick: () => confirm.open("unlock", r) }]
            : []),
          ...(canChangePassword && r.is_active
            ? [{ key: "changePassword", label: t("users.changePassword"), icon: <KeyRound size={14} aria-hidden="true" />, onClick: () => openPasswordReset(r) }]
            : []),
          ...(canViewActivity
            ? [{ key: "activity", label: t("users.activity"), icon: <History size={14} aria-hidden="true" />, onClick: () => openActivity(r) }]
            : []),
          ...(canDeactivate && r.is_active
            ? [{ key: "deactivate", label: t("users.deactivate"), danger: true, icon: <UserX size={14} aria-hidden="true" />, onClick: () => confirm.open("deactivate", r) }]
            : []),
          ...(isAdmin && !r.is_active
            ? [{ key: "activate", label: t("users.activate"), icon: <UserCheck size={14} aria-hidden="true" />, onClick: () => confirm.open("activate", r) }]
            : []),
        ];
        return (
          <RowActionsMenu
            ariaLabel={name}
            primary={
              canEdit && r.is_active && (
                <button className="btn small ghost" onClick={() => openEdit(r)} aria-label={`${t("common.edit")} ${name}`}>
                  {t("common.edit")}
                </button>
              )
            }
            items={items}
          />
        );
      },
    },
  ];

  return (
      <Page
        card
        title={t("users.title")}
        actions={
          can(user?.role, "create", "users") && (
            <button className="btn primary" onClick={openNew}>
              + {t("users.new")}
            </button>
          )
        }
      >
        <ListPage<User>
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
          rows={rows}
          getRowLabel={(r) => r.full_name || r.username}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />

        {modal && (
          <FormModal
            title={editId ? t("common.edit") : t("users.new")}
            onClose={() => setModal(false)}
            onSubmit={submit}
            submitLabel={t("common.save")}
            error={formError}
          >
            <Field label={t("users.username")}>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </Field>
            {!editId && (
              <Field label={t("users.password")}>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </Field>
            )}
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
                {availableRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {roleLabel(r.value, i18n.language, r.label)}
                  </option>
                ))}
              </select>
            </Field>
            {form.role === "CENTER_MANAGER" && (
              <Field label={t("users.center")}>
                <select value={form.center} onChange={(e) => setForm({ ...form, center: e.target.value })}>
                  <option value="">—</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </FormModal>
        )}

        {passwordTarget && (
          <FormModal
            title={`${t("users.changePassword")} — ${passwordTarget.full_name || passwordTarget.username}`}
            onClose={() => setPasswordTarget(null)}
            onSubmit={submitPasswordReset}
            submitLabel={t("common.save")}
            error={passwordError}
          >
            <Field label={t("users.newPassword")}>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus />
            </Field>
            <Field label={t("users.confirmPassword")}>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </Field>
          </FormModal>
        )}

        {activityTarget && (
          <UserActivityDialog
            user={activityTarget}
            rows={activityRows}
            page={activityPage}
            count={activityCount}
            loading={activityLoading}
            onPageChange={setActivityPage}
            onClose={() => setActivityTarget(null)}
          />
        )}

        {confirm.confirming && confirmCopy && (
          <ConfirmDialog
            title={confirmCopy.title}
            message={confirmCopy.message}
            confirmLabel={confirmCopy.confirmLabel}
            danger={confirmCopy.danger}
            error={confirm.error}
            pending={confirm.pending}
            onConfirm={runConfirmedAction}
            onCancel={confirm.close}
          />
        )}
      </Page>
  );
}

// "MedicalRecord" -> "Medical Record" — the model class name is already a
// reasonable label, this just makes it readable without a per-model i18n map.
function humanizeTargetType(targetType: string): string {
  return targetType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatAuditTarget(entry: AuditLogEntry): string {
  if (!entry.target_type) return "—";
  return `${humanizeTargetType(entry.target_type)} #${entry.target_id ?? "?"}`;
}

function formatAuditDetails(entry: AuditLogEntry, t: (key: string) => string): string {
  const details = entry.details;
  if (!details || Object.keys(details).length === 0) return "—";
  if (Array.isArray(details.changed_fields)) {
    return (details.changed_fields as string[]).join(", ");
  }
  if (details.action === "unlock") return t("users.unlock");
  if (details.action === "password_reset") return t("users.changePassword");
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join(", ");
}

function UserActivityDialog({ user, rows, page, count, loading, onPageChange, onClose }: {
  user: User;
  rows: AuditLogEntry[];
  page: number;
  count: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(count / ACTIVITY_PAGE_SIZE));

  return (
    <Dialog title={t("users.activityTitle", { name: user.full_name || user.username })} onClose={onClose} wide>
      <p>
        <b>{t("users.lastLogin")}:</b> {user.last_login ? formatDateTime(user.last_login) : t("users.never")}
      </p>
      {loading ? (
        <p className="muted">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="muted">{t("users.activityEmpty")}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t("users.activityDate")}</th>
                <th scope="col">{t("users.activityAction")}</th>
                <th scope="col">{t("users.activityTarget")}</th>
                <th scope="col">{t("users.activityDetails")}</th>
                <th scope="col">{t("users.activityIp")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td>
                    <span className={`badge status-${entry.action === "FAILED_LOGIN" || entry.action === "DELETE" ? "cancelled" : "active"}`}>
                      {t(`users.action${entry.action}`)}
                    </span>
                  </td>
                  <td>{formatAuditTarget(entry)}</td>
                  <td>{formatAuditDetails(entry, t)}</td>
                  <td>{entry.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="pagination">
          <button type="button" className="btn small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {t("pagination.prev")}
          </button>
          <span className="pagination-info">{t("pagination.pageOf", { page, total: totalPages })}</span>
          <button type="button" className="btn small" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            {t("pagination.next")}
          </button>
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>{t("common.close")}</button>
      </div>
    </Dialog>
  );
}

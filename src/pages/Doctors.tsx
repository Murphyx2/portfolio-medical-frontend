import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, MaskedValue, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { DoctorProfile, Paginated, User } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";
import { formatPhone, formatPhoneInput, isValidRequiredPhone } from "../utils/phone";

const EMPTY = { user: 0, specialty: "", license_number: "", contact_phone: "", contact_email: "", bio: "" };

export function Doctors() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "IT";
  const [rows, setRows] = useState<DoctorProfile[]>([]);
  const [userOptions, setUserOptions] = useState<User[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [formError, setFormError] = useState("");
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

  const qs = query();

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<DoctorProfile>>(`/doctors/profiles/?${qs}`, { signal }))
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

  useEffect(() => {
    // User options for the "assign profile" picker: fetched once, not on
    // every page/sort/search change (unlike `load`, which re-runs then).
    api.get<Paginated<User>>("/auth/users/?page_size=200").then((r) => setUserOptions(r.results)).catch(() => {});
  }, []);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  function openEdit(d: DoctorProfile) {
    setForm({
      user: d.user_id,
      specialty: d.specialty,
      license_number: d.license_number,
      contact_phone: formatPhone(d.contact_phone),
      contact_email: d.contact_email,
      bio: d.bio,
    });
    setEditId(d.id);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  async function submit() {
    if (!isValidRequiredPhone(form.contact_phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    setFormError("");
    const body = { ...form, contact_phone: form.contact_phone.replace(/\D/g, "") };
    try {
      if (editId) await api.patch(`/doctors/profiles/${editId}/`, body);
      else await api.post("/doctors/profiles/", body);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(d: DoctorProfile) {
    await api.delete(`/doctors/profiles/${d.id}/`);
    load();
  }

  const columns: Column<DoctorProfile>[] = [
    { key: "full_name", header: t("doctors.fullName"), sortKey: "user__last_name" },
    { key: "specialty", header: t("doctors.specialty"), sortKey: "specialty" },
    { key: "license_number", header: t("doctors.license"), sortKey: "license_number", render: (r) => <MaskedValue value={r.license_number} /> },
    { key: "contact_phone", header: t("doctors.contactPhone"), sortKey: "contact_phone", render: (r) => <MaskedValue value={formatPhone(r.contact_phone)} /> },
    { key: "contact_email", header: t("doctors.contactEmail"), sortKey: "contact_email" },
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
          </div>
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          <Table
            columns={columns}
            rows={rows}
            onEdit={canEdit ? openEdit : undefined}
            onDelete={canEdit ? remove : undefined}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("doctors.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
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
              type="tel"
              inputMode="tel"
              value={form.contact_phone}
              placeholder="(809) 555-1212"
              maxLength={14}
              onChange={(e) => {
                setForm({ ...form, contact_phone: formatPhoneInput(e.target.value) });
                setPhoneError("");
              }}
              required
            />
            {phoneError && <span className="field-error">{phoneError}</span>}
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

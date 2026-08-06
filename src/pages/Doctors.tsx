import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, Spinner, Table, type Column } from "../components/ui";
import { api } from "../services/api";
import type { DoctorProfile, Paginated, User } from "../services/types";
import { useAuth } from "../store/auth";
import { formatPhone, formatPhoneInput, isValidRequiredPhone } from "../utils/phone";

const EMPTY = { user: 0, specialty: "", license_number: "", contact_phone: "", contact_email: "", bio: "" };
const PAGE_SIZE = 100;

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
  const [phoneError, setPhoneError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<DoctorProfile>>(`/doctors/profiles/?page=${page}&page_size=${PAGE_SIZE}`)
      .then((r) => {
        setRows(r.results);
        setCount(r.count);
        const total = Math.ceil(r.count / PAGE_SIZE);
        if (total > 0 && page > total) setPage(total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
    api.get<Paginated<User>>("/auth/users/?page_size=200").then((r) => setUserOptions(r.results)).catch(() => {});
  }, [load]);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setPhoneError("");
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
    setModal(true);
  }

  async function submit() {
    if (!isValidRequiredPhone(form.contact_phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    const body = { ...form, contact_phone: form.contact_phone.replace(/\D/g, "") };
    if (editId) await api.patch(`/doctors/profiles/${editId}/`, body);
    else await api.post("/doctors/profiles/", body);
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
    { key: "contact_phone", header: t("doctors.contactPhone"), render: (r) => formatPhone(r.contact_phone) },
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
        <>
          <Pagination page={page} count={count} pageSize={PAGE_SIZE} onChange={setPage} />
          <Table
            columns={columns}
            rows={rows}
            onEdit={canEdit ? openEdit : undefined}
            onDelete={canEdit ? remove : undefined}
          />
          <Pagination page={page} count={count} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
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

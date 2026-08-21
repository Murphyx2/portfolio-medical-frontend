import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, MaskedValue, ServiceChipList, ServiceCheckboxList, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { DoctorProfile, Paginated, Service, User } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";
import { formatPhone, formatPhoneInput, isValidRequiredPhone } from "../utils/phone";

const EMPTY = { user: 0, license_number: "", contact_phone: "", contact_email: "", bio: "", services: [] as number[] };

export function Doctors() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = can(user?.role, "edit", "doctors");
  const canEditServices = can(user?.role, "manageServices", "doctors");
  const isAdmin = can(user?.role, "restore", "doctors");
  const [userOptions, setUserOptions] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [userError, setUserError] = useState("");
  const [formError, setFormError] = useState("");
  const [servicesModalDoctor, setServicesModalDoctor] = useState<DoctorProfile | null>(null);
  const [servicesSelected, setServicesSelected] = useState<number[]>([]);
  const [servicesError, setServicesError] = useState("");
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
  } = useListPage<DoctorProfile>("/doctors/profiles/");

  useEffect(() => {
    // User options for the "assign profile" picker: fetched once, not on
    // every page/sort/search change (unlike `load`, which re-runs then).
    api.get<Paginated<User>>("/auth/users/?page_size=200").then((r) => setUserOptions(r.results)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canEdit && !canEditServices) return;
    // Active services only (the default /services/ query already excludes
    // inactive rows), fetched once -- mirrors Encounters.tsx's own
    // page_size=200 service-picker fetch.
    api.get<Paginated<Service>>("/services/?page_size=200").then((r) => setServices(r.results)).catch(() => {});
  }, [canEdit, canEditServices]);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setPhoneError("");
    setUserError("");
    setFormError("");
    setModal(true);
  }

  function openEdit(d: DoctorProfile) {
    setForm({
      user: d.user_id,
      license_number: d.license_number,
      contact_phone: formatPhone(d.contact_phone),
      contact_email: d.contact_email,
      bio: d.bio,
      services: d.services,
    });
    setEditId(d.id);
    setPhoneError("");
    setUserError("");
    setFormError("");
    setModal(true);
  }

  async function submit() {
    if (!form.user) {
      setUserError(t("doctors.userRequired"));
      return;
    }
    if (!isValidRequiredPhone(form.contact_phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    setFormError("");
    const { services: formServices, ...rest } = form;
    const body: Record<string, unknown> = { ...rest, contact_phone: form.contact_phone.replace(/\D/g, "") };
    // Only ADMIN sees the services field in this form (IT has canEdit but
    // not canEditServices) -- omit the key entirely for IT rather than
    // sending an empty list, since the backend treats key-presence itself
    // as "this request is trying to change services."
    if (canEditServices) body.services = formServices;
    try {
      if (editId) await api.patch(`/doctors/profiles/${editId}/`, body);
      else await api.post("/doctors/profiles/", body);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  function openServicesModal(d: DoctorProfile) {
    setServicesModalDoctor(d);
    setServicesSelected(d.services);
    setServicesError("");
  }

  async function submitServices() {
    if (!servicesModalDoctor) return;
    try {
      await api.patch(`/doctors/profiles/${servicesModalDoctor.id}/`, { services: servicesSelected });
      setServicesModalDoctor(null);
      load();
    } catch (err) {
      setServicesError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(d: DoctorProfile) {
    await api.delete(`/doctors/profiles/${d.id}/`);
    load();
  }

  async function restore(d: DoctorProfile) {
    await api.post(`/doctors/profiles/${d.id}/restore/`, {});
    load();
  }

  // Only DOCTOR-role accounts are eligible for a new profile; if the
  // profile being edited is somehow linked to a non-DOCTOR account (role
  // changed after assignment), keep it selectable so the form doesn't
  // silently drop it.
  const eligibleUsers =
    editId && form.user && !userOptions.some((u) => u.id === form.user && u.role === "DOCTOR")
      ? userOptions.filter((u) => u.role === "DOCTOR" || u.id === form.user)
      : userOptions.filter((u) => u.role === "DOCTOR");

  const columns: Column<DoctorProfile>[] = [
    { key: "code", header: t("doctors.code"), sortKey: "code" },
    { key: "full_name", header: t("doctors.fullName"), sortKey: "user__last_name" },
    {
      key: "services",
      header: t("doctors.services"),
      render: (r) => (
        <div className="services-cell">
          <ServiceChipList items={r.services_detail} />
          {canEditServices && (
            <button type="button" className="btn ghost small" onClick={() => openServicesModal(r)}>
              {t("doctors.manageServices")}
            </button>
          )}
        </div>
      ),
    },
    { key: "license_number", header: t("doctors.license"), sortKey: "license_number", render: (r) => <MaskedValue value={r.license_number} /> },
    { key: "contact_phone", header: t("doctors.contactPhone"), sortKey: "contact_phone", render: (r) => <MaskedValue value={formatPhone(r.contact_phone)} /> },
    { key: "contact_email", header: t("doctors.contactEmail"), sortKey: "contact_email", render: (r) => <MaskedValue value={r.contact_email} /> },
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
      <ListPage<DoctorProfile>
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
        activeAccessor={(r) => r.active}
        rows={rows}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={canEdit ? remove : undefined}
        onRestore={isAdmin ? restore : undefined}
        getRowLabel={(r) => r.full_name}
        isInactive={(r) => !r.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("doctors.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
          wide
        >
          <Field label={t("doctors.user")}>
            <select
              value={form.user}
              onChange={(e) => {
                setForm({ ...form, user: Number(e.target.value) });
                setUserError("");
              }}
            >
              <option value={0} disabled>
                —
              </option>
              {eligibleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.username} ({u.username})
                </option>
              ))}
            </select>
            {userError && <span className="field-error">{userError}</span>}
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
          {canEditServices && (
            // Plain .field-styled div, not the Field/<label> wrapper -- this
            // widget nests its own interactive controls (search input,
            // type select, many checkboxes), which is invalid inside a
            // single <label>, unlike Field's usual one-input case.
            <div className="field">
              <span>{t("doctors.services")}</span>
              <ServiceCheckboxList
                services={services}
                selected={form.services}
                onChange={(ids) => setForm({ ...form, services: ids })}
              />
            </div>
          )}
        </FormModal>
      )}

      {servicesModalDoctor && (
        <FormModal
          title={t("doctors.manageServices")}
          onClose={() => setServicesModalDoctor(null)}
          onSubmit={submitServices}
          submitLabel={t("common.save")}
          error={servicesError}
          wide
        >
          <div className="field">
            <span>{servicesModalDoctor.full_name}</span>
            <ServiceCheckboxList services={services} selected={servicesSelected} onChange={setServicesSelected} />
          </div>
        </FormModal>
      )}
    </Page>
  );
}

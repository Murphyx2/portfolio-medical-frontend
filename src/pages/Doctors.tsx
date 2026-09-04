import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { ListPage } from "../components/ListPage";
import { DoctorProfileFormFields } from "../components/doctors/DoctorProfileFormFields";
import { ConfirmDialog, Field, FormModal, MaskedValue, Page, type Column } from "../components/ui";
import { ServiceChipList, ServiceCheckboxList } from "./doctors/ServicePickers";
import { RoomChipList, RoomCheckboxList } from "./doctors/RoomPickers";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { DoctorProfile, ExtraPhone, Paginated, Room, Service, User } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";
import { formatPhone, formatPhoneInput, isValidRequiredPhone } from "../utils/phone";

const EMPTY = {
  user: 0,
  first_name: "",
  last_name: "",
  license_number: "",
  contact_phone: "",
  contact_email: "",
  bio: "",
  services: [] as number[],
  rooms: [] as number[],
};

const EMPTY_ACCOUNT = { username: "", password: "", confirm_password: "", email: "" };

export function Doctors() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = can(user?.role, "edit", "doctors");
  const canEditServices = can(user?.role, "manageServices", "doctors");
  const canEditRooms = can(user?.role, "manageRooms", "doctors");
  const isAdmin = can(user?.role, "restore", "doctors");
  const canUnlinkAccount = can(user?.role, "unlinkAccount", "doctors");
  const [userOptions, setUserOptions] = useState<User[]>([]);
  const [linkedUserIds, setLinkedUserIds] = useState<Set<number>>(new Set());
  const [services, setServices] = useState<Service[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [createAccount, setCreateAccount] = useState(false);
  const [newAccount, setNewAccount] = useState(EMPTY_ACCOUNT);
  const [phoneError, setPhoneError] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [servicesModalDoctor, setServicesModalDoctor] = useState<DoctorProfile | null>(null);
  const [servicesSelected, setServicesSelected] = useState<number[]>([]);
  const [servicesError, setServicesError] = useState("");
  const [roomsModalDoctor, setRoomsModalDoctor] = useState<DoctorProfile | null>(null);
  const [roomsSelected, setRoomsSelected] = useState<number[]>([]);
  const [roomsError, setRoomsError] = useState("");
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
    // Doctor/a users already linked to *some* médico -- excluded from the
    // picker below (except the one being edited) so two médicos can't be
    // pointed at the same login.
    api
      .get<Paginated<DoctorProfile>>("/doctors/profiles/?user__isnull=false&page_size=500")
      .then((r) => setLinkedUserIds(new Set(r.results.map((d) => d.user_id!))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canEdit && !canEditServices) return;
    // Active services only (the default /services/ query already excludes
    // inactive rows), fetched once -- mirrors Encounters.tsx's own
    // page_size=200 service-picker fetch.
    api.get<Paginated<Service>>("/services/?page_size=200").then((r) => setServices(r.results)).catch(() => {});
  }, [canEdit, canEditServices]);

  useEffect(() => {
    if (!canEdit && !canEditRooms) return;
    api.get<Paginated<Room>>("/rooms/?page_size=100").then((r) => setRooms(r.results)).catch(() => {});
  }, [canEdit, canEditRooms]);

  function openNew() {
    setForm(EMPTY);
    setExtraPhones([]);
    setEditId(null);
    setCreateAccount(false);
    setNewAccount(EMPTY_ACCOUNT);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  function openEdit(d: DoctorProfile) {
    setForm({
      user: d.user_id ?? 0,
      first_name: d.first_name,
      last_name: d.last_name,
      license_number: d.license_number,
      contact_phone: formatPhone(d.contact_phone),
      contact_email: d.contact_email,
      bio: d.bio,
      services: d.services,
      rooms: d.rooms,
    });
    setExtraPhones(d.extra_phones.map((p) => formatPhone(p.phone)));
    setEditId(d.id);
    setCreateAccount(false);
    setNewAccount(EMPTY_ACCOUNT);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  async function unlinkAccount() {
    if (!editId) return;
    try {
      await api.post(`/doctors/profiles/${editId}/unlink_account/`, {});
      setForm({ ...form, user: 0 });
      setConfirmUnlink(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function submit() {
    if (!form.first_name.trim()) {
      setFormError(t("doctors.fullNameRequired"));
      return;
    }
    if (!isValidRequiredPhone(form.contact_phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    if (createAccount && newAccount.password !== newAccount.confirm_password) {
      setFormError(t("users.passwordMismatch"));
      return;
    }
    setFormError("");
    const { services: formServices, rooms: formRooms, user: formUser, ...rest } = form;
    const body: Record<string, unknown> = {
      ...rest,
      contact_phone: form.contact_phone.replace(/\D/g, ""),
      extra_phones: extraPhones
        .filter((p) => p.trim() !== "")
        .map((p): ExtraPhone => ({ phone: p.replace(/\D/g, "") })),
    };
    if (createAccount) {
      const { confirm_password: _confirmPassword, ...account } = newAccount;
      body.create_account = { ...account, email: account.email || form.contact_email };
    } else {
      body.user = formUser || null;
    }
    // Only ADMIN sees the services field in this form (IT has canEdit but
    // not canEditServices) -- omit the key entirely for IT rather than
    // sending an empty list, since the backend treats key-presence itself
    // as "this request is trying to change services."
    if (canEditServices) body.services = formServices;
    if (canEditRooms) body.rooms = formRooms;
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

  function openRoomsModal(d: DoctorProfile) {
    setRoomsModalDoctor(d);
    setRoomsSelected(d.rooms);
    setRoomsError("");
  }

  async function submitRooms() {
    if (!roomsModalDoctor) return;
    try {
      await api.patch(`/doctors/profiles/${roomsModalDoctor.id}/`, { rooms: roomsSelected });
      setRoomsModalDoctor(null);
      load();
    } catch (err) {
      setRoomsError(err instanceof ApiError ? flattenError(err.message) : String(err));
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

  // Only DOCTOR-role accounts not already linked to a *different* médico
  // are eligible; if the profile being edited is somehow linked to a
  // non-DOCTOR account (role changed after assignment) or to a user this
  // filter would otherwise exclude, keep it selectable so the form doesn't
  // silently drop it.
  const eligibleUsers = userOptions.filter(
    (u) => u.id === form.user || (u.role === "DOCTOR" && !linkedUserIds.has(u.id))
  );

  const columns: Column<DoctorProfile>[] = [
    { key: "code", header: t("doctors.code"), sortKey: "code" },
    { key: "full_name", header: t("doctors.fullName"), sortKey: "last_name" },
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
    {
      key: "rooms",
      header: t("doctors.rooms"),
      render: (r) => (
        <div className="services-cell">
          <RoomChipList items={r.rooms_detail} />
          {canEditRooms && (
            <button type="button" className="btn ghost small" onClick={() => openRoomsModal(r)}>
              {t("doctors.manageRooms")}
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
      card
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
          <Field label={t("users.firstName")}>
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </Field>
          <Field label={t("users.lastName")}>
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </Field>

          {editId && form.user ? (
            <div className="field">
              <span>{t("doctors.user")}</span>
              <p>{userOptions.find((u) => u.id === form.user)?.username ?? "—"}</p>
              <div className="field-action-row">
                <Link className="btn ghost small" to="/users">
                  {t("doctors.editUser")}
                </Link>
                {canUnlinkAccount && (
                  <button type="button" className="btn ghost small" onClick={() => setConfirmUnlink(true)}>
                    {t("doctors.unlinkAccount")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {!createAccount && (
                <Field label={t("doctors.user")}>
                  <select value={form.user} onChange={(e) => setForm({ ...form, user: Number(e.target.value) })}>
                    <option value={0}>—</option>
                    {eligibleUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.username} ({u.username})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <label className="muted touch-label">
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(e) => {
                    setCreateAccount(e.target.checked);
                    if (e.target.checked) setForm({ ...form, user: 0 });
                  }}
                />{" "}
                {t("doctors.createAccount")}
              </label>
              {createAccount && (
                <div className="form-section">
                  <h4>{t("doctors.accountBlockTitle")}</h4>
                  <Field label={t("users.username")}>
                    <input
                      value={newAccount.username}
                      onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={t("users.password")}>
                    <input
                      type="password"
                      value={newAccount.password}
                      onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={t("users.confirmPassword")}>
                    <input
                      type="password"
                      value={newAccount.confirm_password}
                      onChange={(e) => setNewAccount({ ...newAccount, confirm_password: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={t("users.email")}>
                    <input
                      type="email"
                      value={newAccount.email}
                      placeholder={form.contact_email}
                      onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </>
          )}

          <DoctorProfileFormFields
            licenseNumber={form.license_number}
            onLicenseNumberChange={(v) => setForm({ ...form, license_number: v })}
            contactPhone={form.contact_phone}
            onContactPhoneChange={(v) => {
              setForm({ ...form, contact_phone: formatPhoneInput(v) });
              setPhoneError("");
            }}
            contactPhoneError={phoneError}
            extraPhones={extraPhones}
            onExtraPhonesChange={setExtraPhones}
            contactEmail={form.contact_email}
            onContactEmailChange={(v) => setForm({ ...form, contact_email: v })}
            bio={form.bio}
            onBioChange={(v) => setForm({ ...form, bio: v })}
            services={form.services}
            onServicesChange={(ids) => setForm({ ...form, services: ids })}
            rooms={form.rooms}
            onRoomsChange={(ids) => setForm({ ...form, rooms: ids })}
            serviceOptions={services}
            roomOptions={rooms}
            canEditServices={canEditServices}
            canEditRooms={canEditRooms}
          />
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

      {roomsModalDoctor && (
        <FormModal
          title={t("doctors.manageRooms")}
          onClose={() => setRoomsModalDoctor(null)}
          onSubmit={submitRooms}
          submitLabel={t("common.save")}
          error={roomsError}
          wide
        >
          <div className="field">
            <span>{roomsModalDoctor.full_name}</span>
            <RoomCheckboxList rooms={rooms} selected={roomsSelected} onChange={setRoomsSelected} />
          </div>
        </FormModal>
      )}

      {confirmUnlink && (
        <ConfirmDialog
          title={t("doctors.unlinkAccount")}
          message={t("doctors.unlinkAccountConfirm")}
          confirmLabel={t("doctors.unlinkAccount")}
          danger
          onConfirm={unlinkAccount}
          onCancel={() => setConfirmUnlink(false)}
        />
      )}
    </Page>
  );
}

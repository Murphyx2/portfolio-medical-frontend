import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Dialog, Field, FormModal, MaskedValue, Page, Pagination, SearchBar, Spinner, Table, type Column, type SortDir } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { ARS, MedicalCenter, Paginated, Patient } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";
import { formatPhone, formatPhoneInput, isValidPhone, isValidRequiredPhone, stripToDigits } from "../utils/phone";

const EMPTY = {
  first_name: "",
  last_name: "",
  birth_date: "",
  gender: "",
  phone: "",
  address: "",
  email: "",
  cedula: "",
  nss: "",
  ars: "",
  ars_program: "",
  center: "",
  has_guardian: true,
  guardian_first_name: "",
  guardian_last_name: "",
  guardian_cedula: "",
  guardian_nss: "",
  guardian_phone: "",
};

function formatCedula(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

// Client-side mirror of the backend's age arithmetic, used only to decide
// whether to show the Guardian/Parent section -- the server remains the
// source of truth via PatientSerializer.validate(). Returns null (rather
// than throwing) on an empty/unparseable date so the section just stays
// hidden instead of crashing the form.
function calcAge(birthDateStr: string): number | null {
  if (!birthDateStr) return null;
  const bd = new Date(birthDateStr);
  if (Number.isNaN(bd.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const beforeBirthday =
    today.getMonth() < bd.getMonth() ||
    (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate());
  if (beforeBirthday) age--;
  return age;
}

export function Patients() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<Patient[]>([]);
  const [arsList, setArsList] = useState<ARS[]>([]);
  const [centersList, setCentersList] = useState<MedicalCenter[]>([]);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState<Patient | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [guardianPhoneError, setGuardianPhoneError] = useState("");
  const [formError, setFormError] = useState("");
  const [showInactive, setShowInactive] = useState(false);
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

  const qs = query({ include_inactive: showInactive ? "true" : "" });

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<Patient>>(`/patients/?${qs}`, { signal }))
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
    api
      .get<Paginated<ARS>>("/ars/?page_size=100")
      .then((r) => setArsList(r.results))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<Paginated<MedicalCenter>>("/centers/?page_size=100")
      .then((r) => setCentersList(r.results))
      .catch(() => {});
  }, []);

  const selectedArs = arsList.find((a) => String(a.id) === form.ars);
  const isMinor = (calcAge(form.birth_date) ?? 99) < 18;

  // cedula/nss/phone/email/age are encrypted at rest: the backend can't sort
  // them in SQL and simply ignores an `?ordering=` request for them (falls
  // back to default ordering). Sort those columns client-side, on the
  // currently-loaded page only, instead of routing the click through the
  // server-driven sort in useListControls.
  const CLIENT_SORT_KEYS = new Set(["phone", "email", "cedula", "nss", "age"]);
  const [clientSort, setClientSort] = useState<{ key: string; dir: SortDir } | null>(null);

  function handleColumnSort(key: string) {
    if (CLIENT_SORT_KEYS.has(key)) {
      setClientSort((prev) => {
        if (!prev || prev.key !== key) return { key, dir: "asc" };
        if (prev.dir === "asc") return { key, dir: "desc" };
        return null;
      });
      return;
    }
    setClientSort(null);
    handleSort(key);
  }

  function clientSortValue(p: Patient, key: string): string | number | null {
    switch (key) {
      case "age":
        return p.age ?? null;
      case "phone":
        return p.phone || null;
      case "email":
        return p.email || null;
      case "cedula":
        return p.cedula || null;
      case "nss":
        return p.nss || null;
      default:
        return null;
    }
  }

  const displayRows = useMemo(() => {
    if (!clientSort) return rows;
    const { key, dir } = clientSort;
    return [...rows].sort((a, b) => {
      const av = clientSortValue(a, key);
      const bv = clientSortValue(b, key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, clientSort]);

  function openNew() {
    const defaultCenter = centersList.find((c) => c.is_default);
    setForm({ ...EMPTY, center: defaultCenter ? String(defaultCenter.id) : "" });
    setEditId(null);
    setPhoneError("");
    setGuardianPhoneError("");
    setFormError("");
    setModal(true);
  }

  function openEdit(p: Patient) {
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      birth_date: p.birth_date ?? "",
      gender: p.gender,
      phone: formatPhone(p.phone),
      address: p.address,
      email: p.email,
      cedula: p.cedula,
      nss: p.nss,
      ars: p.ars ? String(p.ars) : "",
      ars_program: p.ars_program ? String(p.ars_program) : "",
      center: p.center ? String(p.center) : "",
      has_guardian: p.has_guardian,
      guardian_first_name: p.guardian_first_name,
      guardian_last_name: p.guardian_last_name,
      guardian_cedula: p.guardian_cedula,
      guardian_nss: p.guardian_nss,
      guardian_phone: formatPhone(p.guardian_phone),
    });
    setEditId(p.id);
    setPhoneError("");
    setGuardianPhoneError("");
    setFormError("");
    setModal(true);
  }

  async function submit() {
    if (!isValidPhone(form.phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    if (isMinor && form.has_guardian && !isValidRequiredPhone(form.guardian_phone)) {
      setGuardianPhoneError(t("common.phoneInvalid"));
      return;
    }
    const body = {
      ...form,
      birth_date: form.birth_date || null,
      phone: form.phone.replace(/\D/g, ""),
      cedula: form.cedula.replace(/\D/g, ""),
      guardian_cedula: form.guardian_cedula.replace(/\D/g, ""),
      guardian_phone: form.guardian_phone.replace(/\D/g, ""),
      ars: form.ars ? Number(form.ars) : null,
      ars_program: form.ars_program ? Number(form.ars_program) : null,
      center: form.center ? Number(form.center) : null,
    };
    try {
      if (editId) await api.patch(`/patients/${editId}/`, body);
      else await api.post("/patients/", body);
      setFormError("");
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(p: Patient) {
    await api.delete(`/patients/${p.id}/`);
    load();
  }

  async function restore(p: Patient) {
    await api.post(`/patients/${p.id}/restore/`, {});
    load();
  }

  async function openDetail(p: Patient) {
    setOpeningId(p.id);
    try {
      const full = await api.get<Patient>(`/patients/${p.id}/`);
      setDetail(full);
    } finally {
      setOpeningId(null);
    }
  }

  const genderLabels: Record<string, string> = {
    MALE: t("patients.genderMale"),
    FEMALE: t("patients.genderFemale"),
  };

  // Matches Records.tsx's click-to-detail pattern: Name/Cedula/NSS cells
  // become links that open a read-only "complete information" dialog
  // instead of trying to fit every field into the table.
  const openDetailLink = (r: Patient, content: ReactNode) => (
    <button type="button" className="row-link" disabled={openingId === r.id} onClick={() => openDetail(r)}>
      {openingId === r.id ? t("common.loading") : content}
    </button>
  );

  // Small inline marker (mirrors MaskedValue's lock-icon mechanism: icon +
  // title tooltip + sr-only label) shown before a guardian's cedula in the
  // table, so staff don't mistake it for the patient's own document.
  function guardianCedulaIcon() {
    const label = t("patients.guardianCedulaTooltip");
    return (
      <span className="masked-value" title={label}>
        <svg
          className="masked-value-icon"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M3 13c0-2.7 2.2-4.75 5-4.75s5 2.05 5 4.75" />
        </svg>
        <span className="sr-only">{label}: </span>
      </span>
    );
  }

  const columns: Column<Patient>[] = [
    {
      key: "full_name",
      header: t("common.name"),
      sortKey: "search_name",
      render: (r) => openDetailLink(r, <MaskedValue value={r.full_name} />),
    },
    { key: "age", header: t("patients.age"), sortKey: "age", render: (r) => (r.age ?? "—") },
    {
      key: "gender",
      header: t("patients.gender"),
      sortKey: "gender",
      render: (r) => genderLabels[r.gender] ?? r.gender,
    },
    {
      key: "cedula",
      header: t("patients.cedula"),
      sortKey: "cedula",
      render: (r) => {
        // For a minor with guardian info on file, this column shows the
        // guardian's cedula instead of the patient's own -- the same value
        // can therefore legitimately repeat across sibling rows. The
        // patient's own cedula is always shown in the detail modal.
        const showsGuardian = (r.age ?? 99) < 18 && r.has_guardian && !!r.guardian_cedula;
        const raw = showsGuardian ? r.guardian_cedula : r.cedula;
        const formatted = raw ? (raw.includes("•") ? raw : formatCedula(raw)) : "";
        return openDetailLink(
          r,
          <>
            {showsGuardian && guardianCedulaIcon()}
            <MaskedValue value={formatted} />
          </>,
        );
      },
    },
    { key: "nss", header: t("patients.nss"), sortKey: "nss", render: (r) => openDetailLink(r, <MaskedValue value={r.nss} />) },
    { key: "phone", header: t("patients.phone"), sortKey: "phone", render: (r) => <MaskedValue value={formatPhone(r.phone)} /> },
    { key: "ars_name", header: t("patients.ars"), sortKey: "ars__name" },
    { key: "ars_program_name", header: t("patients.arsProgram"), sortKey: "ars_program__name" },
    { key: "center_name", header: t("patients.center"), sortKey: "center__code", render: (r) => r.center_code ?? "—" },
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (r: Patient) => (
              <span className={`badge status-${r.active ? "active" : "inactive"}`}>
                {r.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<Patient>,
        ]
      : []),
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
            {isAdmin && (
              <label className="show-inactive-toggle">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                {t("common.showInactive")}
              </label>
            )}
          </div>
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          <Table
            columns={columns}
            rows={displayRows}
            onEdit={openEdit}
            onDelete={remove}
            onRestore={isAdmin ? restore : undefined}
            getRowLabel={(r) => r.full_name}
            isInactive={(r) => !r.active}
            sortKey={clientSort?.key ?? sortKey}
            sortDir={clientSort?.dir ?? sortDir}
            onSort={handleColumnSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("patients.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
          wide
        >
          <div className="form-columns">
            <div>
              <h4>{t("patients.sectionIdentity")}</h4>
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
              <Field label={t("patients.cedula")}>
                <input
                  value={form.cedula}
                  placeholder="000-0000000-0"
                  inputMode="numeric"
                  maxLength={13}
                  required
                  onChange={(e) => setForm({ ...form, cedula: formatCedula(e.target.value) })}
                />
              </Field>
              <Field label={t("patients.birthDate")}>
                <input
                  type="date"
                  value={form.birth_date}
                  required
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                />
              </Field>
              <Field label={t("patients.gender")}>
                <select
                  value={form.gender}
                  required
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="" disabled>
                    {t("patients.selectGender")}
                  </option>
                  <option value="MALE">{t("patients.genderMale")}</option>
                  <option value="FEMALE">{t("patients.genderFemale")}</option>
                </select>
              </Field>
            </div>

            <div>
              <h4>{t("patients.sectionInsurance")}</h4>
              <Field label={t("patients.nss")}>
                <input
                  value={form.nss}
                  inputMode="numeric"
                  maxLength={11}
                  onChange={(e) => setForm({ ...form, nss: stripToDigits(e.target.value).slice(0, 11) })}
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
              <Field label={t("patients.center")}>
                <select
                  value={form.center}
                  onChange={(e) => setForm({ ...form, center: e.target.value })}
                >
                  <option value="">—</option>
                  {centersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {isMinor && (
            <>
              <h4>{t("patients.sectionGuardian")}</h4>
              <label className="show-inactive-toggle">
                <input
                  type="checkbox"
                  checked={form.has_guardian}
                  onChange={(e) => setForm({ ...form, has_guardian: e.target.checked })}
                />
                {t("patients.guardianCheckbox")}
              </label>
              {form.has_guardian && (
                <>
                  <div className="form-columns">
                    <Field label={t("patients.guardianFirstName")}>
                      <input
                        value={form.guardian_first_name}
                        required
                        onChange={(e) => setForm({ ...form, guardian_first_name: e.target.value })}
                      />
                    </Field>
                    <Field label={t("patients.guardianLastName")}>
                      <input
                        value={form.guardian_last_name}
                        required
                        onChange={(e) => setForm({ ...form, guardian_last_name: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="form-columns">
                    <Field label={t("patients.guardianCedula")}>
                      <input
                        value={form.guardian_cedula}
                        placeholder="000-0000000-0"
                        inputMode="numeric"
                        maxLength={13}
                        required
                        onChange={(e) => setForm({ ...form, guardian_cedula: formatCedula(e.target.value) })}
                      />
                    </Field>
                    <Field label={t("patients.guardianPhone")}>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={form.guardian_phone}
                        placeholder="(809) 555-1212"
                        maxLength={14}
                        required
                        onChange={(e) => {
                          setForm({ ...form, guardian_phone: formatPhoneInput(e.target.value) });
                          setGuardianPhoneError("");
                        }}
                      />
                      {guardianPhoneError && <span className="field-error">{guardianPhoneError}</span>}
                    </Field>
                  </div>
                  <Field label={t("patients.guardianNss")}>
                    <input
                      value={form.guardian_nss}
                      inputMode="numeric"
                      maxLength={11}
                      onChange={(e) => setForm({ ...form, guardian_nss: stripToDigits(e.target.value).slice(0, 11) })}
                    />
                  </Field>
                </>
              )}
            </>
          )}

          <h4>{t("patients.sectionContact")}</h4>
          <div className="form-columns">
            <Field label={t("patients.phone")}>
              <input
                type="tel"
                inputMode="tel"
                value={form.phone}
                placeholder="(809) 555-1212"
                maxLength={14}
                onChange={(e) => {
                  setForm({ ...form, phone: formatPhoneInput(e.target.value) });
                  setPhoneError("");
                }}
              />
              {phoneError && <span className="field-error">{phoneError}</span>}
            </Field>
            <Field label={t("patients.email")}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("patients.address")}>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </FormModal>
      )}

      {detail && (
        <Dialog title={<MaskedValue value={detail.full_name} />} onClose={() => setDetail(null)} wide>
          <div className="form-columns">
            <div>
              <h4>{t("patients.sectionIdentity")}</h4>
              <div className="kv-grid">
                <div>
                  <b>{t("patients.cedula")}:</b>{" "}
                  <MaskedValue value={detail.cedula ? (detail.cedula.includes("•") ? detail.cedula : formatCedula(detail.cedula)) : ""} />
                </div>
                <div>
                  <b>{t("patients.birthDate")}:</b> {detail.birth_date ?? "—"}
                </div>
                <div>
                  <b>{t("patients.age")}:</b> {detail.age ?? "—"}
                </div>
                <div>
                  <b>{t("patients.gender")}:</b> {genderLabels[detail.gender] ?? detail.gender}
                </div>
              </div>
            </div>
            <div>
              <h4>{t("patients.sectionInsurance")}</h4>
              <div className="kv-grid">
                <div>
                  <b>{t("patients.nss")}:</b> <MaskedValue value={detail.nss} />
                </div>
                <div>
                  <b>{t("patients.ars")}:</b> {detail.ars_name ?? "—"}
                </div>
                <div>
                  <b>{t("patients.arsProgram")}:</b> {detail.ars_program_name ?? "—"}
                </div>
                <div>
                  <b>{t("patients.center")}:</b> {detail.center_name ?? "—"}
                </div>
              </div>
            </div>
          </div>

          <h4>{t("patients.sectionContact")}</h4>
          <div className="kv-grid">
            <div>
              <b>{t("patients.phone")}:</b> <MaskedValue value={formatPhone(detail.phone)} />
            </div>
            <div>
              <b>{t("common.email")}:</b> <MaskedValue value={detail.email} />
            </div>
            <div>
              <b>{t("patients.address")}:</b> <MaskedValue value={detail.address} />
            </div>
          </div>

          {(detail.age ?? 99) < 18 && (
            <>
              <h4>{t("patients.sectionGuardian")}</h4>
              {detail.has_guardian ? (
                <div className="kv-grid">
                  <div>
                    <b>{t("patients.guardianFirstName")}:</b> <MaskedValue value={detail.guardian_first_name} />
                  </div>
                  <div>
                    <b>{t("patients.guardianLastName")}:</b> <MaskedValue value={detail.guardian_last_name} />
                  </div>
                  <div>
                    <b>{t("patients.guardianCedula")}:</b>{" "}
                    <MaskedValue
                      value={
                        detail.guardian_cedula
                          ? detail.guardian_cedula.includes("•")
                            ? detail.guardian_cedula
                            : formatCedula(detail.guardian_cedula)
                          : ""
                      }
                    />
                  </div>
                  <div>
                    <b>{t("patients.guardianNss")}:</b> <MaskedValue value={detail.guardian_nss} />
                  </div>
                  <div>
                    <b>{t("patients.guardianPhone")}:</b> <MaskedValue value={formatPhone(detail.guardian_phone)} />
                  </div>
                </div>
              ) : (
                <p className="muted">{t("patients.guardianNotOnFile")}</p>
              )}
            </>
          )}

          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setDetail(null)}>
              {t("common.close")}
            </button>
          </div>
        </Dialog>
      )}
    </Page>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column, type SortDir } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { ARS, MedicalCenter, Paginated, Patient } from "../services/types";
import { formatPhone, formatPhoneInput, isValidPhone, stripToDigits } from "../utils/phone";

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
  center: "",
};

function formatCedula(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

function flattenError(message: string): string {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        lines.push(`${key}: ${Array.isArray(value) ? value.join(" ") : String(value)}`);
      }
      return lines.join("\n");
    }
  } catch {
    /* not JSON */
  }
  return message;
}

export function Patients() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Patient[]>([]);
  const [arsList, setArsList] = useState<ARS[]>([]);
  const [centersList, setCentersList] = useState<MedicalCenter[]>([]);
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
    setForm(EMPTY);
    setEditId(null);
    setPhoneError("");
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
    });
    setEditId(p.id);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  async function submit() {
    if (!isValidPhone(form.phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    const body = {
      ...form,
      birth_date: form.birth_date || null,
      phone: form.phone.replace(/\D/g, ""),
      cedula: form.cedula.replace(/\D/g, ""),
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

  const columns: Column<Patient>[] = [
    { key: "full_name", header: t("common.name"), sortKey: "search_name", render: (r) => r.full_name },
    { key: "age", header: t("patients.age"), sortKey: "age", render: (r) => (r.age ?? "-") },
    { key: "gender", header: t("patients.gender"), sortKey: "gender" },
    { key: "phone", header: t("patients.phone"), sortKey: "phone", render: (r) => formatPhone(r.phone) },
    { key: "email", header: t("common.email"), sortKey: "email" },
    { key: "cedula", header: t("patients.cedula"), sortKey: "cedula", render: (r) => (r.cedula ? formatCedula(r.cedula) : "") },
    { key: "nss", header: t("patients.nss"), sortKey: "nss" },
    { key: "ars_name", header: t("patients.ars"), sortKey: "ars__name" },
    { key: "ars_program_name", header: t("patients.arsProgram"), sortKey: "ars_program__name" },
    { key: "center_name", header: t("patients.center"), sortKey: "center__name", render: (r) => r.center_name ?? "—" },
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
          </div>
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          <Table
            columns={columns}
            rows={displayRows}
            onEdit={openEdit}
            onDelete={remove}
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
          <Field label={t("patients.cedula")}>
            <input
              value={form.cedula}
              placeholder="000-0000000-0"
              inputMode="numeric"
              maxLength={13}
              onChange={(e) => setForm({ ...form, cedula: formatCedula(e.target.value) })}
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
        </FormModal>
      )}
    </Page>
  );
}

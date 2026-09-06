import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListPage } from "../components/ListPage";
import { PhoneNumberListField } from "../components/PhoneNumberListField";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, upload } from "../services/api";
import type { MedicalCenter } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { apiErrorMessage } from "../utils/errors";
import { formatPhone, formatPhoneInput, isValidRequiredPhone } from "../utils/phone";

const EMPTY = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  rnc: "",
  nombre_legal: "",
  nombre_corto: "",
  is_default: false,
};

/** Growable list of "additional email" rows -- same add/remove shape as
 * PhoneNumberListField, just plain (unmasked) email inputs. */
function EmailListField({
  values,
  onChange,
  addLabel,
  removeLabel,
  itemLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  removeLabel: string;
  itemLabel: string;
}) {
  function updateAt(index: number, next: string) {
    onChange(values.map((v, i) => (i === index ? next : v)));
  }
  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }
  return (
    <div className="phone-list-field">
      {values.map((value, index) => (
        <div className="phone-list-row" key={index}>
          <input type="email" value={value} aria-label={itemLabel} onChange={(e) => updateAt(index, e.target.value)} />
          <button
            type="button"
            className="phone-list-remove-btn"
            aria-label={removeLabel}
            onClick={() => removeAt(index)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={() => onChange([...values, ""])}>
        + {addLabel}
      </button>
    </div>
  );
}

export function Centers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = can(user?.role, "edit", "centers");
  const isAdmin = can(user?.role, "restore", "centers");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [formError, setFormError] = useState("");
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
  } = useListPage<MedicalCenter>("/centers/");

  function openNew() {
    setForm(EMPTY);
    setExtraPhones([]);
    setExtraEmails([]);
    setLogoFile(null);
    setCurrentLogo(null);
    setEditId(null);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  function openEdit(c: MedicalCenter) {
    setForm({
      name: c.name,
      code: c.code,
      address: c.address,
      phone: formatPhone(c.phone),
      email: c.email,
      rnc: c.rnc,
      nombre_legal: c.nombre_legal,
      nombre_corto: c.nombre_corto,
      is_default: c.is_default,
    });
    setExtraPhones(c.phones.map((p) => formatPhone(p.number)));
    setExtraEmails(c.emails.map((e) => e.email));
    setLogoFile(null);
    setCurrentLogo(c.logo);
    setEditId(c.id);
    setPhoneError("");
    setFormError("");
    setModal(true);
  }

  async function submit() {
    if (!isValidRequiredPhone(form.phone)) {
      setPhoneError(t("common.phoneInvalid"));
      return;
    }
    setFormError("");
    const body = {
      ...form,
      phone: form.phone.replace(/\D/g, ""),
      phones: extraPhones
        .filter((p) => p.trim() !== "")
        .map((p) => ({ number: p.replace(/\D/g, "") })),
      emails: extraEmails.filter((e) => e.trim() !== "").map((e) => ({ email: e.trim() })),
    };
    try {
      let id = editId;
      if (editId) await api.patch(`/centers/${editId}/`, body);
      else {
        const created = await api.post<MedicalCenter>("/centers/", body);
        id = created.id;
      }
      if (logoFile && id) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await upload(`/centers/${id}/`, fd, "PATCH");
      }
      setModal(false);
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    }
  }

  async function remove(c: MedicalCenter) {
    await api.delete(`/centers/${c.id}/`);
    load();
  }

  async function restore(c: MedicalCenter) {
    await api.post(`/centers/${c.id}/restore/`, {});
    load();
  }

  function phoneCell(c: MedicalCenter) {
    if (c.phones.length > 0) {
      const first = formatPhone(c.phones[0].number);
      return c.phones.length > 1 ? `${first} ${t("centers.moreCount", { count: c.phones.length - 1 })}` : first;
    }
    return formatPhone(c.phone);
  }

  function emailCell(c: MedicalCenter) {
    if (c.emails.length > 0) {
      const first = c.emails[0].email;
      return c.emails.length > 1 ? `${first} ${t("centers.moreCount", { count: c.emails.length - 1 })}` : first;
    }
    return c.email;
  }

  const columns: Column<MedicalCenter>[] = [
    { key: "name", header: t("centers.name"), sortKey: "name" },
    {
      key: "code",
      header: t("centers.code"),
      sortKey: "code",
      render: (r) => (
        <span>
          {r.code}
          {r.is_default && <span className="cell-sublabel">{t("centers.defaultLabel")}</span>}
        </span>
      ),
    },
    { key: "address", header: t("centers.address"), sortKey: "address" },
    { key: "phone", header: t("centers.phone"), render: (r) => phoneCell(r) },
    { key: "email", header: t("centers.email"), render: (r) => emailCell(r) },
    { key: "doctor_count", header: t("centers.doctorsCount"), sortKey: "doctor_count" },
  ];

  return (
    <Page
      card
      title={t("centers.title")}
      actions={
        canEdit && (
          <button className="btn primary" onClick={openNew}>
            + {t("centers.new")}
          </button>
        )
      }
    >
      <ListPage<MedicalCenter>
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
        getRowLabel={(r) => r.name}
        isInactive={(r) => !r.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("centers.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
          wide
        >
          <Field label={t("centers.name")}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t("centers.code")}>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </Field>
          <Field label={t("centers.address")}>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          </Field>
          <Field label={t("centers.nombreLegal")}>
            <input value={form.nombre_legal} onChange={(e) => setForm({ ...form, nombre_legal: e.target.value })} />
          </Field>
          <Field label={t("centers.nombreCorto")}>
            <input value={form.nombre_corto} onChange={(e) => setForm({ ...form, nombre_corto: e.target.value })} />
          </Field>
          <Field label={t("centers.rnc")}>
            <input value={form.rnc} onChange={(e) => setForm({ ...form, rnc: e.target.value })} />
          </Field>
          <Field label={t("centers.logo")}>
            {currentLogo && !logoFile && (
              <div className="cell-sublabel">
                <img src={currentLogo} alt="" style={{ maxHeight: 48, maxWidth: 120, display: "block", marginBottom: "0.4rem" }} />
                {t("centers.logoCurrent")}
              </div>
            )}
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Field label={t("centers.phoneLegacy")}>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              placeholder="(809) 555-1212"
              maxLength={14}
              aria-invalid={!!phoneError}
              aria-describedby={phoneError ? "center-phone-error" : undefined}
              onChange={(e) => {
                setForm({ ...form, phone: formatPhoneInput(e.target.value) });
                setPhoneError("");
              }}
              required
            />
            {phoneError && (
              <span id="center-phone-error" className="field-error" role="alert">
                {phoneError}
              </span>
            )}
          </Field>
          <Field label={t("centers.phones")}>
            <PhoneNumberListField
              values={extraPhones}
              onChange={setExtraPhones}
              addLabel={t("centers.addPhone")}
              removeLabel={t("centers.removePhone")}
              itemLabel={t("centers.additionalPhone")}
            />
          </Field>
          <Field label={t("centers.emailLegacy")}>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={t("centers.emails")}>
            <EmailListField
              values={extraEmails}
              onChange={setExtraEmails}
              addLabel={t("centers.addEmail")}
              removeLabel={t("centers.removeEmail")}
              itemLabel={t("centers.additionalEmail")}
            />
          </Field>
          <label className="show-inactive-toggle">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            {t("centers.isDefault")}
          </label>
        </FormModal>
      )}
    </Page>
  );
}

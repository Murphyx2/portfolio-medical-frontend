import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Table, type Column } from "../../components/ui";
import { ApiError } from "../../services/api";
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from "../../services/communications";
import type { CommunicationsChannel, CommunicationsKind, CommunicationsTemplate } from "../../services/types";
import { flattenError } from "../../utils/errors";
import { kindLabel, UnderConstructionBanner } from "./shared";

const KINDS: CommunicationsKind[] = [
  "AVISO",
  "INFORMACION",
  "ALERTA",
  "CITA_CREADA",
  "CITA_RECORDATORIO",
  "CITA_REAGENDADA",
  "CITA_CANCELADA",
];

const EMPTY = {
  channel: "WHATSAPP" as CommunicationsChannel,
  kind: "CITA_RECORDATORIO" as CommunicationsKind,
  provider_name: "",
  language: "es_DO",
  body_email: "",
  variables_json: [] as string[],
  is_active: true,
};

export function CommunicationsTemplates() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CommunicationsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CommunicationsTemplate | null | undefined>(undefined);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [variablesText, setVariablesText] = useState("");

  function load() {
    setLoading(true);
    listTemplates()
      .then((r) => {
        setRows(r.results);
        setError("");
      })
      .catch((err) => setError(err instanceof ApiError ? flattenError(err.message) : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openNew() {
    setForm(EMPTY);
    setVariablesText("");
    setFormError("");
    setEditing(null);
  }

  function openEdit(row: CommunicationsTemplate) {
    setForm({
      channel: row.channel,
      kind: row.kind,
      provider_name: row.provider_name,
      language: row.language,
      body_email: row.body_email,
      variables_json: row.variables_json,
      is_active: row.is_active,
    });
    setVariablesText(row.variables_json.join(", "));
    setFormError("");
    setEditing(row);
  }

  async function submit() {
    const body = {
      ...form,
      variables_json: variablesText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };
    try {
      if (editing) await updateTemplate(editing.id, body);
      else await createTemplate(body);
      setEditing(undefined);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(row: CommunicationsTemplate) {
    await deleteTemplate(row.id);
    load();
  }

  const columns: Column<CommunicationsTemplate>[] = [
    { key: "kind", header: t("communications.templates.kind"), render: (r) => kindLabel(t, r.kind) },
    { key: "channel", header: t("communications.templates.channel") },
    { key: "provider_name", header: t("communications.templates.providerName") },
    { key: "language", header: t("communications.templates.language") },
    {
      key: "is_active",
      header: t("communications.templates.active"),
      align: "center",
      render: (r) => (r.is_active ? "✓" : ""),
    },
  ];

  return (
    <Page
      card
      title={t("communications.templates.title")}
      actions={
        <button className="btn primary" onClick={openNew}>
          {t("communications.templates.new")}
        </button>
      }
    >
      <UnderConstructionBanner t={t} />
      {loading && <p className="muted">{t("common.loading")}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && (
        <Table
          columns={columns}
          rows={rows}
          onEdit={openEdit}
          onDelete={remove}
          getRowLabel={(r) => r.provider_name || r.kind}
          emptyLabel={t("communications.empty")}
        />
      )}

      {editing !== undefined && (
        <FormModal
          title={editing ? t("common.edit") : t("communications.templates.new")}
          onClose={() => setEditing(undefined)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <div className="form-columns">
            <Field label={t("communications.templates.channel")}>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as CommunicationsChannel })}
              >
                <option value="EMAIL">EMAIL</option>
                <option value="WHATSAPP">WHATSAPP</option>
              </select>
            </Field>
            <Field label={t("communications.templates.kind")}>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CommunicationsKind })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(t, k)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {form.channel === "WHATSAPP" ? (
            <>
              <Field label={t("communications.templates.providerName")}>
                <input
                  value={form.provider_name}
                  onChange={(e) => setForm({ ...form, provider_name: e.target.value })}
                />
              </Field>
              <Field label={t("communications.templates.language")}>
                <input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
              </Field>
              <Field label="Variables">
                <input
                  value={variablesText}
                  placeholder="nombre, clinica, fecha, hora, telefono"
                  onChange={(e) => setVariablesText(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <Field label={t("communications.compose.body")}>
              <textarea rows={6} value={form.body_email} onChange={(e) => setForm({ ...form, body_email: e.target.value })} />
            </Field>
          )}
          <Field label={t("communications.templates.active")}>
            <label className="touch-label">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />{" "}
              {t("communications.templates.active")}
            </label>
          </Field>
        </FormModal>
      )}
    </Page>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, RowActionsMenu, Table, Tabs, type Column, type RowActionsMenuItem } from "../components/ui";
import { ApiError, api } from "../services/api";
import {
  createDefinition,
  createPack,
  generatePack,
  generateReport,
  listDefinitions,
  listPacks,
  saveBlob,
  updateDefinition,
  updatePack,
} from "../services/reportes";
import type { ARS, MedicalCenter, Paginated, ReportDefinition, ReportEngineKey, ReportPack, ReportPackEngineKey } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";

function previousMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DEFINITION_ENGINES: { value: ReportEngineKey; label: string }[] = [
  { value: "servicios_prestados", label: "Servicios prestados" },
];
const PACK_ENGINES: { value: ReportPackEngineKey; label: string }[] = [
  { value: "paquete_ars", label: "Paquete ARS" },
];

export function Reportes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = can(user?.role, "edit", "reportes");
  const [tab, setTab] = useState<"individuales" | "paquetes">("individuales");
  const [newDefinition, setNewDefinition] = useState(false);
  const [newPack, setNewPack] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  return (
    <Page
      card
      title={t("reportes.title")}
      actions={
        canEdit && (
          <div className="page-actions-row">
            <button className="btn ghost" onClick={() => setNewDefinition(true)}>
              + {t("reportes.newDefinition")}
            </button>
            <button className="btn primary" onClick={() => setNewPack(true)}>
              + {t("reportes.newPack")}
            </button>
          </div>
        )
      }
    >
      <Tabs
        idPrefix="reportes"
        active={tab}
        onChange={(k) => setTab(k as "individuales" | "paquetes")}
        items={[
          { key: "individuales", label: t("reportes.tabs.individuales") },
          { key: "paquetes", label: t("reportes.tabs.paquetes") },
        ]}
      />
      {tab === "individuales" ? (
        <DefinitionsTab key={reloadKey} canEdit={canEdit} />
      ) : (
        <PacksTab key={reloadKey} canEdit={canEdit} />
      )}

      {newDefinition && (
        <DefinitionFormModal
          onClose={() => setNewDefinition(false)}
          onSaved={() => {
            setNewDefinition(false);
            reload();
          }}
        />
      )}
      {newPack && (
        <PackFormModal
          onClose={() => setNewPack(false)}
          onSaved={() => {
            setNewPack(false);
            reload();
          }}
        />
      )}
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Individuales
// ---------------------------------------------------------------------------

function DefinitionsTab({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState<ReportDefinition | null>(null);
  const [editing, setEditing] = useState<ReportDefinition | null>(null);

  function load() {
    setLoading(true);
    listDefinitions()
      .then((r) => setRows(r.results))
      .catch((err) => setError(err instanceof ApiError ? flattenError(err.message) : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(row: ReportDefinition) {
    await updateDefinition(row.id, { active: !row.active });
    load();
  }

  const columns: Column<ReportDefinition>[] = [
    { key: "name", header: t("reportes.name") },
    { key: "category", header: t("reportes.category") },
    { key: "description", header: t("reportes.description") },
    {
      key: "active",
      header: t("reportes.active"),
      align: "center",
      render: (r) => <span className={`badge status-${r.active ? "active" : "inactive"}`}>{r.active ? t("common.yes") : t("common.no")}</span>,
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "center",
      render: (row) => {
        const items: RowActionsMenuItem[] = canEdit
          ? [
              { key: "edit", label: t("common.edit"), onClick: () => setEditing(row) },
              {
                key: "toggle",
                label: row.active ? t("reportes.deactivate") : t("reportes.activate"),
                danger: row.active,
                onClick: () => toggleActive(row),
              },
            ]
          : [];
        return (
          <RowActionsMenu
            ariaLabel={row.name}
            primary={
              <button className="btn small" onClick={() => setGenerating(row)} disabled={!row.active}>
                {t("reportes.generate")}
              </button>
            }
            items={items}
          />
        );
      },
    },
  ];

  return (
    <>
      {loading && <p className="muted">{t("common.loading")}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && <Table columns={columns} rows={rows} emptyLabel={t("reportes.empty")} getRowLabel={(r) => r.name} />}
      {generating && <GenerateReportModal definition={generating} onClose={() => setGenerating(null)} />}
      {editing && (
        <DefinitionFormModal
          definition={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function GenerateReportModal({ definition, onClose }: { definition: ReportDefinition; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCenterManager = user?.role === "CENTER_MANAGER";
  const [mes, setMes] = useState(previousMonth());
  const [arsList, setArsList] = useState<ARS[]>([]);
  const [ars, setArs] = useState("");
  const [programa, setPrograma] = useState("");
  const [centers, setCenters] = useState<MedicalCenter[]>([]);
  const [centro, setCentro] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Paginated<ARS>>("/ars/?page_size=100").then((r) => setArsList(r.results)).catch(() => {});
    if (!isCenterManager) {
      api
        .get<Paginated<MedicalCenter>>("/centers/?page_size=100")
        .then((r) => {
          setCenters(r.results);
          const defaultCenter = r.results.find((c) => c.is_default);
          if (defaultCenter) setCentro((prev) => prev || String(defaultCenter.id));
        })
        .catch(() => {});
    }
  }, [isCenterManager]);

  const selectedArs = arsList.find((a) => String(a.id) === ars);

  async function submit() {
    setError("");
    try {
      const { blob, filename } = await generateReport(definition.id, {
        mes,
        ars: ars ? Number(ars) : null,
        programa: programa ? Number(programa) : null,
        centro: isCenterManager ? null : centro ? Number(centro) : null,
      });
      saveBlob(blob, filename ?? `reporte-${mes}.xlsx`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <FormModal title={t("reportes.generate")} onClose={onClose} onSubmit={submit} submitLabel={t("reportes.download")} error={error}>
      <Field label={t("reportes.month")}>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
      </Field>
      <Field label={t("reportes.ars")}>
        <select value={ars} onChange={(e) => { setArs(e.target.value); setPrograma(""); }}>
          <option value="">{t("reportes.allArs")}</option>
          {arsList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("reportes.programa")}>
        <select value={programa} onChange={(e) => setPrograma(e.target.value)} disabled={!ars}>
          <option value="">{t("reportes.allProgramas")}</option>
          {(selectedArs?.programs ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("reportes.centro")}>
        {isCenterManager ? (
          <input value={user?.center_name ?? ""} disabled readOnly />
        ) : (
          <select value={centro} onChange={(e) => setCentro(e.target.value)}>
            <option value="">{t("reportes.allCenters")}</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>
    </FormModal>
  );
}

function DefinitionFormModal({
  definition,
  onClose,
  onSaved,
}: {
  definition?: ReportDefinition;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(definition?.name ?? "");
  const [category, setCategory] = useState(definition?.category ?? "");
  const [description, setDescription] = useState(definition?.description ?? "");
  const [engineKey, setEngineKey] = useState<ReportEngineKey>(definition?.engine_key ?? "servicios_prestados");
  const [active, setActive] = useState(definition?.active ?? true);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      const body = { name, category, description, engine_key: engineKey, active };
      if (definition) await updateDefinition(definition.id, body);
      else await createDefinition(body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <FormModal
      title={definition ? t("common.edit") : t("reportes.newDefinition")}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t("common.save")}
      error={error}
    >
      <Field label={t("reportes.name")}>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label={t("reportes.category")}>
        <input value={category} onChange={(e) => setCategory(e.target.value)} required />
      </Field>
      <Field label={t("reportes.description")}>
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label={t("reportes.engine")}>
        <select value={engineKey} onChange={(e) => setEngineKey(e.target.value as ReportEngineKey)}>
          {DEFINITION_ENGINES.map((eng) => (
            <option key={eng.value} value={eng.value}>
              {eng.label}
            </option>
          ))}
        </select>
      </Field>
      <label className="show-inactive-toggle">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {t("reportes.active")}
      </label>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Paquetes
// ---------------------------------------------------------------------------

function PacksTab({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ReportPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState<ReportPack | null>(null);
  const [editing, setEditing] = useState<ReportPack | null>(null);

  function load() {
    setLoading(true);
    listPacks()
      .then((r) => setRows(r.results))
      .catch((err) => setError(err instanceof ApiError ? flattenError(err.message) : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(row: ReportPack) {
    await updatePack(row.id, { active: !row.active });
    load();
  }

  const columns: Column<ReportPack>[] = [
    { key: "name", header: t("reportes.name") },
    { key: "periodicity", header: t("reportes.periodicity") },
    {
      key: "active",
      header: t("reportes.active"),
      align: "center",
      render: (r) => <span className={`badge status-${r.active ? "active" : "inactive"}`}>{r.active ? t("common.yes") : t("common.no")}</span>,
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "center",
      render: (row) => {
        const items: RowActionsMenuItem[] = canEdit
          ? [
              { key: "edit", label: t("common.edit"), onClick: () => setEditing(row) },
              {
                key: "toggle",
                label: row.active ? t("reportes.deactivate") : t("reportes.activate"),
                danger: row.active,
                onClick: () => toggleActive(row),
              },
            ]
          : [];
        return (
          <RowActionsMenu
            ariaLabel={row.name}
            primary={
              <button className="btn small primary" onClick={() => setGenerating(row)} disabled={!row.active}>
                {t("reportes.generatePack")}
              </button>
            }
            items={items}
          />
        );
      },
    },
  ];

  return (
    <>
      {loading && <p className="muted">{t("common.loading")}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && <Table columns={columns} rows={rows} emptyLabel={t("reportes.empty")} getRowLabel={(r) => r.name} />}
      {generating && <GeneratePackModal pack={generating} onClose={() => setGenerating(null)} />}
      {editing && (
        <PackFormModal
          pack={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function GeneratePackModal({ pack, onClose }: { pack: ReportPack; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCenterManager = user?.role === "CENTER_MANAGER";
  const [mes, setMes] = useState(previousMonth());
  const [centers, setCenters] = useState<MedicalCenter[]>([]);
  const [centro, setCentro] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isCenterManager) {
      api
        .get<Paginated<MedicalCenter>>("/centers/?page_size=100")
        .then((r) => {
          setCenters(r.results);
          const defaultCenter = r.results.find((c) => c.is_default);
          if (defaultCenter) setCentro((prev) => prev || String(defaultCenter.id));
        })
        .catch(() => {});
    }
  }, [isCenterManager]);

  async function submit() {
    setError("");
    try {
      const { blob, filename } = await generatePack(pack.id, {
        mes,
        centro: isCenterManager ? null : centro ? Number(centro) : null,
      });
      saveBlob(blob, filename ?? `paquete-${mes}.zip`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <FormModal title={t("reportes.generatePack")} onClose={onClose} onSubmit={submit} submitLabel={t("reportes.download")} error={error}>
      <Field label={t("reportes.month")}>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
      </Field>
      <Field label={t("reportes.centro")}>
        {isCenterManager ? (
          <input value={user?.center_name ?? ""} disabled readOnly />
        ) : (
          <select value={centro} onChange={(e) => setCentro(e.target.value)}>
            <option value="">{t("reportes.allCenters")}</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>
    </FormModal>
  );
}

function PackFormModal({
  pack,
  onClose,
  onSaved,
}: {
  pack?: ReportPack;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(pack?.name ?? "");
  const [periodicity, setPeriodicity] = useState(pack?.periodicity ?? "MENSUAL");
  const [engineKey, setEngineKey] = useState<ReportPackEngineKey>(pack?.engine_key ?? "paquete_ars");
  const [active, setActive] = useState(pack?.active ?? true);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      const body = { name, periodicity, engine_key: engineKey, active };
      if (pack) await updatePack(pack.id, body);
      else await createPack(body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <FormModal
      title={pack ? t("common.edit") : t("reportes.newPack")}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t("common.save")}
      error={error}
    >
      <Field label={t("reportes.name")}>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label={t("reportes.periodicity")}>
        <input value={periodicity} onChange={(e) => setPeriodicity(e.target.value)} required />
      </Field>
      <Field label={t("reportes.engine")}>
        <select value={engineKey} onChange={(e) => setEngineKey(e.target.value as ReportPackEngineKey)}>
          {PACK_ENGINES.map((eng) => (
            <option key={eng.value} value={eng.value}>
              {eng.label}
            </option>
          ))}
        </select>
      </Field>
      <label className="show-inactive-toggle">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {t("reportes.active")}
      </label>
    </FormModal>
  );
}

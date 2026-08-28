import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Page, Pagination, SearchBar, Spinner, Table, Tabs, type Column } from "../../components/ui";
import { listDeliveries, listMessages } from "../../services/communications";
import { ApiError } from "../../services/api";
import type { CommunicationsDelivery, CommunicationsKind, CommunicationsMessage } from "../../services/types";
import { useAuth } from "../../store/auth";
import { can } from "../../utils/can";
import { formatDateTime } from "../../utils/date";
import { flattenError } from "../../utils/errors";
import { kindLabel, StatusBadge, UnderConstructionBanner } from "./shared";
import { MessageDetailDialog } from "./MessageDetailDialog";

const STAFF_KINDS: CommunicationsKind[] = ["AVISO", "INFORMACION", "ALERTA"];
const PATIENT_KINDS: CommunicationsKind[] = [
  "CITA_CREADA",
  "CITA_RECORDATORIO",
  "CITA_REAGENDADA",
  "CITA_CANCELADA",
];

export function Communications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"staff" | "patients">("staff");
  const canCompose = can(user?.role, "sendStaffEmail", "communications");

  return (
    <Page
      title={t("communications.title")}
      actions={
        canCompose && (
          <button className="btn primary" onClick={() => navigate("/comunicaciones/nuevo")}>
            {t("communications.new")}
          </button>
        )
      }
    >
      <UnderConstructionBanner t={t} />
      <Tabs
        idPrefix="communications"
        active={tab}
        onChange={(k) => setTab(k as "staff" | "patients")}
        items={[
          { key: "staff", label: t("communications.tabs.staff") },
          { key: "patients", label: t("communications.tabs.patients") },
        ]}
      />
      {tab === "staff" ? <StaffTab /> : <PatientTab />}
    </Page>
  );
}

function StaffTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CommunicationsMessage[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    if (search.trim()) params.set("search", search.trim());
    if (kind) params.set("kind", kind);
    if (status) params.set("status", status);
    listMessages(params.toString())
      .then((r) => {
        setRows(r.results);
        setCount(r.count);
        setError("");
      })
      .catch((err) => setError(err instanceof ApiError ? flattenError(err.message) : String(err)))
      .finally(() => setLoading(false));
  }, [page, pageSize, search, kind, status]);

  const columns: Column<CommunicationsMessage>[] = [
    { key: "created_at", header: t("communications.columns.date"), render: (r) => formatDateTime(r.created_at) },
    { key: "kind", header: t("communications.columns.type"), render: (r) => kindLabel(t, r.kind) },
    { key: "subject", header: t("communications.columns.subject") },
    {
      key: "created_by_name",
      header: t("communications.columns.author"),
      render: (r) => r.created_by_name || t("communications.system"),
    },
    { key: "recipient_count", header: t("communications.columns.recipients"), align: "center" },
    { key: "status", header: t("communications.columns.status"), render: (r) => <StatusBadge status={r.status} t={t} /> },
  ];

  return (
    <>
      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} onSubmit={() => setPage(1)} label={t("common.search")} />
        <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
          <option value="">{t("communications.filters.all")}</option>
          {STAFF_KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(t, k)}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t("communications.filters.all")}</option>
          {["DRAFT", "QUEUED", "SENDING", "SENT", "PARTIAL", "FAILED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {t(`communications.status.${s}`)}
            </option>
          ))}
        </select>
      </div>
      {loading && <Spinner />}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && (
        <>
          <Table
            columns={columns}
            rows={rows}
            emptyLabel={t("communications.empty")}
            extraActions={(row) => (
              <button className="btn small" onClick={() => setDetailId(row.id)}>
                {t("communications.view")}
              </button>
            )}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
      {detailId != null && <MessageDetailDialog messageId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function PatientTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CommunicationsDelivery[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [count, setCount] = useState(0);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    params.set("message__audience", "PATIENT");
    if (kind) params.set("message__kind", kind);
    if (status) params.set("status", status);
    listDeliveries(params.toString())
      .then((r) => {
        setRows(r.results);
        setCount(r.count);
        setError("");
      })
      .catch((err) => setError(err instanceof ApiError ? flattenError(err.message) : String(err)))
      .finally(() => setLoading(false));
  }, [page, pageSize, kind, status]);

  const columns: Column<CommunicationsDelivery>[] = [
    { key: "created_at", header: t("communications.columns.sentDate"), render: (r) => formatDateTime(r.created_at) },
    { key: "patient_name", header: t("communications.columns.patient"), render: (r) => r.patient_name ?? "" },
    {
      key: "appointment_date",
      header: t("communications.columns.appointment"),
      render: (r) => (r.appointment_date ? formatDateTime(r.appointment_date) : ""),
    },
    { key: "address_masked", header: t("communications.columns.phone") },
    { key: "status", header: t("communications.columns.status"), render: (r) => <StatusBadge status={r.status} t={t} /> },
    { key: "error", header: t("communications.columns.error") },
  ];

  return (
    <>
      <div className="toolbar">
        <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
          <option value="">{t("communications.filters.all")}</option>
          {PATIENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(t, k)}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t("communications.filters.all")}</option>
          {["QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "UNDELIVERABLE", "OPTED_OUT"].map((s) => (
            <option key={s} value={s}>
              {t(`communications.status.${s}`)}
            </option>
          ))}
        </select>
      </div>
      {loading && <Spinner />}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && (
        <>
          <Table
            columns={columns}
            rows={rows}
            emptyLabel={t("communications.empty")}
            extraActions={(row) =>
              row.appointment ? (
                <button className="btn small" onClick={() => navigate("/appointments")}>
                  {t("communications.view")}
                </button>
              ) : null
            }
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
    </>
  );
}

// Re-exported so App.tsx's route for /comunicaciones/registros (if ever
// split out on its own) can reuse the same table without duplicating it --
// currently only mounted inline as the "Pacientes (WhatsApp)" tab above.
export { PatientTab as CommunicationsPatientLog };

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Dialog, Spinner, Table, type Column } from "../../components/ui";
import { getMessage, listDeliveries } from "../../services/communications";
import type { CommunicationsDelivery, CommunicationsMessage } from "../../services/types";
import { formatDateTime } from "../../utils/date";
import { apiErrorMessage } from "../../utils/errors";
import { kindLabel, StatusBadge } from "./shared";

export function MessageDetailDialog({ messageId, onClose }: { messageId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState<CommunicationsMessage | null>(null);
  const [deliveries, setDeliveries] = useState<CommunicationsDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMessage(messageId),
      listDeliveries(new URLSearchParams({ message: String(messageId), page_size: "200" }).toString()),
    ])
      .then(([msg, deliveryPage]) => {
        setMessage(msg);
        setDeliveries(deliveryPage.results);
        setError("");
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [messageId]);

  const columns: Column<CommunicationsDelivery>[] = [
    {
      key: "recipient",
      header: t("communications.columns.recipients"),
      render: (r) => r.user_name ?? r.patient_name ?? r.address_masked,
    },
    { key: "status", header: t("communications.columns.status"), render: (r) => <StatusBadge status={r.status} t={t} /> },
    { key: "error", header: t("communications.columns.error") },
  ];

  return (
    <Dialog title={t("communications.detail.title")} onClose={onClose} wide>
      {loading && <Spinner />}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && (
        <>
          <p>
            <strong>{message.subject}</strong>
          </p>
          <p className="muted">
            {kindLabel(t, message.kind)} · {formatDateTime(message.created_at)} ·{" "}
            {message.created_by_name || t("communications.system")}
          </p>
          <p className="record-body-preview" style={{ whiteSpace: "pre-wrap" }}>
            {message.body}
          </p>
          <h4>{t("communications.detail.recipientsTable")}</h4>
          <Table columns={columns} rows={deliveries} emptyLabel={t("communications.empty")} />
        </>
      )}
    </Dialog>
  );
}

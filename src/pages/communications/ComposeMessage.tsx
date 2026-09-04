import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ConfirmDialog, Field, Page } from "../../components/ui";
import { api, ApiError } from "../../services/api";
import { createMessage, sendTestEmail } from "../../services/communications";
import type { CommunicationsKind, CommunicationsPriority, Paginated, Role, User } from "../../services/types";
import { useAuth } from "../../store/auth";
import { can } from "../../utils/can";
import { flattenError } from "../../utils/errors";
import { UnderConstructionBanner } from "./shared";

const ROLES: Role[] = ["ADMIN", "DOCTOR", "RECEPTIONIST", "IT", "NURSE", "CENTER_MANAGER"];
const MAX_SUBJECT = 120;

type RecipientMode = "all" | "roles" | "people";

export function ComposeMessage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canAlerta = can(user?.role, "sendAlerta", "communications");

  const [kind, setKind] = useState<CommunicationsKind>("AVISO");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<RecipientMode>("all");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [roster, setRoster] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [testStatus, setTestStatus] = useState("");

  useEffect(() => {
    // Best-effort: only ADMIN/IT/CENTER_MANAGER can list /users/. A Doctor
    // composing a notice still gets full role-checkbox recipients, just
    // without the live "{n} personas" count / individual-person picker.
    api
      .get<Paginated<User>>("/users/?page_size=500")
      .then((r) => setRoster(r.results))
      .catch(() => setRoster([]));
  }, []);

  const activeRoster = roster.filter((u) => u.is_active && u.email);
  const estimatedCount =
    roster.length === 0
      ? null
      : mode === "all"
        ? activeRoster.length
        : mode === "roles"
          ? activeRoster.filter((u) => selectedRoles.includes(u.role)).length
          : selectedUserIds.length;

  const priority: CommunicationsPriority = kind === "ALERTA" ? "ALERTA" : "NORMAL";
  const hasRecipients =
    mode === "all" || (mode === "roles" && selectedRoles.length > 0) || (mode === "people" && selectedUserIds.length > 0);

  function buildSubject(): string {
    if (kind === "ALERTA" && !subject.startsWith("[ALERTA]")) return `[ALERTA] ${subject}`;
    return subject;
  }

  async function save(status: "DRAFT" | "QUEUED") {
    if (!subject.trim()) {
      setError(t("communications.compose.subject"));
      return;
    }
    if (!hasRecipients) {
      setError(t("communications.compose.recipientsRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createMessage({
        channel: "EMAIL",
        audience: "STAFF",
        kind,
        priority,
        subject: buildSubject(),
        body,
        scheduled_for: scheduleLater && scheduledFor ? new Date(scheduledFor).toISOString() : null,
        status,
        recipients: {
          all_staff: mode === "all",
          roles: mode === "roles" ? selectedRoles : [],
          user_ids: mode === "people" ? selectedUserIds : [],
        },
      });
      setDraftId(created.id);
      if (status === "QUEUED") navigate("/comunicaciones");
    } catch (err) {
      setError(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  async function sendTest() {
    if (!draftId) return;
    setTestStatus("");
    try {
      await sendTestEmail(draftId);
      setTestStatus(t("communications.compose.testSent"));
    } catch (err) {
      setTestStatus(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  return (
    <Page title={t("communications.new")}>
      <UnderConstructionBanner t={t} />
      <form
        className="mc-form"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="form-columns">
          <Field label={t("communications.compose.type")}>
            <select value={kind} onChange={(e) => setKind(e.target.value as CommunicationsKind)}>
              <option value="AVISO">{t("communications.kind.AVISO")}</option>
              <option value="INFORMACION">{t("communications.kind.INFORMACION")}</option>
              {canAlerta && <option value="ALERTA">{t("communications.kind.ALERTA")}</option>}
            </select>
          </Field>
        </div>

        <Field label={t("communications.compose.subject")}>
          <input
            value={subject}
            maxLength={MAX_SUBJECT}
            onChange={(e) => setSubject(e.target.value)}
            className={kind === "ALERTA" ? "input-danger" : undefined}
          />
          <p className="settings-field-help">{t("communications.compose.subjectHelp")}</p>
        </Field>

        <Field label={t("communications.compose.body")}>
          <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>

        <Field label={t("communications.compose.recipients")}>
          <label>
            <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />{" "}
            {t("communications.compose.allStaff")}
          </label>
          <label>
            <input type="radio" checked={mode === "roles"} onChange={() => setMode("roles")} />{" "}
            {t("communications.compose.byRole")}
          </label>
          {mode === "roles" && (
            <div className="checkbox-list">
              {ROLES.map((r) => (
                <label key={r}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r)}
                    onChange={(e) =>
                      setSelectedRoles((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)))
                    }
                  />{" "}
                  {r}
                </label>
              ))}
            </div>
          )}
          {roster.length > 0 && (
            <>
              <label>
                <input type="radio" checked={mode === "people"} onChange={() => setMode("people")} />{" "}
                {t("communications.compose.byPerson")}
              </label>
              {mode === "people" && (
                <div className="checkbox-list">
                  {activeRoster.map((u) => (
                    <label key={u.id}>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={(e) =>
                          setSelectedUserIds((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                          )
                        }
                      />{" "}
                      {u.full_name || u.username} ({u.role})
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
          {estimatedCount != null && (
            <p className="settings-field-help">{t("communications.compose.willSendTo", { n: estimatedCount })}</p>
          )}
        </Field>

        <Field label={t("communications.compose.schedule")}>
          <label>
            <input type="radio" checked={!scheduleLater} onChange={() => setScheduleLater(false)} />{" "}
            {t("communications.compose.now")}
          </label>
          <label>
            <input type="radio" checked={scheduleLater} onChange={() => setScheduleLater(true)} />{" "}
            {t("communications.compose.later")}
          </label>
          {scheduleLater && (
            <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
          )}
        </Field>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={() => navigate("/comunicaciones")} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn ghost"
            title={draftId ? undefined : t("communications.compose.testSendDisabled")}
            disabled={!draftId || saving}
            onClick={sendTest}
          >
            {t("communications.compose.testSend")}
          </button>
          <button type="button" className="btn ghost" disabled={saving} onClick={() => save("DRAFT")}>
            {t("communications.compose.saveDraft")}
          </button>
          <button
            type="button"
            className={kind === "ALERTA" ? "btn danger" : "btn primary"}
            disabled={saving}
            onClick={() => {
              if (!subject.trim() || !hasRecipients) {
                save("QUEUED");
                return;
              }
              setConfirming(true);
            }}
          >
            {t("communications.compose.send")}
          </button>
        </div>
        {testStatus && <p className="muted">{testStatus}</p>}
      </form>

      {confirming && (
        <ConfirmDialog
          title={t("communications.compose.send")}
          message={t("communications.compose.confirmSend", { n: estimatedCount ?? "" })}
          confirmLabel={t("communications.compose.send")}
          pending={saving}
          onConfirm={() => save("QUEUED")}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Page>
  );
}

import { useEffect, useState } from "react";
import { RotateCcw, ShieldAlert, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog, Page } from "../components/ui";
import { ApiError } from "../services/api";
import { getSettings, resetSettings, updateSettings } from "../services/settings";
import type { SystemSettings } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";
import { formatDateTime } from "../utils/date";

type SettingsSection = "loginSecurity" | "sessions" | "rateLimits" | "dataMedia";
type NumericKey = Exclude<keyof SystemSettings, "updated_by" | "updated_at">;

interface FieldDef {
  key: NumericKey;
  section: SettingsSection;
  min: number;
  max: number;
  /** Extra security-tradeoff callout shown under the range helper text --
   * only the two fields the plan singles out (SETTINGS_PAGE_PLAN.md
   * section 6) carry one. */
  warning?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "login_lockout_threshold", section: "loginSecurity", min: 1, max: 50 },
  { key: "login_lockout_minutes", section: "loginSecurity", min: 5, max: 1440 },
  { key: "password_min_length", section: "loginSecurity", min: 8, max: 64 },
  { key: "access_token_lifetime_minutes", section: "sessions", min: 5, max: 60, warning: true },
  { key: "refresh_token_lifetime_days", section: "sessions", min: 1, max: 30 },
  { key: "login_rate_limit_per_min", section: "rateLimits", min: 3, max: 120 },
  { key: "anon_rate_limit_per_min", section: "rateLimits", min: 10, max: 1000 },
  { key: "user_rate_limit_per_min", section: "rateLimits", min: 30, max: 5000 },
  { key: "max_image_upload_mb", section: "dataMedia", min: 1, max: 100 },
  { key: "media_token_ttl_minutes", section: "dataMedia", min: 5, max: 1440, warning: true },
  { key: "default_page_size", section: "dataMedia", min: 5, max: 100 },
];

const SECTIONS: SettingsSection[] = ["loginSecurity", "sessions", "rateLimits", "dataMedia"];

export function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = can(user?.role, "edit", "settings");

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [form, setForm] = useState<Record<NumericKey, string>>({} as Record<NumericKey, string>);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NumericKey, string>>>({});
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetPending, setResetPending] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    setLoadError("");
    getSettings()
      .then((data) => {
        setSettings(data);
        setForm(toFormState(data));
      })
      .catch((err) => setLoadError(err instanceof ApiError ? flattenError(err.message) : String(err)))
      .finally(() => setLoading(false));
  }

  function toFormState(data: SystemSettings): Record<NumericKey, string> {
    const next = {} as Record<NumericKey, string>;
    for (const f of FIELDS) next[f.key] = String(data[f.key]);
    return next;
  }

  const dirty = settings !== null && FIELDS.some((f) => form[f.key] !== String(settings[f.key]));

  function setField(key: NumericKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSave() {
    if (!settings || saving) return;
    setSaveError("");
    setFieldErrors({});

    const invalid: Partial<Record<NumericKey, string>> = {};
    const patch: Partial<Record<NumericKey, number>> = {};
    for (const f of FIELDS) {
      const raw = form[f.key];
      const n = Number(raw);
      if (raw.trim() === "" || !Number.isInteger(n) || n < f.min || n > f.max) {
        invalid[f.key] = t("settings.rangeError", { min: f.min, max: f.max });
        continue;
      }
      if (n !== settings[f.key]) patch[f.key] = n;
    }
    if (Object.keys(invalid).length > 0) {
      setFieldErrors(invalid);
      return;
    }
    if (Object.keys(patch).length === 0) return;

    setSaving(true);
    try {
      const updated = await updateSettings(patch);
      setSettings(updated);
      setForm(toFormState(updated));
    } catch (err) {
      setSaveError(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    if (settings) setForm(toFormState(settings));
    setFieldErrors({});
    setSaveError("");
  }

  async function confirmReset() {
    setResetPending(true);
    setResetError("");
    try {
      const updated = await resetSettings();
      setSettings(updated);
      setForm(toFormState(updated));
      setConfirmingReset(false);
    } catch (err) {
      setResetError(err instanceof ApiError ? flattenError(err.message) : String(err));
    } finally {
      setResetPending(false);
    }
  }

  return (
    <Page
      title={
        <span className="settings-title">
          {t("settings.title")}
          {!canEdit && <span className="badge settings-readonly-badge">{t("settings.readOnly")}</span>}
        </span>
      }
      actions={
        canEdit && (
          <button
            className="btn ghost"
            onClick={() => setConfirmingReset(true)}
            disabled={loading || !settings}
          >
            <RotateCcw size={14} aria-hidden="true" /> {t("settings.resetToDefaults")}
          </button>
        )
      }
    >
      {!canEdit && (
        <p className="settings-readonly-notice">
          <ShieldAlert size={14} aria-hidden="true" /> {t("settings.readOnlyNotice")}
        </p>
      )}

      {loading && <p className="muted">{t("common.loading")}</p>}
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {settings && (
        <>
          {SECTIONS.map((section) => (
            <div className="settings-section" key={section}>
              <h3 className="settings-section-title">{t(`settings.sections.${section}`)}</h3>
              <div className="settings-field-grid">
                {FIELDS.filter((f) => f.section === section).map((f) => {
                  const changed = settings ? form[f.key] !== String(settings[f.key]) : false;
                  return (
                    <div className={`settings-field${changed ? " is-changed" : ""}`} key={f.key}>
                      <label className="settings-field-label" htmlFor={`settings-${f.key}`}>
                        {t(`settings.fields.${f.key}.label`)}
                        {changed && (
                          <span className="settings-field-changed-dot" title={t("settings.unsavedChange")} />
                        )}
                      </label>
                      <input
                        id={`settings-${f.key}`}
                        type="number"
                        min={f.min}
                        max={f.max}
                        step={1}
                        value={form[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        disabled={!canEdit || saving}
                        aria-describedby={`settings-${f.key}-help`}
                        aria-invalid={Boolean(fieldErrors[f.key])}
                      />
                      <p id={`settings-${f.key}-help`} className="settings-field-help">
                        {t(`settings.fields.${f.key}.help`)}{" "}
                        <span className="settings-field-range">
                          {t("settings.rangeHelp", { min: f.min, max: f.max })}
                        </span>
                      </p>
                      {f.warning && (
                        <p className="settings-field-warning">
                          <TriangleAlert size={13} aria-hidden="true" />
                          <span>{t(`settings.fields.${f.key}.warning`)}</span>
                        </p>
                      )}
                      {fieldErrors[f.key] && (
                        <p className="settings-field-error" role="alert">
                          {fieldErrors[f.key]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="settings-footer">
            <span className="muted settings-updated-at">
              {t("settings.lastUpdated", { date: formatDateTime(settings.updated_at) })}
            </span>
            {canEdit && (
              <div className="settings-footer-actions">
                {saveError && (
                  <p className="form-error" role="alert">
                    {saveError}
                  </p>
                )}
                <button className="btn ghost" onClick={discardChanges} disabled={!dirty || saving}>
                  {t("common.cancel")}
                </button>
                <button className="btn primary" onClick={handleSave} disabled={!dirty || saving}>
                  {saving ? t("common.saving") : t("common.save")}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {confirmingReset && (
        <ConfirmDialog
          title={t("settings.resetToDefaults")}
          message={t("settings.resetConfirmMessage")}
          confirmLabel={t("settings.resetToDefaults")}
          danger
          error={resetError}
          pending={resetPending}
          onConfirm={confirmReset}
          onCancel={() => {
            setConfirmingReset(false);
            setResetError("");
          }}
        />
      )}
    </Page>
  );
}

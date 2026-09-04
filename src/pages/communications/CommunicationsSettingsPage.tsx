import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, Page } from "../../components/ui";
import {
  getCommunicationsSettings,
  sendTestEmailGlobal,
  sendTestWhatsapp,
  updateCommunicationsSettings,
} from "../../services/communications";
import type { CommunicationsSettings } from "../../services/types";
import { apiErrorMessage } from "../../utils/errors";
import { UnderConstructionBanner } from "./shared";

export function CommunicationsSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<CommunicationsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [reminderHours, setReminderHours] = useState(24);
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [changingToken, setChangingToken] = useState(false);
  const [changingSecret, setChangingSecret] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [testPhone, setTestPhone] = useState("");

  function load() {
    setLoading(true);
    getCommunicationsSettings()
      .then((data) => {
        setSettings(data);
        setFromName(data.from_name);
        setReplyTo(data.reply_to);
        setPhoneNumberId(data.whatsapp_phone_number_id);
        setBusinessAccountId(data.whatsapp_business_account_id);
        setCountryCode(data.whatsapp_default_country_code);
        setReminderHours(data.whatsapp_reminder_hours);
        setMasterEnabled(data.whatsapp_master_enabled);
        setLoadError("");
      })
      .catch((err) => setLoadError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save() {
    setSaving(true);
    setSaveError("");
    const patch: Partial<CommunicationsSettings> = {
      from_name: fromName,
      reply_to: replyTo,
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_business_account_id: businessAccountId,
      whatsapp_default_country_code: countryCode,
      whatsapp_reminder_hours: reminderHours,
      whatsapp_master_enabled: masterEnabled,
    };
    if (changingToken && accessToken) patch.whatsapp_access_token = accessToken;
    if (changingSecret && appSecret) patch.whatsapp_app_secret = appSecret;
    try {
      const updated = await updateCommunicationsSettings(patch);
      setSettings(updated);
      setChangingToken(false);
      setChangingSecret(false);
      setAccessToken("");
      setAppSecret("");
    } catch (err) {
      setSaveError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function testEmail() {
    setStatus("");
    try {
      await sendTestEmailGlobal();
      setStatus(t("communications.settingsPage.testEmailSent"));
    } catch (err) {
      setStatus(apiErrorMessage(err));
    }
  }

  async function testWhatsapp() {
    setStatus("");
    try {
      await sendTestWhatsapp(testPhone);
      setStatus(t("communications.settingsPage.testWhatsappSent"));
    } catch (err) {
      setStatus(apiErrorMessage(err));
    }
  }

  function copyWebhook() {
    if (!settings) return;
    navigator.clipboard?.writeText(settings.webhook_url).catch(() => {});
  }

  return (
    <Page title={t("communications.settingsPage.title")}>
      <UnderConstructionBanner t={t} />
      {loading && <p className="muted">{t("common.loading")}</p>}
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}
      {settings && (
        <div className="mc-form">
          <div className="settings-section">
            <h3 className="settings-section-title">{t("communications.settingsPage.sections.email")}</h3>
            <p className="muted">{t("communications.settingsPage.emailBackendNotice")}</p>
            <div className="settings-field-grid">
              <Field label={t("communications.settingsPage.fromName")}>
                <input value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </Field>
              <Field label={t("communications.settingsPage.replyTo")}>
                <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
              </Field>
            </div>
            <button className="btn ghost" onClick={testEmail}>
              {t("communications.settingsPage.testEmail")}
            </button>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">{t("communications.settingsPage.sections.whatsapp")}</h3>
            <p className="muted">{t("communications.settingsPage.providerValue")}</p>
            <div className="settings-field-grid">
              <Field label={t("communications.settingsPage.phoneNumberId")}>
                <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
              </Field>
              <Field label={t("communications.settingsPage.businessAccountId")}>
                <input value={businessAccountId} onChange={(e) => setBusinessAccountId(e.target.value)} />
              </Field>
              <Field label={t("communications.settingsPage.accessToken")}>
                {changingToken ? (
                  <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} autoFocus />
                ) : (
                  <div className="row-actions">
                    <span className="muted">
                      {settings.whatsapp_access_token_last4 ? `•••• ${settings.whatsapp_access_token_last4}` : "—"}
                    </span>
                    <button type="button" className="btn small ghost" onClick={() => setChangingToken(true)}>
                      {t("communications.settingsPage.changeToken")}
                    </button>
                  </div>
                )}
              </Field>
              <Field label={t("communications.settingsPage.appSecret")}>
                {changingSecret ? (
                  <input value={appSecret} onChange={(e) => setAppSecret(e.target.value)} autoFocus />
                ) : (
                  <div className="row-actions">
                    <span className="muted">
                      {settings.whatsapp_app_secret_last4 ? `•••• ${settings.whatsapp_app_secret_last4}` : "—"}
                    </span>
                    <button type="button" className="btn small ghost" onClick={() => setChangingSecret(true)}>
                      {t("communications.settingsPage.changeToken")}
                    </button>
                  </div>
                )}
              </Field>
              <Field label={t("communications.settingsPage.webhookUrl")}>
                <div className="row-actions">
                  <input value={settings.webhook_url} readOnly />
                  <button type="button" className="btn small ghost" onClick={copyWebhook}>
                    {t("communications.settingsPage.copy")}
                  </button>
                </div>
              </Field>
              <Field label={t("communications.settingsPage.countryCode")}>
                <input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
              </Field>
              <Field label={t("communications.settingsPage.reminderHours")}>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={reminderHours}
                  onChange={(e) => setReminderHours(Number(e.target.value))}
                />
              </Field>
            </div>
            <label className="touch-label">
              <input type="checkbox" checked={masterEnabled} onChange={(e) => setMasterEnabled(e.target.checked)} />{" "}
              {t("communications.settingsPage.masterEnabled")}
            </label>
            <div className="settings-field-grid">
              <Field label={t("communications.settingsPage.testPhone")}>
                <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="8091234567" />
              </Field>
            </div>
            <button className="btn ghost" disabled={!settings.whatsapp_configured} onClick={testWhatsapp}>
              {t("communications.settingsPage.testWhatsapp")}
            </button>
            {!settings.whatsapp_configured && <p className="muted">{t("communications.settingsPage.notConfigured")}</p>}
          </div>

          {status && <p className="muted">{status}</p>}
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="settings-footer">
            <button className="btn primary" onClick={save} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}

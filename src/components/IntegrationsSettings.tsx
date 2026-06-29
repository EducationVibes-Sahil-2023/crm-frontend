"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import PushNotificationSettings from "@/components/PushNotificationSettings";
import FreeApiSettings from "@/components/FreeApiSettings";
import SearchableSelect from "@/components/SearchableSelect";
import { loadPushConfig } from "@/lib/pushConfig";
import { countEnabledFreeApis, loadFreeApis } from "@/lib/freeApis";
import { smtpApi } from "@/lib/smtpApi";
import { gmailApi, oauthReasonMessage, type GmailStatus } from "@/lib/gmailApi";
import { allowedFeatures } from "@/lib/access";
import { getPlan, loadSubscription } from "@/lib/subscription";
import {
  DEFAULT_INTEGRATIONS,
  loadIntegrations,
  saveIntegrations,
  type IntegrationsConfig,
  type SmtpEncryption,
  type SyncDirection,
} from "@/lib/integrations";

type TabKey = "google" | "calendar" | "meet" | "sheets" | "gmail" | "smtp" | "push" | "free";

// Each integration tab maps to a plan feature key (null = always available).
// The Super Admin controls which plans unlock each key under Platform Settings →
// Permissions, so a client only sees the integrations their subscription includes.
const TAB_FEATURE: Record<TabKey, string | null> = {
  google: "intgGoogle",
  calendar: "intgGoogle",
  meet: "intgGoogle",
  sheets: "intgGoogle",
  gmail: "intgGoogle",
  smtp: "intgEmail",
  push: "intgPush",
  free: null,
};

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "google", label: "Google Account", icon: "users" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "meet", label: "Meet", icon: "call" },
  { key: "sheets", label: "Sheets / Excel", icon: "quotation" },
  { key: "gmail", label: "Gmail", icon: "gmail" },
  { key: "smtp", label: "SMTP", icon: "export" },
  { key: "push", label: "Web Push", icon: "bell" },
  { key: "free", label: "Free APIs", icon: "plug" },
];

export default function IntegrationsSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<IntegrationsConfig>(loadIntegrations);
  const [tab, setTab] = useState<TabKey>("google");

  // Which integrations this workspace's subscription plan unlocks.
  const allowed = useMemo(() => allowedFeatures(), []);
  const planName = useMemo(() => getPlan(loadSubscription().planId)?.name ?? "your plan", []);
  const tabAllowed = (k: TabKey) => {
    const key = TAB_FEATURE[k];
    return key === null || allowed.has(key);
  };
  const currentLocked = !tabAllowed(tab);

  useEffect(() => {
    saveIntegrations(cfg);
  }, [cfg]);

  // ---- Real Google OAuth (per-workspace, server-backed) ----
  const [gStatus, setGStatus] = useState<GmailStatus | null>(null);
  const [gBusy, setGBusy] = useState(false);
  useEffect(() => {
    // Handle the post-consent return flag, then load this workspace's real status.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const flag = params.get("connected");
      if (flag === "1") toast.success("Google connected", "Your account is linked for this workspace.");
      else if (flag === "0") toast.error("Connection failed", oauthReasonMessage(params.get("reason")));
      if (flag !== null) window.history.replaceState({}, "", window.location.pathname);
    }
    gmailApi.status().then(setGStatus).catch(() => setGStatus(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectGoogleReal() {
    const id = cfg.google.clientId.trim();
    const secret = cfg.google.clientSecret.trim();
    if (!id || !secret) {
      toast.error("Missing credentials", "Enter this workspace's OAuth Client ID and Secret first.");
      return;
    }
    setGBusy(true);
    try {
      // Persist this workspace's own Google app, then start the real OAuth flow.
      await gmailApi.saveConfig({ clientId: id, clientSecret: secret, redirectUri: cfg.google.redirectUri.trim() });
      const { url } = await gmailApi.authUrl("/admin-setup/integrations");
      window.location.href = url;
    } catch (e) {
      setGBusy(false);
      toast.error("Couldn't start Google connect", e instanceof Error && e.message.includes("503") ? "Add your Client ID and Secret, then try again." : "Please try again.");
    }
  }

  async function disconnectGoogleReal() {
    setGBusy(true);
    try {
      await gmailApi.disconnect();
      setGStatus((s) => (s ? { ...s, connected: false, email: "" } : { configured: true, connected: false, email: "" }));
      toast.info("Disconnected", "Google account was disconnected for this workspace.");
    } catch {
      toast.error("Disconnect failed", "Please try again.");
    } finally {
      setGBusy(false);
    }
  }

  // Section updaters.
  const upd = <S extends keyof IntegrationsConfig, K extends keyof IntegrationsConfig[S]>(
    section: S,
    key: K,
    value: IntegrationsConfig[S][K],
  ) => setCfg((c) => ({ ...c, [section]: { ...c[section], [key]: value } }));

  function requireGoogle(action: string): boolean {
    if (!gStatus?.connected) {
      toast.error("Connect Google first", `Connect a Google account before you can ${action}.`);
      return false;
    }
    return true;
  }

  const [smtpBusy, setSmtpBusy] = useState<"" | "save" | "test">("");
  const [smtpTestTo, setSmtpTestTo] = useState("");

  function smtpPayload() {
    return {
      host: cfg.smtp.host.trim(),
      port: cfg.smtp.port,
      username: cfg.smtp.username.trim(),
      password: cfg.smtp.password,
      encryption: cfg.smtp.encryption,
      fromName: cfg.smtp.fromName.trim(),
      fromEmail: cfg.smtp.fromEmail.trim(),
    };
  }

  async function saveSmtpToServer() {
    if (!cfg.smtp.host.trim() || !cfg.smtp.fromEmail.trim()) {
      toast.error("Incomplete", "Host and From email are required.");
      return;
    }
    setSmtpBusy("save");
    try {
      const res = await smtpApi.saveConfig(smtpPayload());
      toast.success(res.configured ? "SMTP saved" : "Saved", res.configured ? "The server can now send mail via SMTP." : "Add host and From email to finish.");
    } catch (e) {
      toast.error("Save failed", e instanceof Error ? e.message : "The backend didn't accept the config.");
    } finally {
      setSmtpBusy("");
    }
  }

  async function sendSmtpTest() {
    if (!cfg.smtp.host.trim() || !cfg.smtp.fromEmail.trim()) {
      toast.error("Incomplete", "Host and From email are required to test SMTP.");
      return;
    }
    const to = smtpTestTo.trim() || cfg.smtp.fromEmail.trim();
    if (!to) {
      toast.error("No recipient", "Enter an address to send the test to.");
      return;
    }
    setSmtpBusy("test");
    try {
      await smtpApi.saveConfig(smtpPayload()); // persist current form, then send through it
      await smtpApi.test(to);
      toast.success("Test sent", `A test email was sent to ${to}.`);
    } catch (e) {
      toast.error("Send failed", e instanceof Error ? e.message : "The SMTP server rejected the message.");
    } finally {
      setSmtpBusy("");
    }
  }

  function reset() {
    setCfg({
      google: { ...DEFAULT_INTEGRATIONS.google, scopes: { ...DEFAULT_INTEGRATIONS.google.scopes } },
      calendar: { ...DEFAULT_INTEGRATIONS.calendar },
      meet: { ...DEFAULT_INTEGRATIONS.meet },
      sheets: { ...DEFAULT_INTEGRATIONS.sheets },
      gmail: { ...DEFAULT_INTEGRATIONS.gmail },
      smtp: { ...DEFAULT_INTEGRATIONS.smtp },
    });
    toast.info("Reset", "Integrations restored to defaults.");
  }

  const [pushEnabled] = useState(() => loadPushConfig().enabled);
  const [freeActive] = useState(() => countEnabledFreeApis(loadFreeApis()) > 0);
  const status: Record<TabKey, boolean> = {
    google: !!gStatus?.connected,
    calendar: cfg.calendar.enabled,
    meet: cfg.meet.enabled,
    sheets: cfg.sheets.enabled,
    gmail: cfg.gmail.enabled,
    smtp: cfg.smtp.enabled,
    push: pushEnabled,
    free: freeActive,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect Google services and outbound email for your workspace.
          </p>
        </div>
        <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Reset to defaults
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          const locked = !tabAllowed(t.key);
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              } ${locked ? "opacity-70" : ""}`}
            >
              <Icon name={t.icon} className="h-4 w-4" />
              {t.label}
              {locked ? (
                <Icon name="shield" className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${status[t.key] ? "bg-emerald-500" : "bg-slate-300"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Locked by subscription plan */}
      {currentLocked && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Icon name="shield" className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">This integration isn&apos;t in your plan</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            <span className="font-semibold">{TABS.find((t) => t.key === tab)?.label}</span> isn&apos;t included in your <span className="font-semibold">{planName}</span> subscription. Upgrade to unlock it for your workspace.
          </p>
          <Link href="/subscription" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:-translate-y-0.5">
            <Icon name="trendUp" className="h-4 w-4" /> View plans &amp; upgrade
          </Link>
        </div>
      )}

      {/* Google Account */}
      {!currentLocked && tab === "google" && (
        <Card
          title="Google OAuth"
          subtitle="This workspace's own Google app — powers Calendar, Meet, Sheets, and Gmail."
          right={
            <Badge ok={!!gStatus?.connected}>
              {gStatus?.connected ? `Connected${gStatus.email ? ` · ${gStatus.email}` : ""}` : "Not connected"}
            </Badge>
          }
        >
          <Grid>
            <Field label="Client ID">
              <Input value={cfg.google.clientId} onChange={(v) => upd("google", "clientId", v)} placeholder="xxxx.apps.googleusercontent.com" />
            </Field>
            <Field label="Client Secret">
              <Secret value={cfg.google.clientSecret} onChange={(v) => upd("google", "clientSecret", v)} placeholder="GOCSPX-…" />
            </Field>
            <Field label="API Key">
              <Input value={cfg.google.apiKey} onChange={(v) => upd("google", "apiKey", v)} placeholder="AIza…" />
            </Field>
            <Field label="Redirect URI">
              <Input value={cfg.google.redirectUri} onChange={(v) => upd("google", "redirectUri", v)} placeholder="https://…/callback" />
            </Field>
          </Grid>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Scopes</p>
            <div className="flex flex-wrap gap-2">
              {(["calendar", "gmail", "sheets", "drive"] as const).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm capitalize text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={cfg.google.scopes[s]}
                    onChange={(e) => setCfg((c) => ({ ...c, google: { ...c.google, scopes: { ...c.google.scopes, [s]: e.target.checked } } }))}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Add this exact <span className="font-medium text-slate-700">Authorized redirect URI</span> to your Google Cloud OAuth client:
            <span className="ml-1 break-all font-mono text-slate-700">{gStatus ? (typeof window !== "undefined" ? `${window.location.origin}/api/gmail/callback` : "/api/gmail/callback") : "/api/gmail/callback"}</span>
          </p>

          <div className="flex items-center gap-2">
            {gStatus?.connected ? (
              <button onClick={disconnectGoogleReal} disabled={gBusy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {gBusy ? "Working…" : "Disconnect"}
              </button>
            ) : (
              <button onClick={connectGoogleReal} disabled={gBusy} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                <Icon name="plug" className="h-4 w-4" /> {gBusy ? "Connecting…" : "Save & Connect Google"}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Calendar */}
      {!currentLocked && tab === "calendar" && (
        <Card
          title="Google Calendar"
          subtitle="Sync meetings and events two ways."
          right={<EnableSwitch checked={cfg.calendar.enabled} onChange={(v) => upd("calendar", "enabled", v)} />}
        >
          <Grid>
            <Field label="Calendar ID">
              <Input value={cfg.calendar.calendarId} onChange={(v) => upd("calendar", "calendarId", v)} placeholder="primary" />
            </Field>
            <Field label="Sync direction">
              <SelectField
                value={cfg.calendar.sync}
                onChange={(v) => upd("calendar", "sync", v as SyncDirection)}
                options={[
                  { value: "off", label: "Off" },
                  { value: "import", label: "Import only" },
                  { value: "export", label: "Export only" },
                  { value: "two-way", label: "Two-way" },
                ]}
              />
            </Field>
          </Grid>
          <ToggleRow label="Add Google Meet link" desc="Attach a Meet link to events created from the CRM." checked={cfg.calendar.createMeet} onChange={(v) => upd("calendar", "createMeet", v)} />
          <ToggleRow label="Send reminders" desc="Use Google Calendar reminders for synced events." checked={cfg.calendar.reminders} onChange={(v) => upd("calendar", "reminders", v)} />
          <Actions>
            <button onClick={() => requireGoogle("sync the calendar") && toast.success("Sync queued", "Calendar sync started.")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Sync now
            </button>
          </Actions>
        </Card>
      )}

      {/* Meet */}
      {!currentLocked && tab === "meet" && (
        <Card
          title="Google Meet"
          subtitle="Generate video meeting links for calls and meetings."
          right={<EnableSwitch checked={cfg.meet.enabled} onChange={(v) => upd("meet", "enabled", v)} />}
        >
          <Grid>
            <Field label="Default duration (minutes)">
              <Input type="number" value={String(cfg.meet.defaultDuration)} onChange={(v) => upd("meet", "defaultDuration", Number(v) || 0)} placeholder="30" />
            </Field>
          </Grid>
          <ToggleRow label="Auto-create links" desc="Automatically create a Meet link when scheduling a meeting." checked={cfg.meet.autoLink} onChange={(v) => upd("meet", "autoLink", v)} />
          <Actions>
            <button onClick={() => requireGoogle("create a Meet link") && toast.success("Meet link created", "https://meet.google.com/abc-defg-hij")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Create test link
            </button>
          </Actions>
        </Card>
      )}

      {/* Sheets / Excel */}
      {!currentLocked && tab === "sheets" && (
        <Card
          title="Google Sheets / Excel"
          subtitle="Export records to a spreadsheet or import in bulk."
          right={<EnableSwitch checked={cfg.sheets.enabled} onChange={(v) => upd("sheets", "enabled", v)} />}
        >
          <Grid>
            <Field label="Spreadsheet ID">
              <Input value={cfg.sheets.spreadsheetId} onChange={(v) => upd("sheets", "spreadsheetId", v)} placeholder="1AbC…xyz" />
            </Field>
            <Field label="Sheet name">
              <Input value={cfg.sheets.sheetName} onChange={(v) => upd("sheets", "sheetName", v)} placeholder="Users" />
            </Field>
          </Grid>
          <ToggleRow label="Auto-export" desc="Append new records to the sheet automatically." checked={cfg.sheets.autoExport} onChange={(v) => upd("sheets", "autoExport", v)} />
          <Actions>
            <button onClick={() => requireGoogle("export to Sheets") && toast.success("Export started", "Users will be written to your sheet.")} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Icon name="export" className="h-4 w-4 text-slate-500" /> Export users
            </button>
          </Actions>
        </Card>
      )}

      {/* Gmail */}
      {!currentLocked && tab === "gmail" && (
        <Card
          title="Gmail"
          subtitle="Send email through the connected Google account."
          right={<EnableSwitch checked={cfg.gmail.enabled} onChange={(v) => upd("gmail", "enabled", v)} />}
        >
          <Grid>
            <Field label="Send as">
              <Input value={cfg.gmail.sendAs} onChange={(v) => upd("gmail", "sendAs", v)} placeholder="you@educationvibes.in" />
            </Field>
          </Grid>
          <Field label="Signature" full>
            <textarea
              value={cfg.gmail.signature}
              onChange={(e) => upd("gmail", "signature", e.target.value)}
              rows={3}
              placeholder="— Sent from CRM Enterprise"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </Field>
          <ToggleRow label="Track opens" desc="Insert a tracking pixel to know when emails are opened." checked={cfg.gmail.trackOpens} onChange={(v) => upd("gmail", "trackOpens", v)} />
          <Actions>
            <button onClick={() => requireGoogle("send via Gmail") && toast.success("Test sent", "A test email was queued via Gmail.")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Send test email
            </button>
          </Actions>
        </Card>
      )}

      {/* SMTP */}
      {!currentLocked && tab === "smtp" && (
        <Card
          title="SMTP"
          subtitle="Fallback outbound mail server (used when Gmail is off)."
          right={<EnableSwitch checked={cfg.smtp.enabled} onChange={(v) => upd("smtp", "enabled", v)} />}
        >
          <Grid>
            <Field label="Host">
              <Input value={cfg.smtp.host} onChange={(v) => upd("smtp", "host", v)} placeholder="smtp.gmail.com" />
            </Field>
            <Field label="Port">
              <Input type="number" value={String(cfg.smtp.port)} onChange={(v) => upd("smtp", "port", Number(v) || 0)} placeholder="587" />
            </Field>
            <Field label="Username">
              <Input value={cfg.smtp.username} onChange={(v) => upd("smtp", "username", v)} placeholder="apikey or email" />
            </Field>
            <Field label="Password">
              <Secret value={cfg.smtp.password} onChange={(v) => upd("smtp", "password", v)} placeholder="••••••••" />
            </Field>
            <Field label="Encryption">
              <SelectField
                value={cfg.smtp.encryption}
                onChange={(v) => upd("smtp", "encryption", v as SmtpEncryption)}
                options={[
                  { value: "none", label: "None" },
                  { value: "ssl", label: "SSL" },
                  { value: "tls", label: "TLS / STARTTLS" },
                ]}
              />
            </Field>
            <Field label="From name">
              <Input value={cfg.smtp.fromName} onChange={(v) => upd("smtp", "fromName", v)} placeholder="CRM Enterprise" />
            </Field>
            <Field label="From email">
              <Input value={cfg.smtp.fromEmail} onChange={(v) => upd("smtp", "fromEmail", v)} placeholder="no-reply@educationvibes.in" />
            </Field>
          </Grid>
          <Actions>
            <button onClick={saveSmtpToServer} disabled={smtpBusy !== ""} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {smtpBusy === "save" ? "Saving…" : "Save to server"}
            </button>
            <input
              value={smtpTestTo}
              onChange={(e) => setSmtpTestTo(e.target.value)}
              placeholder="test recipient (defaults to From email)"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button onClick={sendSmtpTest} disabled={smtpBusy !== ""} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {smtpBusy === "test" ? "Sending…" : "Send test email"}
            </button>
          </Actions>
          <p className="mt-1 text-xs text-slate-400">Saved on the server (writable/mail/smtp.json) — sends use CodeIgniter&apos;s mailer. For Gmail SMTP use an App Password.</p>
        </Card>
      )}

      {/* Web Push */}
      {!currentLocked && tab === "push" && <PushNotificationSettings embedded />}

      {/* Free APIs */}
      {!currentLocked && tab === "free" && <FreeApiSettings />}

      {!currentLocked && tab !== "push" && tab !== "free" && (
        <p className="text-xs text-slate-400">
          Credentials are stored for this workspace. Completing OAuth and sending real email require the server-side callback and mailer to be wired to these settings.
        </p>
      )}
    </div>
  );
}

// ---------- building blocks ----------

function Card({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    />
  );
}

function Secret({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
      <button type="button" onClick={() => setShow((s) => !s)} title={show ? "Hide" : "Show"} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50">
        <Icon name="eye" className="h-4 w-4" />
      </button>
    </div>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <SearchableSelect value={value} onChange={onChange} options={options} className="w-full" buttonClassName="py-2.5" />;
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
      <div>
        <p className="font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">{children}</div>;
}

function EnableSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium ${checked ? "text-emerald-600" : "text-slate-400"}`}>{checked ? "Enabled" : "Disabled"}</span>
      <Switch checked={checked} onChange={onChange} label="Enable integration" />
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function Badge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-400"}`} />
      {children}
    </span>
  );
}

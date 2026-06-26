// Google + email integrations — configured in Admin Setup.

export type SmtpEncryption = "none" | "ssl" | "tls";
export type SyncDirection = "off" | "import" | "export" | "two-way";

export type IntegrationsConfig = {
  google: {
    clientId: string;
    clientSecret: string;
    apiKey: string;
    redirectUri: string;
    connected: boolean;
    account: string;
    scopes: Record<"calendar" | "gmail" | "sheets" | "drive", boolean>;
  };
  calendar: { enabled: boolean; calendarId: string; sync: SyncDirection; createMeet: boolean; reminders: boolean };
  meet: { enabled: boolean; defaultDuration: number; autoLink: boolean };
  sheets: { enabled: boolean; spreadsheetId: string; sheetName: string; autoExport: boolean };
  gmail: { enabled: boolean; sendAs: string; signature: string; trackOpens: boolean };
  smtp: { enabled: boolean; host: string; port: number; username: string; password: string; encryption: SmtpEncryption; fromName: string; fromEmail: string };
};

export const DEFAULT_INTEGRATIONS: IntegrationsConfig = {
  google: {
    clientId: "",
    clientSecret: "",
    apiKey: "",
    redirectUri: "https://app.educationvibes.in/oauth/google/callback",
    connected: false,
    account: "",
    scopes: { calendar: true, gmail: true, sheets: true, drive: false },
  },
  calendar: { enabled: false, calendarId: "primary", sync: "two-way", createMeet: true, reminders: true },
  meet: { enabled: false, defaultDuration: 30, autoLink: true },
  sheets: { enabled: false, spreadsheetId: "", sheetName: "Users", autoExport: false },
  gmail: { enabled: false, sendAs: "", signature: "", trackOpens: false },
  smtp: { enabled: false, host: "", port: 587, username: "", password: "", encryption: "tls", fromName: "CRM Enterprise", fromEmail: "" },
};

const STORAGE_KEY = "integrations_config_v1";

function clone(c: IntegrationsConfig): IntegrationsConfig {
  return {
    google: { ...c.google, scopes: { ...c.google.scopes } },
    calendar: { ...c.calendar },
    meet: { ...c.meet },
    sheets: { ...c.sheets },
    gmail: { ...c.gmail },
    smtp: { ...c.smtp },
  };
}

// Cached parsed config — avoids re-reading/parsing localStorage on every render.
let _cache: IntegrationsConfig | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY) _cache = null; });
}

export function loadIntegrations(): IntegrationsConfig {
  if (typeof window === "undefined") return clone(DEFAULT_INTEGRATIONS);
  if (_cache) return clone(_cache);
  const cfg = clone(DEFAULT_INTEGRATIONS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<IntegrationsConfig>;
      if (p.google) Object.assign(cfg.google, p.google, { scopes: { ...cfg.google.scopes, ...(p.google.scopes ?? {}) } });
      if (p.calendar) Object.assign(cfg.calendar, p.calendar);
      if (p.meet) Object.assign(cfg.meet, p.meet);
      if (p.sheets) Object.assign(cfg.sheets, p.sheets);
      if (p.gmail) Object.assign(cfg.gmail, p.gmail);
      if (p.smtp) Object.assign(cfg.smtp, p.smtp);
    }
  } catch {
    // ignore — fall back to defaults
  }
  _cache = cfg;
  return clone(cfg);
}

export function saveIntegrations(cfg: IntegrationsConfig): void {
  _cache = clone(cfg);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/** Drop the cached config so the next loadIntegrations() re-reads storage. */
export function clearIntegrationsCache(): void { _cache = null; }

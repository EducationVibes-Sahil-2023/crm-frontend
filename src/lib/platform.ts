// Platform-level config managed by the Super Admin (NOT CRM data):
// branding/logo, landing-page content, subscription plans, client reviews,
// payment (Razorpay), Google integration, and automation. localStorage-backed.

import { useEffect, useState } from "react";
import { ensureSuperAdminToken } from "@/lib/superAdmin";
// Type-only imports (erased at runtime) — avoids a require cycle, since
// appearance.ts / navConfig.ts import loadPlatform() from here as values.
import type { Appearance } from "@/lib/appearance";
import type { NavConfig } from "@/lib/navConfig";

const EMPTY_NAV: NavConfig = { items: {}, groups: {}, order: {} };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type PlatformPlan = { id: string; name: string; price: number; period: string; features: string[]; highlighted?: boolean };
export type Review = { id: string; name: string; role: string; rating: number; text: string };
export type Feature = { icon: string; title: string; desc: string };

export type PlatformConfig = {
  brand: { name: string; logoText: string; logoUrl: string; favicon: string; tagline: string; primaryColor: string; logoBg: string; email: string; phone: string; logoWidth: number; logoHeight: number; logoOnly: boolean };
  landing: { heroTitle: string; heroSubtitle: string; ctaLabel: string; ctaUrl: string; features: Feature[] };
  plans: PlatformPlan[];
  reviews: Review[];
  payment: { provider: string; enabled: boolean; keyId: string; keySecret: string; currency: string; webhookUrl: string };
  // The platform's own Google OAuth app. clientId/secret/redirectUri/authDomain/
  // jsOrigin are mirrored here for the console form, but the DATABASE
  // (settings.gmail_oauth) is the authority — see saveGoogleToServer().
  google: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authDomain: string;
    jsOrigin: string;
    gmail: boolean;
    calendar: boolean;
    meet: boolean;
  };
  automation: Record<string, boolean>;
  // Which modules each subscription plan unlocks (planId -> feature keys).
  planFeatures: Record<string, string[]>;
  // The full feature catalog known when this config was last saved. Lets us tell
  // a module the admin deliberately switched off apart from one that simply
  // didn't exist yet — so newly-added modules aren't silently locked on upgrade.
  featureCatalog: string[];
  // Platform-wide DEFAULTS every client workspace inherits. A client can still
  // override these locally (Admin Setup → Theme & UI / Menu); their local choices
  // layer on top of these as the base.
  appearance: Partial<Appearance>; // default theme (accent, sidebar colours, panel bg, …)
  nav: NavConfig;                  // default sidebar menu (order / rename / hide / re-icon)
};

// Every gateable module the Super Admin can switch on/off per plan, grouped for
// a readable permissions matrix.
export const PLATFORM_FEATURES: { key: string; label: string; icon: string; group: string }[] = [
  // Sales / CRM
  { key: "leads", label: "Leads", icon: "leads", group: "Sales & CRM" },
  { key: "forms", label: "Lead Forms", icon: "edit", group: "Sales & CRM" },
  { key: "leadVisitor", label: "Lead Visitor", icon: "visitor", group: "Sales & CRM" },
  { key: "callTracker", label: "Call Tracker", icon: "call", group: "Sales & CRM" },
  { key: "tasks", label: "Task Management", icon: "task", group: "Sales & CRM" },
  { key: "ai", label: "AI Assistant", icon: "ai", group: "Sales & CRM" },
  // Communication
  { key: "gmail", label: "Gmail", icon: "gmail", group: "Communication" },
  { key: "chat", label: "Team Chat", icon: "chat", group: "Communication" },
  { key: "whatsapp", label: "WhatsApp", icon: "whatsapp", group: "Communication" },
  { key: "media", label: "Media Library", icon: "media", group: "Communication" },
  { key: "announcement", label: "Announcements", icon: "announcement", group: "Communication" },
  { key: "marketing", label: "Marketing Campaigns", icon: "announcement", group: "Communication" },
  // Operations
  { key: "calendar", label: "Calendar", icon: "calendar", group: "Operations" },
  { key: "mobileApp", label: "Mobile App", icon: "download", group: "Operations" },
  { key: "support", label: "Support Tickets", icon: "ticket", group: "Operations" },
  // Finance & Assets
  { key: "accounts", label: "Accounts & Billing", icon: "revenue", group: "Finance & Assets" },
  { key: "assets", label: "Asset Management", icon: "asset", group: "Finance & Assets" },
  { key: "inventory", label: "Inventory", icon: "inventory", group: "Finance & Assets" },
  { key: "vendors", label: "Vendors", icon: "briefcase", group: "Finance & Assets" },
  { key: "knowledge", label: "Knowledge Base", icon: "knowledge", group: "Finance & Assets" },
  // People
  { key: "hrms", label: "HRMS & Payroll", icon: "users", group: "Human Resources" },
  // Integrations — gated per plan; clients only see the ones their plan unlocks.
  { key: "intgGoogle", label: "Google Workspace", icon: "gmail", group: "Integrations" },
  { key: "intgEmail", label: "Email / SMTP", icon: "send", group: "Integrations" },
  { key: "intgPush", label: "Web Push", icon: "bell", group: "Integrations" },
];
export const ALL_FEATURE_KEYS = PLATFORM_FEATURES.map((f) => f.key);

// Integration feature keys (subset of ALL_FEATURE_KEYS) — used to gate the
// Integrations setup page by the workspace's plan.
export const INTEGRATION_FEATURE_KEYS = ["intgGoogle", "intgEmail", "intgPush"] as const;

export const DEFAULT_PLAN_FEATURES: Record<string, string[]> = {
  free: ["leads", "forms", "tasks", "calendar", "chat", "knowledge", "mobileApp", "intgPush"],
  starter: ["leads", "forms", "leadVisitor", "callTracker", "tasks", "ai", "gmail", "chat", "whatsapp", "media", "announcement", "marketing", "calendar", "mobileApp", "support", "knowledge", "intgEmail", "intgPush"],
  pro: [...ALL_FEATURE_KEYS],
  enterprise: [...ALL_FEATURE_KEYS],
};

/** True if a stored planFeatures map uses keys from before the granular catalog. */
export function hasLegacyFeatures(pf?: Record<string, string[]>): boolean {
  if (!pf) return false;
  return Object.values(pf).some((arr) => Array.isArray(arr) && arr.some((k) => !ALL_FEATURE_KEYS.includes(k)));
}

/**
 * Merge a saved per-plan feature map over the current defaults.
 *
 * The subtlety: when a NEW gateable module is added to the catalog, any
 * workspace whose Super Admin previously saved plan features has a stored list
 * that predates the new key — and a naive `{...defaults, ...saved}` merge lets
 * that stale list override the default, silently LOCKING the new module (this is
 * how Financial/HR could vanish on an existing deployment). We fix that by
 * granting each plan any feature key the saved config never knew about (absent
 * from every saved plan list) *when that plan's default includes it*. Deliberate
 * admin opt-outs of keys they've actually seen are still respected.
 */
export function mergePlanFeatures(saved?: Record<string, string[]>, savedCatalog?: string[]): Record<string, string[]> {
  const defaults = Object.fromEntries(Object.entries(DEFAULT_PLAN_FEATURES).map(([k, v]) => [k, [...v]]));
  // A legacy/invalid map can't be reasoned about key-by-key — fall back wholesale.
  if (!saved || hasLegacyFeatures(saved)) return defaults;

  // Which keys the saved config knew about. Prefer the explicit catalog marker
  // (precise — distinguishes a deliberately-disabled module from one that didn't
  // exist yet). Legacy configs lack it, so fall back to "any key present in some
  // saved plan list" — a best-effort heuristic that still unlocks new modules.
  const known = savedCatalog && savedCatalog.length
    ? new Set(savedCatalog)
    : new Set(Object.values(saved).flat());
  const newKeys = ALL_FEATURE_KEYS.filter((k) => !known.has(k));

  const out: Record<string, string[]> = { ...defaults };
  for (const plan of new Set([...Object.keys(defaults), ...Object.keys(saved)])) {
    const savedList = saved[plan] ?? defaults[plan] ?? [];
    const grantNew = newKeys.filter((k) => (DEFAULT_PLAN_FEATURES[plan] ?? []).includes(k));
    out[plan] = Array.from(new Set([...savedList, ...grantNew]));
  }
  return out;
}

export const AUTOMATIONS: { key: string; label: string; desc: string }[] = [
  { key: "welcomeEmail", label: "Welcome email on signup", desc: "Email new client admins when their workspace is provisioned." },
  { key: "trialReminder", label: "Trial expiry reminders", desc: "Notify clients 3 days before their trial ends." },
  { key: "autoSuspend", label: "Auto-suspend on non-payment", desc: "Suspend workspaces when an invoice is 7 days overdue." },
  { key: "invoiceEmail", label: "Auto-send invoices", desc: "Email a Razorpay invoice on each billing cycle." },
  { key: "weeklyReport", label: "Weekly platform report", desc: "Email the super admin a usage & revenue summary." },
  { key: "autoBackup", label: "Nightly DB backups", desc: "Back up every client database every night." },
];

export const DEFAULT_PLATFORM: PlatformConfig = {
  brand: { name: "CRM Cloud", logoText: "CC", logoUrl: "", favicon: "", tagline: "The all-in-one CRM for growing teams.", primaryColor: "#2563eb", logoBg: "#2563eb", email: "sales@nexuscrm.in", phone: "+91 98765 43210", logoWidth: 100, logoHeight: 100, logoOnly: false },
  landing: {
    heroTitle: "Run your entire business from one CRM",
    heroSubtitle: "Leads, sales, HR, payments and more — beautifully integrated, multi-tenant, and ready to scale.",
    ctaLabel: "Start free trial",
    ctaUrl: "/login",
    features: [
      { icon: "leads", title: "Lead management", desc: "Capture, assign and convert leads with full activity history." },
      { icon: "users", title: "HRMS built-in", desc: "Attendance, payroll, leaves and more — out of the box." },
      { icon: "payment", title: "Payments", desc: "Invoices, subscriptions and Razorpay collections." },
      { icon: "shield", title: "Isolated & secure", desc: "Each client gets a dedicated, isolated database." },
    ],
  },
  plans: [
    { id: "free", name: "Free", price: 0, period: "mo", features: ["3 users", "500 leads", "Core CRM", "Community support"] },
    { id: "starter", name: "Starter", price: 29, period: "mo", features: ["10 users", "5,000 leads", "Roles & permissions", "Email support"] },
    { id: "pro", name: "Pro", price: 79, period: "mo", features: ["50 users", "Unlimited leads", "HRMS + Payments", "Priority support"], highlighted: true },
    { id: "enterprise", name: "Enterprise", price: 199, period: "mo", features: ["Unlimited users", "SSO & SAML", "Dedicated DB & manager", "99.9% SLA"] },
  ],
  reviews: [
    { id: "r1", name: "Rajesh Kumar", role: "Director, Acme Education", rating: 5, text: "Switching to CRM Cloud cut our admin work in half. The HRMS and CRM in one place is a game changer." },
    { id: "r2", name: "Sneha Iyer", role: "Ops Head, BrightPath", rating: 5, text: "Onboarding was instant and the dedicated database gives us real peace of mind on data privacy." },
    { id: "r3", name: "David Chen", role: "Founder, Globex", rating: 4, text: "Razorpay billing and the clean dashboards make running our subscription effortless." },
  ],
  payment: { provider: "Razorpay", enabled: false, keyId: "", keySecret: "", currency: "INR", webhookUrl: "https://api.crm-cloud.app/webhooks/razorpay" },
  google: { enabled: false, clientId: "", clientSecret: "", redirectUri: "", authDomain: "", jsOrigin: "", gmail: true, calendar: true, meet: true },
  automation: Object.fromEntries(AUTOMATIONS.map((a) => [a.key, ["welcomeEmail", "trialReminder", "invoiceEmail"].includes(a.key)])),
  planFeatures: DEFAULT_PLAN_FEATURES,
  featureCatalog: [...ALL_FEATURE_KEYS],
  appearance: {},
  nav: { items: {}, groups: {}, order: {} },
};

export const PLATFORM_EVENT = "platform:updated";
const EVENT = PLATFORM_EVENT;

function clone(c: PlatformConfig): PlatformConfig {
  return {
    brand: { ...c.brand },
    landing: { ...c.landing, features: c.landing.features.map((f) => ({ ...f })) },
    plans: c.plans.map((p) => ({ ...p, features: [...p.features] })),
    reviews: c.reviews.map((r) => ({ ...r })),
    payment: { ...c.payment },
    google: { ...c.google },
    automation: { ...c.automation },
    planFeatures: Object.fromEntries(Object.entries(c.planFeatures).map(([k, v]) => [k, [...v]])),
    featureCatalog: [...(c.featureCatalog ?? ALL_FEATURE_KEYS)],
    appearance: { ...(c.appearance ?? {}) },
    nav: c.nav
      ? { items: { ...c.nav.items }, groups: { ...c.nav.groups }, order: { ...c.nav.order } }
      : { ...EMPTY_NAV },
  };
}

// Merge a (partial) stored config onto the defaults so newly-added fields exist.
function mergeConfig(p: Partial<PlatformConfig> | null | undefined): PlatformConfig {
  const base = clone(DEFAULT_PLATFORM);
  if (!p || typeof p !== "object") return base;
  return {
    brand: { ...base.brand, ...p.brand },
    landing: { ...base.landing, ...p.landing, features: p.landing?.features ?? base.landing.features },
    plans: Array.isArray(p.plans) && p.plans.length ? p.plans : base.plans,
    reviews: Array.isArray(p.reviews) ? p.reviews : base.reviews,
    payment: { ...base.payment, ...p.payment },
    google: { ...base.google, ...p.google },
    automation: { ...base.automation, ...p.automation },
    planFeatures: mergePlanFeatures(p.planFeatures, p.featureCatalog),
    // Always stamp the CURRENT catalog so the next save records what this build
    // knew about, making future upgrades precise (no reliance on the heuristic).
    featureCatalog: [...ALL_FEATURE_KEYS],
    appearance: { ...base.appearance, ...(p.appearance ?? {}) },
    nav: p.nav && typeof p.nav === "object"
      ? { items: p.nav.items ?? {}, groups: p.nav.groups ?? {}, order: p.nav.order ?? {} }
      : { ...EMPTY_NAV },
  };
}

// The backend (`settings` table) is the source of truth. An in-memory cache backs
// the synchronous reads (nav/permission gating); it is hydrated from the server
// on app load and whenever the config is saved. No browser storage is used.
let _cache: PlatformConfig | null = null;
// Bumped on every LOCAL save. An in-flight GET that started before a save must
// not overwrite the fresher local cache with a now-stale server copy (that race
// is what made an updated logo flash the old one, then the new one seconds later).
let _writeSeq = 0;

export function loadPlatform(): PlatformConfig {
  return clone(_cache ?? DEFAULT_PLATFORM);
}

/**
 * Seed the cache from a SERVER-fetched config on the first client render, so the
 * brand (logo / favicon / name) is available synchronously before the UI paints
 * — no default-then-real flash. Client-only, runs once, and never clobbers a
 * cache that already holds live data. A normal refresh still runs afterwards.
 */
export function primePlatform(raw: Partial<PlatformConfig> | null | undefined): void {
  if (typeof window === "undefined" || _cache) return;
  _cache = mergeConfig(raw ?? null);
}

function setCache(cfg: PlatformConfig, local = false): void {
  _cache = clone(cfg);
  if (local) _writeSeq++;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}

// Request de-duplication: a single in-flight fetch is shared by all callers, and
// a short TTL stops every component mount from re-hitting the backend. Without
// this, the 6 usePlatform() consumers + the boot hydrate would each fire a GET.
let _inflight: Promise<PlatformConfig> | null = null;
let _lastFetch = 0;
const PLATFORM_TTL = 30_000;

/** Fetch the latest config from the backend DB and refresh the cache. */
export async function refreshPlatform(force = false): Promise<PlatformConfig> {
  if (typeof window === "undefined") return clone(DEFAULT_PLATFORM);
  if (!force && _cache && Date.now() - _lastFetch < PLATFORM_TTL) return clone(_cache);
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const seqAtStart = _writeSeq;
    try {
      // `no-store` so the browser never serves a stale cached response.
      const res  = await fetch(`${API_BASE}/platform`, { cache: "no-store", headers: { "Content-Type": "application/json" } });
      const data = res.ok ? await res.json() : null;
      // A local save landed while this GET was in flight — its result is now
      // stale relative to what the user just changed. Keep the local cache.
      if (_writeSeq !== seqAtStart && _cache) {
        _lastFetch = Date.now();
        return clone(_cache);
      }
      const cfg = mergeConfig(data?.config ?? null);
      setCache(cfg);
      _lastFetch = Date.now();
      return cfg;
    } catch {
      if (!_cache) _cache = clone(DEFAULT_PLATFORM);
      return clone(_cache);
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
async function postPlatform(cfg: PlatformConfig): Promise<void> {
  try {
    const token = await ensureSuperAdminToken();
    await fetch(`${API_BASE}/platform`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ config: cfg }),
    });
  } catch {
    // offline — the cache already reflects the change; the next save retries
  }
}

/** Update the cache immediately and persist to the backend (debounced). */
export function savePlatform(c: PlatformConfig): void {
  setCache(c, true);
  // Trust the just-saved local copy over a server fetch for the TTL window, so a
  // refresh doesn't re-pull a not-yet-persisted (stale) config and flash the old
  // value. The debounced POST persists it for real reloads.
  _lastFetch = Date.now();
  if (typeof window === "undefined") return;
  if (_saveTimer) clearTimeout(_saveTimer);
  const snapshot = clone(c);
  _saveTimer = setTimeout(() => { postPlatform(snapshot); }, 250);
}

export function clearPlatformCache(): void { _cache = null; }

// Hydrate from the server as soon as this module loads in the browser, so
// synchronous readers get real data shortly after first paint.
if (typeof window !== "undefined") { void refreshPlatform(); }

/**
 * Live platform config for client components — re-renders when the Super Admin
 * saves changes (same tab via the custom event, other tabs via `storage`).
 * Use this so branding/landing edits reflect immediately on the public site.
 */
export function usePlatform(): PlatformConfig {
  const [cfg, setCfg] = useState<PlatformConfig>(loadPlatform);
  useEffect(() => {
    let active = true;
    const read = () => setCfg(loadPlatform());
    read();
    // Pull the latest from the backend on mount; updates flow via the event.
    refreshPlatform().then(() => { if (active) read(); }).catch(() => {});
    window.addEventListener(EVENT, read);
    return () => { active = false; window.removeEventListener(EVENT, read); };
  }, []);
  return cfg;
}

export function rid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}
export function money(n: number, currency = "$"): string {
  return n === 0 ? "Free" : `${currency}${n.toLocaleString()}`;
}

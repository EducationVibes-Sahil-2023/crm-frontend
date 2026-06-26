// Platform-level config managed by the Super Admin (NOT CRM data):
// branding/logo, landing-page content, subscription plans, client reviews,
// payment (Razorpay), Google integration, and automation. localStorage-backed.

import { useEffect, useState } from "react";
import { ensureSuperAdminToken } from "@/lib/superAdmin";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type PlatformPlan = { id: string; name: string; price: number; period: string; features: string[]; highlighted?: boolean };
export type Review = { id: string; name: string; role: string; rating: number; text: string };
export type Feature = { icon: string; title: string; desc: string };

export type PlatformConfig = {
  brand: { name: string; logoText: string; logoUrl: string; favicon: string; tagline: string; primaryColor: string; logoBg: string; email: string; phone: string };
  landing: { heroTitle: string; heroSubtitle: string; ctaLabel: string; ctaUrl: string; features: Feature[] };
  plans: PlatformPlan[];
  reviews: Review[];
  payment: { provider: string; enabled: boolean; keyId: string; keySecret: string; currency: string; webhookUrl: string };
  google: { enabled: boolean; clientId: string; clientSecret: string; gmail: boolean; calendar: boolean; meet: boolean };
  automation: Record<string, boolean>;
  // Which modules each subscription plan unlocks (planId -> feature keys).
  planFeatures: Record<string, string[]>;
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
  starter: ["leads", "forms", "leadVisitor", "callTracker", "tasks", "ai", "gmail", "chat", "whatsapp", "media", "announcement", "calendar", "mobileApp", "support", "knowledge", "intgEmail", "intgPush"],
  pro: [...ALL_FEATURE_KEYS],
  enterprise: [...ALL_FEATURE_KEYS],
};

/** True if a stored planFeatures map uses keys from before the granular catalog. */
export function hasLegacyFeatures(pf?: Record<string, string[]>): boolean {
  if (!pf) return false;
  return Object.values(pf).some((arr) => Array.isArray(arr) && arr.some((k) => !ALL_FEATURE_KEYS.includes(k)));
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
  brand: { name: "CRM Cloud", logoText: "CC", logoUrl: "", favicon: "", tagline: "The all-in-one CRM for growing teams.", primaryColor: "#2563eb", logoBg: "#2563eb", email: "sales@nexuscrm.in", phone: "+91 98765 43210" },
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
  google: { enabled: false, clientId: "", clientSecret: "", gmail: true, calendar: true, meet: true },
  automation: Object.fromEntries(AUTOMATIONS.map((a) => [a.key, ["welcomeEmail", "trialReminder", "invoiceEmail"].includes(a.key)])),
  planFeatures: DEFAULT_PLAN_FEATURES,
};

const EVENT = "platform:updated";

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
    planFeatures: hasLegacyFeatures(p.planFeatures) ? base.planFeatures : { ...base.planFeatures, ...(p.planFeatures ?? {}) },
  };
}

// The backend (`settings` table) is the source of truth. An in-memory cache backs
// the synchronous reads (nav/permission gating); it is hydrated from the server
// on app load and whenever the config is saved. No browser storage is used.
let _cache: PlatformConfig | null = null;

export function loadPlatform(): PlatformConfig {
  return clone(_cache ?? DEFAULT_PLATFORM);
}

function setCache(cfg: PlatformConfig): void {
  _cache = clone(cfg);
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
    try {
      const res  = await fetch(`${API_BASE}/platform`, { headers: { "Content-Type": "application/json" } });
      const data = res.ok ? await res.json() : null;
      const cfg  = mergeConfig(data?.config ?? null);
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
  setCache(c);
  if (typeof window === "undefined") return;
  if (_saveTimer) clearTimeout(_saveTimer);
  const snapshot = clone(c);
  _saveTimer = setTimeout(() => { postPlatform(snapshot); }, 600);
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

// Marketing module store — WhatsApp / Email / SMS campaigns, reusable message
// templates, and saved audiences. Persisted per-workspace to MySQL (`app_store`
// via /api/store, hydrated at sign-in); starts EMPTY for a fresh workspace. A
// "marketing:updated" event lets open views refresh live.

import { dbGet, dbSet, STORE_EVENT } from "@/lib/dbStore";

export type Channel = "whatsapp" | "email" | "sms";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused";

export type CampaignStats = {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
};

export type Campaign = {
  id: string;
  name: string;
  channel: Channel;
  status: CampaignStatus;
  audienceId: string | null;
  templateId: string | null;
  subject: string; // used for the email channel
  message: string;
  scheduledAt: string; // ISO, "" when sending now / not scheduled
  createdAt: string; // ISO
  updatedAt: string; // ISO
  stats: CampaignStats;
};

export type Template = {
  id: string;
  name: string;
  channel: Channel;
  subject: string; // email only
  body: string;
  createdAt: string;
};

export type Audience = {
  id: string;
  name: string;
  description: string;
  count: number;
  createdAt: string;
};

export type MarketingData = {
  campaigns: Campaign[];
  templates: Template[];
  audiences: Audience[];
};

export const CHANNELS: Channel[] = ["whatsapp", "email", "sms"];

export const CHANNEL_META: Record<Channel, { label: string; short: string; icon: "whatsapp" | "gmail" | "message"; dot: string; badge: string }> = {
  whatsapp: { label: "WhatsApp Marketing", short: "WhatsApp", icon: "whatsapp", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  email: { label: "Email Marketing", short: "Email", icon: "gmail", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  sms: { label: "SMS Marketing", short: "SMS", icon: "message", dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700" },
};

export const STATUS_META: Record<CampaignStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Draft", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  scheduled: { label: "Scheduled", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  sending: { label: "Sending", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  sent: { label: "Sent", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  paused: { label: "Paused", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

export const MARKETING_EVENT = "marketing:updated";
const KEY = "nexus_marketing_v1";

const EMPTY: MarketingData = { campaigns: [], templates: [], audiences: [] };

function broadcast() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MARKETING_EVENT));
}

export function loadMarketing(): MarketingData {
  if (typeof window === "undefined") return { ...EMPTY };
  const p = dbGet<Partial<MarketingData>>(KEY, {});
  return {
    campaigns: Array.isArray(p.campaigns) ? p.campaigns : [],
    templates: Array.isArray(p.templates) ? p.templates : [],
    audiences: Array.isArray(p.audiences) ? p.audiences : [],
  };
}

export function saveMarketing(data: MarketingData): void {
  if (typeof window === "undefined") return;
  dbSet(KEY, data);
  broadcast();
}

/** Subscribe to any marketing change (same tab + cross tab). Returns unsubscribe. */
export function subscribeMarketing(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MARKETING_EVENT, cb);
  window.addEventListener(STORE_EVENT, cb);
  return () => {
    window.removeEventListener(MARKETING_EVENT, cb);
    window.removeEventListener(STORE_EVENT, cb);
  };
}

const rid = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function emptyStats(recipients = 0): CampaignStats {
  return { recipients, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
}

// ── Campaigns ─────────────────────────────────────────────────────────────
export function upsertCampaign(input: Partial<Campaign> & { name: string; channel: Channel }): Campaign {
  const data = loadMarketing();
  const now = new Date().toISOString();
  const existing = input.id ? data.campaigns.find((c) => c.id === input.id) : undefined;
  const campaign: Campaign = {
    id: existing?.id ?? rid(),
    name: input.name.trim(),
    channel: input.channel,
    status: input.status ?? existing?.status ?? "draft",
    audienceId: input.audienceId ?? existing?.audienceId ?? null,
    templateId: input.templateId ?? existing?.templateId ?? null,
    subject: input.subject ?? existing?.subject ?? "",
    message: input.message ?? existing?.message ?? "",
    scheduledAt: input.scheduledAt ?? existing?.scheduledAt ?? "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    stats: input.stats ?? existing?.stats ?? emptyStats(),
  };
  const campaigns = existing
    ? data.campaigns.map((c) => (c.id === campaign.id ? campaign : c))
    : [campaign, ...data.campaigns];
  saveMarketing({ ...data, campaigns });
  return campaign;
}

export function setCampaignStatus(id: string, status: CampaignStatus): void {
  const data = loadMarketing();
  saveMarketing({
    ...data,
    campaigns: data.campaigns.map((c) => (c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c)),
  });
}

export function deleteCampaign(id: string): void {
  const data = loadMarketing();
  saveMarketing({ ...data, campaigns: data.campaigns.filter((c) => c.id !== id) });
}

// ── Templates ─────────────────────────────────────────────────────────────
export function upsertTemplate(input: Partial<Template> & { name: string; channel: Channel; body: string }): Template {
  const data = loadMarketing();
  const existing = input.id ? data.templates.find((t) => t.id === input.id) : undefined;
  const template: Template = {
    id: existing?.id ?? rid(),
    name: input.name.trim(),
    channel: input.channel,
    subject: input.subject ?? existing?.subject ?? "",
    body: input.body,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const templates = existing
    ? data.templates.map((t) => (t.id === template.id ? template : t))
    : [template, ...data.templates];
  saveMarketing({ ...data, templates });
  return template;
}

export function deleteTemplate(id: string): void {
  const data = loadMarketing();
  saveMarketing({ ...data, templates: data.templates.filter((t) => t.id !== id) });
}

// ── Audiences ─────────────────────────────────────────────────────────────
export function upsertAudience(input: Partial<Audience> & { name: string }): Audience {
  const data = loadMarketing();
  const existing = input.id ? data.audiences.find((a) => a.id === input.id) : undefined;
  const audience: Audience = {
    id: existing?.id ?? rid(),
    name: input.name.trim(),
    description: input.description ?? existing?.description ?? "",
    count: input.count ?? existing?.count ?? 0,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const audiences = existing
    ? data.audiences.map((a) => (a.id === audience.id ? audience : a))
    : [audience, ...data.audiences];
  saveMarketing({ ...data, audiences });
  return audience;
}

export function deleteAudience(id: string): void {
  const data = loadMarketing();
  saveMarketing({ ...data, audiences: data.audiences.filter((a) => a.id !== id) });
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

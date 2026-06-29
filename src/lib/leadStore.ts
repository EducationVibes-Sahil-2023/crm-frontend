// Shared, real-time lead intake store. Captured leads (from website forms,
// Excel/CSV imports and webhooks) and leads created/edited in the CRM are
// persisted to the normalised MySQL `leads` table via /api/leads.
//
// Reads stay synchronous: the table is hydrated once into an in-memory cache
// (see hydrateLeads, called from AuthGuard at sign-in), and loadIntakeLeads()
// returns from that cache. Writes update the cache immediately (optimistic) and
// persist to the backend, then reconcile with the server row (so client-side
// temp ids are replaced by the real numeric id). Every change broadcasts a
// LEADS_EVENT so open CRM views refresh live.

import { api, type LeadRow } from "@/lib/api";
import { dbGet, isStoreReady } from "@/lib/dbStore";

export type IntakeChannel = "Website Form" | "Excel Import" | "Webhook" | "Manual";

// Mirrors the Leads page `Lead` shape so captured leads drop straight in.
export type IntakeLead = {
  id: string;
  deleted?: boolean;
  name: string;
  company: string;
  phone: string; // primary number
  altPhone?: string; // alternative / secondary number
  email: string;
  city: string;
  state: string;
  status: string;
  source: string;
  type: string;
  followUpDate: string;
  connectedDate: string;
  lastUpdated: string;
  assignationDate: string;
  responseTime: string;
  referenceName: string;
  totalCallCount: number;
  callCount: number;
  duration: string;
  createdDate: string;
  updatedDate: string;
  createdBy: string;
  channel: IntakeChannel;
  formId?: string;
  assignedTo?: string; // counsellor name (auto-assignment)
  custom?: Record<string, string>; // extra custom-field values keyed by label
};

export type LeadsChangeReason = "hydrate" | "capture" | "mutate";

export const LEADS_EVENT = "nexus-leads-changed";
const OLD_BLOB_KEY = "nexus_intake_leads"; // legacy app_store blob (pre-migration)
const MIGRATED_FLAG = "nexus_leads_blob_migrated_v1";

// ---------- in-memory cache (mirrors dbStore's pattern for sync reads) ----------

let cache: IntakeLead[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;

function isServerId(id: string): boolean {
  return /^\d+$/.test(id);
}

function broadcast(reason: LeadsChangeReason) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LEADS_EVENT, { detail: { reason } }));
  }
}

function sortNewestFirst(list: IntakeLead[]): IntakeLead[] {
  return [...list].sort((a, b) => {
    const an = isServerId(a.id) ? Number(a.id) : Number.MAX_SAFE_INTEGER;
    const bn = isServerId(b.id) ? Number(b.id) : Number.MAX_SAFE_INTEGER;
    return bn - an; // higher id (and unsaved temp ids) first
  });
}

// ---------- field mapping: camelCase IntakeLead <-> snake_case leads row ----------

function dash(v: unknown): string {
  const s = v == null ? "" : String(v);
  return s.trim() === "" ? "—" : s;
}
function nullDash(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" || s === "—" ? null : s;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A display date string ("Jun 28, 2026") from a DB datetime, or "—". */
function fmtDate(dt: unknown): string {
  if (!dt) return "—";
  const d = new Date(String(dt).replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

/** Parse a display/iso date back to a MySQL datetime, or null. */
function toMysqlDate(s: string | undefined): string | null {
  const v = (s ?? "").trim();
  if (v === "" || v === "—" || v === "just now") return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fromRow(row: LeadRow): IntakeLead {
  const r = row as Record<string, unknown>;
  const custom = r.custom && typeof r.custom === "object" ? (r.custom as Record<string, string>) : undefined;
  return {
    id: String(r.id),
    deleted: !!Number(r.deleted),
    name: String(r.name ?? "Unknown"),
    company: dash(r.company),
    phone: dash(r.phone),
    altPhone: r.alt_phone ? String(r.alt_phone) : "",
    email: dash(r.email),
    city: dash(r.city),
    state: dash(r.state),
    status: String(r.status ?? "New"),
    source: String(r.source ?? "—"),
    type: String(r.type ?? "Warm"),
    followUpDate: fmtDate(r.follow_up_date),
    connectedDate: fmtDate(r.connected_date),
    lastUpdated: fmtDate(r.updated_at),
    assignationDate: fmtDate(r.assignation_date),
    responseTime: r.response_time ? String(r.response_time) : "—",
    referenceName: dash(r.reference_name),
    totalCallCount: Number(r.total_call_count) || 0,
    callCount: Number(r.call_count) || 0,
    duration: r.duration ? String(r.duration) : "0m",
    createdDate: fmtDate(r.created_at),
    updatedDate: fmtDate(r.updated_at),
    createdBy: String(r.created_by ?? ""),
    channel: (r.channel ? String(r.channel) : "Manual") as IntakeChannel,
    formId: r.form_id ? String(r.form_id) : undefined,
    assignedTo: r.assigned_to ? String(r.assigned_to) : undefined,
    custom: custom && Object.keys(custom).length ? custom : undefined,
  };
}

function toRow(lead: IntakeLead): Record<string, unknown> {
  return {
    name: lead.name,
    company: nullDash(lead.company),
    phone: nullDash(lead.phone),
    alt_phone: lead.altPhone?.trim() || null,
    email: nullDash(lead.email),
    city: nullDash(lead.city),
    state: nullDash(lead.state),
    status: lead.status || null,
    source: lead.source || null,
    type: lead.type || null,
    channel: lead.channel || null,
    reference_name: nullDash(lead.referenceName),
    assigned_to: lead.assignedTo?.trim() || null,
    created_by: lead.createdBy?.trim() || null,
    follow_up_date: toMysqlDate(lead.followUpDate),
    connected_date: toMysqlDate(lead.connectedDate),
    assignation_date: toMysqlDate(lead.assignationDate),
    response_time: nullDash(lead.responseTime),
    total_call_count: lead.totalCallCount ?? 0,
    call_count: lead.callCount ?? 0,
    duration: lead.duration?.trim() || null,
    form_id: lead.formId?.trim() || null,
    custom: lead.custom && Object.keys(lead.custom).length ? lead.custom : null,
    deleted: lead.deleted ? 1 : 0,
  };
}

// ---------- hydration + one-time blob migration ----------

/** Load the full leads table (active + deleted) into the cache. Runs once. */
export async function hydrateLeads(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (hydrated && !force) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      await migrateBlobIfNeeded();
      const [active, removed] = await Promise.all([
        api.listLeads({ deleted: 0 }),
        api.listLeads({ deleted: 1 }),
      ]);
      cache = sortNewestFirst([...active, ...removed].map(fromRow));
    } catch {
      // Backend offline — keep whatever is cached; readers fall back to [].
    } finally {
      hydrated = true;
      hydrating = null;
      broadcast("hydrate");
    }
  })();
  return hydrating;
}

/**
 * One-time import of the legacy app_store blob (`nexus_intake_leads`) into the
 * `leads` table. Only runs when the table is empty and the blob has rows, so it
 * can't resurrect intentionally-deleted data; guarded by a localStorage flag.
 */
async function migrateBlobIfNeeded(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    if (!isStoreReady()) return; // dbStore not loaded yet — retry on next hydrate
    const blob = dbGet<IntakeLead[]>(OLD_BLOB_KEY, []);
    if (Array.isArray(blob) && blob.length > 0) {
      const existing = await api.listLeads({ deleted: 0 });
      if (existing.length === 0) {
        for (const lead of blob) {
          try {
            await api.createLead(toRow(lead));
          } catch {
            /* skip a bad row, keep importing the rest */
          }
        }
      }
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    /* leave the flag unset so a later hydrate can retry */
  }
}

// ---------- reads ----------

export function loadIntakeLeads(): IntakeLead[] {
  return cache;
}

// ---------- builders / helpers (unchanged signatures) ----------

export function makeIntakeLead(
  partial: Partial<IntakeLead> & { name: string },
  channel: IntakeChannel,
  defaults?: { status?: string; source?: string; type?: string },
): IntakeLead {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  return {
    id: `intake-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: partial.name.trim() || "Unknown",
    company: partial.company?.trim() || "—",
    phone: partial.phone?.trim() || "—",
    altPhone: partial.altPhone?.trim() || "",
    email: partial.email?.trim() || "—",
    city: partial.city?.trim() || "—",
    state: partial.state?.trim() || "—",
    status: partial.status || defaults?.status || "New",
    source: partial.source || defaults?.source || channel,
    type: partial.type || defaults?.type || "Warm",
    followUpDate: "—",
    connectedDate: "—",
    lastUpdated: "just now",
    assignationDate: "—",
    responseTime: "—",
    referenceName: partial.referenceName?.trim() || channel,
    totalCallCount: 0,
    callCount: 0,
    duration: "0m",
    createdDate: today,
    updatedDate: today,
    createdBy: channel,
    channel,
    formId: partial.formId,
    assignedTo: partial.assignedTo,
    custom: partial.custom,
  };
}

// Find an existing captured lead that matches `lead` on any of `fields`
// (e.g. ["email","phone"]). Used to prevent duplicate inserts.
export function findDuplicate(lead: IntakeLead, fields: string[]): IntakeLead | undefined {
  if (!fields.length) return undefined;
  const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();
  return cache.find((x) =>
    fields.some((f) => {
      const a = norm((lead as unknown as Record<string, string>)[f]);
      const b = norm((x as unknown as Record<string, string>)[f]);
      return a && a !== "—" && a === b;
    }),
  );
}

// ---------- writes (optimistic cache update + backend persist) ----------

/**
 * Append one captured/created lead and broadcast. Updates the cache instantly
 * and persists to the backend, then reconciles the temp id with the real row.
 * `reason` controls the broadcast: "capture" (external intake — pages may toast)
 * or "mutate" (in-CRM create — silent).
 */
export function captureLead(lead: IntakeLead, opts?: { reason?: "capture" | "mutate" }): IntakeLead {
  cache = sortNewestFirst([lead, ...cache]);
  broadcast(opts?.reason ?? "capture");
  void persistNew(lead);
  return lead;
}

// Append many (Excel/CSV import) in one broadcast, then persist each.
export function captureMany(leads: IntakeLead[]): number {
  if (!leads.length) return 0;
  cache = sortNewestFirst([...leads, ...cache]);
  broadcast("capture");
  void Promise.all(leads.map((l) => persistNew(l)));
  return leads.length;
}

async function persistNew(lead: IntakeLead): Promise<void> {
  try {
    const saved = fromRow(await api.createLead(toRow(lead)));
    // Replace the optimistic temp-id row with the server row (real numeric id).
    cache = sortNewestFirst(cache.map((l) => (l.id === lead.id ? saved : l)));
    broadcast("mutate");
  } catch {
    /* offline — the optimistic row stays in the cache for this session */
  }
}

/** Patch a lead by id (camelCase fields). Persists to the backend. */
export function updateLead(id: string, patch: Partial<IntakeLead>): void {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const current = cache.find((l) => l.id === id);
  if (!current) return;
  const merged: IntakeLead = { ...current, ...patch, updatedDate: today, lastUpdated: "just now" };
  cache = cache.map((l) => (l.id === id ? merged : l));
  broadcast("mutate");
  if (!isServerId(id)) return; // not yet persisted (temp id) — capture will save it
  void (async () => {
    try {
      const saved = fromRow(await api.updateLead(id, toRow(merged)));
      cache = cache.map((l) => (l.id === id ? saved : l));
      broadcast("mutate");
    } catch {
      /* keep the optimistic edit */
    }
  })();
}

/** Soft-delete a lead (flag deleted = 1). */
export function removeLead(id: string): void {
  const current = cache.find((l) => l.id === id);
  if (!current) return;
  cache = cache.map((l) => (l.id === id ? { ...l, deleted: true } : l));
  broadcast("mutate");
  if (isServerId(id)) void api.deleteLead(id).catch(() => {});
}

/** Restore a soft-deleted lead. */
export function restoreLead(id: string): void {
  updateLead(id, { deleted: false });
}

// ---------- subscription ----------

// Subscribe to any change (same tab + cross tab). The callback receives the
// change reason so callers can react differently (e.g. toast only on "capture").
export function subscribeLeads(cb: (reason: LeadsChangeReason) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = (e: Event) => {
    const reason = (e as CustomEvent).detail?.reason as LeadsChangeReason | undefined;
    cb(reason ?? "mutate");
  };
  window.addEventListener(LEADS_EVENT, onLocal);
  return () => window.removeEventListener(LEADS_EVENT, onLocal);
}

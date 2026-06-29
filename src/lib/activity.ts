// Workspace audit trail ("Activity Logs").
//
// Persisted to the normalised MySQL `activity_log` table via /api/activity.
// Reads stay synchronous: the log is hydrated once into an in-memory cache (see
// hydrateActivities, called from AuthGuard at sign-in) and loadActivities()
// returns from that cache. logActivity() appends optimistically and persists in
// the background. Every change broadcasts ACTIVITY_EVENT so open views refresh.

import type { IconName } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { dbGet, isStoreReady } from "@/lib/dbStore";

export type ActivityCategory =
  | "auth"
  | "lead"
  | "setup"
  | "media"
  | "task"
  | "user"
  | "system";

export type Activity = {
  id: string;
  user: string;
  action: string;
  category: ActivityCategory;
  target?: string;
  at: string; // ISO timestamp
};

export const CATEGORY_META: Record<
  ActivityCategory,
  { label: string; icon: IconName; badge: string; dot: string }
> = {
  auth: { label: "Auth", icon: "logout", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  lead: { label: "Lead", icon: "leads", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  setup: { label: "Setup", icon: "settings", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  media: { label: "Media", icon: "media", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  task: { label: "Task", icon: "task", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  user: { label: "User", icon: "users", badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  system: { label: "System", icon: "dashboard", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

export const ACTIVITY_EVENT = "nexus-activity-changed";
const OLD_BLOB_KEY = "activity_log_v1"; // legacy app_store blob (pre-migration)
const MIGRATED_FLAG = "nexus_activity_blob_migrated_v1";
const MAX = 1000;

// ---------- in-memory cache ----------

let cache: Activity[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;

type ActivityRow = {
  id: string;
  category?: string;
  action?: string;
  actor?: string;
  meta?: { target?: string } | Record<string, never> | null;
  created_at?: string;
};

function broadcast() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
}

function toIso(dt: unknown): string {
  if (!dt) return new Date().toISOString();
  const d = new Date(String(dt).replace(" ", "T"));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
function toMysql(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fromRow(row: ActivityRow): Activity {
  const target = row.meta && typeof row.meta === "object" ? (row.meta as { target?: string }).target : undefined;
  return {
    id: String(row.id),
    user: row.actor || "System",
    action: row.action || "",
    category: (row.category as ActivityCategory) || "system",
    target: target || undefined,
    at: toIso(row.created_at),
  };
}

function toRow(a: Activity): Record<string, unknown> {
  return {
    category: a.category,
    action: a.action,
    actor: a.user,
    meta: a.target ? { target: a.target } : null,
    created_at: toMysql(a.at),
  };
}

// ---------- hydration + one-time blob migration ----------

/** Load the activity log into the cache. Runs once (call from AuthGuard). */
export async function hydrateActivities(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (hydrated && !force) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      await migrateBlobIfNeeded();
      const res = await apiRequest<{ activities: ActivityRow[] }>(`/activity?limit=${MAX}`);
      cache = (res.activities ?? []).map(fromRow);
    } catch {
      /* backend offline — keep whatever is cached */
    } finally {
      hydrated = true;
      hydrating = null;
      broadcast();
    }
  })();
  return hydrating;
}

/** One-time import of the legacy app_store blob into the activity_log table. */
async function migrateBlobIfNeeded(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    if (!isStoreReady()) return; // dbStore not ready — retry next hydrate
    const blob = dbGet<Activity[]>(OLD_BLOB_KEY, []);
    if (Array.isArray(blob) && blob.length > 0) {
      const existing = await apiRequest<{ activities: ActivityRow[] }>(`/activity?limit=1`);
      if ((existing.activities ?? []).length === 0) {
        // Oldest first so the newest keeps the highest id (matches id-desc order).
        for (const entry of [...blob].reverse()) {
          try {
            await apiRequest("/activity", { method: "POST", body: JSON.stringify(toRow(entry)) });
          } catch {
            /* skip a bad row */
          }
        }
      }
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    /* leave flag unset so a later hydrate can retry */
  }
}

// ---------- reads ----------

export function loadActivities(): Activity[] {
  return cache;
}

// ---------- writes ----------

/** Append an activity entry. Safe to call from anywhere on the client. */
export function logActivity(
  action: string,
  opts: { category?: ActivityCategory; target?: string; user?: string } = {},
): void {
  if (typeof window === "undefined") return;
  const entry: Activity = {
    id: `a-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    user: opts.user ?? readUserName(),
    action,
    category: opts.category ?? "system",
    target: opts.target,
    at: new Date().toISOString(),
  };
  cache = [entry, ...cache].slice(0, MAX);
  broadcast();
  void (async () => {
    try {
      const res = await apiRequest<{ activity: ActivityRow }>("/activity", {
        method: "POST",
        body: JSON.stringify(toRow(entry)),
      });
      const saved = fromRow(res.activity);
      cache = cache.map((a) => (a.id === entry.id ? saved : a));
      broadcast();
    } catch {
      /* offline — the optimistic entry stays for this session */
    }
  })();
}

export function clearActivities(): void {
  cache = [];
  broadcast();
  if (typeof window !== "undefined") {
    void apiRequest("/activity", { method: "DELETE" }).catch(() => {});
  }
}

export function activityUsers(list: Activity[]): string[] {
  return Array.from(new Set(list.map((a) => a.user))).sort();
}

// ---------- subscription ----------

export function subscribeActivities(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(ACTIVITY_EVENT, handler);
  return () => window.removeEventListener(ACTIVITY_EVENT, handler);
}

// ---------- helpers ----------

function readUserName(): string {
  try {
    const raw = window.localStorage.getItem("nexus_user");
    if (raw) return (JSON.parse(raw) as { name?: string }).name ?? "Unknown";
  } catch {
    /* noop */
  }
  return "System";
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

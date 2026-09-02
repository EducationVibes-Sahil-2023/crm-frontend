// Database-backed preference store for the super-admin console.
//
// The console authenticates with a super-admin JWT and never holds a workspace
// token, so it cannot use dbStore (`app_store` is per-tenant). These preferences
// live in the platform `settings` table under `superadmin_prefs`, reached via
// /api/super-admin/prefs — so the platform owner's console setup follows them
// across browsers and machines instead of sitting in one browser's storage.
//
// Same shape as dbStore: hydrate once into a cache so reads stay synchronous,
// write through on every change, and poll so another session's edits show up.

import { getSuperAdminToken } from "@/lib/superAdmin";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";
export const SA_PREFS_EVENT = "superadmin-prefs:changed";

const cache = new Map<string, unknown>();
let ready = false;
let hydrating: Promise<void> | null = null;
const pending = new Set<string>();

function emit(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SA_PREFS_EVENT));
}

function headers(token: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** True once the prefs have been read from the backend at least once. */
export function isPrefsReady(): boolean {
  return ready;
}

/** Load every console preference into the cache (one request). */
export async function hydrateSuperAdminPrefs(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (ready && !force) return;
  if (hydrating) return hydrating;
  const token = getSuperAdminToken();
  if (!token) return; // not signed in as platform owner — nothing to load
  hydrating = (async () => {
    try {
      const res = await fetch(`${API_BASE}/super-admin/prefs`, { headers: headers(token) });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const prefs = (json && typeof json.prefs === "object" && json.prefs) || {};
        for (const [k, v] of Object.entries(prefs)) {
          if (!pending.has(k)) cache.set(k, v);
        }
      }
    } catch {
      /* backend offline — readers fall back to their defaults */
    } finally {
      ready = true;
      hydrating = null;
      emit();
    }
  })();
  return hydrating;
}

/** Synchronous read from the hydrated cache, with a default fallback. */
export function prefGet<T>(key: string, fallback: T): T {
  if (!cache.has(key)) return fallback;
  const v = cache.get(key);
  return v === null || v === undefined ? fallback : (v as T);
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function put(key: string, value: unknown): Promise<void> {
  const token = getSuperAdminToken();
  if (!token) { pending.delete(key); return; }
  try {
    await fetch(`${API_BASE}/super-admin/prefs`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ [key]: value }),
    });
  } catch {
    /* offline — the cache holds the value for this session */
  } finally {
    pending.delete(key);
  }
}

/** Update the cache immediately and persist to the backend (debounced per key). */
export function prefSet<T>(key: string, value: T): void {
  cache.set(key, value);
  emit();
  if (typeof window === "undefined") return;
  pending.add(key);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => { timers.delete(key); void put(key, value); }, 400));
}

/** Clear the cache (sign-out) so the next session re-reads from the database. */
export function resetSuperAdminPrefs(): void {
  stopPrefsSync();
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  pending.clear();
  cache.clear();
  ready = false;
}

// ---- live sync ----------------------------------------------------------
// The prefs blob is small, so a poll just re-reads it whole; there is no
// per-key version to diff against as there is for the workspace store.

const SYNC_MS = 15_000;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let bound = false;

/** Re-read prefs and notify listeners if anything actually changed. */
export async function syncSuperAdminPrefs(): Promise<void> {
  if (!ready || !getSuperAdminToken()) return;
  const before = JSON.stringify([...cache.entries()].sort());
  await hydrateSuperAdminPrefs(true);
  const after = JSON.stringify([...cache.entries()].sort());
  if (before !== after) emit();
}

/** Begin polling so another session's changes reach this console. */
export function startPrefsSync(): void {
  if (typeof window === "undefined" || syncTimer) return;
  syncTimer = setInterval(() => { void syncSuperAdminPrefs(); }, SYNC_MS);
  if (!bound) {
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    bound = true;
  }
}

export function stopPrefsSync(): void {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  if (bound && typeof window !== "undefined") {
    window.removeEventListener("focus", onWake);
    document.removeEventListener("visibilitychange", onWake);
    bound = false;
  }
}

function onWake(): void {
  if (document.visibilityState === "visible") void syncSuperAdminPrefs();
}

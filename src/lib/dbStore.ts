// Generic database-backed key/value store — the replacement for browser storage.
// All app data lives in the backend `app_store` table. On sign-in the whole
// store is hydrated into an in-memory cache (so synchronous loadX() reads stay
// fast); every save writes through to the database (debounced). Nothing is
// persisted in the browser, so data is shared across devices and sessions.
//
// The cache is kept LIVE: startStoreSync() polls `GET /api/store?since=<version>`
// so writes made in another tab, another device, or by another user show up
// here within a few seconds. The cache is a read-through view of the database,
// never a separate copy of record.

import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";
export const STORE_EVENT = "appstore:changed";

const cache = new Map<string, unknown>();
let ready = false;
let hydrating: Promise<void> | null = null;

// Newest `updated_at` the server has handed us. Sent back as `?since=` so each
// poll transfers only what changed instead of the whole workspace.
let version: string | null = null;

// Keys with a debounced or in-flight write. A poll must not merge the server's
// (older) value over a local edit that hasn't landed yet, or typing would get
// reverted mid-save.
const pending = new Set<string>();

// Circuit breaker: after 3 consecutive failures, stop hitting the backend for a
// cooldown so a down/erroring API isn't hammered. One trial request is allowed
// once the cooldown passes; a success closes the circuit.
const MAX_FAILURES = 3;
const COOLDOWN_MS = 30_000;
let failures = 0;
let openUntil = 0;

function circuitOpen(): boolean {
  return Date.now() < openUntil;
}
function recordOk(): void {
  failures = 0;
  openUntil = 0;
}
function recordFail(): void {
  failures += 1;
  if (failures >= MAX_FAILURES) {
    openUntil = Date.now() + COOLDOWN_MS;
    failures = 0;
  }
}

function emit(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STORE_EVENT));
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** True once the store has been loaded from the backend at least once. */
export function isStoreReady(): boolean {
  return ready;
}

/** Load every stored blob from the backend into the cache (one request). */
export async function hydrateStore(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (ready && !force) return;
  if (hydrating) return hydrating;
  // Circuit open → don't hit the backend; let the app render with defaults.
  if (circuitOpen()) { ready = true; emit(); return; }
  hydrating = (async () => {
    try {
      const res = await fetch(`${API_BASE}/store`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const data = (json && typeof json.data === "object" && json.data) || {};
        cache.clear();
        for (const [k, v] of Object.entries(data)) cache.set(k, v);
        version = typeof json?.version === "string" ? json.version : null;
        recordOk();
      } else {
        recordFail();
      }
    } catch {
      recordFail(); // backend offline — readers fall back to their defaults
    } finally {
      ready = true;
      hydrating = null;
      emit();
    }
  })();
  return hydrating;
}

/** Synchronous read from the hydrated cache, with a default fallback. */
export function dbGet<T>(key: string, fallback: T): T {
  if (!cache.has(key)) return fallback;
  const v = cache.get(key);
  return v === null || v === undefined ? fallback : (v as T);
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function put(key: string, value: unknown): Promise<void> {
  // Circuit open → skip the write; the value stays in the session cache.
  if (circuitOpen()) { pending.delete(key); return; }
  try {
    const res = await fetch(`${API_BASE}/store/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ data: value }),
    });
    if (res.ok) recordOk(); else recordFail();
  } catch {
    recordFail(); // offline — cache holds the value; a later save may retry
  } finally {
    // Released only once the write has landed, so the next poll is free to
    // accept the server's copy of this key again.
    pending.delete(key);
  }
}

/** Update the cache immediately and persist to the backend (debounced per key). */
export function dbSet<T>(key: string, value: T): void {
  cache.set(key, value);
  emit();
  if (typeof window === "undefined") return;
  pending.add(key);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => { timers.delete(key); void put(key, value); }, 400));
}

// ---------------------------------------------------------------------------
// Live sync — keeps the cache a current view of the database
// ---------------------------------------------------------------------------

const SYNC_MS = 8_000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncing = false;
let listenersBound = false;

/**
 * Pull anything written since the last poll and merge it into the cache.
 * Returns true when something actually changed (listeners were notified).
 */
export async function syncStore(): Promise<boolean> {
  if (typeof window === "undefined" || !ready) return false;
  if (syncing || circuitOpen() || !getToken()) return false;
  syncing = true;
  try {
    const qs = version ? `?since=${encodeURIComponent(version)}` : "";
    const res = await fetch(`${API_BASE}/store${qs}`, { headers: authHeaders() });
    if (!res.ok) { recordFail(); return false; }
    const json = await res.json().catch(() => null);
    recordOk();

    const data = (json && typeof json.data === "object" && json.data) || {};
    let changed = false;
    for (const [k, v] of Object.entries(data)) {
      // A local edit for this key is still on its way to the server — the
      // value we just fetched predates it, so keep ours.
      if (pending.has(k)) continue;
      if (JSON.stringify(cache.get(k)) === JSON.stringify(v)) continue;
      cache.set(k, v);
      changed = true;
    }
    if (typeof json?.version === "string") version = json.version;
    if (changed) emit();
    return changed;
  } catch {
    recordFail();
    return false;
  } finally {
    syncing = false;
  }
}

/**
 * Begin polling the store so this tab reflects writes made elsewhere. Also
 * syncs whenever the tab regains focus, which makes coming back to a
 * backgrounded tab feel instant rather than waiting out the interval.
 * Idempotent — calling it twice does not double up the timer.
 */
export function startStoreSync(): void {
  if (typeof window === "undefined" || syncTimer) return;
  syncTimer = setInterval(() => { void syncStore(); }, SYNC_MS);
  if (!listenersBound) {
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    listenersBound = true;
  }
}

/** Stop polling (sign-out, or leaving the authenticated shell). */
export function stopStoreSync(): void {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  if (listenersBound && typeof window !== "undefined") {
    window.removeEventListener("focus", onWake);
    document.removeEventListener("visibilitychange", onWake);
    listenersBound = false;
  }
}

function onWake(): void {
  if (document.visibilityState === "visible") void syncStore();
}

/** Clear the cache (e.g. on sign-out) so the next session re-hydrates. */
export function resetStore(): void {
  stopStoreSync();
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  pending.clear();
  cache.clear();
  version = null;
  ready = false;
}

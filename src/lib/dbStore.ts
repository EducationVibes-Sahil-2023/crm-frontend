// Generic database-backed key/value store — the replacement for localStorage.
// All app data lives in the backend `app_store` table. On sign-in the whole
// store is hydrated once into an in-memory cache (so synchronous loadX() reads
// stay fast); every save writes through to the database (debounced). Nothing is
// persisted in the browser, so data is shared across devices and sessions.

import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";
export const STORE_EVENT = "appstore:changed";

const cache = new Map<string, unknown>();
let ready = false;
let hydrating: Promise<void> | null = null;

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
  if (circuitOpen()) return;
  try {
    const res = await fetch(`${API_BASE}/store/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ data: value }),
    });
    if (res.ok) recordOk(); else recordFail();
  } catch {
    recordFail(); // offline — cache holds the value; a later save may retry
  }
}

/** Update the cache immediately and persist to the backend (debounced per key). */
export function dbSet<T>(key: string, value: T): void {
  cache.set(key, value);
  emit();
  if (typeof window === "undefined") return;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => { timers.delete(key); void put(key, value); }, 400));
}

/** Clear the cache (e.g. on sign-out) so the next session re-hydrates. */
export function resetStore(): void {
  cache.clear();
  ready = false;
}

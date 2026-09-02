// Work types (WFH / Office / Outside) and geofenced office locations.
// Defined by the admin; used by Attendance to allow/deny geofenced logins.
// Persisted to normalised MySQL tables (`work_types`, `locations`) via
// /api/work-types and /api/work-locations — not a JSON blob.
//
// Reads stay synchronous from an in-memory cache (hydrated at sign-in by
// AuthGuard); writes go to the backend and broadcast LOCATIONS_EVENT.

import { apiRequest } from "@/lib/api";
import { dbGet, dbSet, isStoreReady } from "@/lib/dbStore";

export type WorkType = { id: string; name: string; geofenced: boolean; color: string };

export const DEFAULT_WORK_TYPES: WorkType[] = [
  { id: "office", name: "Office", geofenced: true, color: "blue" },
  { id: "wfh", name: "WFH", geofenced: false, color: "emerald" },
  { id: "outside", name: "Outside", geofenced: false, color: "amber" },
];

export type WorkLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // metres
  address: string;
};

export const DEFAULT_LOCATIONS: WorkLocation[] = [
  { id: "mumbai", name: "Mumbai HQ", latitude: 19.0606, longitude: 72.8362, radius: 100, address: "Bandra Kurla Complex, Mumbai" },
  { id: "bengaluru", name: "Bengaluru Center", latitude: 12.9352, longitude: 77.6245, radius: 100, address: "Koramangala, Bengaluru" },
];

// Legacy app_store blobs, imported once into the new tables.
const OLD_TYPES_KEY = "work_types_v1";
const OLD_LOC_KEY = "work_locations_v1";
const MIGRATED_FLAG = "work_locations_blob_migrated_v1";

export const LOCATIONS_EVENT = "nexus-locations-changed";

function broadcast(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCATIONS_EVENT));
}

let typeCache: WorkType[] = [];
let locCache: WorkLocation[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;

/**
 * One-time import of the legacy blobs. Only runs when the tables are empty and
 * the blob has rows, so it cannot resurrect a list the admin deliberately
 * cleared. The flag lives in the workspace store, so this happens once per
 * workspace rather than once per browser.
 */
async function migrateBlobIfNeeded(): Promise<void> {
  try {
    if (dbGet<boolean>(MIGRATED_FLAG, false)) return;
    if (!isStoreReady()) return; // dbStore not loaded yet — retry on next hydrate

    const oldTypes = dbGet<WorkType[]>(OLD_TYPES_KEY, []);
    if (Array.isArray(oldTypes) && oldTypes.length > 0) {
      const existing = await apiRequest<{ workTypes: WorkType[] }>("/work-types");
      if ((existing.workTypes ?? []).length === 0) {
        await apiRequest("/work-types", { method: "PUT", body: JSON.stringify({ workTypes: oldTypes }) });
      }
    }

    const oldLocs = dbGet<WorkLocation[]>(OLD_LOC_KEY, []);
    if (Array.isArray(oldLocs) && oldLocs.length > 0) {
      const existing = await apiRequest<{ locations: WorkLocation[] }>("/work-locations");
      if ((existing.locations ?? []).length === 0) {
        await apiRequest("/work-locations", { method: "PUT", body: JSON.stringify({ locations: oldLocs }) });
      }
    }

    dbSet(MIGRATED_FLAG, true);
  } catch {
    /* leave the flag unset so a later hydrate can retry */
  }
}

/** Pull work types + locations from the database. Called by AuthGuard at sign-in. */
export async function hydrateLocations(): Promise<void> {
  if (typeof window === "undefined") return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      await migrateBlobIfNeeded();
      const [t, l] = await Promise.all([
        apiRequest<{ workTypes: WorkType[] }>("/work-types"),
        apiRequest<{ locations: WorkLocation[] }>("/work-locations"),
      ]);
      typeCache = Array.isArray(t.workTypes) ? t.workTypes : [];
      locCache = Array.isArray(l.locations) ? l.locations : [];
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

/** True once work types/locations have been read from the backend at least once. */
export function locationsReady(): boolean {
  return hydrated;
}

export function loadWorkTypes(): WorkType[] {
  // The built-in set is the fallback for a workspace that has never configured
  // work types — Attendance needs at least one to offer at check-in.
  return typeCache.length ? typeCache.map((x) => ({ ...x })) : DEFAULT_WORK_TYPES.map((x) => ({ ...x }));
}

export function saveWorkTypes(t: WorkType[]): void {
  typeCache = t;
  broadcast();
  void apiRequest("/work-types", { method: "PUT", body: JSON.stringify({ workTypes: t }) })
    .catch(() => { /* offline — the cache holds it for this session */ });
}

export function loadLocations(): WorkLocation[] {
  return locCache.length ? locCache.map((x) => ({ ...x })) : DEFAULT_LOCATIONS.map((x) => ({ ...x }));
}

export function saveLocations(l: WorkLocation[]): void {
  locCache = l;
  broadcast();
  void apiRequest("/work-locations", { method: "PUT", body: JSON.stringify({ locations: l }) })
    .catch(() => { /* offline */ });
}

/** Subscribe to work-type/location changes. Returns an unsubscribe function. */
export function subscribeLocations(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOCATIONS_EVENT, cb);
  return () => window.removeEventListener(LOCATIONS_EVENT, cb);
}

/** Great-circle distance in metres (Haversine). */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export type NearestResult = { location: WorkLocation; distance: number; within: boolean } | null;

/** Closest configured office to a point, and whether it's within that office's radius. */
export function nearestLocation(lat: number, lng: number): NearestResult {
  const locs = loadLocations();
  if (!locs.length) return null;
  let best = locs[0];
  let bestDist = distanceMeters(lat, lng, best.latitude, best.longitude);
  for (const l of locs.slice(1)) {
    const d = distanceMeters(lat, lng, l.latitude, l.longitude);
    if (d < bestDist) { best = l; bestDist = d; }
  }
  return { location: best, distance: bestDist, within: bestDist <= best.radius };
}

/** Promise wrapper around the browser geolocation API. */
export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

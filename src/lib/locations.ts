// Work types (WFH / Office / Outside) and geofenced office locations.
// Defined by the admin; used by Attendance to allow/deny geofenced logins.

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

const TYPES_KEY = "work_types_v1";
const LOC_KEY = "work_locations_v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadWorkTypes(): WorkType[] {
  const t = read<WorkType[]>(TYPES_KEY, []);
  return Array.isArray(t) && t.length ? t : DEFAULT_WORK_TYPES.map((x) => ({ ...x }));
}
export function saveWorkTypes(t: WorkType[]): void {
  write(TYPES_KEY, t);
}

export function loadLocations(): WorkLocation[] {
  const l = read<WorkLocation[]>(LOC_KEY, []);
  return Array.isArray(l) && l.length ? l : DEFAULT_LOCATIONS.map((x) => ({ ...x }));
}
export function saveLocations(l: WorkLocation[]): void {
  write(LOC_KEY, l);
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

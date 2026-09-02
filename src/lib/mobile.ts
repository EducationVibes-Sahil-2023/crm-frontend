// Mobile app: security (face lock / app lock) + live location tracking helpers.

import { dbGet, dbSet } from "@/lib/dbStore";

export type AppSecurity = {
  appLock: boolean;
  pin: string; // 4 digits
  biometric: boolean; // fingerprint unlock
  faceLock: boolean;
  faceEnrolled: boolean;
  autoLockMin: number; // lock after N idle minutes
  lockOnBackground: boolean;
  liveTracking: boolean; // allow background GPS tracking
};

export const DEFAULT_SECURITY: AppSecurity = {
  appLock: false, pin: "", biometric: true, faceLock: false, faceEnrolled: false,
  autoLockMin: 5, lockOnBackground: true, liveTracking: true,
};

const KEY = "app_security_v1";

// Persisted in the workspace database (app_store) rather than the browser, so
// the lock settings a user configures follow their account to any device.
export function loadSecurity(): AppSecurity {
  return { ...DEFAULT_SECURITY, ...dbGet<Partial<AppSecurity>>(KEY, {}) };
}
export function saveSecurity(s: AppSecurity): void {
  dbSet(KEY, s);
}

// ---------- live tracking ----------

export type TrackPoint = { lat: number; lng: number; at: number; accuracy?: number; speed?: number | null };

export function watchLocation(
  onUpdate: (p: TrackPoint) => void,
  onError: (msg: string) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("Geolocation is not supported by this browser.");
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude, at: pos.timestamp, accuracy: pos.coords.accuracy, speed: pos.coords.speed }),
    (err) => onError(err.message || "Unable to get your location."),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** OpenStreetMap embed URL centred on a point with a marker (no API key needed). */
export function osmEmbed(lat: number, lng: number, d = 0.004): string {
  const bbox = `${(lng - d).toFixed(5)},${(lat - d).toFixed(5)},${(lng + d).toFixed(5)},${(lat + d).toFixed(5)}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function fmtCoord(n: number): string {
  return n.toFixed(6);
}
export function fmtAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

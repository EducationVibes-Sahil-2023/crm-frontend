// Super-admin display profile (photo, title, phone). The login identity
// (name / email / password) stays in the DB-backed credentials; this is the
// presentational profile shown in the header + dropdown. Persisted globally in
// MySQL (`settings.superadmin_profile` via /api/super-admin/profile) so it
// follows the owner across browsers/devices — no localStorage. Reads stay sync
// via an in-memory cache hydrated once at sign-in (hydrateSuperAdminProfile()).

import { useEffect, useState } from "react";
import { getSuperAdminToken } from "@/lib/superAdmin";

export type SuperAdminProfile = {
  avatar: string | null; // data URL
  title: string;         // role / title shown under the name
  phone: string;
};

export const DEFAULT_SA_PROFILE: SuperAdminProfile = { avatar: null, title: "", phone: "" };

const EVENT = "superadmin-profile:updated";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

// Synchronous in-memory cache — filled by hydrateSuperAdminProfile() at sign-in
// so the many sync callers of loadSuperAdminProfile() stay sync.
let cache: SuperAdminProfile | null = null;

function broadcast() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Pull the profile from the DB into the cache. Call once when the console loads. */
export async function hydrateSuperAdminProfile(): Promise<void> {
  if (typeof window === "undefined") return;
  const token = getSuperAdminToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/super-admin/profile`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const p = (await res.json().catch(() => null)) as Partial<SuperAdminProfile> | null;
    if (p) {
      cache = { ...DEFAULT_SA_PROFILE, ...p };
      broadcast();
    }
  } catch {
    /* offline — keep defaults */
  }
}

export function loadSuperAdminProfile(): SuperAdminProfile {
  return cache ? { ...cache } : { ...DEFAULT_SA_PROFILE };
}

export function saveSuperAdminProfile(p: SuperAdminProfile): void {
  if (typeof window === "undefined") return;
  cache = { ...p };
  broadcast();
  const token = getSuperAdminToken();
  if (!token) return;
  // Persist in the background — the cache already reflects the change.
  void fetch(`${API_BASE_URL}/super-admin/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(p),
  }).catch(() => { /* ignore — retried on next save */ });
}

/** Live super-admin profile — re-renders on save (same tab + other tabs). */
export function useSuperAdminProfile(): SuperAdminProfile {
  const [p, setP] = useState<SuperAdminProfile>(loadSuperAdminProfile);
  useEffect(() => {
    const read = () => setP(loadSuperAdminProfile());
    read();
    window.addEventListener(EVENT, read);
    return () => { window.removeEventListener(EVENT, read); };
  }, []);
  return p;
}

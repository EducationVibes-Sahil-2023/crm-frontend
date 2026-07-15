// Super-admin display profile (photo, title, phone). The login identity
// (name / email / password) stays in the DB-backed credentials; this is the
// presentational profile shown in the header + dropdown. Per-browser localStorage.

import { useEffect, useState } from "react";

export type SuperAdminProfile = {
  avatar: string | null; // data URL
  title: string;         // role / title shown under the name
  phone: string;
};

export const DEFAULT_SA_PROFILE: SuperAdminProfile = { avatar: null, title: "", phone: "" };

const KEY = "super_admin_profile_v1";
const EVENT = "superadmin-profile:updated";

export function loadSuperAdminProfile(): SuperAdminProfile {
  if (typeof window === "undefined") return { ...DEFAULT_SA_PROFILE };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SA_PROFILE, ...(JSON.parse(raw) as Partial<SuperAdminProfile>) } : { ...DEFAULT_SA_PROFILE };
  } catch {
    return { ...DEFAULT_SA_PROFILE };
  }
}

export function saveSuperAdminProfile(p: SuperAdminProfile): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Live super-admin profile — re-renders on save (same tab + other tabs). */
export function useSuperAdminProfile(): SuperAdminProfile {
  const [p, setP] = useState<SuperAdminProfile>(DEFAULT_SA_PROFILE);
  useEffect(() => {
    const read = () => setP(loadSuperAdminProfile());
    read();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === KEY) read(); };
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", onStorage); };
  }, []);
  return p;
}

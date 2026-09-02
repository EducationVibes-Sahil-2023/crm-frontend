// Super Admin (platform owner) session — separate from tenant user auth.
// A second, elevated login that gates the /super-admin console.
// In production this is a real platform-level account on the master DB.

import { useEffect, useState } from "react";

const KEY = "super_admin_session_v1";
const JWT_KEY = "super_admin_jwt";

// Fired whenever the session changes (login / logout / credential update), so
// the header + profile dropdown re-render live without a page reload.
export const SUPER_ADMIN_EVENT = "superadmin:updated";
function notifySuperAdmin(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SUPER_ADMIN_EVENT));
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

// Pre-filled email on the login form only. Credentials are validated SERVER-SIDE
// against the DB (`settings.superadmin`, .env fallback) — no password is baked
// into the bundle, so the frontend and backend can never drift out of sync.
export const SUPER_ADMIN_DEMO = {
  email: process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? "superadmin@crm-cloud.app",
  name: process.env.NEXT_PUBLIC_SUPER_ADMIN_NAME ?? "Platform Owner",
};

export type SuperAdminSession = { email: string; name: string; at: string };

/**
 * Authenticate against the backend. On success the server returns a super-admin
 * JWT which we cache (so protected APIs work) alongside the console session.
 */
export async function superAdminLogin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/super-admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.token) {
      return { ok: false, error: data?.messages?.error ?? "Invalid super admin credentials." };
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify({ email: data.email, name: data.name, at: new Date().toISOString() } satisfies SuperAdminSession));
      window.localStorage.setItem(JWT_KEY, data.token);
      // Mutually exclusive with the client (tenant) login — clear any client
      // session so the two never coexist in the same browser. (Keys mirror
      // lib/auth.ts; cleared directly to avoid an import cycle.)
      window.localStorage.removeItem("nexus_token");
      window.localStorage.removeItem("nexus_user");
      notifySuperAdmin();
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection." };
  }
}

/**
 * Change the super-admin credentials (persisted to the DB). Requires the current
 * password for re-authentication.
 */
export async function superAdminChangeCredentials(input: {
  currentPassword: string;
  email?: string;
  password?: string;
  name?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const token = getSuperAdminToken();
  if (!token) return { ok: false, error: "Not signed in." };
  try {
    const res = await fetch(`${API_BASE_URL}/super-admin/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.messages?.error ?? "Could not update credentials." };
    // Reflect the new email/name in the cached console session.
    if (typeof window !== "undefined" && data?.email) {
      window.localStorage.setItem(KEY, JSON.stringify({ email: data.email, name: data.name, at: new Date().toISOString() } satisfies SuperAdminSession));
      notifySuperAdmin();
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

export function getSuperAdmin(): SuperAdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SuperAdminSession) : null;
  } catch {
    return null;
  }
}

export function isSuperAdmin(): boolean {
  return getSuperAdmin() !== null;
}

/** Live super-admin session — re-renders on login/logout/credential change. */
export function useSuperAdmin(): SuperAdminSession | null {
  const [sa, setSa] = useState<SuperAdminSession | null>(null);
  useEffect(() => {
    const read = () => setSa(getSuperAdmin());
    read();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === KEY) read(); };
    window.addEventListener(SUPER_ADMIN_EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(SUPER_ADMIN_EVENT, read); window.removeEventListener("storage", onStorage); };
  }, []);
  return sa;
}

export function superAdminLogout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(JWT_KEY);
  // Drop the cached console preferences too, so the next owner to sign in on
  // this machine loads their own from the database rather than seeing these.
  void import("@/lib/superAdminPrefs").then((m) => m.resetSuperAdminPrefs());
  notifySuperAdmin();
}

// ---- JWT bridge for protected APIs (e.g. Gmail) ----
// The super-admin JWT is minted by the backend at login (superAdminLogin) and
// cached here. Protected APIs read it via getSuperAdminToken(). No password is
// ever stored client-side, so there's nothing to drift out of sync.

export function getSuperAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(JWT_KEY);
}

/**
 * Return the cached super-admin JWT (set at login). Resolves to null when the
 * platform owner isn't signed in — callers then fall back to the regular CRM
 * token or simply leave the super-admin-only feature disabled.
 */
export async function ensureSuperAdminToken(): Promise<string | null> {
  return getSuperAdminToken();
}

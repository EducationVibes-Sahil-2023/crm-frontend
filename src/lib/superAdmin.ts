// Super Admin (platform owner) session — separate from tenant user auth.
// A second, elevated login that gates the /super-admin console.
// In production this is a real platform-level account on the master DB.

const KEY = "super_admin_session_v1";
const JWT_KEY = "super_admin_jwt";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

// Must match the backend's superadmin.email / superadmin.password — defaults to
// superadmin@crm-cloud.app / super123. Override via frontend .env.local
// (NEXT_PUBLIC_SUPER_ADMIN_EMAIL / _NAME / _PASSWORD) and keep the backend
// .env superadmin.* in sync. This is what mints the super-admin JWT used for
// Gmail, Mail and provisioning, and what shows in the console sidebar.
export const SUPER_ADMIN_DEMO = {
  email: process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? "superadmin@crm-cloud.app",
  password: process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD ?? "super123",
  name: process.env.NEXT_PUBLIC_SUPER_ADMIN_NAME ?? "Platform Owner",
};

export type SuperAdminSession = { email: string; name: string; at: string };

export function superAdminLogin(email: string, password: string): { ok: boolean; error?: string } {
  if (email.trim().toLowerCase() === SUPER_ADMIN_DEMO.email.toLowerCase() && password === SUPER_ADMIN_DEMO.password) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify({ email: SUPER_ADMIN_DEMO.email, name: SUPER_ADMIN_DEMO.name, at: new Date().toISOString() } satisfies SuperAdminSession));
    }
    return { ok: true };
  }
  return { ok: false, error: "Invalid super admin credentials." };
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

export function superAdminLogout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(JWT_KEY);
}

// ---- JWT bridge for protected APIs (e.g. Gmail) ----
// The console session is localStorage-only; protected backend APIs need a JWT.
// We mint one (sub: super-admin) by exchanging the known console credentials.

export function getSuperAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(JWT_KEY);
}

/** Ensure a super-admin JWT is cached, minting one from the backend if needed. */
export async function ensureSuperAdminToken(): Promise<string | null> {
  const existing = getSuperAdminToken();
  if (existing) return existing;
  try {
    const res = await fetch(`${API_BASE_URL}/super-admin/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: SUPER_ADMIN_DEMO.email, password: SUPER_ADMIN_DEMO.password }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data?.token && typeof window !== "undefined") {
      window.localStorage.setItem(JWT_KEY, data.token);
      return data.token as string;
    }
  } catch {
    /* backend offline — Gmail features just stay disconnected */
  }
  return null;
}

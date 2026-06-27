import { logActivity } from "@/lib/activity";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

// Shown as a hint on the login page; the real check happens in the backend.
export const DEMO_CREDENTIALS = {
  email: "admin@nexus.com",
  password: "admin123",
};

const TOKEN_KEY = "nexus_token";
const USER_KEY = "nexus_user";

export type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  role?: string;
  active?: boolean;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  avatar?: string | null;
  twofa_enabled?: boolean;
};

export type LoginResult =
  | { status: "ok"; user: User }
  | { status: "2fa"; challenge: string; name: string }
  | { status: "error"; error: string };

function persistSession(data: { token: string; user: User }): User {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, data.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  logActivity("Signed in", { category: "auth", user: data.user.name });
  return data.user;
}

export async function login(identifier: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: identifier.trim(), password }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = data?.messages?.error ?? data?.error ?? "Login failed. Please try again.";
      return { status: "error", error: String(error) };
    }
    if (data?.twofa_required) {
      return { status: "2fa", challenge: String(data.challenge), name: String(data.name ?? "") };
    }
    return { status: "ok", user: persistSession(data) };
  } catch {
    return { status: "error", error: "Cannot reach the server. Is the backend running on :8080?" };
  }
}

/**
 * Self-service recovery — ask the backend to email a reset link. Resolves to a
 * generic message regardless of whether the email is registered (the backend
 * never reveals that). `devResetUrl` is only present in non-production when SMTP
 * isn't configured, so the link can still be followed locally.
 */
export async function requestPasswordReset(email: string): Promise<{ message: string; devResetUrl?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.messages?.error ?? data?.error ?? "Couldn't start password recovery.");
    }
    return { message: String(data?.message ?? "If an account exists, a reset link is on its way."), devResetUrl: data?.devResetUrl };
  } catch (e) {
    if (e instanceof Error && e.message !== "Failed to fetch") throw e;
    throw new Error("Cannot reach the server. Is the backend running on :8080?");
  }
}

/** Complete recovery — set a new password using the emailed token. */
export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.messages?.error ?? data?.error ?? "Couldn't reset your password.");
    }
    return { message: String(data?.message ?? "Your password has been reset.") };
  } catch (e) {
    if (e instanceof Error && e.message !== "Failed to fetch") throw e;
    throw new Error("Cannot reach the server. Is the backend running on :8080?");
  }
}

/** Complete a 2-step login with the authenticator code. */
export async function verifyTwoFactor(challenge: string, code: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, code }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error = data?.messages?.error ?? data?.error ?? "Verification failed.";
      return { status: "error", error: String(error) };
    }
    return { status: "ok", user: persistSession(data) };
  } catch {
    return { status: "error", error: "Cannot reach the server." };
  }
}

export async function logout(): Promise<void> {
  logActivity("Signed out", { category: "auth", user: getUser()?.name });
  const token = getToken();
  if (token) {
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }
}

/**
 * Start a CRM session from a token minted elsewhere (e.g. super-admin
 * "Login as client" impersonation). Overwrites any current session.
 */
export function setImpersonatedSession(token: string, user: User): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  logActivity("Entered client workspace", { category: "auth", user: user.name });
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function isAdmin(): boolean {
  return (getUser()?.role ?? "").toLowerCase() === "administrator";
}

/** Merge changes into the stored user (e.g. from the profile editor). */
export function updateUser(changes: Partial<User>): User | null {
  if (typeof window === "undefined") return null;
  const current = getUser();
  if (!current) return null;
  const next = { ...current, ...changes };
  window.localStorage.setItem(USER_KEY, JSON.stringify(next));
  return next;
}

export type SessionState = "ok" | "inactive" | "invalid" | "offline";

/**
 * Verifies the session against the backend. Drives real-time forced logout:
 * "inactive" means an admin deactivated this account, "invalid" means the token
 * is gone/expired. "offline" (network/5xx) must NOT log the user out.
 */
export async function checkSession(): Promise<SessionState> {
  const token = getToken();
  if (!token) return "invalid";
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) return "invalid";
    if (res.status === 403) return "inactive";
    if (!res.ok) return "offline";
    const data = await res.json().catch(() => null);
    if (data?.user && typeof window !== "undefined") {
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return "ok";
  } catch {
    return "offline";
  }
}

// ---- self-service two-step verification ----

async function authedJson<T>(path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function setup2fa(): Promise<{ secret: string; otpauth_uri: string }> {
  return authedJson("/auth/2fa/setup");
}

export async function enable2fa(code: string): Promise<void> {
  await authedJson("/auth/2fa/enable", { code });
  updateUser({ twofa_enabled: true });
}

export async function disable2fa(): Promise<void> {
  await authedJson("/auth/2fa/disable");
  updateUser({ twofa_enabled: false });
}

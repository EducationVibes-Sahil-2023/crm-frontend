// Calls the backend that provisions a real, isolated database per client.
// Authenticated with the super-admin JWT (the platform-owner console session).

import { ensureSuperAdminToken } from "@/lib/superAdmin";
import { DB_HOST, REGIONS, type Plan, type Tenant, type TenantStatus } from "@/lib/tenants";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type ProvisionResult = {
  database: string;
  dbHost: string;
  alreadyExisted: boolean;
  adminSeeded: boolean;
  adminEmail: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Up to 3 attempts. Retries only transient failures (network error or 5xx);
// client errors (4xx — auth/validation) fail immediately since a retry won't help.
async function call<T>(path: string, init: RequestInit, retries = 3): Promise<T> {
  const token = await ensureSuperAdminToken();
  const opts: RequestInit = {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers as Record<string, string>) },
  };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, opts);
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (res.ok) return data as T;
      lastErr = new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
      if (res.status >= 400 && res.status < 500) break; // client error — don't retry
    } catch (e) {
      lastErr = e; // network/parse error — retry
    }
    if (attempt < retries) await sleep(300 * attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request failed");
}

/** Create the client's database, its users table, and seed the admin login. */
export function provisionTenant(t: Tenant): Promise<ProvisionResult> {
  return call<ProvisionResult>("/tenants/provision", {
    method: "POST",
    body: JSON.stringify({
      company: t.company,
      subdomain: t.subdomain,
      dbName: t.dbName,
      adminName: t.adminName,
      adminEmail: t.adminEmail,
      password: t.tempPassword,
      plan: t.plan,
      region: t.region,
      status: t.status,
      storageGb: t.storageGb,
    }),
  });
}

/** Update a client's registry record (company, plan, status, admin, etc.). */
export function updateTenant(
  database: string,
  patch: Partial<{ company: string; plan: string; status: string; adminName: string; adminEmail: string; region: string; storageGb: number }>,
): Promise<{ updated: boolean; database: string }> {
  return call("/tenants/update", { method: "POST", body: JSON.stringify({ database, ...patch }) });
}

export type ImpersonateResult = {
  token: string;
  tenant: string;
  user: { id: number; name: string; username: string; email: string; role: string; active: boolean; twofa_enabled: boolean };
};

/** Super-admin mints a CRM session for a client database (direct login). */
export function impersonateTenant(database: string): Promise<ImpersonateResult> {
  return call<ImpersonateResult>("/tenants/impersonate", { method: "POST", body: JSON.stringify({ database }) });
}

/** Reset a client admin's login password (super-admin account recovery). */
export function resetTenantPassword(
  database: string,
  password: string,
  adminEmail?: string,
): Promise<{ reset: boolean; database: string; adminEmail: string; adminName: string }> {
  return call("/tenants/reset-password", {
    method: "POST",
    body: JSON.stringify({ database, password, ...(adminEmail ? { adminEmail } : {}) }),
  });
}

export function dropTenant(database: string): Promise<{ database: string }> {
  return call("/tenants/drop", { method: "POST", body: JSON.stringify({ database }) });
}

export function listTenantDbs(): Promise<{ databases: { database: string; users: number }[]; count: number }> {
  return call("/tenants", { method: "GET" });
}

// A client as the backend sees it: the registry row joined with the live DB.
export type ServerClient = {
  company: string;
  slug: string;
  database: string;
  adminName: string;
  adminEmail: string;
  plan: string;
  region: string;
  status: string;
  storageGb: number;
  active: boolean;
  users: number;
  exists: boolean;
  createdAt: string | null;
  lastLoginAt: string | null; // last real client login (not impersonation)
};

type TenantsList = { databases: { database: string; users: number }[]; clients: ServerClient[]; count: number };

// De-dupe concurrent loads — callers that fire at the same time share one request.
let _listInflight: Promise<TenantsList> | null = null;

/** Live list of provisioned clients (registry + databases) for the console. */
export function listTenants(): Promise<TenantsList> {
  if (_listInflight) return _listInflight;
  _listInflight = call<TenantsList>("/tenants", { method: "GET" }).finally(() => { _listInflight = null; });
  return _listInflight;
}

const PLAN_LABELS: Record<string, Plan> = { free: "Free", starter: "Starter", pro: "Pro", professional: "Pro", enterprise: "Enterprise" };
const STATUSES: TenantStatus[] = ["Active", "Trial", "Suspended"];

/** Map a backend client row to the UI Tenant shape (database is the source of truth). */
export function serverClientToTenant(s: ServerClient): Tenant {
  const status = (STATUSES as string[]).includes(s.status) ? (s.status as TenantStatus) : (s.active ? "Active" : "Suspended");
  return {
    id: s.database,
    company: s.company || s.slug,
    subdomain: s.slug,
    adminName: s.adminName || "",
    adminEmail: s.adminEmail,
    plan: PLAN_LABELS[(s.plan || "").toLowerCase()] ?? "Starter",
    status,
    region: s.region || REGIONS[0],
    dbName: s.database,
    dbHost: DB_HOST,
    users: s.users,
    storageGb: s.storageGb ?? 0,
    createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
    // Last time the client signed in themselves (super-admin impersonation
    // doesn't count). "—" until they've logged in at least once.
    lastActive: s.lastLoginAt
      ? new Date(s.lastLoginAt.replace(" ", "T")).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "—",
  };
}

// Calls the backend that provisions a real, isolated database per client.
// Authenticated with the super-admin JWT (the platform-owner console session).

import { ensureSuperAdminToken } from "@/lib/superAdmin";
import type { Tenant } from "@/lib/tenants";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type ProvisionResult = {
  database: string;
  dbHost: string;
  alreadyExisted: boolean;
  adminSeeded: boolean;
  adminEmail: string;
};

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const token = await ensureSuperAdminToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers as Record<string, string>) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  return data as T;
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
    }),
  });
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
  adminEmail: string;
  plan: string;
  active: boolean;
  users: number;
  exists: boolean;
  createdAt: string | null;
};

/** Live list of provisioned clients (registry + databases) for the console. */
export function listTenants(): Promise<{ databases: { database: string; users: number }[]; clients: ServerClient[]; count: number }> {
  return call("/tenants", { method: "GET" });
}

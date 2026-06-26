// Multi-tenant platform: the super admin provisions client workspaces, each with
// its own database. Client-side/localStorage to match the rest of the dashboard;
// in production these records live in a master DB and creation triggers a real
// `CREATE DATABASE tenant_<slug>` + migration run on the backend.

export type Plan = "Free" | "Starter" | "Pro" | "Enterprise";
export const PLANS: Plan[] = ["Free", "Starter", "Pro", "Enterprise"];
export const PLAN_PRICE: Record<Plan, number> = { Free: 0, Starter: 29, Pro: 79, Enterprise: 199 };
export const PLAN_STYLE: Record<Plan, string> = {
  Free: "bg-slate-100 text-slate-600",
  Starter: "bg-sky-100 text-sky-700",
  Pro: "bg-blue-100 text-blue-700",
  Enterprise: "bg-violet-100 text-violet-700",
};

export type TenantStatus = "Active" | "Trial" | "Suspended";
export const STATUS_STYLE: Record<TenantStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Trial: "bg-amber-100 text-amber-700",
  Suspended: "bg-rose-100 text-rose-700",
};

export const REGIONS = ["ap-south-1 (Mumbai)", "ap-southeast-1 (Singapore)", "us-east-1 (N. Virginia)", "eu-west-1 (Ireland)"];
export const DB_HOST = "db.crm-cloud.app";

export type Tenant = {
  id: string;
  company: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
  plan: Plan;
  status: TenantStatus;
  region: string;
  dbName: string;
  dbHost: string;
  users: number;
  storageGb: number;
  createdAt: string;
  lastActive: string;
  // Generated login the super admin shares with the client (demo: stored so it
  // can be re-shown and tested). In production, never store plaintext.
  tempPassword?: string;
};

const BASE_DOMAIN = "nexuscrm.in";

/** The client's CRM sign-in URL (subdomain workspace). */
export function loginUrl(t: Pick<Tenant, "subdomain">): string {
  return `https://${slugify(t.subdomain) || "app"}.${BASE_DOMAIN}/login`;
}

/** Generate a readable, reasonably strong temporary password. */
export function genPassword(): string {
  const words = ["Nexus", "Cloud", "Bright", "Swift", "Prime", "Orbit", "Vault", "Pulse"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  const sym = "!@#$%&*"[Math.floor(Math.random() * 7)];
  return `${w}${n}${sym}`;
}

/** A ready-to-send welcome message containing the client's CRM credentials. */
export function welcomeMessage(t: Tenant, brandName = "Nexus CRM"): string {
  return [
    `Hi ${t.adminName || "there"},`,
    ``,
    `Welcome to ${brandName}! Your workspace for ${t.company} is ready.`,
    ``,
    `Sign in here: ${loginUrl(t)}`,
    `Email: ${t.adminEmail}`,
    `Temporary password: ${t.tempPassword ?? "—"}`,
    ``,
    `Plan: ${t.plan}. Please change your password after your first sign-in.`,
    ``,
    `Need help getting started? Just reply to this email and our team will assist.`,
    ``,
    `— The ${brandName} Team`,
  ].join("\n");
}

const KEY = "platform_tenants_v1";

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
}
export function dbNameFor(subdomain: string): string {
  return `tenant_${slugify(subdomain) || "client"}`;
}

function seed(t: Omit<Tenant, "dbName" | "dbHost"> & { dbHost?: string }): Tenant {
  return { dbHost: DB_HOST, dbName: dbNameFor(t.subdomain), ...t };
}

const DEFAULT_TENANTS: Tenant[] = [
  seed({ id: "t-acme", company: "Acme Education", subdomain: "acme", adminName: "Rajesh Kumar", adminEmail: "admin@acme.edu", plan: "Pro", status: "Active", region: REGIONS[0], users: 42, storageGb: 18, createdAt: "Jan 12, 2026", lastActive: "2h ago" }),
  seed({ id: "t-brightpath", company: "BrightPath Academy", subdomain: "brightpath", adminName: "Sneha Iyer", adminEmail: "it@brightpath.in", plan: "Enterprise", status: "Active", region: REGIONS[0], users: 128, storageGb: 64, createdAt: "Feb 03, 2026", lastActive: "10m ago" }),
  seed({ id: "t-globex", company: "Globex Tutorials", subdomain: "globex", adminName: "David Chen", adminEmail: "ops@globex.io", plan: "Starter", status: "Trial", region: REGIONS[2], users: 7, storageGb: 2, createdAt: "Jun 18, 2026", lastActive: "1d ago" }),
  seed({ id: "t-nexus", company: "Nexus Coaching", subdomain: "nexus", adminName: "Priya Nair", adminEmail: "admin@nexus.co", plan: "Pro", status: "Active", region: REGIONS[1], users: 36, storageGb: 12, createdAt: "Mar 22, 2026", lastActive: "5h ago" }),
  seed({ id: "t-orbit", company: "Orbit Institute", subdomain: "orbit", adminName: "Marcus Thorne", adminEmail: "admin@orbit.edu", plan: "Free", status: "Suspended", region: REGIONS[3], users: 3, storageGb: 1, createdAt: "Apr 09, 2026", lastActive: "21d ago" }),
];

export function loadTenants(): Tenant[] {
  if (typeof window === "undefined") return DEFAULT_TENANTS.map((t) => ({ ...t }));
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TENANTS.map((t) => ({ ...t }));
    const parsed = JSON.parse(raw) as Tenant[];
    return Array.isArray(parsed) ? parsed : DEFAULT_TENANTS.map((t) => ({ ...t }));
  } catch {
    return DEFAULT_TENANTS.map((t) => ({ ...t }));
  }
}
export function saveTenants(list: Tenant[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function mrr(list: Tenant[]): number {
  return list.filter((t) => t.status === "Active").reduce((s, t) => s + PLAN_PRICE[t.plan], 0);
}
export function planCounts(list: Tenant[]): Record<Plan, number> {
  const c: Record<Plan, number> = { Free: 0, Starter: 0, Pro: 0, Enterprise: 0 };
  for (const t of list) c[t.plan]++;
  return c;
}
export function fmtMoney(n: number): string {
  return `$${n.toLocaleString()}`;
}

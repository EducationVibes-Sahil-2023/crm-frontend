// Roles & Permissions — managed in Admin Setup, mapped onto each user profile.
//
// Role definitions are stored in the backend (the `app_store` table via dbStore),
// so they are shared across every device and every login in the workspace — a
// user signing in on any machine gets the permissions their admin defined. The
// store is hydrated once at sign-in (see AuthGuard), so the synchronous
// loadRoles() reads below hit the in-memory cache.

import { dbGet, dbSet } from "@/lib/dbStore";

export const MODULES: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "tasks", label: "Task Management" },
  { key: "communication", label: "Communication" },
  { key: "operations", label: "Operations" },
  { key: "financial", label: "Financial" },
  { key: "users", label: "Users" },
  { key: "adminSetup", label: "Admin Setup" },
];

export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type Action = (typeof ACTIONS)[number];
export type Perm = Record<Action, boolean>;

export type Role = {
  id: string;
  name: string;
  color: string; // a key from setup COLORS
  description: string;
  system?: boolean; // protected from deletion
  permissions: Record<string, Perm>; // moduleKey -> perm
};

// Roles & permissions start EMPTY — there is no demo data. The admin defines
// roles from Admin Setup → Roles & Permissions. (Module access in the app is
// gated by the workspace plan, not these roles, so an empty list is safe.)
export const DEFAULT_ROLES: Role[] = [];

const STORAGE_KEY = "admin_roles_v1";

function normalize(role: Partial<Role> & { name: string }): Role {
  const permissions: Record<string, Perm> = {};
  for (const m of MODULES) {
    const p = role.permissions?.[m.key];
    permissions[m.key] = {
      view: !!p?.view,
      create: !!p?.create,
      edit: !!p?.edit,
      delete: !!p?.delete,
    };
  }
  return {
    id: role.id ?? role.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: role.name,
    color: role.color ?? "blue",
    description: role.description ?? "",
    system: role.system,
    permissions,
  };
}

function cloneDefaults(): Role[] {
  return DEFAULT_ROLES.map((r) => normalize(r));
}

export function loadRoles(): Role[] {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const parsed = dbGet<Role[]>(STORAGE_KEY, []);
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneDefaults();
    return parsed.map((r) => normalize(r));
  } catch {
    return cloneDefaults();
  }
}

export function saveRoles(roles: Role[]): void {
  if (typeof window === "undefined") return;
  dbSet(STORAGE_KEY, roles);
}

export function roleNames(): string[] {
  return loadRoles().map((r) => r.name);
}

export function getRole(name: string): Role | undefined {
  return loadRoles().find((r) => r.name === name);
}

export function countGranted(role: Role): number {
  return countMatrix(role.permissions);
}

export const TOTAL_PERMS = MODULES.length * ACTIONS.length;

/** A blank permission matrix (all actions false for every module). */
export function emptyMatrix(): Record<string, Perm> {
  return Object.fromEntries(
    MODULES.map((m) => [m.key, { view: false, create: false, edit: false, delete: false }]),
  );
}

/** Count granted actions across a permission matrix. */
export function countMatrix(matrix: Record<string, Perm>): number {
  return MODULES.reduce(
    (sum, m) => sum + ACTIONS.filter((a) => matrix[m.key]?.[a]).length,
    0,
  );
}

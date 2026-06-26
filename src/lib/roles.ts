// Roles & Permissions — managed in Admin Setup, mapped onto each user profile.

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

function perm(view: boolean, create: boolean, edit: boolean, del: boolean): Perm {
  return { view, create, edit, delete: del };
}
const NONE = () => perm(false, false, false, false);
const VIEW = () => perm(true, false, false, false);
const FULL = () => perm(true, true, true, true);
const WRITE = () => perm(true, true, true, false);

function build(maker: (key: string) => Perm): Record<string, Perm> {
  return Object.fromEntries(MODULES.map((m) => [m.key, maker(m.key)]));
}

export const DEFAULT_ROLES: Role[] = [
  {
    id: "administrator",
    name: "Administrator",
    color: "rose",
    description: "Full access to every module and all settings.",
    system: true,
    permissions: build(() => FULL()),
  },
  {
    id: "manager",
    name: "Manager",
    color: "violet",
    description: "Manage records across modules, without admin configuration.",
    permissions: build((k) => (k === "adminSetup" ? VIEW() : k === "users" ? WRITE() : FULL())),
  },
  {
    id: "sales-rep",
    name: "Sales Rep",
    color: "blue",
    description: "Work leads and tasks; read-only elsewhere.",
    permissions: build((k) =>
      k === "leads" || k === "tasks"
        ? WRITE()
        : k === "adminSetup" || k === "users"
          ? NONE()
          : VIEW(),
    ),
  },
  {
    id: "support-agent",
    name: "Support Agent",
    color: "amber",
    description: "Handle operations and communication queues.",
    permissions: build((k) =>
      k === "operations" || k === "communication"
        ? WRITE()
        : k === "adminSetup" || k === "users"
          ? NONE()
          : VIEW(),
    ),
  },
  {
    id: "viewer",
    name: "Viewer",
    color: "slate",
    description: "Read-only access to operational modules.",
    permissions: build((k) => (k === "adminSetup" || k === "users" ? NONE() : VIEW())),
  },
];

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
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as Role[];
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneDefaults();
    return parsed.map((r) => normalize(r));
  } catch {
    return cloneDefaults();
  }
}

export function saveRoles(roles: Role[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
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

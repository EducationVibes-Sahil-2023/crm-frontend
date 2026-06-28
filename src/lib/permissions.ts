// Role-based access control — the single source of truth for "what can the
// signed-in user see and do". Role definitions (the permission matrix per
// module) live in the backend store (see roles.ts); this module turns a user +
// their role into an effective matrix and answers can(module, action) questions.
//
// Enforcement built on top of this:
//   • Sidebar    — hides nav items whose module the user can't `view`
//   • RouteGuard — blocks pages whose module the user can't `view`
//   • Pages      — hide create / edit / delete actions per permission
//
// Administrators (and the platform super-admin) bypass every check.

import {
  ACTIONS,
  MODULES,
  emptyMatrix,
  type Action,
  type Perm,
} from "@/lib/roles";

export type Matrix = Record<string, Perm>;

const FULL: Perm = { view: true, create: true, edit: true, delete: true };

/** A matrix that grants every action on every module (admin / super-admin). */
export function fullMatrix(): Matrix {
  return Object.fromEntries(MODULES.map((m) => [m.key, { ...FULL }]));
}

/** Roles that always get unrestricted access, regardless of the matrix. */
export function isAdminRole(role?: string | null): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return r === "administrator" || r === "admin" || r === "owner";
}

/** Union two permission matrices (used to layer per-user extra grants on top of a role). */
export function mergeMatrix(base: Matrix, extra?: Matrix | null): Matrix {
  if (!extra) return { ...emptyMatrix(), ...base };
  const out: Matrix = {};
  for (const m of MODULES) {
    const b = base[m.key];
    const e = extra[m.key];
    out[m.key] = {
      view: !!(b?.view || e?.view),
      create: !!(b?.create || e?.create),
      edit: !!(b?.edit || e?.edit),
      delete: !!(b?.delete || e?.delete),
    };
  }
  return out;
}

/** Does a matrix grant `action` on `module`? */
export function allows(matrix: Matrix, moduleKey: string, action: Action): boolean {
  return !!matrix[moduleKey]?.[action];
}

export { ACTIONS, MODULES };
export type { Action, Perm };

/**
 * Map a route href to the permission module that gates it. `null` means the
 * page is always visible (core pages like the user's own profile, the knowledge
 * base, HR self-service, etc. — anything not represented by a role module).
 *
 * Mirrors the structure of access.ts's hrefFeature() so the two gates compose.
 */
export function hrefModule(href: string): string | null {
  const h = href.toLowerCase();

  if (h === "/" || h === "") return null;
  if (h === "/dashboard" || h.startsWith("/assistant")) return "dashboard";

  // Leads & the lead pipeline
  if (
    h.startsWith("/leads") ||
    h.startsWith("/forms") ||
    h.startsWith("/lead-transfers") ||
    h.startsWith("/visitor-tracker") ||
    h.startsWith("/follow-ups") ||
    h.startsWith("/lead-visitor") ||
    h.startsWith("/reports/leads")
  ) {
    return "leads";
  }

  if (h.startsWith("/tasks")) return "tasks";

  // Communication
  if (
    h.startsWith("/gmail") ||
    h.startsWith("/chat") ||
    h.startsWith("/whatsapp") ||
    h.startsWith("/media") ||
    h.startsWith("/announcement")
  ) {
    return "communication";
  }

  // Operations
  if (
    h.startsWith("/calendar") ||
    h.startsWith("/call-tracker") ||
    h.startsWith("/downloads") ||
    h.startsWith("/live-tracking") ||
    h.startsWith("/app-security") ||
    h.startsWith("/support-ticket")
  ) {
    return "operations";
  }

  // Financial — accounts, assets, inventory, vendors
  if (
    h.startsWith("/account") ||
    h.startsWith("/invoices") ||
    h.startsWith("/payments") ||
    h.startsWith("/quotations") ||
    h.startsWith("/expenses") ||
    h.startsWith("/bills") ||
    h.startsWith("/ledger") ||
    h.startsWith("/asset") ||
    h.startsWith("/inventory") ||
    h.startsWith("/vendors") ||
    h.startsWith("/reports/inventory") ||
    h.startsWith("/reports/sales")
  ) {
    return "financial";
  }

  // Administration
  if (h.startsWith("/users") || h.startsWith("/activity-logs")) return "users";
  if (h.startsWith("/admin-setup") || h.startsWith("/subscription")) return "adminSetup";

  // Everything else (HR self-service, knowledge base, profile, reports overview,
  // super-admin which is gated separately) is always visible.
  return null;
}

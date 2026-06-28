"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
import { directoryApi } from "@/lib/directoryApi";
import { emptyMatrix, loadRoles, type Action, type Perm } from "@/lib/roles";
import { fullMatrix, isAdminRole, mergeMatrix, type Matrix } from "@/lib/permissions";

type PermissionsState = {
  perms: Matrix;
  isAdmin: boolean;
  ready: boolean;
};

const PermissionsContext = createContext<PermissionsState>({
  perms: fullMatrix(),
  isAdmin: true,
  ready: false,
});

/**
 * Compute the signed-in user's effective permissions from their role. Runs
 * synchronously against the already-hydrated role store (AuthGuard waits for the
 * store before rendering the app, so loadRoles() returns real data here).
 *
 * Per-user "extra" grants (set in the Add/Edit User form) live in the team
 * directory and are layered on asynchronously once that loads.
 */
function computeFromRole(): PermissionsState {
  const user = getUser();
  // Admins and the platform super-admin bypass every check.
  if (!user) return { perms: emptyMatrix(), isAdmin: false, ready: true };
  if (isSuperAdmin() || isAdminRole(user.role)) {
    return { perms: fullMatrix(), isAdmin: true, ready: true };
  }
  const role = loadRoles().find((r) => r.name === user.role);
  return { perms: { ...emptyMatrix(), ...(role?.permissions ?? {}) }, isAdmin: false, ready: true };
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  // The provider only renders once AuthGuard has hydrated the role store and the
  // user is signed in, so the initializer below resolves real permissions.
  const [state, setState] = useState<PermissionsState>(computeFromRole);

  useEffect(() => {
    if (state.isAdmin) return; // admins already have everything

    // Layer this user's per-user extra grants (from their directory entry) on top.
    let active = true;
    (async () => {
      try {
        const email = getUser()?.email?.toLowerCase();
        if (!email) return;
        const rows = await directoryApi.list();
        const me = rows.find((r) => r.email?.toLowerCase() === email);
        const extra = me?.extraPermissions as Matrix | undefined;
        if (active && extra) {
          setState((s) => ({ ...s, perms: mergeMatrix(s.perms, extra) }));
        }
      } catch {
        // directory unreachable — fall back to role-only permissions
      }
    })();
    return () => {
      active = false;
    };
  }, [state.isAdmin]);

  return <PermissionsContext.Provider value={state}>{children}</PermissionsContext.Provider>;
}

export type Permissions = {
  /** Whether the user may perform `action` on `module`. */
  can: (moduleKey: string, action: Action) => boolean;
  /** The user's full effective permission matrix. */
  perms: Matrix;
  /** True for administrators / super-admins (unrestricted). */
  isAdmin: boolean;
  /** True once permissions have been resolved. */
  ready: boolean;
};

export function usePermissions(): Permissions {
  const { perms, isAdmin, ready } = useContext(PermissionsContext);
  const can = (moduleKey: string, action: Action): boolean =>
    isAdmin || !!perms[moduleKey]?.[action];
  return { can, perms, isAdmin, ready };
}

/** Convenience guard for a single action — renders children only when allowed. */
export function Can({
  module: moduleKey,
  action,
  children,
}: {
  module: string;
  action: Action;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  return can(moduleKey, action) ? <>{children}</> : null;
}

export type { Perm };

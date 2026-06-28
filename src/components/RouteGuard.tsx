"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { hrefModule } from "@/lib/permissions";
import { usePermissions } from "@/components/PermissionsProvider";

/**
 * Page-level access control. Blocks the current route when the signed-in user's
 * role can't `view` the module that owns it. Sits inside the app layout, so it
 * only ever runs for an authenticated user with permissions already resolved.
 */
export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, ready } = usePermissions();

  const moduleKey = hrefModule(pathname);
  // Not yet resolved, or the page isn't permission-gated → show it.
  if (!ready || moduleKey === null || can(moduleKey, "view")) {
    return <>{children}</>;
  }

  return <AccessDenied />;
}

function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <Icon name="shield" className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-500">
          You don&apos;t have permission to view this page. If you think this is a
          mistake, ask your administrator to update your role.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Icon name="dashboard" className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

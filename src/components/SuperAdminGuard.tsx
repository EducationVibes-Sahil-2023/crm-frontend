"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSuperAdmin } from "@/lib/superAdmin";

/** Gates the /super-admin console behind the elevated super-admin login. */
export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin()) {
      router.replace("/admin/login");
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <svg className="h-7 w-7 animate-spin text-slate-700" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      </div>
    );
  }

  return <>{children}</>;
}

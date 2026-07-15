"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSuperAdmin } from "@/lib/superAdmin";
import { hydrateSuperAdminProfile } from "@/lib/superAdminProfile";

/** Gates the /super-admin console behind the elevated super-admin login. */
export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!isSuperAdmin()) {
        router.replace("/admin/login");
        return;
      }
      void hydrateSuperAdminProfile(); // fill the profile cache from the DB
      setChecked(true);
    };
    check();
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

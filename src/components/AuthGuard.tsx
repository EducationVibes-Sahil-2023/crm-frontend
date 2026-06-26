"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, checkSession, logout } from "@/lib/auth";

// How often to re-verify the session against the backend.
const POLL_MS = 15_000;

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setChecked(true);

    let active = true;

    async function verify() {
      const state = await checkSession();
      if (!active) return;
      // "offline" / "ok" keep the session; only a real signal logs out.
      if (state === "inactive" || state === "invalid") {
        if (state === "inactive" && typeof window !== "undefined") {
          window.localStorage.setItem("nexus_logout_reason", "deactivated");
        }
        await logout();
        router.replace("/login");
      }
    }

    verify();
    const id = window.setInterval(verify, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") verify();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <svg className="h-7 w-7 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      </div>
    );
  }

  return <>{children}</>;
}

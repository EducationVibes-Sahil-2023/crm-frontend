"use client";

// Mobile (phones-only) app shell. The mobile product is framed as TWO apps —
// HRMS and Call Tracker — with an app launcher / switcher. This component renders
// the context-aware bottom navigation plus the full-screen launcher overlay that
// lets you jump between the two apps. Desktop is untouched (everything is
// `lg:hidden`). Mounted once in (app)/layout.tsx.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { getUser } from "@/lib/auth";

type AppKey = "hrms" | "calls";

type AppDef = {
  key: AppKey;
  name: string;
  tagline: string;
  home: string;
  icon: IconName;
  grad: string; // tailwind gradient for the launcher tile
  tabs: { label: string; href: string; icon: IconName; match: string }[];
};

const APPS: AppDef[] = [
  {
    key: "hrms",
    name: "HRMS",
    tagline: "Attendance, leave & pay",
    home: "/hrms",
    icon: "users",
    grad: "from-blue-600 to-indigo-600",
    tabs: [
      { label: "Home", href: "/hrms", icon: "users", match: "/hrms" },
      { label: "Attendance", href: "/attendance", icon: "clock", match: "/attendance" },
      { label: "Leaves", href: "/leaves", icon: "calendar", match: "/leaves" },
      { label: "Payslips", href: "/payslips", icon: "fileText", match: "/payslips" },
    ],
  },
  {
    key: "calls",
    name: "Call Tracker",
    tagline: "Calls matched to leads",
    home: "/call-tracker",
    icon: "call",
    grad: "from-emerald-600 to-teal-600",
    tabs: [{ label: "Calls", href: "/call-tracker", icon: "call", match: "/call-tracker" }],
  },
];

// Routes that belong to the HRMS app (so the HRMS bottom bar stays visible on
// sub-pages like /payroll, /holidays, etc.).
const HRMS_ROUTES = [
  "/hrms", "/attendance", "/leaves", "/payroll", "/payslips", "/holidays",
  "/policies", "/awards", "/engagement", "/posts", "/medical", "/letters", "/admin-setup",
];

function matches(path: string, route: string): boolean {
  return path === route || path.startsWith(route + "/");
}
function activeAppFor(path: string): AppDef | null {
  if (matches(path, "/call-tracker")) return APPS[1];
  if (HRMS_ROUTES.some((r) => matches(path, r))) return APPS[0];
  return null;
}

export default function MobileShell({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [launcher, setLauncher] = useState(false);

  const app = useMemo(() => activeAppFor(pathname), [pathname]);

  // Close the launcher whenever navigation lands somewhere new.
  useEffect(() => { setLauncher(false); }, [pathname]);

  const openApp = useCallback((a: AppDef) => {
    setLauncher(false);
    router.push(a.home);
  }, [router]);

  return (
    <>
      {/* Bottom navigation (phones only) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(0,0,0,0.05)] backdrop-blur lg:hidden">
        {(app?.tabs ?? []).map((t) => {
          const active = matches(pathname, t.match);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? "text-blue-600" : "text-slate-500"
              }`}
            >
              <Icon name={t.icon} className="h-5 w-5" filled={active} />
              {t.label}
            </Link>
          );
        })}
        {/* App switcher — always present so you can hop between the two apps. */}
        <button
          onClick={() => setLauncher(true)}
          aria-label="Switch app"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
            launcher ? "text-blue-600" : "text-slate-500"
          }`}
        >
          <Icon name="grid" className="h-5 w-5" />
          Apps
        </button>
      </nav>

      {launcher && <Launcher current={app?.key ?? null} onOpenApp={openApp} onMenu={onMenu} onClose={() => setLauncher(false)} />}
    </>
  );
}

function Launcher({
  current,
  onOpenApp,
  onMenu,
  onClose,
}: {
  current: AppKey | null;
  onOpenApp: (a: AppDef) => void;
  onMenu?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("there");
  const [role, setRole] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u?.name) setName(u.name.split(" ")[0]);
    setRole(u?.designation || u?.role || "");
    setAvatar(u?.avatar ?? null);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur lg:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-base font-bold text-white ring-2 ring-white/30">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-sm font-semibold text-white">Hi, {name}</p>
            {role && <p className="text-xs text-slate-400">{role}</p>}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-300 hover:bg-white/10">
          <Icon name="close" className="h-6 w-6" />
        </button>
      </div>

      {/* App tiles */}
      <div className="flex flex-1 flex-col justify-center px-6">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Your apps</p>
        <div className="grid grid-cols-2 gap-4">
          {APPS.map((a) => (
            <button
              key={a.key}
              onClick={() => onOpenApp(a)}
              className={`group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br ${a.grad} p-4 text-white shadow-xl ring-1 ring-white/10 transition active:scale-95`}
            >
              <span className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_25%_15%,white,transparent_45%)]" />
              {current === a.key && (
                <span className="absolute right-3 top-3 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-white/40">
                  Open
                </span>
              )}
              <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/25">
                <Icon name={a.icon} className="h-8 w-8" />
              </span>
              <div className="relative text-center">
                <p className="text-base font-bold leading-tight">{a.name}</p>
                <p className="mt-0.5 text-[11px] text-white/80">{a.tagline}</p>
              </div>
            </button>
          ))}
        </div>

        {onMenu && (
          <button
            onClick={() => { onClose(); onMenu(); }}
            className="mx-auto mt-8 flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-300 transition active:scale-95"
          >
            <Icon name="menu" className="h-4 w-4" /> All modules &amp; settings
          </button>
        )}
      </div>

      <p className="pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-[11px] text-slate-500">Nexus · tap an app to switch</p>
    </div>
  );
}

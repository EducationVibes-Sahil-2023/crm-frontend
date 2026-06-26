"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import SuperAdminGuard from "@/components/SuperAdminGuard";
import SuperAdminNotifications from "@/components/SuperAdminNotifications";
import { useToast } from "@/components/Toast";
import { getSuperAdmin, superAdminLogout } from "@/lib/superAdmin";
import { usePlatform } from "@/lib/platform";
import { initials } from "@/lib/branding";

const NAV: { href: string; label: string; icon: IconName; desc: string }[] = [
  { href: "/admin", label: "Overview", icon: "dashboard", desc: "Platform pulse" },
  { href: "/admin/clients", label: "Clients", icon: "briefcase", desc: "Workspaces & DBs" },
  { href: "/admin/demos", label: "Demos", icon: "calendar", desc: "Booked walkthroughs" },
  { href: "/admin/mail", label: "Mail", icon: "gmail", desc: "Platform inbox" },
  { href: "/admin/settings", label: "Settings", icon: "settings", desc: "Branding & config" },
];

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperAdminGuard>
      <Chrome>{children}</Chrome>
    </SuperAdminGuard>
  );
}

function Chrome({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const sa = getSuperAdmin();
  const brand = usePlatform().brand;
  const appName = brand.name || "Nexus CRM";
  const logoUrl = brand.logoUrl || null;
  const logoMark = brand.logoText || initials(appName);
  const logoBg = brand.logoBg || brand.primaryColor || "#2563eb";
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const current = NAV.find((n) => active(n.href));

  function signOut() {
    superAdminLogout();
    toast.info("Signed out", "Super admin session ended.");
    router.replace("/admin/login");
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-white text-slate-600">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-[18px]">
        <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl text-base font-bold text-white shadow-md shadow-indigo-500/25" style={{ backgroundColor: logoBg }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied brand logo, arbitrary host
            <img src={logoUrl} alt={appName} className="h-full w-full object-cover" />
          ) : (
            logoMark
          )}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">{appName}</p>
          <p className="truncate text-[11px] leading-tight text-slate-400">Super Admin · Control Center</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Manage</p>
        {NAV.map((n) => {
          const on = active(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                on ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {on && <span className="absolute left-0 top-1/2 h-6 -translate-y-1/2 w-1 rounded-r-full bg-indigo-600" />}
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${on ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"}`}>
                <Icon name={n.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block leading-tight">{n.label}</span>
                <span className={`block text-[11px] leading-tight ${on ? "text-indigo-400" : "text-slate-400"}`}>{n.desc}</span>
              </span>
            </Link>
          );
        })}

        <p className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Shortcuts</p>
        <a href="/" target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-slate-200"><Icon name="export" className="h-[18px] w-[18px]" /></span>
          <span className="flex-1">Visit live site</span>
        </a>
      </nav>

      {/* User + sign out */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-bold text-white">
            {(sa?.name ?? "SA").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-800">{sa?.name ?? "Super Admin"}</p>
            <p className="truncate text-[10px] text-slate-400">{sa?.email}</p>
          </div>
          <button onClick={signOut} title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
            <Icon name="logout" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar — menu + title on mobile, notification bell on every size */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-2 text-sm font-bold text-slate-800 lg:hidden">
            <Icon name={current?.icon ?? "shield"} className="h-4 w-4 text-indigo-600" /> {current?.label ?? "Super Admin"}
          </span>
          <div className="ml-auto">
            <SuperAdminNotifications />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

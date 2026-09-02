"use client";

import { createElement, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import SuperAdminGuard from "@/components/SuperAdminGuard";
import SuperAdminNotifications from "@/components/SuperAdminNotifications";
import AdminMenuCustomizer from "@/components/AdminMenuCustomizer";
import { useToast } from "@/components/Toast";
import { useSuperAdmin, superAdminLogout } from "@/lib/superAdmin";
import { useSuperAdminProfile } from "@/lib/superAdminProfile";
import { usePlatform } from "@/lib/platform";
import { initials } from "@/lib/branding";
import { useAdminMenu, tint, type AdminMenuItem, type IconAnim } from "@/lib/adminMenu";
import { getLucide } from "@/lib/lucideIcons";
import {
  hydrateSuperAdminPrefs, prefGet, prefSet, startPrefsSync, stopPrefsSync, SA_PREFS_EVENT,
} from "@/lib/superAdminPrefs";

const COLLAPSE_KEY = "admin_sidebar_collapsed";

// Quick actions — one-tap shortcuts pinned above the nav (icons are fixed;
// visibility is toggled from the customizer).
const QUICK_ACTIONS: { href: string; label: string; icon: string }[] = [
  { href: "/admin/clients", label: "New client", icon: "user-plus" },
  { href: "/admin/mail", label: "Compose", icon: "send" },
  { href: "/admin/demos", label: "Book demo", icon: "calendar-plus" },
  { href: "/", label: "Live site", icon: "external-link" },
];

/** Render a lucide menu icon by its stored key, with outline/filled weight. */
function Lu({ name, size, filled }: { name: string; size: number; filled: boolean }) {
  return createElement(getLucide(name), { size, strokeWidth: filled ? 2.6 : 1.8 });
}

/** Motion class for an icon given the chosen animation + whether it's active. */
function animClass(anim: IconAnim, active: boolean): string {
  if (anim === "none") return "";
  if (anim === "pulse") return active ? "nx-ico nx-ico-pulse" : "nx-ico";
  return `nx-ico nx-ico-${anim}`;
}

/** Super-admin avatar: the uploaded photo, or accent-tinted initials. */
function SaAvatar({ src, name, accent, size }: { src: string | null; name: string; accent: string; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, backgroundColor: accent, fontSize: Math.round(size * 0.36) }}>
      {(name || "SA").slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function AdminChrome({ children }: { children: React.ReactNode }) {
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
  const sa = useSuperAdmin();
  const saProfile = useSuperAdminProfile();
  const brand = usePlatform().brand;
  // No hardcoded "Nexus CRM" fallback — show the configured brand name only, and
  // nothing (just the logo) when it's blank or "logo only" is on.
  const brandName = brand.name.trim();
  const logoUrl = brand.logoUrl || null;
  const favicon = brand.favicon || null; // square brand mark — used in the collapsed rail
  const logoMark = brand.logoText || initials(brandName || "CRM");
  const logoBg = brand.logoBg || brand.primaryColor || "#2563eb";

  const [menu, setMenu, resetMenu] = useAdminMenu();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  // Header profile dropdown (top-right), like the client topbar.
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!acctOpen) return;
    const onDoc = (e: MouseEvent) => { if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [acctOpen]);
  // Desktop sidebar collapse (icon rail). Stored with the rest of the console
  // preferences in the platform database, so the rail state follows the owner
  // to any machine. Hydrating also fills the menu customization cache.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let active = true;
    const read = () => { if (active) setCollapsed(prefGet(COLLAPSE_KEY, false)); };
    void hydrateSuperAdminPrefs().then(read);
    startPrefsSync();
    window.addEventListener(SA_PREFS_EVENT, read);
    return () => {
      active = false;
      window.removeEventListener(SA_PREFS_EVENT, read);
      stopPrefsSync();
    };
  }, []);
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c;
    prefSet(COLLAPSE_KEY, next);
    return next;
  });

  const { side, align, accent, sidebarBg, textColor, iconStyle, iconAnim, density, showDescriptions, showQuickActions } = menu;
  const filled = iconStyle === "filled";
  const compact = density === "compact";
  const visible = menu.items.filter((i) => !i.hidden);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const current = visible.find((n) => active(n.href));

  // Group consecutive items that share a section into one labelled block, so
  // reordering across groups in the customizer still renders sensible headings.
  const groups: { section: string; items: AdminMenuItem[] }[] = [];
  for (const it of visible) {
    const last = groups[groups.length - 1];
    if (last && last.section === it.section) last.items.push(it);
    else groups.push({ section: it.section, items: [it] });
  }

  function signOut() {
    superAdminLogout();
    toast.info("Signed out", "Super admin session ended.");
    router.replace("/admin/login");
  }

  const itemPadY = compact ? "py-1.5" : "py-2.5";
  const chipSize = compact ? "h-7 w-7" : "h-8 w-8";

  const sidebarEl = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col" style={{ backgroundColor: sidebarBg, color: textColor }}>
      {/* Brand — fixed height so it lines up exactly with the top bar. */}
      <div className={`flex h-16 items-center border-b border-slate-100 ${isCollapsed ? "justify-center px-2" : "gap-3 px-5"}`}>
        {isCollapsed ? (
          // Collapsed rail: a compact square mark. Prefer the favicon (square by
          // design), then the logo, then the initials tile.
          favicon || logoUrl ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl p-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied brand mark, arbitrary host */}
              <img src={favicon || logoUrl!} alt={brandName || "Logo"} className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold text-white shadow-md shadow-indigo-500/25" style={{ backgroundColor: logoBg }}>
              {logoMark}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
            </span>
          )
        ) : logoUrl ? (
          <span
            className="flex max-h-12 shrink-0 items-center justify-center p-1"
            style={{ width: `${Math.round(140 * (brand.logoWidth ?? 100) / 100)}px`, height: `${Math.round(44 * (brand.logoHeight ?? 100) / 100)}px` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied brand logo, arbitrary host */}
            <img src={logoUrl} alt={brandName || "Logo"} className="max-h-full max-w-full object-contain" />
          </span>
        ) : (
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-base font-bold text-white shadow-md shadow-indigo-500/25" style={{ backgroundColor: logoBg }}>
            {logoMark}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          </span>
        )}
        {!brand.logoOnly && !isCollapsed && (
          <div className="min-w-0 flex-1">
            {brandName && <p className="truncate text-sm font-bold leading-tight" style={{ color: textColor }}>{brandName}</p>}
            <p className="truncate text-[11px] leading-tight text-slate-400">Super Admin · Control Center</p>
          </div>
        )}
        {!isCollapsed && (
          <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden">
            <Icon name="close" className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Quick actions */}
      {showQuickActions && !isCollapsed && (
        <div className="border-b border-slate-100 px-3 py-3">
          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((q) => {
              const external = q.href === "/";
              return (
                <Link
                  key={q.label}
                  href={q.href}
                  onClick={() => setOpen(false)}
                  {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="group flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm" style={{ color: accent }}>
                    <span className={animClass(iconAnim, false)}><Lu name={q.icon} size={14} filled={filled} /></span>
                  </span>
                  <span className="truncate">{q.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {groups.map((group, gi) => (
          <div key={`${group.section}-${gi}`} className="pb-1">
            {group.section && !isCollapsed && (
              <p className={`px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 ${align === "center" ? "text-center" : ""}`}>{group.section}</p>
            )}
            {isCollapsed && gi > 0 && <div className="mx-2 my-1.5 border-t border-slate-100" />}
            {group.items.map((n) => {
              const on = active(n.href);
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  title={isCollapsed ? n.label : undefined}
                  style={on ? { backgroundColor: tint(accent, 0.1), color: accent } : undefined}
                  className={`group relative flex items-center rounded-xl text-sm font-medium transition ${
                    isCollapsed ? "justify-center px-0 py-2" : `gap-3 px-3 ${itemPadY} ${align === "center" ? "justify-center" : ""}`
                  } ${on ? "" : "hover:bg-black/5"}`}
                >
                  {on && !isCollapsed && (
                    <span
                      className={`absolute top-1/2 h-6 -translate-y-1/2 w-1 ${side === "right" ? "right-0 rounded-l-full" : "left-0 rounded-r-full"}`}
                      style={{ backgroundColor: accent }}
                    />
                  )}
                  <span
                    className={`flex ${chipSize} shrink-0 items-center justify-center rounded-lg transition`}
                    style={on ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: tint(n.color, 0.12), color: n.color }}
                  >
                    <span className={animClass(iconAnim, on)}><Lu name={n.icon} size={compact ? 16 : 18} filled={filled} /></span>
                  </span>
                  {!isCollapsed && (
                    <span className={align === "center" ? "min-w-0 text-center" : "min-w-0 flex-1"}>
                      <span className="block leading-tight">{n.label}</span>
                      {showDescriptions && n.desc && (
                        <span className="block text-[11px] leading-tight" style={{ color: on ? tint(accent, 0.65) : undefined }}>
                          <span className={on ? "" : "text-slate-400"}>{n.desc}</span>
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Profile & account controls */}
      <div className="relative border-t border-slate-100 p-3">
        {profileOpen && (
          <div className={`overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg ${isCollapsed ? "absolute bottom-full left-2 z-50 mb-2 w-52" : "mb-2"}`}>
            <Link
              href="/admin/profile"
              onClick={() => { setProfileOpen(false); setOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Icon name="eye" className="h-[18px] w-[18px] text-slate-400" /> View profile
            </Link>
            <button
              onClick={() => { setCustomize(true); setProfileOpen(false); setOpen(false); }}
              className="flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Icon name="edit" className="h-[18px] w-[18px] text-slate-400" /> Customize menu
            </button>
            <Link
              href="/admin/settings"
              onClick={() => { setProfileOpen(false); setOpen(false); }}
              className="flex items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Icon name="settings" className="h-[18px] w-[18px] text-slate-400" /> Account settings
            </Link>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Icon name="export" className="h-[18px] w-[18px] text-slate-400" /> Visit live site
            </a>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <Icon name="logout" className="h-[18px] w-[18px]" /> Sign out
            </button>
          </div>
        )}
        <button
          onClick={() => setProfileOpen((v) => !v)}
          title={isCollapsed ? (sa?.name ?? "Super Admin") : undefined}
          className={`flex w-full items-center rounded-xl bg-slate-50 transition hover:bg-slate-100 ${isCollapsed ? "justify-center p-2" : "gap-3 p-2.5 text-left"}`}
        >
          {saProfile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={saProfile.avatar} alt={sa?.name ?? "SA"} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: accent }}>
              {(sa?.name ?? "SA").slice(0, 2).toUpperCase()}
            </span>
          )}
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800">{sa?.name ?? "Super Admin"}</p>
                <p className="truncate text-[10px] text-slate-400">{saProfile.title || sa?.email}</p>
              </div>
              <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-400 transition ${profileOpen ? "rotate-180" : ""}`} />
            </>
          )}
        </button>
      </div>
    </div>
  );

  const menuBtn = (
    <button onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden">
      <Icon name="menu" className="h-5 w-5" />
    </button>
  );

  // Desktop-only collapse toggle for the docked sidebar.
  const collapseBtn = (
    <button
      onClick={toggleCollapsed}
      title={collapsed ? "Expand menu" : "Collapse menu"}
      aria-label={collapsed ? "Expand menu" : "Collapse menu"}
      className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 lg:inline-flex"
    >
      <Icon name="menu" className="h-5 w-5" />
    </button>
  );

  const sidebarWidth = collapsed ? "w-16" : "w-64";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar — docked per config, collapsible to an icon rail */}
      <aside className={`fixed inset-y-0 z-40 hidden transition-[width] duration-200 lg:block ${sidebarWidth} ${side === "right" ? "right-0 border-l border-slate-200" : "left-0 border-r border-slate-200"}`}>{sidebarEl(collapsed)}</aside>

      {/* Mobile drawer — slides in from the configured side (always expanded) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className={`absolute inset-y-0 w-64 shadow-2xl ${side === "right" ? "right-0" : "left-0"}`}>{sidebarEl(false)}</aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${side === "right" ? (collapsed ? "lg:pr-16" : "lg:pr-64") : (collapsed ? "lg:pl-16" : "lg:pl-64")}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6">
          {side === "left" && <>{menuBtn}{collapseBtn}</>}
          <span className="flex items-center gap-2 text-sm font-bold text-slate-800 lg:hidden">
            <span style={{ color: accent }}><Lu name={current?.icon ?? "layout-dashboard"} size={16} filled={filled} /></span> {current?.label ?? "Super Admin"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setCustomize(true)}
              title="Customize menu"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-slate-600 transition hover:bg-slate-100"
            >
              <Icon name="edit" className="h-4 w-4" /> <span className="hidden text-xs font-semibold sm:inline">Customize</span>
            </button>
            <SuperAdminNotifications />

            {/* Profile dropdown (matches the client topbar) */}
            <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />
            <div ref={acctRef} className="relative">
              <button
                onClick={() => setAcctOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-slate-100"
                aria-label="Open profile menu"
              >
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-900">{sa?.name ?? "Super Admin"}</p>
                  {saProfile.title && <p className="text-xs leading-tight text-slate-500">{saProfile.title}</p>}
                </div>
                <SaAvatar src={saProfile.avatar} name={sa?.name ?? "SA"} accent={accent} size={36} />
                <Icon name="chevronDown" className={`hidden h-4 w-4 text-slate-400 transition sm:block ${acctOpen ? "rotate-180" : ""}`} />
              </button>

              {acctOpen && (
                <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3">
                    <SaAvatar src={saProfile.avatar} name={sa?.name ?? "SA"} accent={accent} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{sa?.name ?? "Super Admin"}</p>
                      <p className="truncate text-xs text-slate-400">{sa?.email}</p>
                    </div>
                  </div>
                  <div className="py-1">
                    <Link href="/admin/profile" onClick={() => setAcctOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                      <Icon name="eye" className="h-4 w-4 text-slate-400" /> View profile
                    </Link>
                    <Link href="/admin/settings" onClick={() => setAcctOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                      <Icon name="settings" className="h-4 w-4 text-slate-400" /> Account settings
                    </Link>
                    <a href="/" target="_blank" rel="noreferrer" onClick={() => setAcctOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                      <Icon name="export" className="h-4 w-4 text-slate-400" /> Visit live site
                    </a>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button onClick={() => { setAcctOpen(false); signOut(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50">
                      <Icon name="logout" className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {side === "right" && <>{collapseBtn}{menuBtn}</>}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>

      <AdminMenuCustomizer
        open={customize}
        onClose={() => setCustomize(false)}
        config={menu}
        onChange={setMenu}
        onReset={resetMenu}
      />
    </div>
  );
}

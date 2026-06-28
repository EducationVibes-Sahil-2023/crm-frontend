"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, type NavItem } from "@/lib/nav";
import { Icon, type IconName } from "@/components/icons";
import { useBranding, initials } from "@/lib/branding";
import { usePlatform } from "@/lib/platform";
import { allowedFeatures, isHrefAllowed, ALL_FEATURE_KEYS } from "@/lib/access";
import { isSuperAdmin } from "@/lib/superAdmin";
import { hrefModule } from "@/lib/permissions";
import { usePermissions } from "@/components/PermissionsProvider";
import { STORE_EVENT } from "@/lib/dbStore";

type SetupNavItem = { label: string; href: string; icon: IconName };
const SETUP_GROUPS: { heading: string; items: SetupNavItem[] }[] = [
  {
    heading: "Lead Setup",
    items: [
      { label: "Status", href: "/admin-setup/status", icon: "ticket" },
      { label: "Source", href: "/admin-setup/source", icon: "announcement" },
      { label: "Type", href: "/admin-setup/type", icon: "asset" },
      { label: "Sub Status", href: "/admin-setup/sub-status", icon: "task" },
      { label: "Lead Fields", href: "/admin-setup/lead-fields", icon: "edit" },
    ],
  },
  {
    heading: "User Setup",
    items: [
      { label: "Department", href: "/admin-setup/department", icon: "briefcase" },
      { label: "Designation", href: "/admin-setup/designation", icon: "users" },
      { label: "Roles & Permissions", href: "/admin-setup/roles", icon: "settings" },
      { label: "User Fields", href: "/admin-setup/user-fields", icon: "edit" },
      { label: "Accounts & Security", href: "/admin-setup/accounts", icon: "shield" },
    ],
  },
  {
    heading: "Support Setup",
    items: [
      { label: "Ticket Category", href: "/admin-setup/ticket-category", icon: "ticket" },
      { label: "Ticket Priority", href: "/admin-setup/ticket-priority", icon: "alert" },
    ],
  },
  {
    heading: "Asset Setup",
    items: [
      { label: "Asset Category", href: "/admin-setup/asset-category", icon: "asset" },
      { label: "Vendor", href: "/admin-setup/vendor", icon: "briefcase" },
    ],
  },
  {
    heading: "HR Setup",
    items: [
      { label: "Shifts & Timing", href: "/admin-setup/shifts", icon: "clock" },
      { label: "Work Locations", href: "/admin-setup/locations", icon: "pin" },
      { label: "Payroll Settings", href: "/admin-setup/payroll", icon: "payment" },
    ],
  },
  {
    heading: "System Setup",
    items: [
      { label: "Branding", href: "/admin-setup/branding", icon: "image" },
      { label: "Theme & UI", href: "/admin-setup/appearance", icon: "star" },
      { label: "Integrations", href: "/admin-setup/integrations", icon: "plug" },
    ],
  },
];

export default function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const inSetup = pathname.startsWith("/admin-setup");
  const branding = useBranding();
  const logoBg = usePlatform().brand.logoBg;
  // Role-based visibility: hide nav items whose module the user can't `view`.
  const { can } = usePermissions();
  const canViewHref = (href: string) => {
    const moduleKey = hrefModule(href);
    return moduleKey === null || can(moduleKey, "view");
  };
  // Modules the current subscription plan unlocks (Super Admin → Platform
  // Settings → Permissions). Starts open to avoid an SSR/first-paint flash.
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set(ALL_FEATURE_KEYS));
  // The Platform / Super Admin menu is for the platform owner only — hidden from
  // client (tenant) logins. Defaults to false so it never flashes for clients;
  // revealed after hydration if a super-admin session exists.
  const [isSuper, setIsSuper] = useState(false);
  // Compute once on mount and only re-sync when the workspace settings actually
  // change (plan/permissions are saved). NOT on every navigation — recomputing
  // here per click made the whole menu re-render needlessly on each page change.
  useEffect(() => {
    const sync = () => {
      setAllowed(allowedFeatures());
      setIsSuper(isSuperAdmin());
    };
    sync();
    window.addEventListener(STORE_EVENT, sync);
    return () => window.removeEventListener(STORE_EVENT, sync);
  }, []);

  function NavLink({
    href,
    icon,
    label,
    active,
  }: {
    href: string;
    icon: IconName;
    label: string;
    active: boolean;
  }) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        className={`flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
          collapsed ? "justify-center px-0" : "gap-3 px-3"
        } ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
      >
        <Icon name={icon} className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={`flex h-full flex-col bg-[#1b2138] text-slate-300 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand / collapse toggle */}
      <div className={`flex h-16 items-center ${collapsed ? "justify-center px-2" : "gap-3 px-5"}`}>
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: logoBg }}
        >
          {branding.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt={branding.appName} className="h-full w-full object-cover" />
          ) : (
            initials(branding.appName)
          )}
        </button>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{branding.appName}</p>
              <p className="truncate text-xs text-slate-400">{branding.tagline}</p>
            </div>
            <button
              onClick={onToggleCollapse}
              title="Collapse menu"
              aria-label="Collapse menu"
              className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {inSetup ? (
        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
          {/* Back to main menu */}
          <Link
            href="/dashboard"
            onClick={onNavigate}
            title={collapsed ? "Back to Menu" : undefined}
            className={`mt-2 flex items-center rounded-lg py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white ${
              collapsed ? "justify-center px-0" : "gap-2 px-3"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
              <path d="m15 18-6-6 6-6" />
            </svg>
            {!collapsed && "Back to Menu"}
          </Link>

          {SETUP_GROUPS.map((group) => (
            <div key={group.heading} className="mt-4">
              {!collapsed && (
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  {group.heading}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={pathname === item.href || pathname.startsWith(item.href + "/")}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      ) : (
        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group, gi) => {
            const items = group.items
              .filter(
                (item) =>
                  isHrefAllowed(item.href, allowed) &&
                  // Super Admin (Platform) menu only for the platform owner.
                  // Match "/admin" exactly or "/admin/…" — NOT "/admin-setup".
                  (isSuper || !(item.href === "/admin" || item.href.startsWith("/admin/"))) &&
                  // Role permissions: the user must be able to view the item's
                  // module (or one of its sub-pages).
                  (canViewHref(item.href) || (item.children ?? []).some((c) => canViewHref(c.href))),
              )
              // Drop sub-pages the user's role can't view, so dropdowns only
              // show what they're allowed to open.
              .map((item) =>
                item.children?.length
                  ? { ...item, children: item.children.filter((c) => canViewHref(c.href)) }
                  : item,
              );
            if (items.length === 0) return null;
            return (
            <div key={gi} className="mt-4 first:mt-2">
              {group.heading && !collapsed && (
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  {group.heading}
                </p>
              )}
              {group.heading && collapsed && <div className="mx-2 my-2 border-t border-white/10" />}
              <ul className="space-y-1">
                {items.map((item) =>
                  item.children?.length ? (
                    <li key={item.label}>
                      <CollapsibleNav item={item} collapsed={collapsed} pathname={pathname} NavLink={NavLink} onNavigate={onNavigate} />
                    </li>
                  ) : (
                    <li key={item.label}>
                      <NavLink
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        active={
                          item.href !== "#" &&
                          (item.href === "/dashboard"
                            ? pathname === "/dashboard"
                            : pathname.startsWith(item.href))
                        }
                      />
                    </li>
                  ),
                )}
              </ul>
            </div>
            );
          })}
        </nav>
      )}
    </aside>
  );
}

function CollapsibleNav({
  item,
  collapsed,
  pathname,
  NavLink,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  NavLink: (p: { href: string; icon: IconName; label: string; active: boolean }) => React.JSX.Element;
  onNavigate?: () => void;
}) {
  const children = item.children ?? [];
  const childActive = (c: NavItem) => (c.href === item.href ? pathname === c.href : pathname.startsWith(c.href));
  const anyActive = children.some(childActive);
  const [open, setOpen] = useState(anyActive);

  // Collapsed rail: just the icon linking to the section landing page.
  if (collapsed) {
    return <NavLink href={item.href} icon={item.icon} label={item.label} active={anyActive} />;
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          anyActive ? "text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 border-l border-white/10 pl-3">
          {children.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  childActive(c) ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon name={c.icon} className="h-4 w-4 shrink-0" />
                <span className="truncate">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

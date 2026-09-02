"use client";

import { createElement, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type NavItem, type NavGroup } from "@/lib/nav";
import { Icon, type IconName } from "@/components/icons";
import { getLucideForCustom } from "@/lib/lucideIcons";
import { useAppearance, sidebarAccentColors, type IconAnim } from "@/lib/appearance";
import { tint } from "@/lib/adminMenu";
import { useBranding, initials } from "@/lib/branding";
import { usePlatform } from "@/lib/platform";
import { allowedFeatures, isHrefAllowed, ALL_FEATURE_KEYS } from "@/lib/access";
import { hrefModule } from "@/lib/permissions";
import { usePermissions } from "@/components/PermissionsProvider";
import { STORE_EVENT } from "@/lib/dbStore";
import { loadNavConfig, resolveNavGroups, EMPTY_NAV_CONFIG, NAV_CONFIG_EVENT } from "@/lib/navConfig";

// Quick actions — one-tap shortcuts pinned above the nav (Control-Center style).
// Each is gated by the same plan + role checks as the matching nav item, so a
// hidden module never shows a shortcut.
const QUICK_ACTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/leads", label: "New lead", icon: "leads" },
  { href: "/gmail", label: "Compose", icon: "gmail" },
  { href: "/tasks", label: "New task", icon: "task" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];

type SetupNavItem = { label: string; href: string; icon: IconName; desc?: string };
const SETUP_GROUPS: { heading: string; items: SetupNavItem[] }[] = [
  {
    heading: "Lead Setup",
    items: [
      { label: "Status", href: "/admin-setup/status", icon: "ticket", desc: "Pipeline stages" },
      { label: "Source", href: "/admin-setup/source", icon: "announcement", desc: "Where leads come from" },
      { label: "Type", href: "/admin-setup/type", icon: "asset", desc: "Hot / warm / cold" },
      { label: "Sub Status", href: "/admin-setup/sub-status", icon: "task", desc: "Detailed sub-stages" },
      { label: "Lead Fields", href: "/admin-setup/lead-fields", icon: "edit", desc: "Custom lead fields" },
    ],
  },
  {
    heading: "User Setup",
    items: [
      { label: "Department", href: "/admin-setup/department", icon: "briefcase", desc: "Org departments" },
      { label: "Designation", href: "/admin-setup/designation", icon: "users", desc: "Job titles" },
      { label: "Roles & Permissions", href: "/admin-setup/roles", icon: "settings", desc: "Access control" },
      { label: "User Fields", href: "/admin-setup/user-fields", icon: "edit", desc: "Custom user fields" },
      { label: "Accounts & Security", href: "/admin-setup/accounts", icon: "shield", desc: "Logins & 2FA" },
    ],
  },
  {
    heading: "Support Setup",
    items: [
      { label: "Ticket Category", href: "/admin-setup/ticket-category", icon: "ticket", desc: "Group tickets" },
      { label: "Ticket Priority", href: "/admin-setup/ticket-priority", icon: "alert", desc: "Urgency levels" },
    ],
  },
  {
    heading: "Asset Setup",
    items: [
      { label: "Asset Category", href: "/admin-setup/asset-category", icon: "asset", desc: "Classify assets" },
      { label: "Vendor", href: "/admin-setup/vendor", icon: "briefcase", desc: "Suppliers & OEMs" },
    ],
  },
  {
    heading: "HR Setup",
    items: [
      { label: "Shifts & Timing", href: "/admin-setup/shifts", icon: "clock", desc: "Work schedules" },
      { label: "Work Locations", href: "/admin-setup/locations", icon: "pin", desc: "Office & sites" },
      { label: "Payroll Settings", href: "/admin-setup/payroll", icon: "payment", desc: "Salary & payroll" },
    ],
  },
  {
    heading: "System Setup",
    items: [
      { label: "Branding", href: "/admin-setup/branding", icon: "image", desc: "Logo & identity" },
      { label: "Theme & UI", href: "/admin-setup/appearance", icon: "star", desc: "Colours & menu look" },
      { label: "Menu / Navigation", href: "/admin-setup/menu", icon: "list", desc: "Reorder & rename" },
      { label: "Integrations", href: "/admin-setup/integrations", icon: "plug", desc: "Connect services" },
    ],
  },
];

/** True when a #rrggbb colour is light enough that white text would be illegible. */
function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.68;
}

/** Motion class for a sidebar icon given the chosen animation + active state. */
function animClass(anim: IconAnim, active: boolean): string {
  if (anim === "none") return "";
  if (anim === "pulse") return active ? "nx-ico nx-ico-pulse" : "nx-ico";
  return `nx-ico nx-ico-${anim}`;
}

/** Render a nav icon. Default = plain glyph (coloured by the item's colour, the
 * accent when active, or the inherited text colour). With `chips` on, it sits in
 * a rounded colour chip like the admin menu. */
function NavIcon({
  icon, size = 18, chip = 32, filled, anim, active, color, accentSolid, accentTint, chips,
}: {
  icon: string; size?: number; chip?: number; filled: boolean; anim: IconAnim; active: boolean; color?: string; accentSolid: string; accentTint: string; chips: boolean;
}) {
  const glyph = createElement(getLucideForCustom(icon), { size, strokeWidth: filled ? 2.6 : 1.8 });
  const box = { width: chip, height: chip };

  if (chips) {
    const style = active
      ? { backgroundColor: accentSolid, color: "#fff", ...box }
      : color
        ? { backgroundColor: tint(color, 0.14), color, ...box }
        : { backgroundColor: accentTint, color: accentSolid, ...box };
    return (
      <span className="flex shrink-0 items-center justify-center rounded-lg shadow-sm" style={style}>
        <span className={animClass(anim, active)}>{glyph}</span>
      </span>
    );
  }

  // Plain (default): no chip background.
  const c = active ? accentSolid : color || undefined;
  return (
    <span className="flex shrink-0 items-center justify-center" style={box}>
      <span className={animClass(anim, active)} style={c ? { color: c } : undefined}>{glyph}</span>
    </span>
  );
}

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
  const brand = usePlatform().brand;
  // Fall back to the workspace/platform product name when no custom name is set
  // (so a fresh workspace never shows the generic "Nexus CRM").
  const appDisplayName = branding.appName || brand.name || "CRM";
  // Logo-only mode (no name/tagline): let the logo span the full sidebar width.
  const logoOnlyFull = !!branding.logo && branding.logoOnly && !collapsed;
  // Collapsed rail: a compact square mark — prefer the favicon (square by design),
  // then the logo, then the initials tile.
  const collapsedMark = branding.favicon || branding.logo || null;
  // Always resolve to a solid, saturated colour so the white logo initials stay
  // legible on any sidebar background (incl. the new light default).
  const logoBg = brand.logoBg || brand.primaryColor || "#2563eb";
  // Sidebar look (colours / icon style / icon motion) from the Appearance page.
  const appearance = useAppearance();
  const iconFilled = appearance.sidebarIconStyle === "filled";
  const iconAnim = appearance.sidebarIconAnim;
  const chips = appearance.sidebarIconChips;
  // Control-Center style extras: subtitle under each label + quick-actions grid.
  const showDescriptions = appearance.sidebarDescriptions;
  const showQuickActions = appearance.sidebarQuickActions;
  // Active/highlight colours — a custom sidebar accent, else the app theme accent
  // (so changing the theme recolours the menu). `solid` = highlight, `tint` = row bg.
  const { solid: accentSolid, tint: accentTint } = sidebarAccentColors(appearance);
  // Role-based visibility: hide nav items whose module the user can't `view`.
  const { can } = usePermissions();
  const canViewHref = (href: string) => {
    const moduleKey = hrefModule(href);
    return moduleKey === null || can(moduleKey, "view");
  };
  // Modules the current subscription plan unlocks (Super Admin → Platform
  // Settings → Permissions). Starts open to avoid an SSR/first-paint flash.
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set(ALL_FEATURE_KEYS));
  // Compute once on mount and only re-sync when the workspace settings actually
  // change (plan/permissions are saved). NOT on every navigation — recomputing
  // here per click made the whole menu re-render needlessly on each page change.
  useEffect(() => {
    const sync = () => {
      setAllowed(allowedFeatures());
    };
    sync();
    window.addEventListener(STORE_EVENT, sync);
    return () => window.removeEventListener(STORE_EVENT, sync);
  }, []);

  // Admin menu customization (order / rename / re-slug / re-icon / hide),
  // merged over the base menu. Re-syncs when the config is saved or another
  // tab changes it. Start from the base menu to avoid a first-paint flash.
  const [navGroups, setNavGroups] = useState<NavGroup[]>(() => resolveNavGroups(EMPTY_NAV_CONFIG));
  useEffect(() => {
    const sync = () => setNavGroups(resolveNavGroups(loadNavConfig()));
    sync();
    window.addEventListener(NAV_CONFIG_EVENT, sync);
    window.addEventListener("platform:updated", sync); // inherited default hydrated
    window.addEventListener(STORE_EVENT, sync);
    return () => {
      window.removeEventListener(NAV_CONFIG_EVENT, sync);
      window.removeEventListener("platform:updated", sync);
      window.removeEventListener(STORE_EVENT, sync);
    };
  }, []);

  function NavLink({
    href,
    icon,
    label,
    active,
    color,
    desc,
  }: {
    href: string;
    icon: IconName;
    label: string;
    active: boolean;
    color?: string;
    desc?: string;
  }) {
    const withDesc = !collapsed && showDescriptions && !!desc;
    return (
      <Link
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        style={active ? { backgroundColor: accentTint, color: accentSolid } : undefined}
        className={`group relative flex items-center rounded-lg text-sm font-medium transition ${
          collapsed ? "justify-center px-0 py-1.5" : `gap-2.5 px-2.5 ${withDesc ? "py-2" : "py-1.5"}`
        } ${active ? "" : "hover:bg-black/[0.05]"}`}
      >
        {/* Active accent bar (Super-Admin style) */}
        {active && <span className="absolute left-0 top-1/2 h-6 -translate-y-1/2 w-1 rounded-r-full" style={{ backgroundColor: accentSolid }} />}
        <NavIcon icon={icon} filled={iconFilled} anim={iconAnim} active={active} color={color} accentSolid={accentSolid} accentTint={accentTint} chips={chips} />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate leading-tight">{label}</span>
            {withDesc && (
              <span
                className={`block truncate text-[11px] leading-tight ${active ? "" : "opacity-55"}`}
                style={active ? { color: tint(accentSolid, 0.55) } : undefined}
              >
                {desc}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  }

  // Quick-action shortcuts the current user may actually open (plan + role gated).
  const quickActions = QUICK_ACTIONS.filter((q) => isHrefAllowed(q.href, allowed) && canViewHref(q.href));

  return (
    <aside
      className={`flex h-full flex-col transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
      style={{ backgroundColor: appearance.sidebarBg, color: appearance.sidebarText }}
    >
      {/* Brand / collapse toggle */}
      <div className={`flex h-16 items-center ${collapsed ? "justify-center px-2" : "gap-3 px-5"}`}>
        <span className={`relative flex ${logoOnlyFull ? "flex-1" : "shrink-0"}`}>
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            className={`flex items-center justify-center overflow-hidden rounded-lg text-sm font-bold ${logoOnlyFull ? "w-full" : "shrink-0"}`}
            style={
              collapsed
                ? collapsedMark
                  ? { width: 36, height: 36 }
                  : { width: 36, height: 36, backgroundColor: logoBg, color: isLightColor(logoBg) ? "#0f172a" : "#ffffff" }
                : branding.logo
                  ? branding.logoOnly
                    ? { height: `${Math.round(48 * branding.logoHeight / 100)}px` }
                    : { width: `${Math.round(132 * branding.logoWidth / 100)}px`, height: `${Math.round(44 * branding.logoHeight / 100)}px` }
                  : { width: 36, height: 36, backgroundColor: logoBg, color: isLightColor(logoBg) ? "#0f172a" : "#ffffff" }
            }
          >
            {collapsed ? (
              collapsedMark ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={collapsedMark} alt={appDisplayName} className="h-full w-full object-contain p-0.5" />
              ) : (
                initials(appDisplayName)
              )
            ) : branding.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo} alt={appDisplayName} className="h-full w-full object-contain" />
            ) : (
              initials(appDisplayName)
            )}
          </button>
          {/* Online status dot (Control-Center style); hidden in full-width logo mode. */}
          {!logoOnlyFull && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 bg-emerald-400" style={{ borderColor: appearance.sidebarBg }} />
          )}
        </span>
        {!collapsed && !branding.logoOnly && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: appearance.sidebarText }}>{appDisplayName}</p>
            {branding.tagline && <p className="truncate text-xs opacity-70">{branding.tagline}</p>}
          </div>
        )}
      </div>

      {/* Quick actions (Control-Center style) — main menu only, expanded only. */}
      {!inSetup && !collapsed && showQuickActions && quickActions.length > 0 && (
        <div className="px-3 pb-3 pt-1">
          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                onClick={onNavigate}
                className="group flex items-center gap-2 rounded-xl border border-black/[0.06] bg-black/[0.03] px-2.5 py-2 text-[11px] font-semibold transition hover:bg-black/[0.06]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm" style={{ color: accentSolid }}>
                  <span className={animClass(iconAnim, false)}>{createElement(getLucideForCustom(q.icon), { size: 14, strokeWidth: iconFilled ? 2.6 : 1.8 })}</span>
                </span>
                <span className="truncate">{q.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {inSetup ? (
        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
          {/* Back to main menu */}
          <Link
            href="/dashboard"
            onClick={onNavigate}
            title={collapsed ? "Back to Menu" : undefined}
            className={`mt-2 flex items-center rounded-lg py-2 text-sm font-medium opacity-80 transition hover:bg-black/[0.05] hover:opacity-100 ${
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
                      desc={item.desc}
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
          {navGroups.map((group, gi) => {
            const items = group.items
              .filter(
                (item) =>
                  isHrefAllowed(item.href, allowed) &&
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
              {group.heading && collapsed && <div className="mx-2 my-2 border-t border-black/10" />}
              <ul className="space-y-1">
                {items.map((item) =>
                  item.children?.length ? (
                    <li key={item.label}>
                      <CollapsibleNav item={item} collapsed={collapsed} pathname={pathname} NavLink={NavLink} onNavigate={onNavigate} iconFilled={iconFilled} iconAnim={iconAnim} accentSolid={accentSolid} accentTint={accentTint} chips={chips} showDescriptions={showDescriptions} />
                    </li>
                  ) : (
                    <li key={item.label}>
                      <NavLink
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        color={item.color}
                        desc={item.desc}
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
  iconFilled,
  iconAnim,
  accentSolid,
  accentTint,
  chips,
  showDescriptions,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  NavLink: (p: { href: string; icon: IconName; label: string; active: boolean; color?: string; desc?: string }) => React.JSX.Element;
  onNavigate?: () => void;
  iconFilled: boolean;
  iconAnim: IconAnim;
  accentSolid: string;
  accentTint: string;
  chips: boolean;
  showDescriptions: boolean;
}) {
  const children = item.children ?? [];
  const childActive = (c: NavItem) => (c.href === item.href ? pathname === c.href : pathname.startsWith(c.href));
  const anyActive = children.some(childActive);
  const [open, setOpen] = useState(anyActive);

  // Collapsed rail: just the icon linking to the section landing page.
  if (collapsed) {
    return <NavLink href={item.href} icon={item.icon} label={item.label} active={anyActive} color={item.color} />;
  }

  const withDesc = showDescriptions && !!item.desc;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={anyActive ? { backgroundColor: accentTint, color: accentSolid } : undefined}
        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition ${withDesc ? "py-2" : "py-1.5"} ${
          anyActive ? "" : "hover:bg-black/[0.05]"
        }`}
      >
        {anyActive && <span className="absolute left-0 top-1/2 h-6 -translate-y-1/2 w-1 rounded-r-full" style={{ backgroundColor: accentSolid }} />}
        <NavIcon icon={item.icon} filled={iconFilled} anim={iconAnim} active={anyActive} color={item.color} accentSolid={accentSolid} accentTint={accentTint} chips={chips} />
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate leading-tight">{item.label}</span>
          {withDesc && (
            <span
              className={`block truncate text-[11px] leading-tight ${anyActive ? "" : "opacity-55"}`}
              style={anyActive ? { color: tint(accentSolid, 0.55) } : undefined}
            >
              {item.desc}
            </span>
          )}
        </span>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 border-l border-black/10 pl-3">
          {children.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                onClick={onNavigate}
                style={childActive(c) ? { backgroundColor: accentTint, color: accentSolid } : undefined}
                className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                  childActive(c) ? "font-medium" : "opacity-80 hover:bg-black/[0.05] hover:opacity-100"
                }`}
              >
                <NavIcon icon={c.icon} size={15} chip={26} filled={iconFilled} anim={iconAnim} active={childActive(c)} color={c.color} accentSolid={accentSolid} accentTint={accentTint} chips={chips} />
                <span className="truncate">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

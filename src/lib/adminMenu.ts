// Super-admin sidebar customization — position, accent, icon style, density and
// per-item icon/colour/label/order/visibility. This is a per-browser UI
// preference, so it lives in localStorage (not the backend platform config).
// The layout reads it live via useAdminMenu(); the customizer writes to it.

import { useEffect, useState } from "react";

export type IconAnim = "none" | "pop" | "bounce" | "spin" | "wiggle" | "pulse";

export type AdminMenuItem = {
  key: string;        // stable id (canonical, never edited)
  href: string;       // canonical route (never edited)
  label: string;      // editable display label
  desc: string;       // editable sub-label
  icon: string;       // editable lucide icon key (see lib/lucideIcons)
  color: string;      // editable per-item accent (icon chip) — #rrggbb
  hidden: boolean;    // show/hide in the rail
  section: string;    // group heading
};

export type AdminMenuConfig = {
  side: "left" | "right";
  align: "left" | "center";       // how each item's icon+label sits in the rail
  iconStyle: "outline" | "filled";
  iconAnim: IconAnim;             // icon motion on hover (or continuous, for pulse)
  accent: string;                 // global active/highlight colour — #rrggbb
  sidebarBg: string;              // menu background — #rrggbb
  textColor: string;              // base label/text colour — #rrggbb
  density: "comfortable" | "compact";
  showDescriptions: boolean;
  showQuickActions: boolean;
  items: AdminMenuItem[];         // order = render order
};

export const ICON_ANIMS: { value: IconAnim; label: string }[] = [
  { value: "none", label: "None" },
  { value: "pop", label: "Pop" },
  { value: "bounce", label: "Bounce" },
  { value: "wiggle", label: "Wiggle" },
  { value: "spin", label: "Spin" },
  { value: "pulse", label: "Pulse" },
];

// Preset accent swatches offered in the customizer.
export const ACCENT_PRESETS = [
  "#4f46e5", // indigo
  "#7c3aed", // violet
  "#2563eb", // blue
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#db2777", // pink
  "#475569", // slate
  "#0f172a", // near-black
];

export const DEFAULT_ADMIN_MENU: AdminMenuConfig = {
  side: "left",
  align: "left",
  iconStyle: "outline",
  iconAnim: "pop",
  accent: "#4f46e5",
  sidebarBg: "#ffffff",
  textColor: "#475569",
  density: "comfortable",
  showDescriptions: true,
  showQuickActions: true,
  items: [
    { key: "overview", href: "/admin",          label: "Overview", desc: "Platform pulse",       icon: "layout-dashboard", color: "#4f46e5", hidden: false, section: "Manage" },
    { key: "clients",  href: "/admin/clients",  label: "Clients",  desc: "Workspaces & DBs",     icon: "building-2",       color: "#0891b2", hidden: false, section: "Manage" },
    { key: "database", href: "/admin/database", label: "Database", desc: "Inspect & backup",     icon: "database",         color: "#0d9488", hidden: false, section: "Manage" },
    { key: "demos",    href: "/admin/demos",    label: "Demos",    desc: "Booked walkthroughs",  icon: "calendar-days",    color: "#d97706", hidden: false, section: "Manage" },
    { key: "mail",     href: "/admin/mail",     label: "Mail",     desc: "Platform inbox",       icon: "mail",             color: "#dc2626", hidden: false, section: "Communication" },
    { key: "settings", href: "/admin/settings", label: "Settings", desc: "Branding & config",    icon: "settings",         color: "#7c3aed", hidden: false, section: "Configure" },
  ],
};

const KEY = "admin_menu_config_v3";
const EVENT = "admin-menu:updated";

function cloneItem(i: AdminMenuItem): AdminMenuItem { return { ...i }; }
function clone(c: AdminMenuConfig): AdminMenuConfig { return { ...c, items: c.items.map(cloneItem) }; }

/**
 * Reconcile a stored config against the current defaults. Keys/hrefs are always
 * taken from the defaults (routes are code-defined); the user's label/icon/
 * colour/order/visibility win. New default items appear; stale keys drop.
 */
function mergeMenu(p: Partial<AdminMenuConfig> | null | undefined): AdminMenuConfig {
  const base = clone(DEFAULT_ADMIN_MENU);
  if (!p || typeof p !== "object") return base;

  const byKey = new Map(base.items.map((i) => [i.key, i]));
  const seen = new Set<string>();
  const items: AdminMenuItem[] = [];
  for (const s of Array.isArray(p.items) ? p.items : []) {
    const def = byKey.get(s?.key);
    if (!def || seen.has(def.key)) continue;
    seen.add(def.key);
    items.push({
      key: def.key,
      href: def.href,
      label: typeof s.label === "string" && s.label.trim() ? s.label : def.label,
      desc: typeof s.desc === "string" ? s.desc : def.desc,
      icon: typeof s.icon === "string" && s.icon ? s.icon : def.icon,
      color: typeof s.color === "string" ? s.color : def.color,
      hidden: s.hidden === true,
      section: typeof s.section === "string" && s.section.trim() ? s.section : def.section,
    });
  }
  for (const def of base.items) if (!seen.has(def.key)) items.push(cloneItem(def));

  return {
    side: p.side === "right" ? "right" : "left",
    align: p.align === "center" ? "center" : "left",
    iconStyle: p.iconStyle === "filled" ? "filled" : "outline",
    iconAnim: ICON_ANIMS.some((a) => a.value === p.iconAnim) ? (p.iconAnim as IconAnim) : base.iconAnim,
    accent: typeof p.accent === "string" ? p.accent : base.accent,
    sidebarBg: typeof p.sidebarBg === "string" ? p.sidebarBg : base.sidebarBg,
    textColor: typeof p.textColor === "string" ? p.textColor : base.textColor,
    density: p.density === "compact" ? "compact" : "comfortable",
    showDescriptions: p.showDescriptions !== false,
    showQuickActions: p.showQuickActions !== false,
    items,
  };
}

export function loadAdminMenu(): AdminMenuConfig {
  if (typeof window === "undefined") return clone(DEFAULT_ADMIN_MENU);
  try {
    const raw = window.localStorage.getItem(KEY);
    return mergeMenu(raw ? (JSON.parse(raw) as Partial<AdminMenuConfig>) : null);
  } catch {
    return clone(DEFAULT_ADMIN_MENU);
  }
}

export function saveAdminMenu(c: AdminMenuConfig): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* quota — ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function resetAdminMenu(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Append an alpha channel to a #rrggbb colour → e.g. tint("#4f46e5", 0.1). */
export function tint(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
}

/**
 * Live admin-menu config for client components. Re-renders when the customizer
 * saves (same tab via the custom event, other tabs via `storage`). Returns the
 * config plus an updater that persists and reflects immediately.
 */
export function useAdminMenu(): [AdminMenuConfig, (c: AdminMenuConfig) => void, () => void] {
  const [cfg, setCfg] = useState<AdminMenuConfig>(DEFAULT_ADMIN_MENU);
  useEffect(() => {
    const read = () => setCfg(loadAdminMenu());
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", read); };
  }, []);
  const update = (c: AdminMenuConfig) => { setCfg(c); saveAdminMenu(c); };
  const reset = () => { resetAdminMenu(); setCfg(loadAdminMenu()); };
  return [cfg, update, reset];
}

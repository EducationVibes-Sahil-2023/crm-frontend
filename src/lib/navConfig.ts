// Sidebar menu customization. Admins can reorder (sequence), rename, re-slug,
// re-icon and hide menu items + reorder groups. Stored in localStorage and
// merged over the static base menu (nav.ts) at render time, so the whole
// sidebar re-themes with no per-item wiring — mirrors the appearance store.

import { NAV_GROUPS, type NavGroup, type NavItem } from "@/lib/nav";
import { loadPlatform } from "@/lib/platform";
import type { IconName } from "@/components/icons";

// A per-item override, keyed by the item's ORIGINAL identity (see itemKey).
export type NavItemOverride = {
  label?: string;
  href?: string;
  icon?: IconName;
  color?: string;
  desc?: string; // override the item's tagline/subtitle ("" hides it)
  hidden?: boolean;
  group?: string; // reassign a top-level item to a different group (cross-group move)
};

export type NavConfig = {
  // key -> field overrides
  items: Record<string, NavItemOverride>;
  // groupHeading rename, keyed by original group key
  groups: Record<string, { heading?: string; hidden?: boolean }>;
  // ordered lists of ORIGINAL keys:
  //   order["__groups__"] -> group keys in display order
  //   order[<groupKey>]   -> top-level item keys in that group
  //   order[<itemKey>]    -> child keys under a parent item
  order: Record<string, string[]>;
};

export const EMPTY_NAV_CONFIG: NavConfig = { items: {}, groups: {}, order: {} };

const KEY = "nexus_nav_config";
export const NAV_CONFIG_EVENT = "navconfig:updated";

// Stable identity for an item — derived from the base label+href, so it stays
// valid even after the admin renames or re-slugs the item.
export function itemKey(baseLabel: string, baseHref: string): string {
  return `${baseLabel}|${baseHref}`;
}

// Stable identity for a group.
export function groupKey(g: NavGroup, index: number): string {
  return g.heading || `Group ${index + 1}`;
}

// Map every top-level item key -> the group key it belongs to by default.
export function baseGroupMap(): Record<string, string> {
  const m: Record<string, string> = {};
  NAV_GROUPS.forEach((g, i) => {
    const gk = groupKey(g, i);
    g.items.forEach((it) => { m[itemKey(it.label, it.href)] = gk; });
  });
  return m;
}

// The default group key for a top-level item (undefined if unknown).
export function itemBaseGroup(key: string): string | undefined {
  return baseGroupMap()[key];
}

// The platform-wide default menu, set by the Super Admin under Platform Settings
// → Appearance. Clients inherit it as their base.
function platformNavDefault(): NavConfig {
  const n = loadPlatform().nav;
  return n ? { items: { ...n.items }, groups: { ...n.groups }, order: { ...n.order } } : structuredCloneCfg(EMPTY_NAV_CONFIG);
}

// Layer client overrides (b) over the base (a); per-key, the client wins.
function mergeNavConfigs(a: NavConfig, b: Partial<NavConfig>): NavConfig {
  return {
    items: { ...a.items, ...(b.items ?? {}) },
    groups: { ...a.groups, ...(b.groups ?? {}) },
    order: { ...a.order, ...(b.order ?? {}) },
  };
}

export function loadNavConfig(): NavConfig {
  const base = typeof window === "undefined" ? structuredCloneCfg(EMPTY_NAV_CONFIG) : platformNavDefault();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    return mergeNavConfigs(base, JSON.parse(raw) as Partial<NavConfig>);
  } catch {
    return base;
  }
}

export function saveNavConfig(cfg: NavConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cfg));
    window.dispatchEvent(new Event(NAV_CONFIG_EVENT));
  } catch {
    /* ignore */
  }
}

function structuredCloneCfg(c: NavConfig): NavConfig {
  return { items: { ...c.items }, groups: { ...c.groups }, order: { ...c.order } };
}

// Order a list of {origKey} entries by a saved key sequence. Keys not present in
// `order` keep their base position, appended after the ordered ones.
function applyOrder<T extends { origKey: string }>(list: T[], order?: string[]): T[] {
  if (!order || order.length === 0) return list;
  const pos = new Map(order.map((k, i) => [k, i]));
  return [...list]
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const pa = pos.has(a.it.origKey) ? pos.get(a.it.origKey)! : order.length + a.i;
      const pb = pos.has(b.it.origKey) ? pos.get(b.it.origKey)! : order.length + b.i;
      return pa - pb;
    })
    .map((x) => x.it);
}

type ResolvedItem = NavItem & { origKey: string };

function resolveItem(base: NavItem, cfg: NavConfig): ResolvedItem | null {
  const key = itemKey(base.label, base.href);
  const ov = cfg.items[key];
  if (ov?.hidden) return null;

  let children: NavItem[] | undefined;
  if (base.children?.length) {
    const resolved = base.children
      .map((c) => resolveItem(c, cfg))
      .filter((c): c is ResolvedItem => c !== null);
    const ordered = applyOrder(resolved, cfg.order[key]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    children = ordered.map(({ origKey, ...rest }) => rest);
  }

  return {
    origKey: key,
    label: ov?.label?.trim() || base.label,
    href: ov?.href?.trim() || base.href,
    icon: (ov?.icon as IconName) || base.icon,
    ...(ov?.color ? { color: ov.color } : base.color ? { color: base.color } : {}),
    // Tagline: an override wins (an explicit "" clears it); else the base desc.
    ...((ov?.desc !== undefined ? ov.desc.trim() : base.desc) ? { desc: ov?.desc !== undefined ? ov.desc.trim() : base.desc } : {}),
    ...(children ? { children } : {}),
  };
}

// Merge the saved config over the base menu, producing the menu the Sidebar
// renders. Top-level items may be reassigned to a different group via the
// `group` override (cross-group move); they're bucketed into their effective
// group, then ordered within it.
export function resolveNavGroups(cfg: NavConfig): NavGroup[] {
  const visible = NAV_GROUPS.map((g, i) => ({ g, key: groupKey(g, i) }))
    .filter(({ key }) => !cfg.groups[key]?.hidden);
  const visibleKeys = new Set(visible.map((x) => x.key));

  // Resolve every top-level item and drop it in its effective group's bucket.
  // Iterate ALL base groups (not just visible ones) so an item moved OUT of a
  // now-hidden group into a visible one is still shown; gate on the effective
  // group's visibility so items whose effective group is hidden stay hidden.
  const buckets: Record<string, ResolvedItem[]> = {};
  NAV_GROUPS.forEach((g, i) => {
    const baseKey = groupKey(g, i);
    for (const base of g.items) {
      const resolved = resolveItem(base, cfg);
      if (!resolved) continue;
      const target = cfg.items[itemKey(base.label, base.href)]?.group;
      const gk = target && visibleKeys.has(target) ? target : baseKey;
      if (!visibleKeys.has(gk)) continue;
      (buckets[gk] ??= []).push(resolved);
    }
  });

  const orderedGroups = applyOrder(
    visible.map((entry) => ({ ...entry, origKey: entry.key })),
    cfg.order["__groups__"],
  );

  return orderedGroups.map(({ g, key }) => {
    const ordered = applyOrder(buckets[key] ?? [], cfg.order[key]);
    return {
      heading: cfg.groups[key]?.heading?.trim() || g.heading,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      items: ordered.map(({ origKey, ...rest }) => rest),
    };
  });
}

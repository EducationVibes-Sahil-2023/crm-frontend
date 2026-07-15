"use client";

// Reusable sidebar-menu editor. Operates purely on a NavConfig `value` and emits
// the next config via `onChange` — the caller owns persistence. Used by both the
// client editor (Admin Setup → Menu, localStorage) and the Super Admin platform
// default (Platform Settings → Appearance, backend config).

import { useMemo, useState } from "react";
import { Icon, ICON_NAMES, type IconName } from "@/components/icons";
import { NAV_GROUPS, type NavItem } from "@/lib/nav";
import { groupKey, itemBaseGroup, itemKey, type NavConfig } from "@/lib/navConfig";

// ---- Display tree (base menu + current overrides, hidden items kept visible) ----

type EItem = { key: string; base: NavItem; label: string; href: string; icon: IconName; desc: string; hidden: boolean; children: EItem[] };
type EGroup = { key: string; baseHeading?: string; heading: string; hidden: boolean; items: EItem[] };

function orderByKeys<T extends { key: string }>(list: T[], order?: string[]): T[] {
  if (!order || order.length === 0) return list;
  const pos = new Map(order.map((k, i) => [k, i]));
  return [...list]
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (pos.get(a.it.key) ?? order.length + a.i) - (pos.get(b.it.key) ?? order.length + b.i))
    .map((x) => x.it);
}

type BuildOpts = { exclude?: Set<string>; visible?: (href: string) => boolean };

function buildItem(base: NavItem, cfg: NavConfig, opts?: BuildOpts): EItem {
  const key = itemKey(base.label, base.href);
  const ov = cfg.items[key] ?? {};
  const childBases = (base.children ?? []).filter((c) => !opts?.visible || opts.visible(c.href));
  const children = childBases.length
    ? orderByKeys(childBases.map((c) => buildItem(c, cfg, opts)), cfg.order[key])
    : [];
  return {
    key,
    base,
    label: ov.label ?? base.label,
    href: ov.href ?? base.href,
    icon: (ov.icon ?? base.icon) as IconName,
    desc: ov.desc ?? base.desc ?? "",
    hidden: !!ov.hidden,
    children,
  };
}

function buildGroups(cfg: NavConfig, opts?: BuildOpts): EGroup[] {
  // Visible groups (after excluding admin/system groups the caller opts out of).
  const metas = NAV_GROUPS.map((g, i) => ({ g, key: groupKey(g, i) }))
    .filter(({ key }) => !opts?.exclude?.has(key));
  const visibleKeys = new Set(metas.map((m) => m.key));

  // Bucket every top-level item into its EFFECTIVE group, honouring a cross-group
  // move (cfg.items[key].group). Hidden items stay visible in the editor so they
  // can be un-hidden; the plan/role filter still drops locked modules.
  const buckets: Record<string, EItem[]> = {};
  NAV_GROUPS.forEach((g, i) => {
    const baseKey = groupKey(g, i);
    g.items.forEach((base) => {
      if (opts?.visible && !opts.visible(base.href)) return;
      const key = itemKey(base.label, base.href);
      const target = cfg.items[key]?.group;
      const gk = target && visibleKeys.has(target) ? target : baseKey;
      if (!visibleKeys.has(gk)) return;
      (buckets[gk] ??= []).push(buildItem(base, cfg, opts));
    });
  });

  const built: EGroup[] = metas
    .map(({ g, key }) => {
      const gov = cfg.groups[key] ?? {};
      return {
        key,
        baseHeading: g.heading,
        heading: gov.heading ?? g.heading ?? "Main",
        hidden: !!gov.hidden,
        items: orderByKeys(buckets[key] ?? [], cfg.order[key]),
      };
    })
    // A group left with no editable items after filtering is dropped.
    .filter((grp) => grp.items.length > 0);
  return orderByKeys(built, cfg.order["__groups__"]);
}

// ---- Editor ----

export default function MenuEditor({
  value,
  onChange,
  excludeGroupKeys,
  isItemVisible,
}: {
  value: NavConfig;
  onChange: (next: NavConfig) => void;
  // Group headings to omit entirely (e.g. ["Administration"] on the client editor).
  excludeGroupKeys?: string[];
  // Predicate to keep only menus the workspace actually has (plan/role gated).
  isItemVisible?: (href: string) => boolean;
}) {
  const cfg = value;
  const exclude = useMemo(() => (excludeGroupKeys?.length ? new Set(excludeGroupKeys) : undefined), [excludeGroupKeys]);
  const groups = useMemo(() => buildGroups(cfg, { exclude, visible: isItemVisible }), [cfg, exclude, isItemVisible]);

  function setItemField(item: EItem, field: "label" | "href" | "icon" | "desc", v: string) {
    const next: NavConfig = { ...cfg, items: { ...cfg.items } };
    const cur = { ...(next.items[item.key] ?? {}) };
    const baseVal = field === "icon" ? item.base.icon : field === "desc" ? (item.base.desc ?? "") : (item.base[field] as string);
    if (v === baseVal) {
      // Matches the default → drop the override.
      delete cur[field];
    } else if (field !== "desc" && !v.trim()) {
      // label/href/icon must never be blank; a blank input means "no override".
      delete cur[field];
    } else {
      // For desc, an explicit "" is a real override that HIDES the tagline.
      (cur as Record<string, string>)[field] = field === "desc" ? v.trim() : v;
    }
    if (Object.keys(cur).length === 0) delete next.items[item.key];
    else next.items[item.key] = cur;
    onChange(next);
  }

  function toggleItemHidden(item: EItem) {
    const next: NavConfig = { ...cfg, items: { ...cfg.items } };
    const cur = { ...(next.items[item.key] ?? {}) };
    if (cur.hidden) delete cur.hidden;
    else cur.hidden = true;
    if (Object.keys(cur).length === 0) delete next.items[item.key];
    else next.items[item.key] = cur;
    onChange(next);
  }

  function revertItem(item: EItem) {
    const next: NavConfig = { ...cfg, items: { ...cfg.items } };
    delete next.items[item.key];
    onChange(next);
  }

  function toggleGroupHidden(group: EGroup) {
    const next: NavConfig = { ...cfg, groups: { ...cfg.groups } };
    const cur = { ...(next.groups[group.key] ?? {}) };
    if (cur.hidden) delete cur.hidden;
    else cur.hidden = true;
    if (Object.keys(cur).length === 0) delete next.groups[group.key];
    else next.groups[group.key] = cur;
    onChange(next);
  }

  function setGroupHeading(group: EGroup, v: string) {
    const next: NavConfig = { ...cfg, groups: { ...cfg.groups } };
    const cur = { ...(next.groups[group.key] ?? {}) };
    if (!v.trim() || v === (group.baseHeading ?? "")) delete cur.heading;
    else cur.heading = v;
    if (Object.keys(cur).length === 0) delete next.groups[group.key];
    else next.groups[group.key] = cur;
    onChange(next);
  }

  // Reorder within a scope: orderKey is "__groups__", a group key, or an item key.
  function move(orderKey: string, keys: string[], index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= keys.length) return;
    const arr = [...keys];
    [arr[index], arr[j]] = [arr[j], arr[index]];
    onChange({ ...cfg, order: { ...cfg.order, [orderKey]: arr } });
  }

  // Move a TOP-LEVEL item to a different group. Setting it back to its default
  // group clears the override. The item lands at the end of the target group.
  function setItemGroup(item: EItem, target: string) {
    const next: NavConfig = { ...cfg, items: { ...cfg.items } };
    const cur = { ...(next.items[item.key] ?? {}) };
    if (!target || target === itemBaseGroup(item.key)) delete cur.group;
    else cur.group = target;
    if (Object.keys(cur).length === 0) delete next.items[item.key];
    else next.items[item.key] = cur;
    onChange(next);
  }

  // Group options for the per-item "move to group" dropdown.
  const groupOptions = groups.map((g) => ({ key: g.key, heading: g.heading }));

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => {
        const groupKeys = groups.map((g) => g.key);
        const itemKeys = group.items.map((it) => it.key);
        return (
          <div key={group.key} className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${group.hidden ? "opacity-60" : ""}`}>
            {/* Group header */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <ReorderButtons onUp={() => move("__groups__", groupKeys, gi, -1)} onDown={() => move("__groups__", groupKeys, gi, 1)} first={gi === 0} last={gi === groups.length - 1} />
              <input
                value={group.heading}
                onChange={(e) => setGroupHeading(group, e.target.value)}
                placeholder="Group heading"
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 outline-none hover:border-slate-200 focus:border-blue-400 focus:bg-white"
              />
              <span className="text-xs text-slate-400">{group.items.length} items</span>
              <HideToggle hidden={group.hidden} onClick={() => toggleGroupHidden(group)} label="group" />
            </div>

            {/* Items */}
            <ul className="divide-y divide-slate-50">
              {group.items.map((item, ii) => (
                <ItemRow
                  key={item.key}
                  item={item}
                  depth={0}
                  onUp={() => move(group.key, itemKeys, ii, -1)}
                  onDown={() => move(group.key, itemKeys, ii, 1)}
                  first={ii === 0}
                  last={ii === group.items.length - 1}
                  onField={setItemField}
                  onToggleHidden={toggleItemHidden}
                  onRevert={revertItem}
                  moveChild={move}
                  currentGroupKey={group.key}
                  groupOptions={groupOptions}
                  onGroup={setItemGroup}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ---- Item row (recurses into children) ----

function ItemRow({
  item,
  depth,
  onUp,
  onDown,
  first,
  last,
  onField,
  onToggleHidden,
  onRevert,
  moveChild,
  currentGroupKey,
  groupOptions,
  onGroup,
}: {
  item: EItem;
  depth: number;
  onUp: () => void;
  onDown: () => void;
  first: boolean;
  last: boolean;
  onField: (item: EItem, field: "label" | "href" | "icon" | "desc", value: string) => void;
  onToggleHidden: (item: EItem) => void;
  onRevert: (item: EItem) => void;
  moveChild: (orderKey: string, keys: string[], index: number, dir: -1 | 1) => void;
  // Top-level only: move this item to another group.
  currentGroupKey?: string;
  groupOptions?: { key: string; heading: string }[];
  onGroup?: (item: EItem, target: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = item.children.length > 0;
  const childKeys = item.children.map((c) => c.key);
  const overridden =
    item.label !== item.base.label || item.href !== item.base.href || item.icon !== item.base.icon || item.desc !== (item.base.desc ?? "") || item.hidden;

  return (
    <li>
      <div className={`flex flex-wrap items-center gap-2 px-4 py-2.5 ${item.hidden ? "opacity-50" : ""}`} style={{ paddingLeft: depth ? 16 + depth * 20 : undefined }}>
        <ReorderButtons onUp={onUp} onDown={onDown} first={first} last={last} />

        {hasChildren ? (
          <button onClick={() => setOpen((o) => !o)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Expand submenu">
            <Icon name="chevronDown" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <span className="w-6" />
        )}

        <IconPicker value={item.icon} onChange={(v) => onField(item, "icon", v)} />

        <input
          value={item.label}
          onChange={(e) => onField(item, "label", e.target.value)}
          placeholder="Menu name"
          className="min-w-[8rem] flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
          <span className="text-xs font-medium text-slate-400">slug</span>
          <input
            value={item.href}
            onChange={(e) => onField(item, "href", e.target.value)}
            placeholder="/path"
            spellCheck={false}
            className="w-32 bg-transparent font-mono text-xs text-slate-700 outline-none"
          />
        </div>

        {/* Tagline / subtitle shown under the label in the sidebar. Blank hides it. */}
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
          <span className="text-xs font-medium text-slate-400">tagline</span>
          <input
            value={item.desc}
            onChange={(e) => onField(item, "desc", e.target.value)}
            placeholder="(none)"
            className="w-40 bg-transparent text-xs text-slate-700 outline-none"
          />
        </div>

        {/* Move to another group (top-level items only). */}
        {depth === 0 && groupOptions && groupOptions.length > 1 && onGroup && (
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            <span className="text-xs font-medium text-slate-400">group</span>
            <select
              value={currentGroupKey}
              onChange={(e) => onGroup(item, e.target.value)}
              className="max-w-[9rem] bg-transparent text-xs font-medium text-slate-700 outline-none"
              title="Move to group"
            >
              {groupOptions.map((g) => (
                <option key={g.key} value={g.key}>{g.heading}</option>
              ))}
            </select>
          </div>
        )}

        {overridden && (
          <button onClick={() => onRevert(item)} title="Revert to default" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Icon name="refresh" className="h-4 w-4" />
          </button>
        )}
        <HideToggle hidden={item.hidden} onClick={() => onToggleHidden(item)} label={item.label} />
      </div>

      {hasChildren && open && (
        <ul className="divide-y divide-slate-50 border-t border-slate-50 bg-slate-50/40">
          {item.children.map((child, ci) => (
            <ItemRow
              key={child.key}
              item={child}
              depth={depth + 1}
              onUp={() => moveChild(item.key, childKeys, ci, -1)}
              onDown={() => moveChild(item.key, childKeys, ci, 1)}
              first={ci === 0}
              last={ci === item.children.length - 1}
              onField={onField}
              onToggleHidden={onToggleHidden}
              onRevert={onRevert}
              moveChild={moveChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ---- Small controls ----

function ReorderButtons({ onUp, onDown, first, last }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean }) {
  return (
    <div className="flex flex-col">
      <button onClick={onUp} disabled={first} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move up">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="m18 15-6-6-6 6" /></svg>
      </button>
      <button onClick={onDown} disabled={last} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move down">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </div>
  );
}

function HideToggle({ hidden, onClick, label }: { hidden: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      title={hidden ? `Show ${label}` : `Hide ${label}`}
      aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
      className={`rounded-md p-1.5 transition ${hidden ? "text-slate-300 hover:bg-slate-100" : "text-blue-600 hover:bg-blue-50"}`}
    >
      <Icon name="eye" className="h-4 w-4" />
    </button>
  );
}

function IconPicker({ value, onChange }: { value: IconName; onChange: (v: IconName) => void }) {
  return (
    <label className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-blue-400" title={`Icon: ${value}`}>
      <Icon name={value} className="h-4 w-4" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as IconName)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Choose icon"
      >
        {ICON_NAMES.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  );
}

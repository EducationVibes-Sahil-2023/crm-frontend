"use client";

import { createElement, useEffect, useState } from "react";
import { Icon, ICON_NAMES, type IconName } from "@/components/icons";
import { getLucideForCustom } from "@/lib/lucideIcons";
import { ACCENT_PRESETS } from "@/lib/adminMenu";
import {
  APPEARANCE_EVENT,
  ICON_ANIMS,
  SIDEBAR_BG_PRESETS,
  SIDEBAR_TEXT_PRESETS,
  applyAppearance,
  loadAppearance,
  saveAppearance,
  type Appearance,
} from "@/lib/appearance";
import { NAV_GROUPS, type NavItem } from "@/lib/nav";
import { allowedFeatures, isHrefAllowed } from "@/lib/access";
import {
  EMPTY_NAV_CONFIG,
  groupKey,
  itemKey,
  itemBaseGroup,
  loadNavConfig,
  saveNavConfig,
  type NavConfig,
} from "@/lib/navConfig";

// System/admin groups clients shouldn't reorder or rename from the customizer.
const EXCLUDE_GROUPS = new Set(["Administration"]);

// ---- top-level editable menu tree (mirrors the nav editor, compacted) ----
type EItem = { key: string; base: NavItem; label: string; icon: IconName; color: string; hidden: boolean };
type EGroup = { key: string; heading: string; items: EItem[] };

function orderByKeys(list: EItem[], order?: string[]): EItem[] {
  if (!order || order.length === 0) return list;
  const pos = new Map(order.map((k, i) => [k, i]));
  return [...list]
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (pos.get(a.it.key) ?? order.length + a.i) - (pos.get(b.it.key) ?? order.length + b.i))
    .map((x) => x.it);
}

type BuildOpts = { exclude?: Set<string>; visible?: (href: string) => boolean };

function buildGroups(cfg: NavConfig, opts?: BuildOpts): EGroup[] {
  const metas = NAV_GROUPS.map((g, i) => ({ key: groupKey(g, i), heading: cfg.groups[groupKey(g, i)]?.heading ?? g.heading ?? "Menu" }))
    .filter((m) => !opts?.exclude?.has(m.key));
  const visibleKeys = new Set(metas.map((m) => m.key));
  // Bucket each item into its effective group (honouring a cross-group move).
  const buckets: Record<string, EItem[]> = {};
  NAV_GROUPS.forEach((g, i) => {
    const baseKey = groupKey(g, i);
    g.items.forEach((base) => {
      // Skip menus the workspace can't use (plan/role gated) when filtering.
      if (opts?.visible && !opts.visible(base.href)) return;
      const key = itemKey(base.label, base.href);
      const ov = cfg.items[key] ?? {};
      const target = ov.group && visibleKeys.has(ov.group) ? ov.group : baseKey;
      (buckets[target] ??= []).push({ key, base, label: ov.label ?? base.label, icon: (ov.icon ?? base.icon) as IconName, color: ov.color ?? base.color ?? "", hidden: !!ov.hidden });
    });
  });
  return metas
    .map((m) => ({ key: m.key, heading: m.heading, items: orderByKeys(buckets[m.key] ?? [], cfg.order[m.key]) }))
    .filter((grp) => grp.items.length > 0);
}

/**
 * Live slide-over that customizes the client sidebar — the same UX as the admin
 * menu customizer. Colours / icon style / motion write to the Appearance store;
 * per-item icon / colour / label / order / visibility write to the nav config.
 */
export default function ClientMenuCustomizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [appr, setAppr] = useState<Appearance>(loadAppearance);
  const [cfg, setCfg] = useState<NavConfig>(EMPTY_NAV_CONFIG);
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set());
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const load = () => { setAppr(loadAppearance()); setCfg(loadNavConfig()); setAllowed(allowedFeatures()); };
    load();
  }, [open]);

  // Filter: drop the admin group + any menus this workspace's plan doesn't unlock
  // (empty set = plan not resolved yet, so show everything to avoid a flash).
  const menuOpts: BuildOpts = { exclude: EXCLUDE_GROUPS, visible: (href: string) => allowed.size === 0 || isHrefAllowed(href, allowed) };

  // ---- appearance updates (persist + apply live + notify) ----
  function patchAppr(patch: Partial<Appearance>) {
    const next = { ...appr, ...patch };
    setAppr(next);
    saveAppearance(next);
    applyAppearance(next);
    window.dispatchEvent(new Event(APPEARANCE_EVENT));
  }

  // ---- nav config updates (persist + notify the sidebar) ----
  function commit(next: NavConfig) {
    setCfg(next);
    saveNavConfig(next);
  }
  function setItemField(item: EItem, field: "label" | "icon" | "color", value: string) {
    const next: NavConfig = { ...cfg, items: { ...cfg.items } };
    const cur = { ...(next.items[item.key] ?? {}) };
    const baseVal = (field === "icon" ? item.base.icon : field === "color" ? (item.base.color ?? "") : item.base.label) as string;
    if (!value.trim() || value === baseVal) delete cur[field];
    else (cur as Record<string, string>)[field] = value;
    if (Object.keys(cur).length === 0) delete next.items[item.key];
    else next.items[item.key] = cur;
    commit(next);
  }
  function toggleHidden(item: EItem) {
    const next: NavConfig = { ...cfg, items: { ...cfg.items } };
    const cur = { ...(next.items[item.key] ?? {}) };
    if (cur.hidden) delete cur.hidden;
    else cur.hidden = true;
    if (Object.keys(cur).length === 0) delete next.items[item.key];
    else next.items[item.key] = cur;
    commit(next);
  }
  // Move an item up/down — crossing group boundaries when it's at a group edge.
  function move(gi: number, ii: number, dir: -1 | 1) {
    const gs = buildGroups(cfg, menuOpts);
    const group = gs[gi];
    if (!group) return;
    const to = ii + dir;
    const next: NavConfig = { ...cfg, order: { ...cfg.order }, items: { ...cfg.items } };

    if (to >= 0 && to < group.items.length) {
      // Reorder within the same group.
      const keys = group.items.map((x) => x.key);
      [keys[ii], keys[to]] = [keys[to], keys[ii]];
      next.order[group.key] = keys;
    } else {
      // Cross into the adjacent group (bottom of previous / top of next).
      const tgi = gi + dir;
      if (tgi < 0 || tgi >= gs.length) return;
      const target = gs[tgi];
      const item = group.items[ii];
      next.order[group.key] = group.items.map((x) => x.key).filter((k) => k !== item.key);
      const tgtKeys = target.items.map((x) => x.key);
      if (dir === -1) tgtKeys.push(item.key);
      else tgtKeys.unshift(item.key);
      next.order[target.key] = tgtKeys;
      const cur = { ...(next.items[item.key] ?? {}) };
      if (target.key !== itemBaseGroup(item.key)) cur.group = target.key;
      else delete cur.group;
      if (Object.keys(cur).length === 0) delete next.items[item.key];
      else next.items[item.key] = cur;
    }
    commit(next);
  }
  function resetAll() {
    commit({ items: {}, groups: {}, order: {} });
    patchAppr({ sidebarBg: "#ffffff", sidebarText: "#334155", sidebarAccent: "", sidebarIconChips: true, sidebarIconStyle: "outline", sidebarIconAnim: "pop", sidebarDescriptions: true, sidebarQuickActions: true });
  }

  if (!open) return null;
  const groups = buildGroups(cfg, menuOpts);
  const filled = appr.sidebarIconStyle === "filled";

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
            <Icon name="settings" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Customize menu</p>
            <p className="text-[11px] text-slate-400">Colours, icons & order</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Menu colours */}
          <Section title="Menu colours">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Active colour</p>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_PRESETS.map((c) => (
                  <button key={c} onClick={() => patchAppr({ sidebarAccent: c })} aria-label={`Accent ${c}`}
                    className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${appr.sidebarAccent.toLowerCase() === c.toLowerCase() ? "ring-slate-900" : "ring-transparent hover:ring-slate-300"}`}
                    style={{ backgroundColor: c }} />
                ))}
                <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-slate-500">
                  <Icon name="plus" className="h-4 w-4" />
                  <input type="color" value={appr.sidebarAccent || "#2563eb"} onChange={(e) => patchAppr({ sidebarAccent: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                </label>
                <button onClick={() => patchAppr({ sidebarAccent: "" })} className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${appr.sidebarAccent ? "border-slate-200 text-slate-500 hover:bg-slate-50" : "border-blue-300 bg-blue-50 text-blue-600"}`}>Theme</button>
              </div>
            </div>
            <ColorRow label="Background" value={appr.sidebarBg} presets={SIDEBAR_BG_PRESETS} onChange={(v) => patchAppr({ sidebarBg: v })} />
            <ColorRow label="Text" value={appr.sidebarText} presets={SIDEBAR_TEXT_PRESETS} onChange={(v) => patchAppr({ sidebarText: v })} />
          </Section>

          {/* Icon style */}
          <Section title="Icon style">
            <Segmented value={appr.sidebarIconStyle} onChange={(v) => patchAppr({ sidebarIconStyle: v as "outline" | "filled" })}
              options={[{ value: "outline", label: "Outline" }, { value: "filled", label: "Filled" }]} />
          </Section>

          {/* Icon background */}
          <Section title="Icon background">
            <Segmented value={appr.sidebarIconChips ? "chips" : "plain"} onChange={(v) => patchAppr({ sidebarIconChips: v === "chips" })}
              options={[{ value: "plain", label: "Plain" }, { value: "chips", label: "Colour chip" }]} />
            <p className="mt-1 text-[11px] text-slate-400">Plain shows normal icons; Colour chip puts each icon on a tinted background.</p>
          </Section>

          {/* Icon motion */}
          <Section title="Icon motion">
            <div className="grid grid-cols-3 gap-1.5">
              {ICON_ANIMS.map((a) => {
                const on = appr.sidebarIconAnim === a.value;
                const cls = a.value === "none" ? "" : a.value === "pulse" ? "nx-ico nx-ico-pulse" : `nx-ico nx-ico-${a.value}`;
                return (
                  <button key={a.value} onClick={() => patchAppr({ sidebarIconAnim: a.value })}
                    className={`group flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-semibold transition ${on ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    <span className={`inline-flex h-6 items-center ${cls}`}>{createElement(getLucideForCustom("ai"), { size: 18 })}</span>
                    {a.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Hover a menu item to preview (Pulse animates continuously).</p>
          </Section>

          {/* Layout — Control-Center style extras */}
          <Section title="Layout">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-600">Item descriptions</span>
              <Segmented value={appr.sidebarDescriptions ? "on" : "off"} onChange={(v) => patchAppr({ sidebarDescriptions: v === "on" })}
                options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-600">Quick actions</span>
              <Segmented value={appr.sidebarQuickActions ? "on" : "off"} onChange={(v) => patchAppr({ sidebarQuickActions: v === "on" })}
                options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Descriptions add a subtitle under each label; Quick actions pin a shortcut grid above the menu.</p>
          </Section>

          {/* Menu items */}
          <Section title="Menu items">
            <div className="space-y-4">
              {groups.map((group, gi) => {
                return (
                  <div key={group.key}>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.heading}</p>
                    <div className="space-y-2">
                      {group.items.map((item, idx) => (
                        <div key={item.key} className={`rounded-xl border border-slate-200 p-2.5 ${item.hidden ? "opacity-60" : ""}`}>
                          <div className="flex items-center gap-2">
                            {/* icon picker */}
                            <div className="relative">
                              <button onClick={() => { setIconPickerFor(iconPickerFor === item.key ? null : item.key); setColorPickerFor(null); }} title="Change icon"
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm" style={{ backgroundColor: item.color || "#64748b" }}>
                                {createElement(getLucideForCustom(item.icon), { size: 18, strokeWidth: filled ? 2.6 : 1.8 })}
                              </button>
                              {iconPickerFor === item.key && (
                                <IconGrid current={item.icon} onPick={(n) => { setItemField(item, "icon", n); setIconPickerFor(null); }} onClose={() => setIconPickerFor(null)} />
                              )}
                            </div>
                            {/* label */}
                            <input value={item.label} onChange={(e) => setItemField(item, "label", e.target.value)}
                              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15" />
                            {/* colour */}
                            <div className="relative">
                              <button onClick={() => { setColorPickerFor(colorPickerFor === item.key ? null : item.key); setIconPickerFor(null); }} title="Icon colour"
                                className="flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ring-slate-200">
                                <span className="h-4 w-4 rounded-full" style={item.color ? { backgroundColor: item.color } : { background: "conic-gradient(#ef4444,#eab308,#22c55e,#3b82f6,#a855f7,#ef4444)" }} />
                              </button>
                              {colorPickerFor === item.key && (
                                <ColorGrid current={item.color} onPick={(c) => { setItemField(item, "color", c); setColorPickerFor(null); }} onClose={() => setColorPickerFor(null)} />
                              )}
                            </div>
                          </div>
                          {/* row actions */}
                          <div className="mt-2 flex items-center gap-1">
                            <IconBtn name="chevronDown" className="rotate-180" disabled={gi === 0 && idx === 0} onClick={() => move(gi, idx, -1)} title="Move up" />
                            <IconBtn name="chevronDown" disabled={gi === groups.length - 1 && idx === group.items.length - 1} onClick={() => move(gi, idx, 1)} title="Move down" />
                            <span className="mx-1 truncate text-[11px] text-slate-400">{item.base.href}</span>
                            <button onClick={() => toggleHidden(item)}
                              className={`ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${item.hidden ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}>
                              <Icon name="eye" className="h-3.5 w-3.5" /> {item.hidden ? "Hidden" : "Visible"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
          <button onClick={resetAll} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            <Icon name="refresh" className="h-4 w-4" /> Reset
          </button>
          <button onClick={onClose} className="ml-auto rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:shadow-xl">
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}

// ---- building blocks (mirror the admin customizer) ----
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${o.value === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorRow({ label, value, presets, onChange }: { label: string; value: string; presets: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <p className="w-20 shrink-0 text-[11px] font-semibold text-slate-500">{label}</p>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {presets.map((c) => (
          <button key={c} onClick={() => onChange(c)} aria-label={`${label} ${c}`}
            className={`h-6 w-6 rounded-full ring-1 ring-inset ring-slate-200 transition ${value.toLowerCase() === c.toLowerCase() ? "outline outline-2 outline-offset-1 outline-slate-900" : "hover:ring-slate-400"}`}
            style={{ backgroundColor: c }} />
        ))}
        <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-slate-500">
          <Icon name="plus" className="h-3.5 w-3.5" />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

function IconBtn({ name, onClick, disabled, title, className = "" }: { name: IconName; onClick: () => void; disabled?: boolean; title: string; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30">
      <Icon name={name} className={`h-4 w-4 ${className}`} />
    </button>
  );
}

function IconGrid({ current, onPick, onClose }: { current: IconName; onPick: (n: IconName) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const keys = q.trim() ? ICON_NAMES.filter((k) => k.toLowerCase().includes(q.trim().toLowerCase())) : ICON_NAMES;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-0 top-11 z-20 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons…"
          className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15" />
        <div className="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto">
          {keys.map((n) => (
            <button key={n} onClick={() => onPick(n)} title={n}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${n === current ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
              {createElement(getLucideForCustom(n), { size: 18 })}
            </button>
          ))}
          {keys.length === 0 && <p className="col-span-6 py-3 text-center text-[11px] text-slate-400">No icons match “{q}”.</p>}
        </div>
      </div>
    </>
  );
}

function ColorGrid({ current, onPick, onClose }: { current: string; onPick: (c: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          {ACCENT_PRESETS.map((c) => (
            <button key={c} onClick={() => onPick(c)} title={c} aria-label={`Colour ${c}`}
              className={`h-7 w-7 rounded-full ring-2 ring-offset-1 transition ${current.toLowerCase() === c.toLowerCase() ? "ring-slate-900" : "ring-transparent hover:ring-slate-300"}`}
              style={{ backgroundColor: c }} />
          ))}
          <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-slate-500" title="Custom colour">
            <Icon name="plus" className="h-4 w-4" />
            <input type="color" value={current || "#4f46e5"} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
        <button onClick={() => onPick("")} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Default (theme colour)
        </button>
      </div>
    </>
  );
}

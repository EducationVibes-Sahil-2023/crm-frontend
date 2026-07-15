"use client";

import { createElement, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { getLucide, LUCIDE_ICON_KEYS } from "@/lib/lucideIcons";
import {
  ACCENT_PRESETS,
  ICON_ANIMS,
  type AdminMenuConfig,
  type AdminMenuItem,
} from "@/lib/adminMenu";

/** Render a lucide icon by its stored key. */
function LIcon({ name, size = 18, filled = false }: { name: string; size?: number; filled?: boolean }) {
  return createElement(getLucide(name), { size, strokeWidth: filled ? 2.6 : 1.8 });
}

/**
 * Slide-over panel that live-edits the super-admin sidebar: position, accent,
 * icon style, density, and per-item icon/colour/label/order/visibility.
 * All changes apply immediately (each control calls `onChange` → persisted).
 */
export default function AdminMenuCustomizer({
  open,
  onClose,
  config,
  onChange,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  config: AdminMenuConfig;
  onChange: (c: AdminMenuConfig) => void;
  onReset: () => void;
}) {
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

  const patch = (partial: Partial<AdminMenuConfig>) => onChange({ ...config, ...partial });
  const patchItem = (key: string, partial: Partial<AdminMenuItem>) =>
    onChange({ ...config, items: config.items.map((i) => (i.key === key ? { ...i, ...partial } : i)) });
  const move = (key: string, dir: -1 | 1) => {
    const idx = config.items.findIndex((i) => i.key === key);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= config.items.length) return;
    const items = [...config.items];
    [items[idx], items[to]] = [items[to], items[idx]];
    onChange({ ...config, items });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <Icon name="settings" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Customize menu</p>
            <p className="text-[11px] text-slate-400">Position, colours, icons & order</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Position */}
          <Section title="Position">
            <Segmented
              value={config.side}
              onChange={(v) => patch({ side: v as "left" | "right" })}
              options={[{ value: "left", label: "Left", icon: "arrowLeft" }, { value: "right", label: "Right", icon: "export" }]}
            />
          </Section>

          {/* Alignment */}
          <Section title="Item alignment">
            <Segmented
              value={config.align}
              onChange={(v) => patch({ align: v as "left" | "center" })}
              options={[{ value: "left", label: "Left", icon: "list" }, { value: "center", label: "Center", icon: "grid" }]}
            />
          </Section>

          {/* Menu colours */}
          <Section title="Menu colours">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Accent</p>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => patch({ accent: c })}
                    className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${config.accent.toLowerCase() === c.toLowerCase() ? "ring-slate-900" : "ring-transparent hover:ring-slate-300"}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Accent ${c}`}
                  />
                ))}
                <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-slate-500 hover:text-slate-600">
                  <Icon name="plus" className="h-4 w-4" />
                  <input type="color" value={config.accent} onChange={(e) => patch({ accent: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                </label>
              </div>
            </div>
            <ColorRow label="Background" value={config.sidebarBg} onChange={(v) => patch({ sidebarBg: v })} presets={["#ffffff", "#f8fafc", "#0f172a", "#1e293b", "#111827"]} />
            <ColorRow label="Text" value={config.textColor} onChange={(v) => patch({ textColor: v })} presets={["#475569", "#334155", "#0f172a", "#e2e8f0", "#f1f5f9"]} />
          </Section>

          {/* Icon style + density */}
          <Section title="Icon style">
            <Segmented
              value={config.iconStyle}
              onChange={(v) => patch({ iconStyle: v as "outline" | "filled" })}
              options={[{ value: "outline", label: "Outline", icon: "star" }, { value: "filled", label: "Filled", icon: "star" }]}
            />
          </Section>

          {/* Icon motion */}
          <Section title="Icon motion">
            <div className="grid grid-cols-3 gap-1.5">
              {ICON_ANIMS.map((a) => {
                const on = config.iconAnim === a.value;
                return (
                  <button
                    key={a.value}
                    onClick={() => patch({ iconAnim: a.value })}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-semibold transition ${on ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    <span className={`group flex h-7 w-7 items-center justify-center rounded-md ${on ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`nx-ico ${a.value === "pulse" ? "nx-ico-pulse" : `nx-ico-${a.value}`}`}><Icon name="star" className="h-4 w-4" filled /></span>
                    </span>
                    {a.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Hover a menu item to preview (Pulse animates continuously).</p>
          </Section>

          <Section title="Density">
            <Segmented
              value={config.density}
              onChange={(v) => patch({ density: v as "comfortable" | "compact" })}
              options={[{ value: "comfortable", label: "Comfortable", icon: "list" }, { value: "compact", label: "Compact", icon: "menu" }]}
            />
          </Section>

          {/* Toggles */}
          <Section title="Display">
            <Toggle label="Show item descriptions" checked={config.showDescriptions} onChange={(v) => patch({ showDescriptions: v })} />
            <Toggle label="Show quick actions" checked={config.showQuickActions} onChange={(v) => patch({ showQuickActions: v })} />
          </Section>

          {/* Menu items */}
          <Section title="Menu items">
            <div className="space-y-2">
              {config.items.map((item, idx) => (
                <div key={item.key} className={`rounded-xl border border-slate-200 p-2.5 transition ${item.hidden ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2">
                    {/* Icon picker */}
                    <div className="relative">
                      <button
                        onClick={() => setIconPickerFor(iconPickerFor === item.key ? null : item.key)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm"
                        style={{ backgroundColor: item.color }}
                        title="Change icon"
                      >
                        <LIcon name={item.icon} size={18} filled={config.iconStyle === "filled"} />
                      </button>
                      {iconPickerFor === item.key && (
                        <IconGrid
                          current={item.icon}
                          onPick={(name) => { patchItem(item.key, { icon: name }); setIconPickerFor(null); }}
                          onClose={() => setIconPickerFor(null)}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <input
                      value={item.label}
                      onChange={(e) => patchItem(item.key, { label: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
                    />

                    {/* Per-item colour */}
                    <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-slate-200" title="Item colour">
                      <span className="block h-full w-full" style={{ backgroundColor: item.color }} />
                      <input type="color" value={item.color} onChange={(e) => patchItem(item.key, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                    </label>
                  </div>

                  {/* Row actions */}
                  <div className="mt-2 flex items-center gap-1">
                    <IconBtn name="chevronDown" className="rotate-180" disabled={idx === 0} onClick={() => move(item.key, -1)} title="Move up" />
                    <IconBtn name="chevronDown" disabled={idx === config.items.length - 1} onClick={() => move(item.key, 1)} title="Move down" />
                    <span className="mx-1 truncate text-[11px] text-slate-400">{item.href}</span>
                    <button
                      onClick={() => patchItem(item.key, { hidden: !item.hidden })}
                      className={`ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${item.hidden ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
                    >
                      <Icon name="eye" className="h-3.5 w-3.5" /> {item.hidden ? "Hidden" : "Visible"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
          <button onClick={onReset} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            <Icon name="refresh" className="h-4 w-4" /> Reset
          </button>
          <button onClick={onClose} className="ml-auto rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-xl">
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}

// ---- small building blocks ----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string; icon: IconName }[] }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Icon name={o.icon} className="h-3.5 w-3.5" filled={o.label === "Filled"} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ColorRow({ label, value, onChange, presets }: { label: string; value: string; onChange: (v: string) => void; presets: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <p className="w-20 shrink-0 text-[11px] font-semibold text-slate-500">{label}</p>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {presets.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`h-6 w-6 rounded-full ring-1 ring-inset ring-slate-200 transition ${value.toLowerCase() === c.toLowerCase() ? "outline outline-2 outline-offset-1 outline-slate-900" : "hover:ring-slate-400"}`}
            style={{ backgroundColor: c }}
            aria-label={`${label} ${c}`}
          />
        ))}
        <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-slate-500">
          <Icon name="plus" className="h-3.5 w-3.5" />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:bg-slate-50">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-indigo-500" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function IconBtn({ name, onClick, disabled, title, className = "" }: { name: IconName; onClick: () => void; disabled?: boolean; title: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon name={name} className={`h-4 w-4 ${className}`} />
    </button>
  );
}

function IconGrid({ current, onPick, onClose }: { current: string; onPick: (n: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const keys = q.trim() ? LUCIDE_ICON_KEYS.filter((k) => k.includes(q.trim().toLowerCase())) : LUCIDE_ICON_KEYS;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-0 top-11 z-20 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search icons…"
          className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
        />
        <div className="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto">
          {keys.map((n) => (
            <button
              key={n}
              onClick={() => onPick(n)}
              title={n}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${n === current ? "bg-indigo-500 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
            >
              <LIcon name={n} size={18} />
            </button>
          ))}
          {keys.length === 0 && <p className="col-span-6 py-3 text-center text-[11px] text-slate-400">No icons match “{q}”.</p>}
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";
import {
  ACCENTS,
  APPEARANCE_EVENT,
  BACKGROUNDS,
  DENSITIES,
  DEFAULT_APPEARANCE,
  FONTS,
  PAGE_SIZE_OPTIONS,
  RADII,
  SIDEBAR_BG_PRESETS,
  SIDEBAR_TEXT_PRESETS,
  ICON_ANIMS,
  accentSwatch,
  applyAppearance,
  bgValue,
  loadAppearance,
  saveAppearance,
  type AccentKey,
  type Appearance,
  type BgKey,
  type Density,
  type FontKey,
  type Radius,
} from "@/lib/appearance";
import { getLucideForCustom } from "@/lib/lucideIcons";
import { createElement } from "react";

export default function AppearanceSetupPage() {
  const toast = useToast();
  const [a, setA] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const read = () => setA(loadAppearance());
    read();
  }, []);

  // Persist + apply live + notify the rest of the app.
  function update(patch: Partial<Appearance>) {
    const next = { ...a, ...patch };
    setA(next);
    saveAppearance(next);
    applyAppearance(next);
    window.dispatchEvent(new Event(APPEARANCE_EVENT));
  }

  function reset() {
    update(DEFAULT_APPEARANCE);
    toast.info("Appearance reset", "Restored the default theme.");
    logActivity("Reset CRM appearance", { category: "setup" });
  }

  function saveExplicit() {
    saveAppearance(a);
    toast.success("Appearance saved", "Your theme is applied across the CRM.");
    logActivity("Updated CRM appearance", { category: "setup", target: `${ACCENTS[a.accent].label} · ${DENSITIES[a.density].label}` });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Theme &amp; UI</h1>
          <p className="mt-1 text-sm text-slate-500">
            Customize the CRM look &amp; feel — accent color, font, density, roundness and table defaults. Applies for everyone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Reset
          </button>
          <button onClick={saveExplicit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Controls */}
        <div className="space-y-6 lg:col-span-2">
          {/* Accent */}
          <Section title="Accent color" desc="The brand color used across buttons, links, highlights and gradients.">
            <div className="flex flex-wrap gap-2.5">
              {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
                const active = a.accent === key;
                return (
                  <button
                    key={key}
                    onClick={() => update({ accent: key })}
                    title={ACCENTS[key].label}
                    aria-label={ACCENTS[key].label}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ring-offset-2 transition ${active ? "ring-2 ring-slate-900" : "hover:scale-105"}`}
                    style={{ background: accentSwatch(key) }}
                  >
                    {active && <Icon name="check" className="h-5 w-5 text-white" />}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Font */}
          <Section title="Font" desc="The typeface used throughout the interface.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(FONTS) as FontKey[]).map((key) => {
                const active = a.font === key;
                return (
                  <button
                    key={key}
                    onClick={() => update({ font: key })}
                    style={{ fontFamily: FONTS[key].stack }}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-base font-semibold">Aa</span>
                    <span className="text-xs text-slate-500">{FONTS[key].label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Density */}
          <Section title="Density" desc="How compact the interface is — scales the whole UI.">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(DENSITIES) as Density[]).map((key) => {
                const active = a.density === key;
                return (
                  <button
                    key={key}
                    onClick={() => update({ density: key })}
                    className={`rounded-xl border p-3 text-left transition ${
                      active ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">{DENSITIES[key].label}</p>
                    <p className="text-xs text-slate-500">{DENSITIES[key].desc}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Radius */}
          <Section title="Corner roundness" desc="The radius applied to cards, buttons and inputs.">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RADII) as Radius[]).map((key) => {
                const active = a.radius === key;
                return (
                  <button
                    key={key}
                    onClick={() => update({ radius: key })}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                      active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="h-5 w-5 border-2 border-current"
                      style={{ borderRadius: `${RADII[key].scale * 0.5}rem` }}
                    />
                    {RADII[key].label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Panel background */}
          <Section title="Panel background" desc="The background color of the main content area next to the sidebar.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(BACKGROUNDS) as BgKey[]).map((key) => {
                const active = a.bg === key;
                const swatch = bgValue(key, a.accent);
                return (
                  <button
                    key={key}
                    onClick={() => update({ bg: key })}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="h-7 w-7 shrink-0 rounded-lg border border-slate-200 shadow-inner"
                      style={{ background: swatch }}
                    />
                    <span className="text-xs font-medium">{BACKGROUNDS[key].label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Sidebar colours */}
          <Section title="Sidebar colours" desc="The background and text colour of the left navigation menu. The active-item colour follows your accent.">
            <div className="space-y-3">
              <SwatchRow
                label="Background"
                value={a.sidebarBg}
                presets={SIDEBAR_BG_PRESETS}
                onChange={(v) => update({ sidebarBg: v })}
              />
              <SwatchRow
                label="Text & icons"
                value={a.sidebarText}
                presets={SIDEBAR_TEXT_PRESETS}
                onChange={(v) => update({ sidebarText: v })}
              />
              {/* Mini preview */}
              <div className="mt-1 flex items-center gap-2 rounded-xl p-2" style={{ backgroundColor: a.sidebarBg, color: a.sidebarText }}>
                {["dashboard", "leads", "gmail", "settings"].map((ic) => (
                  <span key={ic} className="inline-flex">
                    {createElement(getLucideForCustom(ic), { size: 18, strokeWidth: a.sidebarIconStyle === "filled" ? 2.6 : 1.8 })}
                  </span>
                ))}
                <span className="ml-1 text-xs font-medium">Menu preview</span>
              </div>
            </div>
          </Section>

          {/* Sidebar icons */}
          <Section title="Sidebar icons" desc="Icon weight and motion for the navigation menu (modern lucide icons).">
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Icon style</p>
                <div className="flex gap-2">
                  {(["outline", "filled"] as const).map((s) => {
                    const active = a.sidebarIconStyle === s;
                    return (
                      <button
                        key={s}
                        onClick={() => update({ sidebarIconStyle: s })}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium capitalize transition ${
                          active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {createElement(getLucideForCustom("dashboard"), { size: 18, strokeWidth: s === "filled" ? 2.6 : 1.8 })}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Icon background</p>
                <div className="flex gap-2">
                  {([["plain", "Plain"], ["chips", "Colour chip"]] as const).map(([val, label]) => {
                    const active = (val === "chips") === a.sidebarIconChips;
                    return (
                      <button
                        key={val}
                        onClick={() => update({ sidebarIconChips: val === "chips" })}
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                          active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Icon motion — hover to preview (Pulse animates continuously)</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {ICON_ANIMS.map((anim) => {
                    const active = a.sidebarIconAnim === anim.value;
                    const cls = anim.value === "none" ? "" : anim.value === "pulse" ? "nx-ico nx-ico-pulse" : `nx-ico nx-ico-${anim.value}`;
                    return (
                      <button
                        key={anim.value}
                        onClick={() => update({ sidebarIconAnim: anim.value })}
                        className={`group flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[11px] font-semibold transition ${
                          active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`inline-flex h-6 items-center ${cls}`}>
                          {createElement(getLucideForCustom("ai"), { size: 18 })}
                        </span>
                        {anim.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Item descriptions</p>
                  <p className="text-xs text-slate-500">Show a one-line subtitle under each menu label (Control-Center style).</p>
                </div>
                <Toggle on={a.sidebarDescriptions} onClick={() => update({ sidebarDescriptions: !a.sidebarDescriptions })} label="Item descriptions" />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Quick actions</p>
                  <p className="text-xs text-slate-500">Pin a shortcut grid (New lead, Compose…) above the menu.</p>
                </div>
                <Toggle on={a.sidebarQuickActions} onClick={() => update({ sidebarQuickActions: !a.sidebarQuickActions })} label="Quick actions" />
              </label>
            </div>
          </Section>

          {/* Tables */}
          <Section title="Tables" desc="Defaults for data tables across the CRM.">
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Rows per page (default)</p>
                <div className="flex flex-wrap gap-2">
                  {PAGE_SIZE_OPTIONS.map((n) => {
                    const active = a.tablePageSize === n;
                    return (
                      <button
                        key={n}
                        onClick={() => update({ tablePageSize: n })}
                        className={`min-w-[3rem] rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Sticky table header</p>
                  <p className="text-xs text-slate-500">Keep column headers visible while scrolling.</p>
                </div>
                <Toggle on={a.stickyHeader} onClick={() => update({ stickyHeader: !a.stickyHeader })} label="Sticky header" />
              </label>
            </div>
          </Section>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Live preview</p>
            <div className="rounded-2xl border border-slate-200 p-4" style={{ background: bgValue(a.bg, a.accent) }}>
              <Preview pageSize={a.tablePageSize} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">{desc}</p>
      {children}
    </div>
  );
}

function SwatchRow({ label, value, presets, onChange }: { label: string; value: string; presets: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="w-24 shrink-0 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            aria-label={`${label} ${c}`}
            className={`h-7 w-7 rounded-lg ring-1 ring-inset ring-slate-200 transition ${value.toLowerCase() === c.toLowerCase() ? "outline outline-2 outline-offset-1 outline-slate-900" : "hover:scale-105"}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-slate-500">
          <Icon name="plus" className="h-4 w-4" />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-blue-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// A self-contained preview that reflects accent / radius / font / density live.
function Preview({ pageSize }: { pageSize: number }) {
  const rows = [
    { name: "Aarav Sharma", status: "New", tone: "bg-blue-100 text-blue-700" },
    { name: "Diya Patel", status: "Won", tone: "bg-emerald-100 text-emerald-700" },
    { name: "Kabir Mehta", status: "Lost", tone: "bg-rose-100 text-rose-700" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%)]" />
        <p className="relative text-sm font-bold">Sample header</p>
        <p className="relative text-xs text-blue-100">This is how surfaces look</p>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Primary</button>
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Secondary</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Accent</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Success</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Warning</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {rows.map((r, i) => (
            <div key={r.name} className={`flex items-center justify-between gap-2 px-3 py-2 ${i > 0 ? "border-t border-slate-100" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white">
                  {r.name[0]}
                </span>
                <span className="text-xs font-medium text-slate-700">{r.name}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.tone}`}>{r.status}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-slate-400">Tables show {pageSize} rows per page by default</p>
      </div>
    </div>
  );
}

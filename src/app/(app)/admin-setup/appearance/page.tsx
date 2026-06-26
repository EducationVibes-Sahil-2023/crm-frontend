"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";
import {
  ACCENTS,
  APPEARANCE_EVENT,
  DENSITIES,
  DEFAULT_APPEARANCE,
  FONTS,
  PAGE_SIZE_OPTIONS,
  RADII,
  accentSwatch,
  applyAppearance,
  loadAppearance,
  saveAppearance,
  type AccentKey,
  type Appearance,
  type Density,
  type FontKey,
  type Radius,
} from "@/lib/appearance";

export default function AppearanceSetupPage() {
  const toast = useToast();
  const [a, setA] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    setA(loadAppearance());
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
            <Preview pageSize={a.tablePageSize} />
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

"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";
import {
  DEFAULT_BRANDING,
  loadBranding,
  readLogo,
  saveBranding,
  initials,
  type Branding,
} from "@/lib/branding";
import { usePlatform } from "@/lib/platform";

export default function BrandingSetupPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const [b, setB] = useState<Branding>(DEFAULT_BRANDING);
  const platformName = usePlatform().brand.name || "CRM";

  useEffect(() => {
    const read = () => setB(loadBranding());
    read();
  }, []);

  function patch(p: Partial<Branding>) {
    setB((prev) => ({ ...prev, ...p }));
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) e.target.value = "";
    if (!file) return;
    try {
      patch({ logo: await readLogo(file) });
    } catch (err) {
      toast.error("Couldn't use that image", (err as Error).message);
    }
  }

  async function onFavicon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) e.target.value = "";
    if (!file) return;
    try {
      patch({ favicon: await readLogo(file) });
    } catch (err) {
      toast.error("Couldn't use that icon", (err as Error).message);
    }
  }

  function save() {
    // Name + tagline are optional; the UI falls back to the workspace name.
    const next: Branding = { ...b, appName: b.appName.trim(), tagline: b.tagline.trim() };
    saveBranding(next);
    setB(next);
    logActivity("Updated CRM branding", { category: "setup" });
    toast.success("Branding saved", "Your branding is live across the app.");
  }

  function reset() {
    saveBranding(DEFAULT_BRANDING);
    setB(DEFAULT_BRANDING);
    toast.info("Branding reset", "Restored the default Nexus branding.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Branding</h1>
        <p className="mt-1 text-sm text-slate-500">
          Set your CRM logo and name. Applied instantly to the sidebar, the login screen and the browser tab.
        </p>
      </header>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Logo */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Logo</label>
          <div className="flex items-center gap-4">
            <span
              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-xl font-bold text-white shadow"
              style={b.logo ? { backgroundColor: "#f1f5f9" } : undefined}
            >
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt="Logo preview" className="object-contain" style={{ width: `${b.logoWidth}%`, height: `${b.logoHeight}%` }} />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600">{initials(b.appName || platformName)}</span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Icon name="upload" className="h-4 w-4" /> Upload logo
              </button>
              {b.logo && (
                <button
                  onClick={() => patch({ logo: null })}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <Icon name="trash" className="h-4 w-4" /> Remove
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Square PNG/SVG works best. Max 512 KB.</p>

          {/* Logo size — with a live preview that updates as you drag */}
          {b.logo && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <SizeSlider label="Logo width" value={b.logoWidth} onChange={(v) => patch({ logoWidth: v })} />
                <SizeSlider label="Logo height" value={b.logoHeight} onChange={(v) => patch({ logoHeight: v })} />
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <span
                  className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200"
                  style={{ width: `${Math.round(132 * b.logoWidth / 100)}px`, height: `${Math.round(44 * b.logoHeight / 100)}px` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.logo} alt="Logo size preview" className="h-full w-full object-contain" />
                </span>
                <span className="text-xs font-medium text-slate-400">Live size — {b.logoWidth}% wide · {b.logoHeight}% tall</span>
              </div>
            </div>
          )}
        </div>

        {/* Favicon */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Favicon</label>
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
              {b.favicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.favicon} alt="Favicon preview" className="h-full w-full object-contain" />
              ) : (
                <Icon name="star" className="h-5 w-5" />
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => faviconRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Icon name="upload" className="h-4 w-4" /> Upload favicon
              </button>
              {b.favicon && (
                <button
                  onClick={() => patch({ favicon: null })}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <Icon name="trash" className="h-4 w-4" /> Remove
                </button>
              )}
              <input ref={faviconRef} type="file" accept="image/*,.ico" onChange={onFavicon} className="hidden" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Shown in the browser tab. 32×32 PNG or ICO works best. Max 512 KB.</p>
        </div>

        {/* Name + tagline */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">CRM name <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              value={b.appName}
              onChange={(e) => patch({ appName: e.target.value })}
              placeholder={platformName}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Tagline / edition <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              value={b.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="Leave blank for none"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Show logo only */}
        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Show logo only</p>
            <p className="text-xs text-slate-500">Hide the name &amp; tagline in the sidebar — show just the logo.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={b.logoOnly}
            aria-label="Show logo only"
            onClick={() => patch({ logoOnly: !b.logoOnly })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${b.logoOnly ? "bg-blue-600" : "bg-slate-300"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${b.logoOnly ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </label>

        {/* Live preview */}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Sidebar preview</p>
          <div className="flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <span
              className={`flex items-center justify-center overflow-hidden rounded-lg text-sm font-bold text-white ${b.logo && b.logoOnly ? "flex-1" : ""}`}
              style={b.logo
                ? b.logoOnly
                  ? { height: `${Math.round(48 * b.logoHeight / 100)}px` }
                  : { width: `${Math.round(132 * b.logoWidth / 100)}px`, height: `${Math.round(44 * b.logoHeight / 100)}px` }
                : { width: 36, height: 36, background: "linear-gradient(to bottom right, #3b82f6, #4f46e5)" }}
            >
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt="" className="h-full w-full object-contain" />
              ) : (
                initials(b.appName || platformName)
              )}
            </span>
            {!b.logoOnly && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{b.appName || platformName}</p>
                {b.tagline && <p className="truncate text-xs text-slate-500">{b.tagline}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={reset} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
            Reset
          </button>
          <button onClick={save} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            Save branding
          </button>
        </div>
      </div>
    </div>
  );
}

function SizeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-slate-500">{label}</label>
        <span className="text-xs font-semibold text-slate-700">{value}%</span>
      </div>
      <input
        type="range"
        min={40}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-blue-600"
      />
    </div>
  );
}

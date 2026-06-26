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

export default function BrandingSetupPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [b, setB] = useState<Branding>(DEFAULT_BRANDING);

  useEffect(() => {
    setB(loadBranding());
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

  function save() {
    const next: Branding = { ...b, appName: b.appName.trim() || DEFAULT_BRANDING.appName };
    saveBranding(next);
    setB(next);
    logActivity("Updated CRM branding", { category: "setup" });
    toast.success("Branding saved", "Your logo and name are live across the app.");
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
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow">
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt="Logo preview" className="h-full w-full object-cover" />
              ) : (
                initials(b.appName)
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
        </div>

        {/* Name + tagline */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">CRM name</label>
            <input
              value={b.appName}
              onChange={(e) => patch({ appName: e.target.value })}
              placeholder="Nexus CRM"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Tagline / edition</label>
            <input
              value={b.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="Enterprise"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Sidebar preview</p>
          <div className="flex items-center gap-3 rounded-xl bg-[#1b2138] p-4">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(b.appName)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{b.appName || "Nexus CRM"}</p>
              <p className="truncate text-xs text-slate-400">{b.tagline || "Enterprise"}</p>
            </div>
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

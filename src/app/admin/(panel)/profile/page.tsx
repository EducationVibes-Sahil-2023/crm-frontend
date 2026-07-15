"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import SuperAdminCredentials from "@/components/SuperAdminCredentials";
import { getSuperAdmin } from "@/lib/superAdmin";
import { readLogo } from "@/lib/branding";
import { DEFAULT_SA_PROFILE, hydrateSuperAdminProfile, loadSuperAdminProfile, saveSuperAdminProfile, type SuperAdminProfile } from "@/lib/superAdminProfile";

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "SA";
}

export default function SuperAdminProfilePage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [p, setP] = useState<SuperAdminProfile>(DEFAULT_SA_PROFILE);

  useEffect(() => {
    let alive = true;
    const read = () => { if (alive) setP(loadSuperAdminProfile()); };
    read();                              // instant from cache (may be empty)
    void hydrateSuperAdminProfile().then(read); // then refresh from the DB
    return () => { alive = false; };
  }, []);

  const sa = getSuperAdmin();
  const name = sa?.name ?? "Super Admin";
  const email = sa?.email ?? "";

  function patch(next: Partial<SuperAdminProfile>) {
    setP((prev) => ({ ...prev, ...next }));
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) e.target.value = "";
    if (!file) return;
    try {
      patch({ avatar: await readLogo(file) });
    } catch (err) {
      toast.error("Couldn't use that image", (err as Error).message);
    }
  }

  function save() {
    saveSuperAdminProfile(p);
    toast.success("Profile saved", "Your photo and details are updated.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your photo, title and contact details — shown across the super-admin console.</p>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div className="relative">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white shadow">
              {p.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar} alt={name} className="h-full w-full object-cover" />
              ) : (
                initials(name)
              )}
            </span>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow hover:bg-indigo-700"
              title="Upload photo"
              aria-label="Upload photo"
            >
              <Icon name="camera" className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-lg font-bold text-slate-900">{name}</p>
            <p className="truncate text-sm text-slate-500">{email}</p>
            {p.avatar && (
              <button onClick={() => patch({ avatar: null })} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline">
                <Icon name="trash" className="h-3.5 w-3.5" /> Remove photo
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Title / role</label>
            <input
              value={p.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Platform Owner, Founder…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="mt-1 text-[11px] text-slate-400">Shown under your name in the header (leave blank for none).</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Phone</label>
            <input
              value={p.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              placeholder="+91 98765 43210"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end border-t border-slate-100 pt-4">
          <button onClick={save} className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-xl active:scale-[0.99]">
            Save profile
          </button>
        </div>
      </div>

      {/* Login identity (name / email / password) */}
      <SuperAdminCredentials />
    </div>
  );
}

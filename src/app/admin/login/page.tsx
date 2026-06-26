"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { SUPER_ADMIN_DEMO, isSuperAdmin, superAdminLogin } from "@/lib/superAdmin";
import { usePlatform } from "@/lib/platform";

export default function AdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState(SUPER_ADMIN_DEMO.email);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const logoBg = usePlatform().brand.logoBg;

  useEffect(() => {
    if (isSuperAdmin()) router.replace("/admin");
  }, [router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = superAdminLogin(email, password);
    if (res.ok) {
      toast.success("Welcome back", "Super admin access granted.");
      router.replace("/admin");
    } else {
      setError(res.error ?? "Login failed.");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
      {/* Soft animated gradient blobs */}
      <div className="nx-blob pointer-events-none absolute -left-32 -top-24 h-[28rem] w-[28rem] rounded-full bg-indigo-200/50 blur-[120px]" />
      <div className="nx-blob pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-200/50 blur-[120px]" style={{ animationDelay: "5s" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-3xl shadow-xl shadow-indigo-300/60" style={{ backgroundColor: logoBg }}>
            <Icon name="shield" className="h-8 w-8 text-white" />
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-white bg-emerald-400" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900">Super Admin</h1>
          <p className="mt-1.5 text-sm text-slate-500">Sign in to the platform control center</p>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white/80 p-7 shadow-xl shadow-slate-200/60 backdrop-blur-xl">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              <Icon name="alert" className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email</label>
          <div className="relative mb-4">
            <Icon name="gmail" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="superadmin@…" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
          </div>

          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Password</label>
          <div className="relative mb-5">
            <Icon name="shield" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} placeholder="••••••••" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700" aria-label="Toggle password"><Icon name="eye" className="h-4 w-4" /></button>
          </div>

          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-xl hover:shadow-indigo-500/40 active:scale-[0.99] disabled:opacity-60">
            {busy ? "Verifying…" : <><Icon name="logout" className="h-4 w-4 rotate-180" /> Sign in</>}
          </button>

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-500">
            Demo · <span className="font-mono text-slate-700">{SUPER_ADMIN_DEMO.email}</span> / <span className="font-mono text-slate-700">{SUPER_ADMIN_DEMO.password}</span>
          </p>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          <button onClick={() => router.push("/")} className="hover:text-slate-700">← Back to site</button>
        </p>
      </div>
    </div>
  );
}

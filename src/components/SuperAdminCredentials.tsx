"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getSuperAdmin, superAdminChangeCredentials } from "@/lib/superAdmin";

/**
 * Change the platform-owner (super-admin) login. Persists to the DB
 * (`settings.superadmin`) via the backend — no .env edit / redeploy needed.
 */
export default function SuperAdminCredentials() {
  const toast = useToast();
  const session = getSuperAdmin();
  const [email, setEmail] = useState(session?.email ?? "");
  const [name, setName] = useState(session?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) return toast.error("Current password required", "Confirm your current password to make changes.");
    if (password && password.length < 6) return toast.error("Password too short", "Use at least 6 characters.");
    if (password && password !== confirm) return toast.error("Passwords don't match", "Re-enter the new password.");

    setBusy(true);
    const res = await superAdminChangeCredentials({
      currentPassword,
      email: email.trim() || undefined,
      name: name.trim() || undefined,
      password: password || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Credentials updated", "Saved to the database. Use the new login next time.");
      setCurrentPassword(""); setPassword(""); setConfirm("");
    } else {
      toast.error("Update failed", res.error ?? "Could not update credentials.");
    }
  }

  const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
  const label = "mb-1.5 block text-xs font-semibold text-slate-600";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Icon name="shield" className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-bold text-slate-900">Super Admin Login</h2>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Stored securely in the database (password hashed). Changes apply immediately — no redeploy.
      </p>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={field} placeholder="owner@company.com" />
        </div>
        <div>
          <label className={label}>Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Platform Owner" />
        </div>

        <div className="sm:col-span-2 mt-1 border-t border-slate-100 pt-4">
          <label className={label}>Current password <span className="text-rose-500">*</span></label>
          <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type={show ? "text" : "password"} className={field} placeholder="Confirm it's you" autoComplete="current-password" />
        </div>
        <div>
          <label className={label}>New password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} className={field} placeholder="Leave blank to keep current" autoComplete="new-password" />
        </div>
        <div>
          <label className={label}>Confirm new password</label>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type={show ? "text" : "password"} className={field} placeholder="Re-enter new password" autoComplete="new-password" />
        </div>

        <div className="sm:col-span-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="rounded border-slate-300" />
            Show passwords
          </label>
          <button type="submit" disabled={busy} className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-xl active:scale-[0.99] disabled:opacity-60">
            {busy ? "Saving…" : "Save credentials"}
          </button>
        </div>
      </form>
    </div>
  );
}

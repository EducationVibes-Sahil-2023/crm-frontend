"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { loginUrl, welcomeMessage, type Tenant } from "@/lib/tenants";
import { ensureSuperAdminToken } from "@/lib/superAdmin";
import { getToken } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

function Row({ label, value, onCopy }: { label: string; value: string; onCopy: (text: string, what: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
      <button onClick={() => onCopy(value, label)} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-blue-600" title={`Copy ${label}`}>
        <Icon name="paperclip" className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Shown right after a client workspace is created. Displays the CRM credentials,
 * a ready-to-send welcome message, and lets the admin provision + test the login.
 */
export default function WelcomeCredentials({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const toast = useToast();
  const url = loginUrl(tenant);
  const message = welcomeMessage(tenant);
  const [busy, setBusy] = useState(false);

  function copy(text: string, what: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied", `${what} copied to clipboard.`),
      () => toast.error("Couldn't copy", "Your browser blocked clipboard access."),
    );
  }

  async function provision() {
    setBusy(true);
    try {
      // Super-admin console has no CRM login, so use its minted JWT (sub:
      // super-admin), which the backend accepts for account provisioning.
      const token = (await ensureSuperAdminToken()) ?? getToken();
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          name: tenant.adminName,
          email: tenant.adminEmail,
          password: tenant.tempPassword ?? "",
          role: "Administrator",
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast.success("Login account created", `${tenant.adminEmail} can now sign in.`);
      } else {
        const m = String(data?.messages?.error ?? data?.error ?? `Failed (${res.status})`);
        if (/already exists|taken|duplicate/i.test(m)) toast.info("Already provisioned", "An account with this email already exists.");
        else if (res.status === 401 || res.status === 403) toast.error("Not authorized", "Sign in to the super-admin console again, then retry.");
        else toast.error("Couldn't provision", m);
      }
    } catch {
      toast.error("Backend unreachable", "Start the backend on :8080 (try --host 0.0.0.0) and retry.");
    } finally {
      setBusy(false);
    }
  }

  async function testSignIn() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: tenant.adminEmail, password: tenant.tempPassword }),
      });
      if (res.ok) toast.success("Credentials work ✓", "The client can sign in with these details.");
      else if (res.status === 403) toast.error("Account inactive", "The login exists but is deactivated.");
      else toast.info("Not provisioned yet", "No CRM login matches these credentials. Use “Create login account”.");
    } catch {
      toast.error("Backend unreachable", "Start the backend on :8080 to test sign-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-5 text-white">
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30"><Icon name="check" className="h-5 w-5" /></span>
            <div>
              <h3 className="text-lg font-bold">Workspace ready</h3>
              <p className="text-sm text-emerald-50">{tenant.company} — share these CRM credentials.</p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar space-y-4 overflow-y-auto p-6">
          <div className="grid gap-2">
            <Row label="Sign-in URL" value={url} onCopy={copy} />
            <Row label="Email" value={tenant.adminEmail} onCopy={copy} />
            <Row label="Temporary password" value={tenant.tempPassword ?? "—"} onCopy={copy} />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Welcome message</p>
              <div className="flex gap-1.5">
                <button onClick={() => copy(message, "Welcome message")} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Copy</button>
                <a href={`mailto:${tenant.adminEmail}?subject=${encodeURIComponent(`Welcome to ${tenant.company}'s CRM`)}&body=${encodeURIComponent(message)}`} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50">Email</a>
              </div>
            </div>
            <textarea readOnly value={message} rows={9} className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={testSignIn} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Test sign-in</button>
          <button onClick={provision} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">Create login account</button>
          <button onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Done</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";
import { getUser, isAdmin, setup2fa, enable2fa, disable2fa } from "@/lib/auth";
import { accountsApi, qrUrl, ROLE_OPTIONS, type Account, type AccountInput } from "@/lib/accountUsers";

export default function AccountsSecurityPage() {
  const toast = useToast();
  const me = getUser();
  const admin = isAdmin();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | "new" | null>(null);

  async function refresh() {
    try {
      setAccounts(await accountsApi.list());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (admin) refresh();
    else setLoading(false);
  }, [admin]);

  async function toggleActive(a: Account) {
    try {
      const updated = a.active ? await accountsApi.deactivate(a.id) : await accountsApi.activate(a.id);
      setAccounts((list) => list.map((x) => (x.id === a.id ? updated : x)));
      logActivity(`${updated.active ? "Activated" : "Deactivated"} account ${a.email}`, { category: "user" });
      toast.success(
        updated.active ? "Account activated" : "Account deactivated",
        updated.active ? `${a.name} can sign in again.` : `${a.name} will be signed out within ~15s.`,
      );
    } catch (e) {
      toast.error("Couldn't update", (e as Error).message);
    }
  }

  async function resetTwofa(a: Account) {
    if (!window.confirm(`Reset two-step verification for ${a.name}? They'll set it up again next time.`)) return;
    try {
      const updated = await accountsApi.resetTwofa(a.id);
      setAccounts((list) => list.map((x) => (x.id === a.id ? updated : x)));
      toast.success("2FA reset", `${a.name} no longer has two-step verification.`);
    } catch (e) {
      toast.error("Couldn't reset 2FA", (e as Error).message);
    }
  }

  async function remove(a: Account) {
    if (!window.confirm(`Delete ${a.name}'s account? This cannot be undone.`)) return;
    try {
      await accountsApi.remove(a.id);
      setAccounts((list) => list.filter((x) => x.id !== a.id));
      toast.success("Account deleted", `${a.name} has been removed.`);
    } catch (e) {
      toast.error("Couldn't delete", (e as Error).message);
    }
  }

  if (!admin) {
    return (
      <div className="mx-auto max-w-2xl">
        <PersonalSecurity meEmail={me?.email} />
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <Icon name="shield" className="mr-2 inline h-4 w-4" />
          Only administrators can manage other accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PersonalSecurity meEmail={me?.email} />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Login Accounts</h2>
            <p className="text-xs text-slate-500">Create accounts, control access, and manage two-step verification.</p>
          </div>
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Icon name="plus" className="h-4 w-4" /> Add account
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">Loading accounts…</p>
        ) : error ? (
          <p className="px-5 py-10 text-center text-sm text-rose-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Account</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">2FA</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {accounts.map((a) => {
                  const isMe = a.id === me?.id;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
                            {a.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              a.name.slice(0, 2).toUpperCase()
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">
                              {a.name} {isMe && <span className="text-xs font-normal text-slate-400">(you)</span>}
                            </p>
                            <p className="truncate text-xs text-slate-500">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{a.role}</span>
                      </td>
                      <td className="px-3 py-3">
                        {a.twofa_enabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            <Icon name="shield" className="h-3 w-3" /> On
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-400">Off</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleActive(a)}
                          disabled={isMe}
                          title={isMe ? "You can't deactivate yourself" : "Toggle access"}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-40 ${a.active ? "bg-emerald-500" : "bg-slate-300"}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${a.active ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditing(a)} title="Edit" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                            <Icon name="edit" className="h-4 w-4" />
                          </button>
                          {a.twofa_enabled && (
                            <button onClick={() => resetTwofa(a)} title="Reset 2FA" className="rounded-lg p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600">
                              <Icon name="refresh" className="h-4 w-4" />
                            </button>
                          )}
                          {!isMe && (
                            <button onClick={() => remove(a)} title="Delete" className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <AccountModal
          account={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(acc) => {
            setAccounts((list) => {
              const exists = list.some((x) => x.id === acc.id);
              return exists ? list.map((x) => (x.id === acc.id ? acc : x)) : [...list, acc];
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- personal 2FA ---------- */

function PersonalSecurity({ meEmail }: { meEmail?: string }) {
  const toast = useToast();
  const user = getUser();
  const [enabled, setEnabled] = useState(!!user?.twofa_enabled);
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    try {
      setSetup(await setup2fa());
    } catch (e) {
      toast.error("Couldn't start setup", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndEnable() {
    setBusy(true);
    try {
      await enable2fa(code.replace(/\D/g, ""));
      setEnabled(true);
      setSetup(null);
      setCode("");
      toast.success("Two-step verification on", "You'll enter a code at each sign-in.");
    } catch (e) {
      toast.error("Couldn't enable", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!window.confirm("Turn off two-step verification for your account?")) return;
    setBusy(true);
    try {
      await disable2fa();
      setEnabled(false);
      toast.info("Two-step verification off", "Your account now signs in with a password only.");
    } catch (e) {
      toast.error("Couldn't disable", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">Your two-step verification</h2>
            <p className="text-sm text-slate-500">
              {meEmail ? `Signed in as ${meEmail}. ` : ""}
              {enabled ? "Enabled — a code is required at each sign-in." : "Add an authenticator app for an extra layer of security."}
            </p>
          </div>
        </div>
        {enabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Icon name="check" className="h-3.5 w-3.5" /> Enabled
          </span>
        ) : null}
      </div>

      {!enabled && !setup && (
        <button onClick={begin} disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
          {busy ? "Preparing…" : "Enable two-step verification"}
        </button>
      )}

      {enabled && (
        <button onClick={turnOff} disabled={busy} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">
          Turn off
        </button>
      )}

      {setup && (
        <div className="mt-5 grid gap-5 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[auto,1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl(setup.otpauth_uri)} alt="2FA QR code" className="h-[190px] w-[190px] rounded-lg bg-white p-2 shadow-sm" />
          <div>
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
              <li>Open Google Authenticator / Authy.</li>
              <li>Scan this QR code, or enter the key manually:</li>
            </ol>
            <code className="mt-2 block break-all rounded-md bg-white px-3 py-2 text-xs font-semibold tracking-wider text-slate-700 shadow-sm">{setup.secret}</code>
            <label className="mt-3 block text-sm font-semibold text-slate-700">Enter the 6-digit code</label>
            <div className="mt-1 flex gap-2">
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <button onClick={verifyAndEnable} disabled={busy || code.length !== 6} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                Verify & enable
              </button>
              <button onClick={() => { setSetup(null); setCode(""); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- create / edit account ---------- */

function AccountModal({
  account,
  onClose,
  onSaved,
}: {
  account: Account | null;
  onClose: () => void;
  onSaved: (a: Account) => void;
}) {
  const toast = useToast();
  const isEdit = !!account;
  const [form, setForm] = useState<AccountInput>({
    name: account?.name ?? "",
    email: account?.email ?? "",
    username: account?.username ?? "",
    role: account?.role ?? "Member",
    phone: account?.phone ?? "",
    department: account?.department ?? "",
    designation: account?.designation ?? "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof AccountInput>(k: K, v: AccountInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Missing details", "Name and email are required.");
      return;
    }
    if (!isEdit && (form.password ?? "").length < 6) {
      toast.error("Weak password", "Set a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const payload: Partial<AccountInput> = {
        name: form.name,
        email: form.email,
        username: form.username || undefined,
        role: form.role,
        phone: form.phone || null,
        department: form.department || null,
        designation: form.designation || null,
      };
      if (form.password) payload.password = form.password;
      const saved = account
        ? await accountsApi.update(account.id, payload)
        : await accountsApi.create(payload as AccountInput);
      logActivity(`${account ? "Updated" : "Created"} account ${saved.email}`, { category: "user" });
      toast.success(account ? "Account updated" : "Account created", saved.name);
      onSaved(saved);
    } catch (e) {
      toast.error("Couldn't save", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">{isEdit ? "Edit account" : "New account"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Full name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Username</label>
            <input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="auto from email" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Role</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value)} className={field}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">{isEdit ? "New password" : "Password"}</label>
            <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={isEdit ? "leave blank to keep" : "min 6 characters"} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Phone</label>
            <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Department</label>
            <input value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Designation</label>
            <input value={form.designation ?? ""} onChange={(e) => set("designation", e.target.value)} className={field} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}

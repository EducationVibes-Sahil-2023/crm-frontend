"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import ClientForm from "@/components/ClientForm";
import WelcomeCredentials from "@/components/WelcomeCredentials";
import { PLAN_PRICE, PLAN_STYLE, STATUS_STYLE, dbNameFor, fmtMoney, genPassword, mrr, type Tenant, type TenantStatus } from "@/lib/tenants";
import { provisionTenant, dropTenant, impersonateTenant, listTenants, updateTenant, resetTenantPassword, serverClientToTenant } from "@/lib/tenantsApi";
import { setImpersonatedSession } from "@/lib/auth";

export default function ClientsManager() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState("All");
  const [view2, setView2] = useState<"cards" | "table">("cards");
  const [form, setForm] = useState<{ open: boolean; edit: Tenant | null }>({ open: false, edit: null });
  const [view, setView] = useState<Tenant | null>(null);
  const [confirmDel, setConfirmDel] = useState<Tenant | null>(null);
  const [confirmReset, setConfirmReset] = useState<Tenant | null>(null);
  const [welcome, setWelcome] = useState<Tenant | null>(null);

  // Load the live client list from the database (the single source of truth).
  const reload = useCallback(async () => {
    const res = await listTenants();
    const list = res.clients.map(serverClientToTenant);
    setTenants(list);
    setView((v) => (v ? list.find((x) => x.id === v.id) ?? null : v));
    return list;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (active) toast.error("Couldn't load clients", `${(e as Error).message} Is the backend running on :8080?`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reload, toast]);

  const shown = useMemo(() => tenants.filter((t) => {
    const q = query.trim().toLowerCase();
    return (!q || t.company.toLowerCase().includes(q) || t.subdomain.includes(q) || t.adminEmail.toLowerCase().includes(q) || t.dbName.includes(q))
      && (statusF === "All" || t.status === statusF);
  }), [tenants, query, statusF]);

  async function save(t: Tenant) {
    const isNew = !tenants.some((x) => x.id === t.id);
    setForm({ open: false, edit: null });
    if (isNew) {
      // Create → provision the isolated database (writes the registry too), then
      // show the welcome credentials and refresh from the server.
      const withPw = t.tempPassword ? t : { ...t, tempPassword: genPassword() };
      setWelcome(withPw);
      try {
        const res = await provisionTenant(withPw);
        toast.success(
          res.alreadyExisted ? "Database ready" : "Client created",
          `${res.database}${res.adminSeeded ? " · admin login seeded" : ""}.`,
        );
      } catch (e) {
        toast.error("Couldn't create client", (e as Error).message);
      }
    } else {
      // Edit → update the registry record.
      try {
        await updateTenant(t.dbName, {
          company: t.company,
          plan: t.plan,
          status: t.status,
          adminName: t.adminName,
          adminEmail: t.adminEmail,
          region: t.region,
          storageGb: t.storageGb,
        });
        toast.success("Client updated", `${t.company} saved.`);
      } catch (e) {
        toast.error("Couldn't update client", (e as Error).message);
      }
    }
    reload().catch(() => {});
  }

  // Super-admin direct login into a client's CRM (no client password needed).
  async function loginAsClient(t: Tenant) {
    const database = t.dbName || dbNameFor(t.subdomain);
    try {
      const res = await impersonateTenant(database);
      setImpersonatedSession(res.token, {
        id: res.user.id,
        name: res.user.name,
        username: res.user.username,
        email: res.user.email,
        role: res.user.role,
        active: res.user.active,
        twofa_enabled: res.user.twofa_enabled,
      });
      toast.success("Entering client workspace", `Signed in as ${res.user.email}.`);
      // Full navigation so the CRM AuthGuard picks up the new tenant session.
      window.location.assign("/dashboard");
    } catch (e) {
      toast.error("Couldn't open client CRM", (e as Error).message);
    }
  }

  // Re-provision (create the DB + seed admin) for an existing client.
  async function provision(t: Tenant) {
    const withPw = t.tempPassword ? t : { ...t, tempPassword: genPassword() };
    try {
      const res = await provisionTenant(withPw);
      toast.success(res.alreadyExisted ? "Database ready" : "Database provisioned", `${res.database}${res.adminSeeded ? " · admin login seeded" : ""}.`);
      reload().catch(() => {});
    } catch (e) {
      toast.error("Database not provisioned", (e as Error).message);
    }
  }

  function showCredentials(t: Tenant) {
    // The temp password is a one-time generated credential for display only —
    // it isn't persisted (the real password lives hashed in the client DB).
    setWelcome(t.tempPassword ? t : { ...t, tempPassword: genPassword() });
  }

  async function setStatus(t: Tenant, status: TenantStatus) {
    // Optimistic update, then persist to the registry.
    setTenants((all) => all.map((x) => (x.id === t.id ? { ...x, status } : x)));
    setView((v) => (v && v.id === t.id ? { ...v, status } : v));
    try {
      await updateTenant(t.dbName, { status });
      toast.success(status === "Suspended" ? "Suspended" : "Activated", `${t.company} is now ${status}.`);
    } catch (e) {
      toast.error("Couldn't update status", (e as Error).message);
      reload().catch(() => {});
    }
  }

  // Account recovery — issue a fresh admin password for a locked-out client,
  // then surface the new credentials so they can be copied / emailed across.
  async function resetPassword(t: Tenant) {
    setConfirmReset(null);
    const pw = genPassword();
    try {
      const res = await resetTenantPassword(t.dbName, pw, t.adminEmail || undefined);
      toast.success("Password reset", `New credentials issued for ${res.adminEmail}.`);
      setWelcome({ ...t, adminEmail: res.adminEmail || t.adminEmail, adminName: res.adminName || t.adminName, tempPassword: pw });
    } catch (e) {
      toast.error("Couldn't reset password", (e as Error).message);
    }
  }

  async function remove(t: Tenant) {
    setConfirmDel(null);
    setView((v) => (v && v.id === t.id ? null : v));
    setTenants((all) => all.filter((x) => x.id !== t.id));
    try {
      await dropTenant(t.dbName);
      toast.info("Client removed", `${t.company} and database ${t.dbName} were deprovisioned.`);
    } catch (e) {
      toast.error("Couldn't remove client", (e as Error).message);
      reload().catch(() => {});
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400"><Link href="/admin" className="hover:text-indigo-600">Super Admin</Link> <span className="text-slate-300">/</span> Clients</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Client Workspaces</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"><Icon name="briefcase" className="h-3.5 w-3.5" /> {tenants.length} tenants</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {tenants.filter((t) => t.status === "Active").length} active</span>
          </p>
        </div>
        <button onClick={() => setForm({ open: true, edit: null })} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"><Icon name="plus" className="h-4 w-4" /> New Client</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { label: "Total clients", value: String(tenants.length), icon: "briefcase", tint: "from-slate-500 to-slate-700" },
          { label: "Active", value: String(tenants.filter((t) => t.status === "Active").length), icon: "check", tint: "from-emerald-500 to-teal-600" },
          { label: "On trial", value: String(tenants.filter((t) => t.status === "Trial").length), icon: "clock", tint: "from-amber-500 to-orange-600" },
          { label: "MRR", value: fmtMoney(mrr(tenants)), icon: "revenue", tint: "from-indigo-500 to-violet-600" },
        ] as { label: string; value: string; icon: IconName; tint: string }[]).map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.tint} text-white shadow-sm`}><Icon name={s.icon} className="h-5 w-5" /></span>
            <div className="min-w-0">
              {loading ? <Skeleton className="h-5 w-12" /> : <p className="text-lg font-extrabold leading-none text-slate-900">{s.value}</p>}
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-sm">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, subdomain, db, email…" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-blue-500" />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500">{["All", "Active", "Trial", "Suspended"].map((o) => <option key={o}>{o}</option>)}</select>
        <div className="ml-auto flex items-center rounded-xl border border-slate-300 bg-white p-1 shadow-sm">
          <button onClick={() => setView2("cards")} title="Card view" className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${view2 === "cards" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}><Icon name="grid" className="h-4 w-4" /> Cards</button>
          <button onClick={() => setView2("table")} title="Table view" className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${view2 === "table" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}><Icon name="list" className="h-4 w-4" /> Table</button>
        </div>
      </div>

      {view2 === "cards" ? (
        loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-20" /></div></div>
                <div className="mt-4 grid grid-cols-3 gap-2">{Array.from({ length: 3 }).map((_, c) => <Skeleton key={c} className="h-12 rounded-lg" />)}</div>
                <Skeleton className="mt-4 h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="briefcase" className="h-6 w-6" /></span>
            <p className="mt-3 text-sm font-medium text-slate-500">No clients match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((t) => (
              <TenantCard
                key={t.id}
                tenant={t}
                onView={() => setView(t)}
                onLogin={() => loginAsClient(t)}
                onEdit={() => setForm({ open: true, edit: t })}
                onCredentials={() => showCredentials(t)}
                onResetPassword={() => setConfirmReset(t)}
                onStatus={(s) => setStatus(t, s)}
                onDelete={() => setConfirmDel(t)}
              />
            ))}
          </div>
        )
      ) : (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-scrollbar max-h-[62vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Client</th><th className="px-4 py-3">Database</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Users</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => <tr key={r} className="border-b border-slate-100">{Array.from({ length: 6 }).map((_, c) => <td key={c} className="px-4 py-4"><Skeleton className="h-3.5 w-20" /></td>)}</tr>)
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">No clients match.</td></tr>
              ) : shown.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">{t.company.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0"><p className="truncate font-medium text-slate-900">{t.company}</p><p className="truncate text-[11px] text-slate-500">{t.adminEmail}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><p className="font-mono text-xs text-slate-700">{t.dbName}</p><p className="font-mono text-[10px] text-slate-400">{t.subdomain}.crm-cloud.app</p></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PLAN_STYLE[t.plan]}`}>{t.plan}</span></td>
                  <td className="px-4 py-3 text-slate-600">{t.users}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>{t.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => loginAsClient(t)} title="Login as client" className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Icon name="export" className="h-[18px] w-[18px]" /></button>
                      <button onClick={() => setView(t)} title="View" className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Icon name="eye" className="h-[18px] w-[18px]" /></button>
                      <button onClick={() => showCredentials(t)} title="Welcome & credentials" className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Icon name="shield" className="h-[18px] w-[18px]" /></button>
                      <button onClick={() => setConfirmReset(t)} title="Reset admin password" className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Icon name="key" className="h-[18px] w-[18px]" /></button>
                      <button onClick={() => setForm({ open: true, edit: t })} title="Edit" className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Icon name="edit" className="h-[18px] w-[18px]" /></button>
                      {t.status === "Suspended"
                        ? <button onClick={() => setStatus(t, "Active")} title="Activate" className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Icon name="check" className="h-[18px] w-[18px]" /></button>
                        : <button onClick={() => setStatus(t, "Suspended")} title="Suspend" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="alert" className="h-[18px] w-[18px]" /></button>}
                      <button onClick={() => setConfirmDel(t)} title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-[18px] w-[18px]" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {welcome && <WelcomeCredentials tenant={welcome} onClose={() => setWelcome(null)} />}
      {form.open && <ClientForm initial={form.edit} existing={tenants} onClose={() => setForm({ open: false, edit: null })} onSave={save} />}
      {view && <ClientDrawer tenant={view} onClose={() => setView(null)} onEdit={() => { setForm({ open: true, edit: view }); setView(null); }} onStatus={(s) => setStatus(view, s)} onDelete={() => setConfirmDel(view)} onProvision={() => provision(view.tempPassword ? view : { ...view, tempPassword: genPassword() })} onCredentials={() => showCredentials(view)} onResetPassword={() => setConfirmReset(view)} />}
      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Icon name="trash" className="h-6 w-6" /></div>
            <h3 className="mt-4 text-center text-base font-bold text-slate-900">Delete {confirmDel.company}?</h3>
            <p className="mt-1.5 text-center text-sm text-slate-500">This deprovisions the workspace and drops database <span className="font-mono text-slate-700">{confirmDel.dbName}</span>. This cannot be undone.</p>
            <div className="mt-5 flex gap-2"><button onClick={() => setConfirmDel(null)} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button onClick={() => remove(confirmDel)} className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Delete</button></div>
          </div>
        </div>
      )}
      {confirmReset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setConfirmReset(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><Icon name="key" className="h-6 w-6" /></div>
            <h3 className="mt-4 text-center text-base font-bold text-slate-900">Reset admin password?</h3>
            <p className="mt-1.5 text-center text-sm text-slate-500">A new temporary password will be generated for <span className="font-medium text-slate-700">{confirmReset.adminEmail || confirmReset.company}</span> and the account re-activated. Their current password will stop working.</p>
            <div className="mt-5 flex gap-2"><button onClick={() => setConfirmReset(null)} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button onClick={() => resetPassword(confirmReset)} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Reset password</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function TenantCard({ tenant: t, onView, onLogin, onEdit, onCredentials, onResetPassword, onStatus, onDelete }: { tenant: Tenant; onView: () => void; onLogin: () => void; onEdit: () => void; onCredentials: () => void; onResetPassword: () => void; onStatus: (s: TenantStatus) => void; onDelete: () => void }) {
  const suspended = t.status === "Suspended";
  const accent = suspended ? "from-rose-400 to-rose-600" : t.status === "Trial" ? "from-amber-400 to-orange-500" : "from-indigo-500 to-violet-600";
  const stats: [IconName, string, string][] = [
    ["users", "Users", String(t.users)],
    ["asset", "Storage", `${t.storageGb} GB`],
    ["clock", "Last active", t.lastActive],
  ];
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg ${suspended ? "opacity-90" : ""}`}>
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start gap-3 p-5 pb-3">
        <button onClick={onView} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-sm font-bold text-white shadow-sm`}>{t.company.slice(0, 2).toUpperCase()}</button>
        <div className="min-w-0 flex-1">
          <button onClick={onView} className="block max-w-full truncate text-left text-[15px] font-bold text-slate-900 hover:text-indigo-600">{t.company}</button>
          <p className="truncate font-mono text-[11px] text-slate-400">{t.subdomain}.crm-cloud.app</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[t.status]}`}>{t.status}</span>
      </div>

      <div className="flex items-center gap-2 px-5 pb-3">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PLAN_STYLE[t.plan]}`}>{t.plan}</span>
        <span className="truncate text-[11px] text-slate-400">{fmtMoney(PLAN_PRICE[t.plan])}/mo · {t.region}</span>
      </div>

      <div className="mx-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70">
        {stats.map(([icon, label, value]) => (
          <div key={label} className="px-2 py-2.5 text-center">
            <p className="flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"><Icon name={icon} className="h-3 w-3" /> {label}</p>
            <p className="mt-0.5 truncate text-xs font-bold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <p className="px-5 pt-3 font-mono text-[11px] text-slate-400">db: <span className="text-slate-600">{t.dbName}</span></p>

      <div className="mt-auto flex items-center gap-1.5 p-4 pt-3">
        <button onClick={onLogin} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"><Icon name="export" className="h-4 w-4" /> Login as client</button>
        <button onClick={onView} title="View" className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"><Icon name="eye" className="h-[18px] w-[18px]" /></button>
        <button onClick={onCredentials} title="Credentials" className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"><Icon name="shield" className="h-[18px] w-[18px]" /></button>
        <button onClick={onResetPassword} title="Reset admin password" className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"><Icon name="key" className="h-[18px] w-[18px]" /></button>
        <button onClick={onEdit} title="Edit" className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"><Icon name="edit" className="h-[18px] w-[18px]" /></button>
        {suspended
          ? <button onClick={() => onStatus("Active")} title="Activate" className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"><Icon name="check" className="h-[18px] w-[18px]" /></button>
          : <button onClick={() => onStatus("Suspended")} title="Suspend" className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Icon name="alert" className="h-[18px] w-[18px]" /></button>}
        <button onClick={onDelete} title="Delete" className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-[18px] w-[18px]" /></button>
      </div>
    </div>
  );
}

function ClientDrawer({ tenant: t, onClose, onEdit, onStatus, onDelete, onProvision, onCredentials, onResetPassword }: { tenant: Tenant; onClose: () => void; onEdit: () => void; onStatus: (s: TenantStatus) => void; onDelete: () => void; onProvision: () => void; onCredentials: () => void; onResetPassword: () => void }) {
  const rows: [string, string][] = [
    ["Admin", `${t.adminName} · ${t.adminEmail}`],
    ["Plan", `${t.plan} · ${fmtMoney(PLAN_PRICE[t.plan])}/mo`],
    ["Region", t.region],
    ["Users", String(t.users)],
    ["Storage", `${t.storageGb} GB`],
    ["Created", t.createdAt],
    ["Last active", t.lastActive],
  ];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="no-scrollbar flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5 text-white">
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-2 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-base font-bold ring-2 ring-white/30">{t.company.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{t.company}</h2>
              <p className="truncate font-mono text-xs text-slate-300">{t.subdomain}.crm-cloud.app</p>
            </div>
          </div>
          <span className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[t.status]}`}>{t.status}</span>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Icon name="asset" className="h-3.5 w-3.5" /> Dedicated database</p>
            <div className="space-y-1 font-mono text-xs text-slate-700">
              <p>name: <span className="font-semibold">{t.dbName}</span></p>
              <p>host: {t.dbHost}</p>
              <p>region: {t.region}</p>
            </div>
          </div>
          <dl className="divide-y divide-slate-100">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="min-w-0 truncate text-right text-sm text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-auto space-y-2 border-t border-slate-200 px-6 py-4">
          <div className="flex gap-2">
            <button onClick={onProvision} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Icon name="asset" className="h-4 w-4" /> Provision database</button>
            <button onClick={onCredentials} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Icon name="shield" className="h-4 w-4" /> Credentials</button>
          </div>
          <button onClick={onResetPassword} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"><Icon name="key" className="h-4 w-4" /> Reset admin password</button>
          <div className="flex gap-2">
            <a href={`https://${t.subdomain}.crm-cloud.app`} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Icon name="export" className="h-4 w-4" /> Open workspace</a>
            <button onClick={onEdit} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Icon name="edit" className="h-4 w-4" /> Edit</button>
          </div>
          <div className="flex gap-2">
            {t.status === "Suspended"
              ? <button onClick={() => onStatus("Active")} className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">Activate</button>
              : <button onClick={() => onStatus("Suspended")} className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">Suspend</button>}
            <button onClick={onDelete} className="rounded-lg px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"><Icon name="trash" className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

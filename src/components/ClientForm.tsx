"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { useToast } from "@/components/Toast";
import { DB_HOST, PLANS, REGIONS, dbNameFor, slugify, type Plan, type Tenant, type TenantStatus } from "@/lib/tenants";

export default function ClientForm({
  initial,
  existing,
  onClose,
  onSave,
}: {
  initial: Tenant | null;
  existing: Tenant[];
  onClose: () => void;
  onSave: (t: Tenant) => void;
}) {
  const toast = useToast();
  const isEdit = !!initial;
  const [f, setF] = useState({
    company: initial?.company ?? "",
    subdomain: initial?.subdomain ?? "",
    adminName: initial?.adminName ?? "",
    adminEmail: initial?.adminEmail ?? "",
    plan: (initial?.plan ?? "Pro") as Plan,
    region: initial?.region ?? REGIONS[0],
    status: (initial?.status ?? "Trial") as TenantStatus,
    // Database name minus the mandatory `tenant_` prefix (editable when creating).
    dbSuffix: (initial?.dbName ?? "").replace(/^tenant_/, ""),
  });
  // Until the admin edits the database name, it mirrors the subdomain.
  const [dbEdited, setDbEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string) => { setF((s) => ({ ...s, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: "" })); };

  // Auto-derive subdomain from company until the user edits it.
  function onCompany(v: string) {
    setF((s) => ({ ...s, company: v, subdomain: !isEdit && (!s.subdomain || s.subdomain === slugify(s.company)) ? slugify(v) : s.subdomain }));
    if (errors.company) setErrors((e) => ({ ...e, company: "" }));
  }

  // Database identifier: lowercase letters, digits and underscores only.
  const sanitizeDb = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40);
  function onDbSuffix(v: string) {
    setDbEdited(true);
    set("dbSuffix", sanitizeDb(v));
  }

  const sub = slugify(f.subdomain);
  const dbSuffix = dbEdited ? f.dbSuffix : sub;
  // Edits keep the existing database (renaming a live DB isn't supported here).
  const dbName = isEdit ? (initial?.dbName ?? dbNameFor(sub)) : `tenant_${dbSuffix || "client"}`;
  const subTaken = existing.some((t) => t.id !== initial?.id && slugify(t.subdomain) === sub);
  const dbTaken = !isEdit && existing.some((t) => t.dbName === dbName);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.company.trim()) err.company = "Company name is required";
    if (!sub) err.subdomain = "Subdomain is required";
    else if (subTaken) err.subdomain = "That subdomain is already taken";
    if (!f.adminName.trim()) err.adminName = "Admin name is required";
    if (!f.adminEmail.trim()) err.adminEmail = "Admin email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.adminEmail.trim())) err.adminEmail = "Enter a valid email";
    if (!isEdit) {
      if (!dbSuffix) err.dbName = "Database name is required";
      else if (dbTaken) err.dbName = "That database name is already in use";
    }
    setErrors(err);
    if (Object.keys(err).length) return;

    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    const tenant: Tenant = {
      id: initial?.id ?? `t-${Date.now().toString(36)}`,
      company: f.company.trim(),
      subdomain: sub,
      adminName: f.adminName.trim(),
      adminEmail: f.adminEmail.trim(),
      plan: f.plan,
      status: f.status,
      region: f.region,
      dbName,
      dbHost: DB_HOST,
      users: initial?.users ?? 1,
      storageGb: initial?.storageGb ?? 0,
      createdAt: initial?.createdAt ?? now,
      lastActive: initial?.lastActive ?? "just now",
    };
    onSave(tenant);
    toast.success(isEdit ? "Client updated" : "Client provisioned", isEdit ? f.company : `${f.company} · database ${dbName} created.`);
  }

  const inputCls = (e?: string) => `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${e ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate className="no-scrollbar my-8 w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20"><Icon name="shield" className="h-6 w-6" /></span>
              <div><h2 className="text-lg font-bold">{isEdit ? "Edit Client" : "New Client Workspace"}</h2><p className="text-xs text-slate-300">Provision an isolated tenant</p></div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <F label="Company / Institute" error={errors.company}>
            <input value={f.company} onChange={(e) => onCompany(e.target.value)} placeholder="Acme Education" className={inputCls(errors.company)} />
          </F>
          <F label="Subdomain" error={errors.subdomain}>
            <div className="flex items-center">
              <input value={f.subdomain} onChange={(e) => set("subdomain", e.target.value)} placeholder="acme" className={`${inputCls(errors.subdomain)} rounded-r-none`} />
              <span className="shrink-0 rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">.crm-cloud.app</span>
            </div>
          </F>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Admin name" error={errors.adminName}><input value={f.adminName} onChange={(e) => set("adminName", e.target.value)} placeholder="Jane Cooper" className={inputCls(errors.adminName)} /></F>
            <F label="Admin email" error={errors.adminEmail}><input value={f.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} placeholder="admin@acme.edu" className={inputCls(errors.adminEmail)} /></F>
            <F label="Plan"><SearchSelect value={f.plan} onChange={(v) => set("plan", v)} options={PLANS} searchable={false} /></F>
            <F label="Status"><SearchSelect value={f.status} onChange={(v) => set("status", v)} options={["Trial", "Active", "Suspended"]} searchable={false} /></F>
            <F label="Region" full><SearchSelect value={f.region} onChange={(v) => set("region", v)} options={REGIONS} /></F>
          </div>

          {/* DB provisioning */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Icon name="asset" className="h-3.5 w-3.5" /> Dedicated database</p>
            {isEdit ? (
              <div className="grid grid-cols-1 gap-1.5 font-mono text-xs text-slate-600 sm:grid-cols-2">
                <p>name: <span className="font-semibold text-slate-800">{dbName}</span></p>
                <p>host: <span className="text-slate-800">{DB_HOST}</span></p>
              </div>
            ) : (
              <>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Database name</label>
                <div className="flex items-center">
                  <span className="shrink-0 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 px-3 py-2.5 font-mono text-sm text-slate-400">tenant_</span>
                  <input
                    value={dbSuffix}
                    onChange={(e) => onDbSuffix(e.target.value)}
                    placeholder={sub || "client"}
                    className={`${inputCls(errors.dbName)} rounded-l-none font-mono`}
                  />
                </div>
                {errors.dbName && <p className="mt-1 text-xs text-rose-600">{errors.dbName}</p>}
                <p className="mt-2 font-mono text-[11px] text-slate-400">host: {DB_HOST}</p>
                <p className="mt-1 text-[11px] text-slate-400">A fresh, isolated database <span className="font-mono text-slate-500">{dbName}</span> is created and migrated for this client on save. Lowercase letters, digits and underscores only.</p>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">{isEdit ? "Save Changes" : <><Icon name="plus" className="h-4 w-4" /> Create & Provision</>}</button>
        </div>
      </form>
    </div>
  );
}

function F({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { useToast } from "@/components/Toast";
import { assetsApi, formatDate, formatMoney, type Asset } from "@/lib/assets";
import {
  loadMaintenance,
  MAINTENANCE_TYPES,
  maintenanceStatus,
  MNT_STATUS_META,
  saveMaintenance,
  type Maintenance,
  type MaintenanceStatus,
  type MaintenanceType,
} from "@/lib/assetSystem";

const TABS: ("all" | MaintenanceStatus)[] = ["all", "scheduled", "overdue", "completed"];

export default function AssetMaintenancePage() {
  const toast = useToast();
  const [list, setList] = useState<Maintenance[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"all" | MaintenanceStatus>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setList(loadMaintenance());
      try { setAssets(await assetsApi.list()); } catch { /* keep empty */ }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (ready) saveMaintenance(list); }, [list, ready]);

  const counts = useMemo(() => {
    const c = { all: list.length, scheduled: 0, overdue: 0, completed: 0 };
    list.forEach((m) => (c[maintenanceStatus(m)] += 1));
    return c;
  }, [list]);
  const totalCost = useMemo(() => list.reduce((s, m) => s + Number(m.cost || 0), 0), [list]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .map((m) => ({ m, st: maintenanceStatus(m) }))
      .filter(({ st }) => tab === "all" || st === tab)
      .filter(({ m }) => !q || m.assetName.toLowerCase().includes(q) || m.vendor.toLowerCase().includes(q) || m.type.toLowerCase().includes(q))
      .sort((a, b) => (b.m.scheduled || "").localeCompare(a.m.scheduled || ""));
  }, [list, tab, query]);

  function addEntry(m: Maintenance) {
    setList((l) => [m, ...l]);
    setOpen(false);
    toast.success("Maintenance scheduled", `${m.type} · ${m.assetName}`);
  }
  function complete(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    setList((l) => l.map((m) => (m.id === id ? { ...m, completed: today } : m)));
    toast.success("Marked complete", "Maintenance closed.");
  }
  function reopen(id: string) {
    setList((l) => l.map((m) => (m.id === id ? { ...m, completed: null } : m)));
  }
  function remove(id: string) {
    setList((l) => l.filter((m) => m.id !== id));
    toast.info("Removed", "Maintenance record deleted.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Maintenance</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule preventive servicing, log repairs and track maintenance spend.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> Schedule</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="clock" label="Scheduled" value={counts.scheduled} wrap="bg-blue-100 text-blue-600" />
        <Stat icon="alert" label="Overdue" value={counts.overdue} wrap="bg-rose-100 text-rose-600" />
        <Stat icon="check" label="Completed" value={counts.completed} wrap="bg-emerald-100 text-emerald-600" />
        <Stat icon="revenue" label="Total spend" value={formatMoney(totalCost)} wrap="bg-amber-100 text-amber-600" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{t}</button>
          ))}
        </div>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-52 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>

      {!ready ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="settings" className="h-7 w-7" /></div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No maintenance records</p>
          <p className="mt-1 text-sm text-slate-400">Schedule preventive maintenance or log a repair.</p>
          <button onClick={() => setOpen(true)} className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> Schedule</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Asset</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Scheduled</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3 text-right">Cost</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map(({ m, st }) => {
                  const meta = MNT_STATUS_META[st];
                  return (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{m.assetName}</td>
                      <td className="px-5 py-3 text-slate-600">{m.type}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(m.scheduled)}{m.completed && <span className="block text-xs text-emerald-600">done {formatDate(m.completed)}</span>}</td>
                      <td className="px-5 py-3 text-slate-600">{m.vendor || "—"}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{formatMoney(m.cost)}</td>
                      <td className="px-5 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {st === "completed" ? (
                            <button onClick={() => reopen(m.id)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Reopen</button>
                          ) : (
                            <button onClick={() => complete(m.id)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Complete</button>
                          )}
                          <button onClick={() => remove(m.id)} aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && <ScheduleModal assets={assets} onClose={() => setOpen(false)} onAdd={addEntry} />}
    </div>
  );
}

function ScheduleModal({ assets, onClose, onAdd }: { assets: Asset[]; onClose: () => void; onAdd: (m: Maintenance) => void }) {
  const toast = useToast();
  const assetNames = useMemo(() => assets.map((a) => a.name), [assets]);
  const [assetName, setAssetName] = useState("");
  const [type, setType] = useState<MaintenanceType>("Preventive");
  const [scheduled, setScheduled] = useState("");
  const [vendor, setVendor] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetName.trim() || !scheduled) { toast.error("Incomplete", "Pick an asset and a date."); return; }
    const asset = assets.find((a) => a.name === assetName);
    onAdd({
      id: `mnt-${Date.now().toString(36)}`,
      assetId: asset?.id ?? "",
      assetName: assetName.trim(),
      type, scheduled, completed: null,
      cost: Number(cost) || 0,
      vendor: vendor.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });
  }

  const cls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <div><h2 className="text-lg font-bold">Schedule maintenance</h2><p className="text-xs text-blue-100">Plan a service or log a repair.</p></div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <L label="Asset">
            {assetNames.length > 0 ? (
              <SearchSelect value={assetName} onChange={setAssetName} options={assetNames} placeholder="Select asset" />
            ) : (
              <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Asset name" className={cls} />
            )}
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Type"><SearchSelect value={type} onChange={(v) => setType(v as MaintenanceType)} options={MAINTENANCE_TYPES} searchable={false} /></L>
            <L label="Scheduled date"><input type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className={cls} /></L>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <L label="Vendor"><input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Service provider" className={cls} /></L>
            <L label="Estimated cost (₹)"><input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" className={cls} /></L>
          </div>
          <L label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${cls} resize-none`} placeholder="What needs doing…" /></L>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Schedule</button>
        </div>
      </form>
    </div>
  );
}

function L({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>;
}
function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}><Icon name={icon} className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
    </div>
  );
}

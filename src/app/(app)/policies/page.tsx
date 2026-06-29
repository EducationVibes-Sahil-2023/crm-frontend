"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import SearchSelect from "@/components/SearchSelect";
import { loadPolicies, savePolicies, type Policy } from "@/lib/hr";

const CAT_STYLE: Record<string, string> = {
  Leave: "bg-blue-100 text-blue-700",
  Attendance: "bg-emerald-100 text-emerald-700",
  Payroll: "bg-violet-100 text-violet-700",
  Compliance: "bg-amber-100 text-amber-700",
};

export default function PoliciesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Leave");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setPolicies(loadPolicies()); setLoading(false); setReady(true); }, 400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (ready) savePolicies(policies); }, [policies, ready]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title required", "Enter a policy title.");
    setPolicies((p) => [{ id: `pol-${Date.now().toString(36)}`, title: title.trim(), category, summary: summary.trim(), updated: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) }, ...p]);
    setTitle(""); setSummary(""); setOpen(false);
    toast.success("Policy added", `${title.trim()} published.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Policies</h1>
          <p className="mt-1 text-sm text-slate-500">HR policies and guidelines — {policies.length} documents.</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><span className="text-base leading-none">+</span> Add Policy</button>
      </div>

      {open && (
        <form onSubmit={add} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Policy title" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 sm:col-span-2" />
            <SearchSelect value={category} onChange={setCategory} options={["Leave", "Attendance", "Payroll", "Compliance"]} />
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Short summary…" className="resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 sm:col-span-3" />
          </div>
          <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Publish</button></div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Skeleton className="h-5 w-40" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-3/4" /></div>)
        ) : (
          policies.map((p) => (
            <div key={p.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name="knowledge" className="h-5 w-5" /></span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CAT_STYLE[p.category] ?? "bg-slate-100 text-slate-600"}`}>{p.category}</span>
              </div>
              <p className="mt-3 font-semibold text-slate-900">{p.title}</p>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{p.summary}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">Updated {p.updated}</span>
                <button onClick={() => { setPolicies((all) => all.filter((x) => x.id !== p.id)); toast.info("Removed", `${p.title} deleted.`); }} title="Delete" className="rounded-md p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"><Icon name="trash" className="h-4 w-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

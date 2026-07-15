"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  deleteAudience,
  loadMarketing,
  relativeTime,
  subscribeMarketing,
  upsertAudience,
  type MarketingData,
} from "@/lib/marketing";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export default function AudiencesPage() {
  const toast = useToast();
  const [data, setData] = useState<MarketingData>({ campaigns: [], templates: [], audiences: [] });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [count, setCount] = useState("");

  useEffect(() => {
    const refresh = () => setData(loadMarketing());
    refresh();
    return subscribeMarketing(refresh);
  }, []);

  const audiences = useMemo(
    () => [...data.audiences].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data],
  );

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name required", "Give the audience a name.");
      return;
    }
    upsertAudience({ name, description, count: Math.max(0, parseInt(count || "0", 10) || 0) });
    toast.success("Audience saved", `"${name.trim()}" is ready to target.`);
    setName(""); setDescription(""); setCount("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audiences</h1>
        <p className="mt-1 text-sm text-slate-500">Saved contact segments you can target when sending a campaign.</p>
      </div>

      {/* Create */}
      <form onSubmit={add} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-800">New audience</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. All active leads" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Contacts</label>
            <input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" className={inputCls} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              <span className="text-base leading-none">+</span> Add
            </button>
          </div>
          <div className="sm:col-span-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who's in this segment?" className={inputCls} />
          </div>
        </div>
      </form>

      {/* List */}
      {audiences.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          No audiences yet. Add one above to target it from a campaign.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Audience</th>
                <th className="px-5 py-3 text-right">Contacts</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {audiences.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{a.name}</p>
                    {a.description && <p className="truncate text-xs text-slate-400">{a.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900">{a.count.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{relativeTime(a.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => { deleteAudience(a.id); toast.info("Audience deleted", `"${a.name}" removed.`); }} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                      <Icon name="trash" className="h-[18px] w-[18px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

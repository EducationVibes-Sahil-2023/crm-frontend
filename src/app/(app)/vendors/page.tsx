"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import VendorForm from "@/components/VendorForm";
import {
  VENDOR_CATEGORIES,
  loadVendors,
  saveVendors,
  type Vendor,
} from "@/lib/vendors";

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-600",
};
const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];

export default function VendorsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [ready, setReady] = useState(false);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [status, setStatus] = useState("All Statuses");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);

  // Load (simulated) then persist on every change.
  useEffect(() => {
    const t = setTimeout(() => {
      setVendors(loadVendors());
      setLoading(false);
      setReady(true);
    }, 600);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready) saveVendors(vendors);
  }, [vendors, ready]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vendors.filter((v) => {
      const mq = !q || v.name.toLowerCase().includes(q) || v.email.toLowerCase().includes(q) || v.contactPerson.toLowerCase().includes(q) || v.city.toLowerCase().includes(q);
      return mq && (category === "All Categories" || v.category === category) && (status === "All Statuses" || v.status === status);
    });
  }, [vendors, query, category, status]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(v: Vendor) {
    setEditing(v);
    setFormOpen(true);
  }
  function removeVendor(v: Vendor) {
    setVendors((list) => list.filter((x) => x.id !== v.id));
    toast.info("Vendor removed", `${v.name} was deleted.`);
  }
  function handleSubmit(vendor: Vendor) {
    if (editing) {
      setVendors((list) => list.map((x) => (x.id === editing.id ? { ...vendor, id: editing.id } : x)));
      toast.success("Vendor saved", `${vendor.name} was updated.`);
    } else {
      const created: Vendor = {
        ...vendor,
        id: `v-${Date.now().toString(36)}`,
        createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      };
      setVendors((list) => [created, ...list]);
      toast.success("Vendor added", `${vendor.name} was saved.`);
    }
    setFormOpen(false);
  }

  const activeCount = vendors.filter((v) => v.status === "Active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendors</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your suppliers — <strong>{vendors.length}</strong> total, <strong>{activeCount}</strong> active.
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          <span className="text-base leading-none">+</span> Add Vendor
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, contact, city…" className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500">
            {["All Categories", ...VENDOR_CATEGORIES].map((o) => <option key={o}>{o}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500">
            {["All Statuses", "Active", "Inactive"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-scrollbar max-h-[65vh] overflow-auto rounded-t-2xl">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3">Vendor</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">GSTIN</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3">Terms</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, r) => (
                  <tr key={r} className="border-b border-slate-100">
                    {Array.from({ length: 8 }).map((_, c) => (
                      <td key={c} className="px-6 py-4"><Skeleton className="h-3.5 w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-400">
                    {vendors.length === 0 ? "No vendors yet. Add your first vendor." : "No vendors match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((v, i) => (
                  <tr key={v.id} className="group border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                          {v.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{v.name}</p>
                          {v.website ? (
                            <a href={v.website} target="_blank" rel="noreferrer" className="truncate text-xs text-blue-600 hover:underline">{v.website.replace(/^https?:\/\//, "")}</a>
                          ) : (
                            <p className="text-xs text-slate-400">No website</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-700">{v.contactPerson || "—"}</p>
                      <a href={`mailto:${v.email}`} className="text-xs text-blue-600 hover:underline">{v.email}</a>
                      <p className="text-xs text-slate-500">{v.phone}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{v.category}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{v.gstin || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{[v.city, v.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{v.paymentTerms}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[v.status] ?? "bg-slate-100 text-slate-600"}`}>{v.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(v)} title="Edit" aria-label="Edit" className="rounded-md p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600">
                          <Icon name="edit" className="h-[18px] w-[18px]" />
                        </button>
                        <button onClick={() => removeVendor(v)} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                          <Icon name="trash" className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
            Showing <strong>{filtered.length}</strong> of <strong>{vendors.length}</strong> vendors
          </div>
        )}
      </div>

      {formOpen && (
        <VendorForm
          mode={editing ? "edit" : "create"}
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

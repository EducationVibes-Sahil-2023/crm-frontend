"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import {
  ASSIGN_META,
  formatDate,
  formatMoney,
  inventoryApi,
  itemValue,
  STATUS_META,
  stockStatus,
  timeAgo,
  UNITS,
  type InventoryItem,
  type ItemFields,
  type MovementType,
  type StockStatus,
} from "@/lib/inventory";

const TABS: ("all" | StockStatus)[] = ["all", "in", "low", "out"];

export default function InventoryPage() {
  const toast = useToast();
  const me = useMemo(() => getUser(), []);
  const actor = me?.name ?? "You";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | StockStatus>("all");
  const [category, setCategory] = useState("All categories");

  const [detail, setDetail] = useState<InventoryItem | null>(null);
  const [draft, setDraft] = useState<ItemFields>({});
  const [saving, setSaving] = useState(false);

  const [adjustType, setAdjustType] = useState<MovementType>("in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ItemFields>({ unit: "pcs" });

  const load = useCallback(async () => {
    try {
      setItems(await inventoryApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.category && set.add(i.category));
    return ["All categories", ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const st = stockStatus(i);
      const mt = tab === "all" || st === tab;
      const mc = category === "All categories" || i.category === category;
      const mq =
        !q ||
        i.name.toLowerCase().includes(q) ||
        (i.sku || "").toLowerCase().includes(q) ||
        (i.category || "").toLowerCase().includes(q) ||
        (i.location || "").toLowerCase().includes(q);
      return mt && mc && mq;
    });
  }, [items, query, tab, category]);

  const stats = useMemo(() => {
    let value = 0;
    let low = 0;
    let out = 0;
    for (const i of items) {
      value += itemValue(i);
      const s = stockStatus(i);
      if (s === "low") low++;
      if (s === "out") out++;
    }
    return { total: items.length, value, low, out };
  }, [items]);

  const toDraft = (i: InventoryItem): ItemFields => ({
    name: i.name ?? "",
    sku: i.sku ?? "",
    category: i.category ?? "",
    description: i.description ?? "",
    unit: i.unit ?? "pcs",
    reorder_level: i.reorder_level == null ? "" : String(i.reorder_level),
    unit_price: i.unit_price == null ? "" : String(i.unit_price),
    location: i.location ?? "",
    supplier: i.supplier ?? "",
  });

  const apply = useCallback((i: InventoryItem) => {
    setDetail(i);
    setDraft(toDraft(i));
    setItems((list) => {
      const stripped = { ...i };
      delete stripped.movements;
      return list.some((x) => x.id === i.id) ? list.map((x) => (x.id === i.id ? stripped : x)) : [stripped, ...list];
    });
  }, []);

  async function openItem(i: InventoryItem) {
    apply(i);
    try {
      apply(await inventoryApi.get(i.id));
    } catch {
      /* keep list copy */
    }
  }

  const dirty = useMemo(() => {
    if (!detail) return false;
    const base = toDraft(detail);
    return (Object.keys(draft) as (keyof ItemFields)[]).some((k) => (draft[k] ?? "") !== (base[k] ?? ""));
  }, [draft, detail]);

  function setField(k: keyof ItemFields, v: string) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function saveChanges() {
    if (!detail) return;
    setSaving(true);
    try {
      apply(await inventoryApi.update(detail.id, draft));
      toast.success("Saved", "Item details updated");
    } catch (e) {
      toast.error("Could not save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function doAdjust() {
    if (!detail) return;
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) {
      toast.error("Enter a quantity", "Quantity must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      const updated = await inventoryApi.adjust(detail.id, adjustType, qty, adjustReason.trim(), actor);
      apply(updated);
      setAdjustQty("");
      setAdjustReason("");
      toast.success(adjustType === "in" ? "Stock added" : "Stock removed", `New balance: ${updated.quantity} ${updated.unit}`);
    } catch (e) {
      toast.error("Adjustment failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function assignUnits(payload: { assignee_name: string; assignee_email?: string; qty: number; note?: string; create_asset?: boolean }) {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await inventoryApi.assign(detail.id, payload, actor);
      apply(updated);
      toast.success("Assigned", `${payload.qty} ${updated.unit} issued to ${payload.assignee_name}`);
    } catch (e) {
      toast.error("Could not assign", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function returnAssignment(assignmentId: string, qty: number | undefined) {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await inventoryApi.returnUnits(assignmentId, qty, actor);
      apply(updated);
      toast.success("Returned", "Stock updated");
    } catch (e) {
      toast.error("Return failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(i: InventoryItem) {
    if (!confirm(`Delete "${i.name}" and its stock history?`)) return;
    try {
      await inventoryApi.remove(i.id);
      setItems((list) => list.filter((x) => x.id !== i.id));
      if (detail?.id === i.id) setDetail(null);
      toast.success("Item deleted", i.name);
    } catch (e) {
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    }
  }

  async function createItem() {
    if (!createForm.name?.trim()) return;
    setSaving(true);
    try {
      const created = await inventoryApi.create(createForm, actor);
      setCreateOpen(false);
      setCreateForm({ unit: "pcs" });
      toast.success("Item added", created.name);
      openItem(created);
    } catch (e) {
      toast.error("Could not add item", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Track stock levels, value and every stock movement.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Icon name="plus" className="h-4 w-4" /> New Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="inventory" label="Items" value={stats.total} wrap="bg-slate-100 text-slate-600" />
        <Stat icon="revenue" label="Stock value" value={formatMoney(stats.value)} wrap="bg-emerald-100 text-emerald-600" />
        <Stat icon="alert" label="Low stock" value={stats.low} wrap="bg-amber-100 text-amber-600" />
        <Stat icon="close" label="Out of stock" value={stats.out} wrap="bg-rose-100 text-rose-600" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {t === "all" ? "All" : STATUS_META[t].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <SearchSelect value={category} onChange={setCategory} options={categories} />
          </div>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              className="w-52 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} hasItems={items.length > 0} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-right">Available</th>
                  <th className="px-5 py-3 text-right">Assigned</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Unit price</th>
                  <th className="px-5 py-3 text-right">Value</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const sm = STATUS_META[stockStatus(i)];
                  return (
                    <tr key={i.id} onClick={() => openItem(i)} className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {i.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.image_url} alt={i.name} className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                              <Icon name="inventory" className="h-5 w-5" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{i.name}</p>
                            <p className="text-xs text-slate-500">{i.sku || "No SKU"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{i.category || "—"}</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-800">{Number(i.quantity)} <span className="text-xs font-normal text-slate-400">{i.unit}</span></td>
                      <td className="px-5 py-3 text-right text-slate-600">{i.assigned ? <span className="font-medium text-indigo-600">{i.assigned}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${sm.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />{sm.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">{formatMoney(i.unit_price)}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{formatMoney(itemValue(i))}</td>
                      <td className="px-5 py-3 text-slate-600">{i.location || "—"}</td>
                      <td className="px-5 py-3 text-slate-500">{timeAgo(i.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <Drawer
          item={detail}
          draft={draft}
          dirty={dirty}
          saving={saving}
          adjustType={adjustType}
          adjustQty={adjustQty}
          adjustReason={adjustReason}
          onAdjustType={setAdjustType}
          onAdjustQty={setAdjustQty}
          onAdjustReason={setAdjustReason}
          onAdjust={doAdjust}
          onField={setField}
          onSave={saveChanges}
          onAssign={assignUnits}
          onReturn={returnAssignment}
          onDelete={() => removeItem(detail)}
          onClose={() => setDetail(null)}
        />
      )}

      {/* Create modal */}
      {createOpen && (
        <Modal title="New inventory item" onClose={() => setCreateOpen(false)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Photo" full>
              <PhotoUpload value={createForm.image_url} onChange={(url) => setCreateForm((f) => ({ ...f, image_url: url }))} />
            </Field>
            <Field label="Item name" required full>
              <input className={inputCls} autoFocus value={createForm.name ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="A4 Paper Ream" />
            </Field>
            <Field label="SKU"><input className={inputCls} value={createForm.sku ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, sku: e.target.value }))} placeholder="PPR-A4" /></Field>
            <Field label="Category"><input className={inputCls} value={createForm.category ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))} placeholder="Stationery" /></Field>
            <Field label="Unit">
              <SearchSelect value={createForm.unit ?? "pcs"} onChange={(v) => setCreateForm((f) => ({ ...f, unit: v }))} options={UNITS} searchable={false} />
            </Field>
            <Field label="Opening quantity"><input type="number" min="0" className={inputCls} value={createForm.quantity ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" /></Field>
            <Field label="Reorder level"><input type="number" min="0" className={inputCls} value={createForm.reorder_level ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, reorder_level: e.target.value }))} placeholder="10" /></Field>
            <Field label="Unit price (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={createForm.unit_price ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" /></Field>
            <Field label="Location"><input className={inputCls} value={createForm.location ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))} placeholder="Shelf B2" /></Field>
            <Field label="Supplier" full><input className={inputCls} value={createForm.supplier ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, supplier: e.target.value }))} placeholder="Paper Co" /></Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setCreateOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cancel</button>
            <button onClick={createItem} disabled={!createForm.name?.trim() || saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">Add item</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function PhotoUpload({ value, onChange }: { value?: string | null; onChange: (url: string | null) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await inventoryApi.upload(file);
      onChange(url);
      toast.success("Photo uploaded", file.name);
    } catch (e) {
      toast.error("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Item" className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
        <div className="flex flex-col gap-1.5">
          <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
            {busy ? "Uploading…" : "Replace"}
            <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <button type="button" onClick={() => onChange(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50">
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="flex h-20 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/40">
      <Icon name="camera" className="h-5 w-5" />
      {busy ? "Uploading…" : "Upload photo"}
      <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
    </label>
  );
}

function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Drawer({
  item, draft, dirty, saving, adjustType, adjustQty, adjustReason,
  onAdjustType, onAdjustQty, onAdjustReason, onAdjust, onField, onSave, onAssign, onReturn, onDelete, onClose,
}: {
  item: InventoryItem;
  draft: ItemFields;
  dirty: boolean;
  saving: boolean;
  adjustType: MovementType;
  adjustQty: string;
  adjustReason: string;
  onAdjustType: (t: MovementType) => void;
  onAdjustQty: (v: string) => void;
  onAdjustReason: (v: string) => void;
  onAdjust: () => void;
  onField: (k: keyof ItemFields, v: string) => void;
  onSave: () => void;
  onAssign: (payload: { assignee_name: string; assignee_email?: string; qty: number; note?: string; create_asset?: boolean }) => void;
  onReturn: (assignmentId: string, qty: number | undefined) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const sm = STATUS_META[stockStatus(item)];
  const assignedOut = (item.assignments ?? []).reduce((s, a) => s + (Number(a.qty) - Number(a.qty_returned)), 0);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Icon name="inventory" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900">{item.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${sm.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />{sm.label}
                </span>
                {item.sku && <span>{item.sku}</span>}
                <span>· {Number(item.quantity)} {item.unit} available</span>
                {assignedOut > 0 && <span className="font-medium text-indigo-600">· {assignedOut} assigned out</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* stock adjust */}
          <Section title="Adjust stock">
            <div className="mb-3 flex items-center gap-2">
              {(["in", "out"] as MovementType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onAdjustType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    adjustType === t
                      ? t === "in" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t === "in" ? "Stock In (+)" : "Stock Out (−)"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Quantity"><input type="number" min="1" className={inputCls} value={adjustQty} onChange={(e) => onAdjustQty(e.target.value)} placeholder="0" /></Field>
              <Field label="Reason"><input className={inputCls} value={adjustReason} onChange={(e) => onAdjustReason(e.target.value)} placeholder="e.g. Purchase / Issued" /></Field>
            </div>
            <button
              onClick={onAdjust}
              disabled={saving || !adjustQty}
              className="mt-3 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {adjustType === "in" ? "Add to stock" : "Remove from stock"}
            </button>
          </Section>

          {/* assignments */}
          <AssignSection item={item} saving={saving} onAssign={onAssign} onReturn={onReturn} />

          {/* details */}
          <Section title="Item details">
            <div className="mb-3">
              <span className="mb-1 block text-xs font-medium text-slate-500">Photo</span>
              <PhotoUpload value={draft.image_url} onChange={(url) => onField("image_url", url ?? "")} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name" required><input className={inputCls} value={draft.name ?? ""} onChange={(e) => onField("name", e.target.value)} /></Field>
              <Field label="SKU"><input className={inputCls} value={draft.sku ?? ""} onChange={(e) => onField("sku", e.target.value)} /></Field>
              <Field label="Category"><input className={inputCls} value={draft.category ?? ""} onChange={(e) => onField("category", e.target.value)} /></Field>
              <Field label="Unit"><SearchSelect value={draft.unit ?? "pcs"} onChange={(v) => onField("unit", v)} options={UNITS} searchable={false} /></Field>
              <Field label="Reorder level"><input type="number" min="0" className={inputCls} value={draft.reorder_level ?? ""} onChange={(e) => onField("reorder_level", e.target.value)} /></Field>
              <Field label="Unit price (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={draft.unit_price ?? ""} onChange={(e) => onField("unit_price", e.target.value)} /></Field>
              <Field label="Location"><input className={inputCls} value={draft.location ?? ""} onChange={(e) => onField("location", e.target.value)} /></Field>
              <Field label="Supplier"><input className={inputCls} value={draft.supplier ?? ""} onChange={(e) => onField("supplier", e.target.value)} /></Field>
            </div>
            <Field label="Description" className="mt-3">
              <textarea rows={2} className={`${inputCls} resize-none`} value={draft.description ?? ""} onChange={(e) => onField("description", e.target.value)} />
            </Field>
            <div className="mt-3 flex flex-wrap gap-3">
              <Pill label="Current value" value={formatMoney(itemValue(item))} />
              <Pill label="Last updated" value={formatDate(item.updated_at)} />
            </div>
          </Section>

          {/* movement history */}
          <Section title="Stock movements">
            {(item.movements ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No movements yet.</p>
            ) : (
              <ol className="space-y-3">
                {(item.movements ?? []).map((m) => {
                  const isIn = m.type === "in";
                  return (
                    <li key={m.id} className="flex gap-3">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isIn ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                        <Icon name={isIn ? "plus" : "close"} className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-700">
                          <span className="font-medium text-slate-900">{isIn ? "+" : "−"}{Number(m.qty)} {item.unit}</span>
                          <span className="text-slate-400"> → balance {Number(m.balance_after)}</span>
                          {m.reason && <span> · {m.reason}</span>}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">{m.actor || "System"} · {timeAgo(m.created_at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-600">
            <Icon name="trash" className="h-4 w-4" /> Delete
          </button>
          <button onClick={onSave} disabled={!dirty || saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignSection({
  item,
  saving,
  onAssign,
  onReturn,
}: {
  item: InventoryItem;
  saving: boolean;
  onAssign: (payload: { assignee_name: string; assignee_email?: string; qty: number; note?: string; create_asset?: boolean }) => void;
  onReturn: (assignmentId: string, qty: number | undefined) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [createAsset, setCreateAsset] = useState(false);
  const available = Number(item.quantity);
  const assignments = item.assignments ?? [];

  function submit() {
    const n = name.trim();
    const q = Number(qty);
    if (!n || !q || q <= 0) return;
    onAssign({ assignee_name: n, assignee_email: email.trim() || undefined, qty: q, note: note.trim() || undefined, create_asset: createAsset });
    setName(""); setEmail(""); setQty("1"); setNote(""); setCreateAsset(false);
  }

  return (
    <Section title="Assign to users">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Assignee name" required><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Asha Sharma" /></Field>
        <Field label="Assignee email"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="asha@company.com" /></Field>
        <Field label={`Quantity (max ${available})`}><input type="number" min="1" max={available} className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sales team" /></Field>
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={createAsset} onChange={(e) => setCreateAsset(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
        Also create an asset record for this user (links to Asset Management)
      </label>
      <button
        onClick={submit}
        disabled={saving || !name.trim() || !Number(qty) || Number(qty) > available || available <= 0}
        className="mt-3 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
      >
        {available <= 0 ? "Nothing available to assign" : "Assign units"}
      </button>

      {/* assignment records */}
      {assignments.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assignment records</p>
          {assignments.map((a) => {
            const outstanding = Number(a.qty) - Number(a.qty_returned);
            const meta = ASSIGN_META[a.status];
            return (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {a.assignee_name}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>{meta.label}</span>
                      {a.asset_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          <Icon name="asset" className="h-3 w-3" /> Asset #{a.asset_id}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {Number(a.qty_returned)}/{Number(a.qty)} returned
                      {a.note ? ` · ${a.note}` : ""} · {formatDate(a.issued_at)}
                    </p>
                  </div>
                  {outstanding > 0 && (
                    <button
                      onClick={() => onReturn(a.id, undefined)}
                      disabled={saving}
                      className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
                    >
                      Return {outstanding}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, required, full, className, children }: { label: string; required?: boolean; full?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""} ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Pill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-100 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative my-6 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 transition hover:text-slate-600">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ onCreate, hasItems }: { onCreate: () => void; hasItems: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="inventory" className="h-8 w-8" />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">{hasItems ? "No matching items" : "No inventory items yet"}</p>
      <p className="mt-1 text-sm text-slate-500">{hasItems ? "Try a different search or filter." : "Add your first item to start tracking stock."}</p>
      {!hasItems && (
        <button onClick={onCreate} className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
          <Icon name="plus" className="h-4 w-4" /> New Item
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 py-16 text-center">
      <p className="text-sm font-semibold text-rose-700">Couldn&apos;t load inventory</p>
      <p className="mt-1 max-w-md text-xs text-rose-500">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">Retry</button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

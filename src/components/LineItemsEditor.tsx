"use client";

import { Icon } from "@/components/icons";
import { computeTotals, emptyItem, lineTotal, money, type LineItem } from "@/lib/billing";

// Editable table of line items + discount/tax controls with a live totals panel.
// Shared by the Quotation and Invoice create forms.
export default function LineItemsEditor({
  items,
  onItems,
  discountPct,
  onDiscount,
  taxPct,
  onTax,
}: {
  items: LineItem[];
  onItems: (items: LineItem[]) => void;
  discountPct: number;
  onDiscount: (v: number) => void;
  taxPct: number;
  onTax: (v: number) => void;
}) {
  const totals = computeTotals(items, discountPct, taxPct);

  function update(id: string, patch: Partial<LineItem>) {
    onItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function remove(id: string) {
    onItems(items.filter((it) => it.id !== id));
  }
  function add() {
    onItems([...items, emptyItem()]);
  }

  return (
    <div>
      {/* Header row (desktop) */}
      <div className="hidden grid-cols-12 gap-2 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
        <span className="col-span-6">Description</span>
        <span className="col-span-2 text-right">Qty</span>
        <span className="col-span-2 text-right">Unit price</span>
        <span className="col-span-2 text-right">Amount</span>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:border-0 sm:p-0">
            <input
              value={it.description}
              onChange={(e) => update(it.id, { description: e.target.value })}
              placeholder="Item or service description"
              className="col-span-12 rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:col-span-6"
            />
            <input
              type="number"
              min={0}
              value={it.quantity}
              onChange={(e) => update(it.id, { quantity: Number(e.target.value) })}
              className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:col-span-2"
            />
            <input
              type="number"
              min={0}
              value={it.unitPrice}
              onChange={(e) => update(it.id, { unitPrice: Number(e.target.value) })}
              className="col-span-4 rounded-lg border border-slate-300 px-2 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:col-span-2"
            />
            <div className="col-span-4 flex items-center justify-end gap-1 sm:col-span-2">
              <span className="truncate text-sm font-medium text-slate-700">{money(lineTotal(it))}</span>
              <button
                type="button"
                onClick={() => remove(it.id)}
                aria-label="Remove item"
                disabled={items.length === 1}
                className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600"
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
        Add item
      </button>

      {/* Totals */}
      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <div className="w-full space-y-2 sm:max-w-xs">
          <Row label="Subtotal" value={money(totals.subtotal)} />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-sm text-slate-500">
              Discount
              <span className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPct}
                  onChange={(e) => onDiscount(Number(e.target.value))}
                  className="w-16 rounded-md border border-slate-300 py-1 pl-2 pr-5 text-right text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </span>
            </label>
            <span className="text-sm font-medium text-rose-600">−{money(totals.discount)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-sm text-slate-500">
              Tax
              <span className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={taxPct}
                  onChange={(e) => onTax(Number(e.target.value))}
                  className="w-16 rounded-md border border-slate-300 py-1 pl-2 pr-5 text-right text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </span>
            </label>
            <span className="text-sm font-medium text-slate-700">{money(totals.tax)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-sm font-bold text-slate-800">Total</span>
            <span className="text-base font-bold text-slate-900">{money(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-700">{value}</span>
    </div>
  );
}

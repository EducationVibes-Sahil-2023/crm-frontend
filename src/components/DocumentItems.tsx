"use client";

import { computeTotals, lineTotal, money, type LineItem } from "@/lib/billing";

// Read-only line-items table + totals, shown in quotation/invoice detail views.
export default function DocumentItems({
  items,
  discountPct,
  taxPct,
  extra,
}: {
  items: LineItem[];
  discountPct: number;
  taxPct: number;
  // optional extra rows under Total (e.g. Paid / Balance for invoices)
  extra?: { label: string; value: string; strong?: boolean; tone?: "rose" | "emerald" }[];
}) {
  const totals = computeTotals(items, discountPct, taxPct);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Unit price</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2.5 text-slate-700">{it.description || "—"}</td>
              <td className="px-3 py-2.5 text-right text-slate-600">{it.quantity}</td>
              <td className="px-3 py-2.5 text-right text-slate-600">{money(it.unitPrice)}</td>
              <td className="px-3 py-2.5 text-right font-medium text-slate-800">{money(lineTotal(it))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-3 py-3">
        <div className="w-full max-w-xs space-y-1.5">
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {discountPct > 0 && <Row label={`Discount (${discountPct}%)`} value={`−${money(totals.discount)}`} tone="rose" />}
          <Row label={`Tax (${taxPct}%)`} value={money(totals.tax)} />
          <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
            <span className="text-sm font-bold text-slate-800">Total</span>
            <span className="text-base font-bold text-slate-900">{money(totals.total)}</span>
          </div>
          {extra?.map((e) => (
            <Row key={e.label} label={e.label} value={e.value} strong={e.strong} tone={e.tone} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "rose" | "emerald" }) {
  const color = tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-700";
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${strong ? "font-semibold text-slate-700" : "text-slate-500"}`}>{label}</span>
      <span className={`text-sm ${strong ? "font-bold" : "font-medium"} ${color}`}>{value}</span>
    </div>
  );
}

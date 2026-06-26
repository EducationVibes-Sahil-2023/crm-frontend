"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDate,
  formatMoney,
  inventoryApi,
  itemValue,
  stockStatus,
  type InventoryItem,
} from "@/lib/inventory";
import { CHART_COLORS, exportCsv } from "@/lib/reportUtils";
import { BarChart, Card, Donut, MiniTable, RankBars, ReportHeader, StatCard } from "@/components/ReportKit";

export default function InventoryReportPage() {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    inventoryApi
      .list()
      .then((list) => alive && setItems(list ?? []))
      .catch((e) => alive && setError(e?.message || "Could not load inventory."));
    return () => {
      alive = false;
    };
  }, []);

  const r = useMemo(() => {
    if (!items) return null;
    const totalItems = items.length;
    const totalUnits = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const totalValue = items.reduce((s, i) => s + itemValue(i), 0);
    const low = items.filter((i) => stockStatus(i) === "low").length;
    const out = items.filter((i) => stockStatus(i) === "out").length;

    // Stock health donut.
    const inStock = totalItems - low - out;
    const health = [
      { label: "In stock", value: inStock, color: "bg-emerald-500" },
      { label: "Low stock", value: low, color: "bg-amber-500" },
      { label: "Out of stock", value: out, color: "bg-rose-500" },
    ];

    // Value by category.
    const byCat: Record<string, number> = {};
    items.forEach((i) => {
      const c = i.category || "Uncategorised";
      byCat[c] = (byCat[c] || 0) + itemValue(i);
    });
    const categories = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([label, value], idx) => ({ label, value, color: CHART_COLORS[idx % CHART_COLORS.length] }));

    // Top items by stock value.
    const topItems = [...items]
      .sort((a, b) => itemValue(b) - itemValue(a))
      .slice(0, 6)
      .map((i) => ({ label: i.name, value: itemValue(i) }));

    // Recent stock movements across all items.
    const movements = items
      .flatMap((i) => (i.movements ?? []).map((m) => ({ ...m, item: i.name })))
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      .slice(0, 7);

    // Items needing reorder.
    const reorder = items
      .filter((i) => stockStatus(i) !== "in")
      .sort((a, b) => Number(a.quantity) - Number(b.quantity))
      .slice(0, 6);

    return { totalItems, totalUnits, totalValue, low, out, health, categories, topItems, movements, reorder };
  }, [items]);

  function onExport() {
    if (!items) return;
    exportCsv(
      "inventory-report",
      items.map((i) => ({
        SKU: i.sku || "",
        Item: i.name,
        Category: i.category || "",
        Quantity: Number(i.quantity || 0),
        "Reorder Level": Number(i.reorder_level || 0),
        "Unit Price": Number(i.unit_price || 0),
        "Stock Value": itemValue(i),
        Status: stockStatus(i),
      })),
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ReportHeader title="Inventory Report" subtitle="Stock valuation, alerts and movements." />
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">
            Couldn’t load inventory data. {error}
          </p>
        </Card>
      </div>
    );
  }

  if (!r) {
    return (
      <div className="space-y-6">
        <ReportHeader title="Inventory Report" subtitle="Stock valuation, alerts and movements." />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportHeader title="Inventory Report" subtitle="Stock valuation, alerts and movements." onExport={onExport} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="inventory" label="Stock value" value={formatMoney(r.totalValue)} wrap="bg-violet-100 text-violet-600" />
        <StatCard icon="grid" label="Items / units" value={`${r.totalItems} / ${r.totalUnits}`} wrap="bg-blue-100 text-blue-600" />
        <StatCard icon="alert" label="Low stock" value={r.low} wrap="bg-amber-100 text-amber-600" />
        <StatCard icon="close" label="Out of stock" value={r.out} wrap="bg-rose-100 text-rose-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Value by category" subtitle="Top categories by stock value" className="lg:col-span-2">
          <BarChart data={r.categories.map((c) => ({ label: c.label, value: c.value }))} color="bg-violet-500" format={formatMoney} />
        </Card>
        <Card title="Stock health" subtitle="Items by status">
          <Donut segments={r.health} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top items by value" subtitle="Highest stock value">
          <RankBars rows={r.topItems} format={formatMoney} />
        </Card>
        <Card title="Needs reorder" subtitle="Low or out of stock">
          <MiniTable
            columns={[
              { key: "name", label: "Item" },
              { key: "qty", label: "Qty", align: "right" },
              { key: "reorder", label: "Reorder", align: "right" },
            ]}
            rows={r.reorder.map((i) => ({
              name: i.name,
              qty: Number(i.quantity || 0),
              reorder: Number(i.reorder_level || 0),
            }))}
          />
        </Card>
      </div>

      <Card title="Recent stock movements" subtitle="Latest in / out adjustments">
        <MiniTable
          columns={[
            { key: "item", label: "Item" },
            { key: "type", label: "Type" },
            { key: "qty", label: "Qty", align: "right" },
            { key: "balance", label: "Balance", align: "right" },
            { key: "date", label: "Date", align: "right" },
          ]}
          rows={r.movements.map((m) => ({
            item: m.item,
            type: (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {m.type === "in" ? "Stock In" : "Stock Out"}
              </span>
            ),
            qty: Number(m.qty || 0),
            balance: Number(m.balance_after || 0),
            date: formatDate(m.created_at),
          }))}
        />
      </Card>
    </div>
  );
}

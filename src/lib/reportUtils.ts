// Small, shared helpers for the Reports section: CSV export and date-range
// presets. Kept framework-free so report pages can import freely.

export type Period = "7d" | "30d" | "90d" | "ytd" | "all";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];

// Inclusive start date (yyyy-mm-dd) for a period, or "" for all-time.
export function periodStart(period: Period): string {
  if (period === "all") return "";
  const d = new Date();
  if (period === "ytd") return `${d.getFullYear()}-01-01`;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// True when an ISO-ish date string falls on/after the period start.
export function inPeriod(iso: string | null | undefined, period: Period): boolean {
  if (period === "all") return true;
  if (!iso) return false;
  const start = periodStart(period);
  return iso.slice(0, 10) >= start;
}

// Convert rows of objects to CSV and trigger a browser download.
export function exportCsv(filename: string, rows: Record<string, string | number>[]): void {
  if (typeof window === "undefined" || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// A simple, repeatable palette for chart segments.
export const CHART_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
];

"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchableSelect from "@/components/SearchableSelect";
import { PERIODS, type Period } from "@/lib/reportUtils";

// ── Page header with optional period filter + export button ──────────
export function ReportHeader({
  title,
  subtitle,
  period,
  onPeriodChange,
  onExport,
  children,
}: {
  title: string;
  subtitle?: string;
  period?: Period;
  onPeriodChange?: (p: Period) => void;
  onExport?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {period !== undefined && onPeriodChange && (
          <SearchableSelect
            value={period}
            onChange={(v) => onPeriodChange(v as Period)}
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
            className="w-40"
            buttonClassName="shadow-sm"
          />
        )}
        {onExport && (
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Icon name="export" className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stat / KPI card ──────────────────────────────────────────────────
export function StatCard({
  icon,
  label,
  value,
  sub,
  wrap = "bg-blue-100 text-blue-600",
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  wrap?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${wrap}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section card wrapper ─────────────────────────────────────────────
export function Card({
  title,
  subtitle,
  right,
  className = "",
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Vertical bar chart (single series) ───────────────────────────────
export function BarChart({
  data,
  color = "bg-blue-500",
  format = (n) => String(n),
  height = 180,
}: {
  data: { label: string; value: number }[];
  color?: string;
  format?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <Empty />;
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end justify-center">
            <div
              className={`w-full max-w-[42px] rounded-t ${color} transition-all`}
              style={{ height: `${(d.value / max) * 100}%` }}
              title={`${d.label}: ${format(d.value)}`}
            />
          </div>
          <span className="truncate text-[11px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Grouped two-series vertical bars ─────────────────────────────────
export function GroupedBars({
  data,
  colorA = "bg-emerald-500",
  colorB = "bg-rose-400",
  labelA = "A",
  labelB = "B",
  format = (n) => String(n),
  height = 180,
}: {
  data: { label: string; a: number; b: number }[];
  colorA?: string;
  colorB?: string;
  labelA?: string;
  labelB?: string;
  format?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  if (data.length === 0) return <Empty />;
  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div className={`w-1/2 max-w-[20px] rounded-t ${colorA}`} style={{ height: `${(d.a / max) * 100}%` }} title={`${labelA} ${format(d.a)}`} />
              <div className={`w-1/2 max-w-[20px] rounded-t ${colorB}`} style={{ height: `${(d.b / max) * 100}%` }} title={`${labelB} ${format(d.b)}`} />
            </div>
            <span className="truncate text-[11px] text-slate-400">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${colorA}`} /> {labelA}</span>
        <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${colorB}`} /> {labelB}</span>
      </div>
    </div>
  );
}

// ── Horizontal ranked bars ───────────────────────────────────────────
export function RankBars({
  rows,
  format = (n) => String(n),
}: {
  rows: { label: string; value: number; color?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <Empty />;
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-slate-600">{r.label}</span>
            <span className="ml-2 shrink-0 font-semibold text-slate-700">{format(r.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${r.color ?? "bg-blue-500"}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Donut chart with legend ──────────────────────────────────────────
export function Donut({
  segments,
  format = (n) => String(n),
  size = 160,
}: {
  segments: { label: string; value: number; color: string }[];
  format?: (n: number) => string;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <Empty />;
  // Build a conic-gradient using the segment colors mapped to hex. Compute
  // cumulative offsets without mutating outer state (render-safe).
  const visible = segments.filter((s) => s.value > 0);
  const stops = visible
    .map((s, i) => {
      const before = visible.slice(0, i).reduce((sum, x) => sum + x.value, 0);
      const from = (before / total) * 100;
      const to = ((before + s.value) / total) * 100;
      return `${COLOR_HEX[s.color] ?? "#3b82f6"} ${from}% ${to}%`;
    })
    .join(", ");
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div className="h-full w-full rounded-full" style={{ background: `conic-gradient(${stops})` }} />
        <div className="absolute inset-0 m-auto flex flex-col items-center justify-center rounded-full bg-white" style={{ width: size * 0.6, height: size * 0.6 }}>
          <span className="text-lg font-bold text-slate-900">{format(total)}</span>
          <span className="text-[11px] text-slate-400">Total</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
              {s.label}
            </span>
            <span className="font-semibold text-slate-700">
              {format(s.value)}
              <span className="ml-1 font-normal text-slate-400">({((s.value / total) * 100).toFixed(0)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Tailwind class → hex, for conic-gradient (which can't use CSS classes).
const COLOR_HEX: Record<string, string> = {
  "bg-blue-500": "#3b82f6",
  "bg-emerald-500": "#10b981",
  "bg-violet-500": "#8b5cf6",
  "bg-amber-500": "#f59e0b",
  "bg-rose-500": "#f43f5e",
  "bg-cyan-500": "#06b6d4",
  "bg-indigo-500": "#6366f1",
  "bg-orange-500": "#f97316",
  "bg-teal-500": "#14b8a6",
  "bg-pink-500": "#ec4899",
  "bg-sky-500": "#0ea5e9",
  "bg-slate-400": "#94a3b8",
};

function Empty() {
  return <p className="py-8 text-center text-sm text-slate-400">No data for this period</p>;
}

// ── Simple data table ────────────────────────────────────────────────
export function MiniTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, ReactNode>[];
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            {columns.map((c) => (
              <th key={c.key} className={`pb-2 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="text-slate-700">
              {columns.map((c) => (
                <td key={c.key} className={`py-2.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { initials } from "@/lib/billing";

type StatusMeta = { label: string; badge: string; dot: string };
type IconName = Parameters<typeof Icon>[0]["name"];

export function Hero({
  title,
  subtitle,
  onCreate,
  createLabel,
  stats,
}: {
  title: string;
  subtitle: string;
  onCreate: () => void;
  createLabel: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
      <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 max-w-md text-sm text-blue-100">{subtitle}</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
        >
          <Icon name="plus" className="h-4 w-4" />
          {createLabel}
        </button>
      </div>
      <div className="relative mt-6 flex flex-wrap gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
            <p className="text-xl font-bold leading-none">{s.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Toolbar({
  query,
  onQuery,
  filterValue,
  onFilter,
  filterOptions,
  placeholder,
}: {
  query: string;
  onQuery: (v: string) => void;
  filterValue: string;
  onFilter: (v: string) => void;
  filterOptions: SelectOption[];
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <SearchableSelect value={filterValue} onChange={onFilter} options={filterOptions} className="w-full sm:w-48" />
    </div>
  );
}

export function StatusBadge({ meta }: { meta: StatusMeta }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function Empty({
  hasAny,
  icon,
  label,
  onCreate,
}: {
  hasAny: boolean;
  icon: IconName;
  label: string;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon name={icon} className="h-8 w-8" />
      </div>
      <p className="mt-4 text-lg font-semibold text-slate-800">{hasAny ? `No matching ${label}s` : `No ${label}s yet`}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {hasAny ? "Try a different search or status filter." : `Create your first ${label} to get started.`}
      </p>
      {!hasAny && (
        <button onClick={onCreate} className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          <Icon name="plus" className="h-4 w-4" />
          New {label}
        </button>
      )}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
      {initials(name)}
    </span>
  );
}

export function FormModal({
  title,
  onClose,
  onSubmit,
  submitLabel,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="px-6 py-5">{children}</div>
        <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DetailModal({
  number,
  meta,
  badge,
  customer,
  customerEmail,
  onClose,
  footer,
  children,
}: {
  number: string;
  meta: string;
  badge: StatusMeta;
  customer: string;
  customerEmail: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold">{number}</span>
                <StatusBadge meta={badge} />
              </div>
              <p className="mt-1 text-xs text-blue-100">{meta}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <Avatar name={customer} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{customer}</p>
              <p className="truncate text-xs text-slate-400">{customerEmail}</p>
            </div>
          </div>
          {children}
        </div>

        {footer && <div className="border-t border-slate-200 bg-white p-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Action({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: "default" | "primary" | "emerald" | "rose";
}) {
  const cls =
    tone === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : tone === "emerald"
        ? "bg-emerald-600 text-white hover:bg-emerald-700"
        : tone === "rose"
          ? "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition ${cls}`}>
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </button>
  );
}

export function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    />
  );
}

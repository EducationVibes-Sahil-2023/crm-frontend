"use client";

import { Icon, type IconName } from "@/components/icons";

export const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>;
}

export function HrModal({ title, onClose, children, max = "max-w-md" }: { title: string; onClose: () => void; children: React.ReactNode; max?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`my-6 w-full ${max} overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5`}>
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_80%)]" />
          <div className="relative flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15"><Icon name="close" className="h-5 w-5" /></button></div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HrFooter({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
      <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
      <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">{submitLabel}</button>
    </div>
  );
}

export function HrHero({ icon, title, sub, actionLabel, onAction, stats }: { icon: IconName; title: string; sub: string; actionLabel?: string; onAction?: () => void; stats: [string, string][] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
      <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name={icon} className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold">{title}</h1><p className="mt-1 text-sm text-blue-100">{sub}</p></div>
        </div>
        {actionLabel && onAction && (
          <button onClick={onAction} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"><Icon name="folderPlus" className="h-4 w-4" /> {actionLabel}</button>
        )}
      </div>
      <div className="relative mt-6 flex flex-wrap gap-3">
        {stats.map(([l, v]) => <div key={l} className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur"><p className="text-lg font-bold leading-none">{v}</p><p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{l}</p></div>)}
      </div>
    </div>
  );
}

export function HrEmpty({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name={icon} className="h-8 w-8" /></div><p className="mt-4 text-lg font-semibold text-slate-800">{title}</p><p className="mt-1 text-sm text-slate-500">{sub}</p></div>;
}

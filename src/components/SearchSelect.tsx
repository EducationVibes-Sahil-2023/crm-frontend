"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/**
 * Searchable dropdown used across forms (User, Lead, …).
 * Set `searchable={false}` for tiny option sets where a filter isn't useful.
 */
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  name,
  setRef,
  error,
  searchable = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  name?: string;
  setRef?: (name: string) => (el: HTMLElement | null) => void;
  error?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = searchable && q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;

  function close() {
    setOpen(false);
    setQ("");
  }

  return (
    <div className="relative">
      <button
        ref={name && setRef ? setRef(name) : undefined}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
          error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
        }`}
      >
        <span className={value ? "truncate text-slate-800" : "truncate text-slate-400"}>{value || placeholder}</span>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {searchable && (
              <div className="relative mb-1">
                <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div className="no-scrollbar max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-slate-400">No matches</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      onChange(o);
                      close();
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                      o === value ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{o}</span>
                    {o === value && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m20 6-11 11-5-5" /></svg>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

export type SelectOption = { value: string; label: string; dotClass?: string };

// A lightweight searchable dropdown (combobox). Filters options by a search box,
// closes on outside-click / Escape, and shows an optional colored dot per option.
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  buttonClassName = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    setQuery("");
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
    };
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${buttonClassName}`}
      >
        <span className={`flex min-w-0 items-center gap-2 ${selected ? "text-slate-800" : "text-slate-400"}`}>
          {selected?.dotClass && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected.dotClass}`} />}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[12rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </div>
          </div>
          <ul className="no-scrollbar max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-slate-400">No matches</li>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => pick(o.value)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                        active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {o.dotClass && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.dotClass}`} />}
                        <span className="truncate">{o.label}</span>
                      </span>
                      {active && <Icon name="check" className="h-4 w-4 shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

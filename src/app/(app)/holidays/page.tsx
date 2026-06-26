"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import {
  ALL_INDIA,
  INDIAN_STATES,
  holidayYear,
  holidayYears,
  loadHolidays,
  saveHolidays,
  type Holiday,
} from "@/lib/hr";
import { loadProfile } from "@/lib/profile";

const TYPE_STYLE: Record<string, { badge: string; dot: string; tile: string }> = {
  National: { badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", tile: "from-blue-50 to-indigo-50 text-blue-700 ring-blue-100" },
  Festival: { badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500", tile: "from-violet-50 to-fuchsia-50 text-violet-700 ring-violet-100" },
  Optional: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", tile: "from-amber-50 to-orange-50 text-amber-700 ring-amber-100" },
};
const typeStyle = (t: string) => TYPE_STYLE[t] ?? { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400", tile: "from-slate-50 to-slate-100 text-slate-600 ring-slate-200" };
const TYPE_FILTERS = ["All", "National", "Festival", "Optional"];

const TODAY = new Date();
const todayIso = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(TODAY.getDate()).padStart(2, "0")}`;

export default function HolidaysPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [myState, setMyState] = useState<string>("Karnataka");

  const [year, setYear] = useState<number>(TODAY.getFullYear());
  const [scope, setScope] = useState<"mine" | "all" | string>("mine");
  const [typeF, setTypeF] = useState("All");

  // add / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const list = loadHolidays();
      setHolidays(list);
      setMyState(loadProfile().state || "Karnataka");
      const years = holidayYears(list);
      if (years.length && !years.includes(TODAY.getFullYear())) setYear(years[years.length - 1]);
      setLoading(false);
      setReady(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready) saveHolidays(holidays);
  }, [holidays, ready]);

  const years = useMemo(() => {
    const ys = holidayYears(holidays);
    return ys.length ? ys : [TODAY.getFullYear()];
  }, [holidays]);

  const yIdx = years.indexOf(year);
  const activeState = scope === "mine" ? myState : scope === "all" ? null : scope;
  const inYear = useMemo(() => holidays.filter((h) => holidayYear(h) === year), [holidays, year]);

  const visible = useMemo(() => {
    return inYear
      .filter((h) => (!activeState ? true : h.state === ALL_INDIA || h.state === activeState))
      .filter((h) => typeF === "All" || h.type === typeF)
      .sort((a, b) => a.iso.localeCompare(b.iso));
  }, [inYear, activeState, typeF]);

  const stats = useMemo(() => {
    const mine = inYear.filter((h) => h.state === ALL_INDIA || h.state === myState);
    return {
      total: visible.length,
      mine: mine.length,
      national: visible.filter((h) => h.type === "National").length,
      festival: visible.filter((h) => h.type === "Festival").length,
      optional: visible.filter((h) => h.type === "Optional").length,
      upcoming: visible.filter((h) => h.iso >= todayIso).length,
    };
  }, [inYear, visible, myState]);

  const nextHoliday = useMemo(() => visible.find((h) => h.iso >= todayIso), [visible]);

  const months = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of visible) {
      const key = h.iso.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    return Array.from(map.entries());
  }, [visible]);

  const scopeOptions: SelectOption[] = [
    { value: "mine", label: `My state — ${myState}` },
    { value: "all", label: "All states" },
    ...INDIAN_STATES.filter((s) => s !== ALL_INDIA).map((s) => ({ value: s, label: s })),
  ];
  const stateFormOptions: SelectOption[] = INDIAN_STATES.map((s) => ({ value: s, label: s === ALL_INDIA ? "All India (everyone)" : s }));

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(h: Holiday) {
    setEditing(h);
    setModalOpen(true);
  }
  function save(entry: Holiday) {
    setHolidays((list) => {
      const exists = list.some((x) => x.id === entry.id);
      return exists ? list.map((x) => (x.id === entry.id ? entry : x)) : [...list, entry];
    });
    setYear(new Date(entry.iso + "T00:00:00").getFullYear());
    setModalOpen(false);
    setEditing(null);
    toast.success(editing ? "Holiday updated" : "Holiday added", `${entry.name} · ${entry.state}`);
  }
  function remove(id: string, nm: string) {
    setHolidays((h) => h.filter((x) => x.id !== id));
    toast.info("Removed", `${nm} was deleted.`);
  }

  return (
    <div className="space-y-5">
      {/* Compact header with inline year navigator */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white shadow-sm">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%),radial-gradient(circle_at_88%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="calendar" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Holiday Calendar</h1>
              <p className="text-xs text-blue-100">Year-wise · personalised to {myState}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Year stepper */}
            <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/20 backdrop-blur">
              <button
                onClick={() => yIdx > 0 && setYear(years[yIdx - 1])}
                disabled={yIdx <= 0}
                aria-label="Previous year"
                className="rounded-lg p-1.5 transition hover:bg-white/20 disabled:opacity-30"
              >
                <Icon name="arrowLeft" className="h-4 w-4" />
              </button>
              <span className="min-w-[3.5rem] text-center text-base font-bold tabular-nums">{year}</span>
              <button
                onClick={() => yIdx < years.length - 1 && setYear(years[yIdx + 1])}
                disabled={yIdx >= years.length - 1}
                aria-label="Next year"
                className="rounded-lg p-1.5 transition hover:bg-white/20 disabled:opacity-30"
              >
                <Icon name="arrowLeft" className="h-4 w-4 rotate-180" />
              </button>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              <Icon name="plus" className="h-4 w-4" />
              <span className="hidden sm:inline">Add Holiday</span>
            </button>
          </div>
        </div>

        {/* Year pills + quick stats inline */}
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                y === year ? "bg-white text-blue-700 shadow-sm" : "bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20"
              }`}
            >
              {y}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/20" />
          <Chip label="Total" value={stats.total} />
          <Chip label={myState} value={stats.mine} />
          <Chip label="Upcoming" value={stats.upcoming} />
        </div>
      </div>

      {/* Toolbar: type filter + scope */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeF(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${typeF === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <SearchableSelect value={scope} onChange={setScope} options={scopeOptions} className="w-full sm:w-60" />
      </div>

      {/* Next holiday highlight */}
      {!loading && nextHoliday && <NextBanner h={nextHoliday} myState={myState} />}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="flex-1"><Skeleton className="h-4 w-28" /><Skeleton className="mt-2 h-3 w-20" /></div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon name="calendar" className="h-7 w-7" /></div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No holidays for this selection</p>
          <p className="mt-1 text-sm text-slate-400">Try another year, type or state — or add one.</p>
          <button onClick={openAdd} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
            <Icon name="plus" className="h-4 w-4" /> Add Holiday
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {months.map(([key, list]) => {
            const monthLabel = new Date(key + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
            return (
              <div key={key}>
                <div className="mb-2.5 flex items-center gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{monthLabel}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{list.length}</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {list.map((h) => <HolidayCard key={h.id} h={h} myState={myState} onEdit={() => openEdit(h)} onRemove={() => remove(h.id, h.name)} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <HolidayModal
          editing={editing}
          defaultYear={year}
          stateOptions={stateFormOptions}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={save}
        />
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>;
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs ring-1 ring-white/20 backdrop-blur">
      <b className="tabular-nums">{value}</b>
      <span className="text-blue-100">{label}</span>
    </span>
  );
}

function relativeDays(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const diff = Math.round((d.getTime() - new Date(todayIso + "T00:00:00").getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return "Past";
  if (diff < 7) return `In ${diff} days`;
  if (diff < 30) return `In ${Math.round(diff / 7)} week${diff < 14 ? "" : "s"}`;
  return `In ${Math.round(diff / 30)} month${diff < 45 ? "" : "s"}`;
}

function NextBanner({ h, myState }: { h: Holiday; myState: string }) {
  const d = new Date(h.iso + "T00:00:00");
  const ts = typeStyle(h.type);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
      <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br ${ts.tile} ring-1`}>
        <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("en-US", { month: "short" })}</span>
        <span className="text-2xl font-bold leading-none">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-500">Next holiday · {relativeDays(h.iso)}</p>
        <p className="truncate text-lg font-bold text-slate-900">{h.name}</p>
        <p className="text-sm text-slate-500">{d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })} · {h.state === ALL_INDIA ? "All India" : h.state}</p>
      </div>
      {(h.state === ALL_INDIA || h.state === myState) && (
        <span className="hidden shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white sm:inline">You&apos;re off</span>
      )}
    </div>
  );
}

function HolidayCard({ h, myState, onEdit, onRemove }: { h: Holiday; myState: string; onEdit: () => void; onRemove: () => void }) {
  const d = new Date(h.iso + "T00:00:00");
  const day = d.getDate();
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  const dow = d.getDay(); // 0 Sun .. 6 Sat
  const longWeekend = dow === 1 || dow === 5; // Mon/Fri
  const ts = typeStyle(h.type);
  const isToday = h.iso === todayIso;
  const isPast = h.iso < todayIso;

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isToday ? "border-blue-400 ring-1 ring-blue-300" : "border-slate-200"
      } ${isPast ? "opacity-65" : ""}`}
    >
      <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br ${ts.tile} ring-1`}>
        <span className="text-[10px] font-semibold uppercase">{mon}</span>
        <span className="text-lg font-bold leading-none">{day}</span>
        <span className="text-[9px] opacity-70">{weekday}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-800">{h.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ts.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${ts.dot}`} />{h.type}
          </span>
          {h.state === myState ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Your state</span>
          ) : h.state === ALL_INDIA ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">All India</span>
          ) : (
            <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600" title={h.state}>{h.state}</span>
          )}
          {longWeekend && !isPast && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Long weekend</span>}
        </div>
      </div>

      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onEdit}
          title="Edit"
          aria-label={`Edit ${h.name}`}
          className="rounded-md bg-white/80 p-1.5 text-slate-400 shadow-sm backdrop-blur transition hover:bg-slate-100 hover:text-slate-700"
        >
          <Icon name="edit" className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          title="Delete"
          aria-label={`Delete ${h.name}`}
          className="rounded-md bg-white/80 p-1.5 text-slate-400 shadow-sm backdrop-blur transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function HolidayModal({
  editing,
  defaultYear,
  stateOptions,
  onClose,
  onSave,
}: {
  editing: Holiday | null;
  defaultYear: number;
  stateOptions: SelectOption[];
  onClose: () => void;
  onSave: (h: Holiday) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [date, setDate] = useState(editing?.iso ?? "");
  const [type, setType] = useState(editing?.type ?? "National");
  const [state, setState] = useState(editing?.state ?? ALL_INDIA);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !date) {
      toast.error("Incomplete", "Enter a holiday name and date.");
      return;
    }
    const d = new Date(date + "T00:00:00");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    onSave({
      id: editing?.id ?? `h-${Date.now().toString(36)}`,
      name: name.trim(),
      iso: date,
      date: label,
      type,
      state,
    });
  }

  const preview = date ? new Date(date + "T00:00:00") : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} noValidate className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        {/* gradient header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="calendar" className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-bold">{editing ? "Edit Holiday" : "Add Holiday"}</h2>
                <p className="text-xs text-blue-100">{editing ? "Update the holiday details." : `Add a new holiday${defaultYear ? ` to ${defaultYear}` : ""}.`}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label="Holiday name">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Onam" className={inputCls} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
            <Field label="Type"><SearchableSelect value={type} onChange={setType} options={["National", "Festival", "Optional"].map((t) => ({ value: t, label: t }))} /></Field>
          </div>
          <Field label="Applies to">
            <SearchableSelect value={state} onChange={setState} options={stateOptions} />
          </Field>

          {preview && !isNaN(preview.getTime()) && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-to-br ${typeStyle(type).tile} ring-1`}>
                <span className="text-[9px] font-semibold uppercase">{preview.toLocaleDateString("en-US", { month: "short" })}</span>
                <span className="text-lg font-bold leading-none">{preview.getDate()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{name.trim() || "Holiday name"}</p>
                <p className="text-xs text-slate-500">{preview.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {state === ALL_INDIA ? "All India" : state}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">{editing ? "Save changes" : "Add Holiday"}</button>
        </div>
      </form>
    </div>
  );
}

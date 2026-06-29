"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { Field, HrEmpty, HrFooter, HrHero, HrModal, inputCls } from "@/components/HrUi";
import SearchSelect from "@/components/SearchSelect";
import { ENGAGEMENT_TYPES, loadEngagement, saveEngagement, type Engagement } from "@/lib/hr";

const TYPE_STYLE: Record<string, string> = {
  "Team Outing": "bg-cyan-100 text-cyan-700",
  "Town Hall": "bg-blue-100 text-blue-700",
  Workshop: "bg-violet-100 text-violet-700",
  Celebration: "bg-rose-100 text-rose-700",
  Wellness: "bg-emerald-100 text-emerald-700",
};
function parseDate(s: string) { const t = new Date(s).getTime(); return isNaN(t) ? Infinity : t; }

export default function EngagementPage() {
  const toast = useToast();
  const me = getUser()?.name || "You";
  const [events, setEvents] = useState<Engagement[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => { setEvents(loadEngagement()); setNowMs(Date.now()); setReady(true); }, []);
  useEffect(() => { if (ready) saveEngagement(events); }, [events, ready]);

  const sorted = [...events].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const upcoming = events.filter((e) => parseDate(e.date) >= nowMs - 864e5).length;

  function add(ev: Omit<Engagement, "id" | "going">) { setEvents((l) => [{ ...ev, id: `en-${Date.now()}`, going: [] }, ...l]); setOpen(false); toast.success("Event created", ev.title); }
  function rsvp(id: string) {
    setEvents((l) => l.map((e) => (e.id === id ? { ...e, going: e.going.includes(me) ? e.going.filter((g) => g !== me) : [...e.going, me] } : e)));
  }
  function remove(id: string) { setEvents((l) => l.filter((e) => e.id !== id)); }

  return (
    <div className="space-y-6">
      <HrHero icon="chat" title="Employee Engagement" sub="Events, outings, town halls and wellness activities." actionLabel="Create Event" onAction={() => setOpen(true)} stats={[["Events", String(events.length)], ["Upcoming", String(upcoming)]]} />

      {events.length === 0 ? <HrEmpty icon="chat" title="No events yet" sub="Plan a team activity to boost engagement." /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((e) => {
            const going = e.going.includes(me);
            return (
              <div key={e.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TYPE_STYLE[e.type] ?? "bg-slate-100 text-slate-600"}`}>{e.type}</span>
                  <button onClick={() => remove(e.id)} aria-label="Remove" className="rounded p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"><Icon name="trash" className="h-4 w-4" /></button>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{e.title}</h3>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5"><Icon name="calendar" className="h-3.5 w-3.5" /> {e.date}</p>
                  <p className="flex items-center gap-1.5"><Icon name="pin" className="h-3.5 w-3.5" /> {e.location}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">{e.going.length} going</span>
                  <button onClick={() => rsvp(e.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${going ? "bg-emerald-50 text-emerald-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                    <Icon name={going ? "check" : "plus"} className="h-3.5 w-3.5" /> {going ? "Going" : "RSVP"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && <EventModal onClose={() => setOpen(false)} onSave={add} />}
    </div>
  );
}

function EventModal({ onClose, onSave }: { onClose: () => void; onSave: (e: Omit<Engagement, "id" | "going">) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [type, setType] = useState(ENGAGEMENT_TYPES[0]);
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) return toast.error("Add a title");
    if (!date) return toast.error("Pick a date");
    onSave({ title: title.trim(), type, date: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }), location: location.trim() || "TBD" });
  }
  return (
    <HrModal title="Create Event" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="space-y-4 px-6 py-6">
          <Field label="Title"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quarterly Town Hall" className={inputCls} /></Field>
          <Field label="Type"><SearchSelect value={type} onChange={setType} options={ENGAGEMENT_TYPES} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
            <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue / link" className={inputCls} /></Field>
          </div>
        </div>
        <HrFooter onClose={onClose} submitLabel="Create Event" />
      </form>
    </HrModal>
  );
}

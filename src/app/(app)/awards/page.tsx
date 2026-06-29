"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import SearchSelect from "@/components/SearchSelect";
import { Field, HrEmpty, HrFooter, HrHero, HrModal, inputCls } from "@/components/HrUi";
import { AWARD_CATEGORIES, listEmployees, loadAwards, saveAwards, type Award } from "@/lib/hr";

const CAT_STYLE: Record<string, string> = {
  "Star Performer": "bg-amber-100 text-amber-700",
  "Team Player": "bg-blue-100 text-blue-700",
  Innovation: "bg-violet-100 text-violet-700",
  "Long Service": "bg-emerald-100 text-emerald-700",
  "Spot Award": "bg-rose-100 text-rose-700",
};
const GRAD = ["from-amber-400 to-orange-500", "from-blue-400 to-indigo-500", "from-violet-400 to-purple-500", "from-emerald-400 to-teal-500", "from-rose-400 to-pink-500"];

export default function AwardsPage() {
  const toast = useToast();
  const employees = useMemo(() => listEmployees(), []);
  const [awards, setAwards] = useState<Award[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setAwards(loadAwards()); setReady(true); }, []);
  useEffect(() => { if (ready) saveAwards(awards); }, [awards, ready]);

  function add(a: Omit<Award, "id">) {
    setAwards((l) => [{ ...a, id: `aw-${Date.now()}` }, ...l]);
    setOpen(false);
    toast.success("Award given", `${a.title} → ${a.employee}`);
  }
  function remove(id: string) { setAwards((l) => l.filter((a) => a.id !== id)); }

  return (
    <div className="space-y-6">
      <HrHero icon="win" title="Awards & Recognition" sub="Celebrate and reward your team's wins." actionLabel="Give Award" onAction={() => setOpen(true)} stats={[["Total", String(awards.length)], ["This month", String(awards.filter((a) => new Date(a.date).getMonth() === new Date().getMonth()).length)]]} />

      {awards.length === 0 ? (
        <HrEmpty icon="win" title="No awards yet" sub="Recognise a team member to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {awards.map((a, i) => (
            <div key={a.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${GRAD[i % GRAD.length]}`} />
              <div className="flex items-start justify-between">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${GRAD[i % GRAD.length]}`}><Icon name="win" className="h-6 w-6" /></span>
                <button onClick={() => remove(a.id)} aria-label="Remove" className="rounded p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"><Icon name="trash" className="h-4 w-4" /></button>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">{a.title}</h3>
              <p className="text-sm font-medium text-blue-700">{a.employee}</p>
              {a.note && <p className="mt-1 text-xs text-slate-500">{a.note}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CAT_STYLE[a.category] ?? "bg-slate-100 text-slate-600"}`}>{a.category}</span>
                <span className="text-[11px] text-slate-400">{a.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <AwardModal employees={employees.map((e) => e.name)} onClose={() => setOpen(false)} onSave={add} />}
    </div>
  );
}

function AwardModal({ employees, onClose, onSave }: { employees: string[]; onClose: () => void; onSave: (a: Omit<Award, "id">) => void }) {
  const toast = useToast();
  const [employee, setEmployee] = useState(employees[0] ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(AWARD_CATEGORIES[0]);
  const [note, setNote] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Add a title");
    onSave({ employee, title: title.trim(), category, note: note.trim(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) });
  }
  return (
    <HrModal title="Give Award" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="space-y-4 px-6 py-6">
          <Field label="Employee"><SearchSelect value={employee} onChange={setEmployee} options={employees} /></Field>
          <Field label="Award title"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Counsellor of the Month" className={inputCls} /></Field>
          <Field label="Category"><SearchSelect value={category} onChange={setCategory} options={[...AWARD_CATEGORIES]} /></Field>
          <Field label="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Why are they being recognised?" /></Field>
        </div>
        <HrFooter onClose={onClose} submitLabel="Give Award" />
      </form>
    </HrModal>
  );
}

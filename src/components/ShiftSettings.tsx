"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { listEmployees } from "@/lib/hr";
import {
  DEFAULT_SHIFTS,
  format12,
  hoursLabel,
  loadAssignments,
  loadShifts,
  saveAssignments,
  saveShifts,
  type Shift,
} from "@/lib/shifts";

const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];

function diffHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

export default function ShiftSettings() {
  const toast = useToast();
  const employees = listEmployees();
  const [shifts, setShifts] = useState<Shift[]>(loadShifts);
  const [assign, setAssign] = useState<Record<string, string>>(loadAssignments);

  useEffect(() => { saveShifts(shifts); }, [shifts]);
  useEffect(() => { saveAssignments(assign); }, [assign]);

  // new shift form
  const [name, setName] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("18:00");
  const [grace, setGrace] = useState(15);

  function addShift(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required", "Give the shift a name.");
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
    setShifts((s) => [...s, { id, name: name.trim(), start, end, workHours: diffHours(start, end), graceMinutes: grace }]);
    setName("");
    toast.success("Shift added", `${name.trim()} (${format12(start)}–${format12(end)}).`);
  }
  function patch(id: string, p: Partial<Shift>) {
    setShifts((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function remove(id: string) {
    if (shifts.length <= 1) return toast.error("Keep one shift", "At least one shift is required.");
    setShifts((s) => s.filter((x) => x.id !== id));
    setAssign((a) => Object.fromEntries(Object.entries(a).map(([u, sid]) => [u, sid === id ? shifts[0].id : sid])));
    toast.info("Shift removed", "");
  }

  const counts = (id: string) => Object.values(assign).filter((v) => v === id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shifts &amp; Timing</h1>
          <p className="mt-1 text-sm text-slate-500">Define shift hours and late-coming grace, then assign users. Attendance uses these to flag late logins.</p>
        </div>
        <button onClick={() => { setShifts(DEFAULT_SHIFTS.map((s) => ({ ...s }))); toast.info("Reset", "Shifts restored to defaults."); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Reset shifts</button>
      </div>

      {/* Add shift */}
      <form onSubmit={addShift} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-800">Add a shift</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44 flex-1"><Lbl>Name</Lbl><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Night (7–3)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <div><Lbl>Start</Lbl><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <div><Lbl>End</Lbl><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <div><Lbl>Grace (min)</Lbl><input type="number" value={grace} onChange={(e) => setGrace(Math.max(0, Number(e.target.value)))} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <div className="text-xs text-slate-500">≈ {hoursLabel(diffHours(start, end))} work</div>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">+ Add</button>
        </div>
      </form>

      {/* Shifts list (editable) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3">Shift</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">End</th><th className="px-4 py-3">Avg hours</th><th className="px-4 py-3">Grace</th><th className="px-4 py-3">Users</th><th className="px-4 py-3 text-right">—</th>
          </tr></thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3"><input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} className="w-full rounded-md border border-transparent px-1.5 py-1 font-medium text-slate-800 outline-none hover:border-slate-200 focus:border-blue-500" /></td>
                <td className="px-4 py-3"><input type="time" value={s.start} onChange={(e) => patch(s.id, { start: e.target.value, workHours: diffHours(e.target.value, s.end) })} className="rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-500" /><p className="mt-0.5 text-[10px] text-slate-400">{format12(s.start)}</p></td>
                <td className="px-4 py-3"><input type="time" value={s.end} onChange={(e) => patch(s.id, { end: e.target.value, workHours: diffHours(s.start, e.target.value) })} className="rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-500" /><p className="mt-0.5 text-[10px] text-slate-400">{format12(s.end)}</p></td>
                <td className="px-4 py-3"><input type="number" step="0.5" value={s.workHours} onChange={(e) => patch(s.id, { workHours: Number(e.target.value) })} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-500" /></td>
                <td className="px-4 py-3"><div className="flex items-center gap-1"><input type="number" value={s.graceMinutes} onChange={(e) => patch(s.id, { graceMinutes: Math.max(0, Number(e.target.value)) })} className="w-14 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-500" /><span className="text-xs text-slate-400">min</span></div></td>
                <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{counts(s.id)}</span></td>
                <td className="px-4 py-3 text-right"><button onClick={() => remove(s.id)} title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign users */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <p className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">Assign users to shifts</p>
        <div className="no-scrollbar max-h-[50vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Designation</th><th className="px-5 py-3">Shift</th><th className="px-5 py-3">Timing</th></tr></thead>
            <tbody>
              {employees.map((e, i) => {
                const sid = assign[e.name] ?? shifts[0]?.id;
                const sh = shifts.find((x) => x.id === sid);
                return (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>{e.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span><span className="font-medium text-slate-800">{e.name}</span></div></td>
                    <td className="px-5 py-3 text-slate-500">{e.designation}</td>
                    <td className="px-5 py-3"><select value={sid} onChange={(ev) => setAssign((a) => ({ ...a, [e.name]: ev.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500">{shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                    <td className="px-5 py-3 text-slate-600">{sh ? `${format12(sh.start)} – ${format12(sh.end)} · grace ${sh.graceMinutes}m` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-500">{children}</label>;
}

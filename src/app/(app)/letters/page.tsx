"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import SearchSelect from "@/components/SearchSelect";
import { formatMoney, listEmployees, loadLetters, saveLetters, type Letter, type LetterKind } from "@/lib/hr";

export default function LettersPage() {
  const toast = useToast();
  const employees = useMemo(() => listEmployees(), []);
  const [letters, setLetters] = useState<Letter[]>(loadLetters);
  const [kind, setKind] = useState<LetterKind>("offer");
  const [employee, setEmployee] = useState(employees[0]?.name ?? "");
  const [designation, setDesignation] = useState(employees[0]?.designation ?? "");
  const [ctc, setCtc] = useState(employees[0]?.ctc ?? 50000);
  const [prevCtc, setPrevCtc] = useState(employees[0]?.ctc ?? 50000);
  const [effectiveDate, setEffectiveDate] = useState("");

  useEffect(() => { saveLetters(letters); }, [letters]);

  function onPick(name: string) {
    setEmployee(name);
    const e = employees.find((x) => x.name === name);
    if (e) { setDesignation(e.designation); setCtc(e.ctc); setPrevCtc(e.ctc); }
  }

  const preview: Letter = {
    id: "preview", kind, employee, designation, department: "Counsellor", ctc,
    effectiveDate: effectiveDate ? new Date(effectiveDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—",
    prevCtc: kind === "increment" ? prevCtc : undefined,
    createdAt: "",
  };

  function generate() {
    if (!effectiveDate) return toast.error("Pick a date", "Select an effective date for the letter.");
    const letter: Letter = { ...preview, id: `lt-${Date.now().toString(36)}`, createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) };
    setLetters((all) => [letter, ...all]);
    toast.success("Letter generated", `${kind === "offer" ? "Offer" : "Increment"} letter for ${employee} created.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Letters</h1>
        <p className="mt-1 text-sm text-slate-500">Generate offer and increment letters.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* Form */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            <button onClick={() => setKind("offer")} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${kind === "offer" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Offer Letter</button>
            <button onClick={() => setKind("increment")} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${kind === "increment" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Increment Letter</button>
          </div>
          <L label="Employee"><SearchSelect value={employee} onChange={onPick} options={employees.map((e) => e.name)} /></L>
          <L label="Designation"><input value={designation} onChange={(e) => setDesignation(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></L>
          {kind === "increment" && (
            <L label="Previous CTC (monthly)"><input type="number" value={prevCtc} onChange={(e) => setPrevCtc(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></L>
          )}
          <L label={kind === "increment" ? "Revised CTC (monthly)" : "CTC (monthly)"}><input type="number" value={ctc} onChange={(e) => setCtc(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></L>
          <L label="Effective date"><input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></L>
          <button onClick={generate} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Generate Letter</button>
        </div>

        {/* Preview */}
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <LetterBody letter={preview} />
            <button onClick={() => window.print()} className="mt-6 flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Icon name="download" className="h-4 w-4" /> Print / Download</button>
          </div>

          {letters.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <p className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">Generated letters</p>
              <ul>
                {letters.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 last:border-0 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon name="fileText" className="h-4 w-4" /></span>
                      <div><p className="text-sm font-medium text-slate-800">{l.kind === "offer" ? "Offer" : "Increment"} · {l.employee}</p><p className="text-xs text-slate-500">{formatMoney(l.ctc)}/mo · eff. {l.effectiveDate} · {l.createdAt}</p></div>
                    </div>
                    <button onClick={() => setLetters((all) => all.filter((x) => x.id !== l.id))} title="Delete" className="rounded-md p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LetterBody({ letter }: { letter: Letter }) {
  const annual = letter.ctc * 12;
  return (
    <div className="text-sm leading-relaxed text-slate-700">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white">E</span><div><p className="font-bold text-slate-900">EducationVibes</p><p className="text-xs text-slate-400">Human Resources</p></div></div>
        <p className="text-xs text-slate-400">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
      <p className="mt-5 font-semibold text-slate-900">{letter.kind === "offer" ? "Letter of Offer" : "Salary Increment Letter"}</p>
      <p className="mt-3">Dear {letter.employee},</p>
      {letter.kind === "offer" ? (
        <p className="mt-3">We are pleased to offer you the position of <strong>{letter.designation}</strong> in the {letter.department} department at EducationVibes, effective <strong>{letter.effectiveDate}</strong>. Your total compensation will be <strong>{formatMoney(letter.ctc)} per month</strong> ({formatMoney(annual)} per annum), subject to the company&apos;s standard terms and statutory deductions.</p>
      ) : (
        <p className="mt-3">In recognition of your performance and contribution as <strong>{letter.designation}</strong>, we are pleased to revise your compensation from <strong>{formatMoney(letter.prevCtc ?? 0)}</strong> to <strong>{formatMoney(letter.ctc)} per month</strong> ({formatMoney(annual)} per annum), effective <strong>{letter.effectiveDate}</strong>. All other terms of your employment remain unchanged.</p>
      )}
      <p className="mt-3">We look forward to your continued success with the team.</p>
      <p className="mt-6">Warm regards,</p>
      <p className="mt-1 font-semibold text-slate-900">HR Department</p>
      <p className="text-xs text-slate-400">EducationVibes</p>
    </div>
  );
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>;
}

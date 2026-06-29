"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import SearchSelect from "@/components/SearchSelect";
import { loadForms, pickAssignee, saveForms, type FormField, type LeadFormDef } from "@/lib/forms";
import { captureLead, findDuplicate, makeIntakeLead } from "@/lib/leadStore";
import { listDirectory } from "@/lib/directory";
import { notifyLeadTransferred, notifyNewLead } from "@/lib/leadNotify";

// Public, embeddable lead-capture form. Submitting writes into the shared lead
// store, which the CRM picks up in real time (same browser / cross-tab).
export default function PublicFormPage() {
  const params = useParams();
  const search = useSearchParams();
  const embed = search.get("embed") === "1";
  const id = String(params.id);

  const [form, setForm] = useState<LeadFormDef | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [dup, setDup] = useState(false);

  useEffect(() => {
    setForm(loadForms().find((f) => f.id === id) ?? null);
  }, [id]);

  function set(key: string, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const next: Record<string, string> = {};
    for (const f of form.fields) {
      const val = (values[f.key] ?? "").trim();
      if (f.required && !val) next[f.key] = `${f.label} is required`;
      if (f.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) next[f.key] = "Enter a valid email";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const assignedTo = pickAssignee(form, form.submissions, listDirectory());
    const lead = makeIntakeLead(
      {
        name: values.name || "Website lead",
        email: values.email,
        phone: values.phone,
        company: values.company,
        city: values.city,
        state: values.state,
        formId: form.id,
        assignedTo,
      },
      "Website Form",
      form.defaults,
    );
    // Block duplicates if the form disallows them.
    if (!form.allowDuplicates && findDuplicate(lead, form.dedupeFields)) {
      setDup(true);
      return;
    }
    captureLead(lead);
    notifyNewLead(lead);
    if (form.notifyOnTransfer && assignedTo) notifyLeadTransferred(lead);
    // Bump the form's submission counter.
    saveForms(loadForms().map((f) => (f.id === form.id ? { ...f, submissions: f.submissions + 1 } : f)));
    setDone(true);
  }

  const wrap = embed ? "p-3" : "min-h-screen bg-slate-100 p-4 sm:p-8 flex items-start justify-center";

  if (!form || !form.isPublic) {
    return (
      <div className={wrap}>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-slate-500">This form is not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <h1 className="relative text-lg font-bold">{form.name}</h1>
          {form.description && <p className="relative mt-1 text-sm text-blue-100">{form.description}</p>}
        </div>

        {dup ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Already received</h2>
            <p className="mt-1 text-sm text-slate-500">It looks like you&apos;ve already submitted this form. Our team will be in touch.</p>
            <button onClick={() => { setValues({}); setDup(false); }} className="mt-5 text-sm font-semibold text-blue-600 hover:underline">Start over</button>
          </div>
        ) : done ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><path d="m20 6-11 11-5-5" /></svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Thank you!</h2>
            <p className="mt-1 text-sm text-slate-500">{form.successMessage}</p>
            <button onClick={() => { setValues({}); setDone(false); }} className="mt-5 text-sm font-semibold text-blue-600 hover:underline">Submit another response</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-6 py-6">
            {form.fields.map((f) => (
              <PublicField key={f.key} field={f} value={values[f.key] ?? ""} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
            ))}
            <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
              Submit
            </button>
            <p className="text-center text-[11px] text-slate-400">Protected by your CRM · powered by Nexus</p>
          </form>
        )}
      </div>
    </div>
  );
}

function PublicField({ field, value, error, onChange }: { field: FormField; value: string; error?: string; onChange: (v: string) => void }) {
  const cls = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        {field.label} {field.required && <span className="text-rose-500">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`${cls} resize-none`} />
      ) : field.type === "select" ? (
        <SearchSelect value={value} onChange={onChange} options={field.options ?? []} placeholder="Select…" error={error} />
      ) : (
        <input type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

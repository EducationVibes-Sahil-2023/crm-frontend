"use client";

import { useState } from "react";
import SearchSelect from "@/components/SearchSelect";
import { useToast } from "@/components/Toast";
import { listDirectory } from "@/lib/directory";
import { VISITOR_TYPES, addVisitorRequest, type VisitorRequest } from "@/lib/leadExtras";

export default function VisitorRequestForm({
  lead,
  requestedBy,
  onClose,
  onCreated,
}: {
  lead?: { id: string; name: string };
  requestedBy: string;
  onClose: () => void;
  onCreated: (req: VisitorRequest) => void;
}) {
  const toast = useToast();
  const attendees = listDirectory().map((u) => u.name);
  const [form, setForm] = useState({
    leadName: lead?.name ?? "",
    dateOfVisit: "",
    location: "",
    visitorType: VISITOR_TYPES[0],
    attendee: attendees[0] ?? "",
    address: "",
    purpose: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const req: Record<string, string> = {};
    if (!form.leadName.trim()) req.leadName = "Lead name is required";
    if (!form.dateOfVisit) req.dateOfVisit = "Date of visit is required";
    if (!form.location.trim()) req.location = "Location is required";
    if (!form.visitorType) req.visitorType = "Visitor type is required";
    if (!form.attendee) req.attendee = "Attendee is required";
    if (!form.address.trim()) req.address = "Address is required";
    if (!form.purpose.trim()) req.purpose = "Purpose is required";
    setErrors(req);
    if (Object.keys(req).length) return;

    const created = addVisitorRequest({
      leadId: lead?.id,
      leadName: form.leadName.trim(),
      dateOfVisit: form.dateOfVisit,
      location: form.location.trim(),
      visitorType: form.visitorType,
      attendee: form.attendee,
      address: form.address.trim(),
      purpose: form.purpose.trim(),
      requestedBy,
    });
    toast.success("Visitor request created", `Visit on ${new Date(form.dateOfVisit).toLocaleDateString()} submitted.`);
    onCreated(created);
  }

  const inputCls = (err?: boolean) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${err ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate className="no-scrollbar my-8 w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Create Lead Visitor Request</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!lead && (
            <F label="Lead / Visitor name" error={errors.leadName}>
              <input value={form.leadName} onChange={(e) => set("leadName", e.target.value)} placeholder="Lead name" className={inputCls(!!errors.leadName)} />
            </F>
          )}
          <F label="Date of Visit" error={errors.dateOfVisit}>
            <input type="datetime-local" value={form.dateOfVisit} onChange={(e) => set("dateOfVisit", e.target.value)} className={inputCls(!!errors.dateOfVisit)} />
          </F>
          <F label="Location" error={errors.location}>
            <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Mumbai HQ" className={inputCls(!!errors.location)} />
          </F>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Visitor Type" error={errors.visitorType}>
              <SearchSelect value={form.visitorType} onChange={(v) => set("visitorType", v)} options={VISITOR_TYPES} error={errors.visitorType} searchable={false} />
            </F>
            <F label="Attendee" error={errors.attendee}>
              <SearchSelect value={form.attendee} onChange={(v) => set("attendee", v)} options={attendees} error={errors.attendee} placeholder="Select attendee" />
            </F>
          </div>
          <F label="Address" error={errors.address}>
            <textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} placeholder="address" className={`resize-none ${inputCls(!!errors.address)}`} />
          </F>
          <F label="Purpose" error={errors.purpose}>
            <textarea value={form.purpose} onChange={(e) => set("purpose", e.target.value)} rows={2} placeholder="Purpose of visit" className={`resize-none ${inputCls(!!errors.purpose)}`} />
          </F>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Submit Request</button>
        </div>
      </form>
    </div>
  );
}

function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label} <span className="text-rose-500">*</span></label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

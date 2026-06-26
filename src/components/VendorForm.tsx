"use client";

import { useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { useToast } from "@/components/Toast";
import {
  PAYMENT_TERMS,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  emptyVendor,
  type Vendor,
} from "@/lib/vendors";

const FIELD_ORDER = ["name", "contactPerson", "email", "phone", "category", "gstin", "website", "city", "state", "zip", "paymentTerms", "status"];

const isUrl = (v: string) => /^https?:\/\/.+/i.test(v);

export default function VendorForm({
  initial,
  mode,
  onClose,
  onSubmit,
}: {
  initial: Vendor | null;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (vendor: Vendor) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Vendor>(() => ({ ...emptyVendor(), ...initial }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const setRef = (name: string) => (el: HTMLElement | null) => {
    fieldRefs.current[name] = el;
  };

  const set = <K extends keyof Vendor>(key: K, value: Vendor[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const v = (s: string) => (s ?? "").trim();
    if (!v(form.name)) e.name = "Vendor name is required";
    if (!v(form.email)) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v(form.email))) e.email = "Enter a valid email address";
    if (!v(form.phone)) e.phone = "Phone is required";
    else if (!/^[+\d][\d\s()-]{6,}$/.test(v(form.phone))) e.phone = "Enter a valid phone number";
    if (v(form.website) && !isUrl(form.website)) e.website = "Enter a full URL (https://…)";
    if (v(form.zip) && !/^[\dA-Za-z -]{3,10}$/.test(v(form.zip))) e.zip = "Enter a valid zip / postal code";
    return e;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    const keys = Object.keys(e);
    if (keys.length) {
      const first = FIELD_ORDER.find((k) => e[k]) ?? keys[0];
      const el = fieldRefs.current[first];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => el?.focus?.(), 250);
      toast.error("Check the form", `${keys.length} field${keys.length > 1 ? "s" : ""} need attention.`);
      return;
    }
    onSubmit({ ...form, name: form.name.trim(), email: form.email.trim() });
  }

  const initials = form.name.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "V";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} noValidate className="no-scrollbar my-6 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="sticky top-0 z-20 overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-2 ring-white/40 backdrop-blur">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{mode === "create" ? "Add Vendor" : "Edit Vendor"}</h2>
                <p className="truncate text-sm text-emerald-100">{form.name.trim() || "New supplier"}{form.category && <span className="text-emerald-200"> · {form.category}</span>}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="space-y-7 px-6 py-6">
          {/* Business */}
          <Section title="Business" icon="briefcase">
            <Field label="Vendor name" required error={errors.name}>
              <Input name="name" setRef={setRef} value={form.name} onChange={(v) => set("name", v)} error={errors.name} placeholder="Acme Supplies Co." />
            </Field>
            <Field label="Contact person" error={errors.contactPerson}>
              <Input name="contactPerson" setRef={setRef} value={form.contactPerson} onChange={(v) => set("contactPerson", v)} placeholder="Rajesh Kumar" />
            </Field>
            <Field label="Category">
              <SearchSelect name="category" setRef={setRef} value={form.category} onChange={(v) => set("category", v)} options={VENDOR_CATEGORIES} placeholder="Select category" />
            </Field>
            <Field label="GSTIN / Tax ID">
              <Input name="gstin" setRef={setRef} value={form.gstin} onChange={(v) => set("gstin", v)} placeholder="27AABCA1234F1Z5" />
            </Field>
          </Section>

          {/* Contact */}
          <Section title="Contact" icon="call">
            <Field label="Email" required error={errors.email}>
              <Input name="email" setRef={setRef} type="email" value={form.email} onChange={(v) => set("email", v)} error={errors.email} placeholder="sales@acme.in" />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <Input name="phone" setRef={setRef} value={form.phone} onChange={(v) => set("phone", v)} error={errors.phone} placeholder="+91 98200 11223" />
            </Field>
            <Field label="Website" full error={errors.website}>
              <Input name="website" setRef={setRef} value={form.website} onChange={(v) => set("website", v)} error={errors.website} placeholder="https://acme.in" />
            </Field>
          </Section>

          {/* Address */}
          <Section title="Address" icon="pin">
            <Field label="Address" full>
              <Input value={form.address} onChange={(v) => set("address", v)} placeholder="Plot 12, MIDC" />
            </Field>
            <Field label="City"><Input name="city" setRef={setRef} value={form.city} onChange={(v) => set("city", v)} placeholder="Pune" /></Field>
            <Field label="State"><Input name="state" setRef={setRef} value={form.state} onChange={(v) => set("state", v)} placeholder="MH" /></Field>
            <Field label="Zip / Postal" error={errors.zip}><Input name="zip" setRef={setRef} value={form.zip} onChange={(v) => set("zip", v)} error={errors.zip} placeholder="411001" /></Field>
            <Field label="Country"><Input value={form.country} onChange={(v) => set("country", v)} placeholder="India" /></Field>
          </Section>

          {/* Terms */}
          <Section title="Terms" icon="payment">
            <Field label="Payment terms">
              <SearchSelect name="paymentTerms" setRef={setRef} value={form.paymentTerms} onChange={(v) => set("paymentTerms", v)} options={PAYMENT_TERMS} searchable={false} />
            </Field>
            <Field label="Status">
              <SearchSelect name="status" setRef={setRef} value={form.status} onChange={(v) => set("status", v)} options={VENDOR_STATUSES} searchable={false} />
            </Field>
            <Field label="Notes" full>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                placeholder="Anything worth remembering about this vendor…"
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            {mode === "create" ? "Save Vendor" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: Parameters<typeof Icon>[0]["name"]; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Icon name={icon} className="h-4 w-4 text-slate-400" /> {title}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, required, full, error, children }: { label: string; required?: boolean; full?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          {error}
        </p>
      )}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", name, setRef, error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  name?: string;
  setRef?: (name: string) => (el: HTMLElement | null) => void;
  error?: string;
}) {
  return (
    <input
      ref={name && setRef ? setRef(name) : undefined}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
        error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
      }`}
    />
  );
}

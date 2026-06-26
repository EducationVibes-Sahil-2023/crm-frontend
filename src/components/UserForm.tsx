"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { useToast } from "@/components/Toast";
import { optionNames } from "@/lib/setup";
import { STATE_NAMES, citiesOf } from "@/lib/places";
import {
  ACTIONS,
  MODULES,
  countMatrix,
  emptyMatrix,
  loadRoles,
  type Action,
  type Perm,
} from "@/lib/roles";
import { USER_FIELDS, loadFieldConfig, type UserFieldKey } from "@/lib/userFields";
import { MAX_AVATAR_BYTES, readAvatar } from "@/lib/profile";

export type UserDraft = {
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  role: string;
  status: string;
  companyCode: string;
  joiningDate: string;
  city: string;
  state: string;
  address: string;
  zip: string;
  bio: string;
  password: string;
  linkedin: string;
  twitter: string;
  github: string;
  avatar: string | null;
  extraPermissions: Record<string, Perm>;
};

const STATUSES = ["Active", "Inactive"];

// Scroll/focus priority when validation fails (top-to-bottom in the form).
const FIELD_ORDER = [
  "name", "email", "phone", "designation", "department", "bio", "role",
  "companyCode", "joiningDate", "city", "state", "address", "zip",
  "linkedin", "twitter", "github", "password",
];

const BLANK: UserDraft = {
  name: "", email: "", phone: "", designation: "", department: "", role: "",
  status: "Active", companyCode: "", joiningDate: "", city: "", state: "",
  address: "", zip: "", bio: "", password: "", linkedin: "", twitter: "",
  github: "", avatar: null, extraPermissions: emptyMatrix(),
};

const isUrl = (v: string) => /^https?:\/\/.+/i.test(v);

export default function UserForm({
  initial,
  mode,
  onClose,
  onSubmit,
}: {
  initial: UserDraft | null;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (draft: UserDraft) => void;
}) {
  const toast = useToast();
  const [roles] = useState(loadRoles);
  const [fieldCfg] = useState(loadFieldConfig);
  const designations = useMemo(() => optionNames("designation"), []);
  const departments = useMemo(() => optionNames("department"), []);

  // A field is required when configured mandatory; password only on create.
  const isReq = (key: UserFieldKey) => fieldCfg[key] && (key !== "password" || mode === "create");

  const [form, setForm] = useState<UserDraft>(() => ({
    ...BLANK,
    role: initial?.role || roles[0]?.name || "",
    designation: initial?.designation || designations[0] || "",
    department: initial?.department || departments[0] || "",
    ...initial,
    extraPermissions: { ...emptyMatrix(), ...(initial?.extraPermissions ?? {}) },
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const setRef = (name: string) => (el: HTMLElement | null) => {
    fieldRefs.current[name] = el;
  };

  const avatarRef = useRef<HTMLInputElement>(null);
  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image too large", "Please choose an image under 2 MB.");
      return;
    }
    try {
      const dataUrl = await readAvatar(file);
      setForm((f) => ({ ...f, avatar: dataUrl }));
    } catch {
      toast.error("Upload failed", "Could not read that image.");
    }
  }

  const set = <K extends keyof UserDraft>(key: K, value: UserDraft[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const selectedRole = roles.find((r) => r.name === form.role);
  const base = selectedRole?.permissions ?? emptyMatrix();
  const extraCount = countMatrix(form.extraPermissions);
  const initials = form.name.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  function toggleExtra(moduleKey: string, action: Action) {
    setForm((f) => ({
      ...f,
      extraPermissions: {
        ...f.extraPermissions,
        [moduleKey]: { ...f.extraPermissions[moduleKey], [action]: !f.extraPermissions[moduleKey][action] },
      },
    }));
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const v = (s: string) => (s ?? "").trim();

    // Required checks driven by the Admin Setup field config.
    for (const f of USER_FIELDS) {
      if (isReq(f.key) && !v(form[f.key])) e[f.key] = `${f.label} is required`;
    }

    // Format checks — always applied when a value is present.
    if (v(form.name) && v(form.name).length < 2) e.name = "Name is too short";
    if (v(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v(form.email))) e.email = "Enter a valid email address";
    if (v(form.phone) && !/^[+\d][\d\s()-]{6,}$/.test(v(form.phone))) e.phone = "Enter a valid phone number";
    if (v(form.zip) && !/^\d{4,6}$/.test(v(form.zip))) e.zip = "Enter a valid zip code";
    if (form.password && form.password.length < 6) e.password = "Use at least 6 characters";
    for (const k of ["linkedin", "twitter", "github"] as const) {
      if (v(form[k]) && !isUrl(form[k])) e[k] = "Enter a full URL (https://…)";
    }
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
      toast.error("Check the form", `${keys.length} field${keys.length > 1 ? "s" : ""} need${keys.length > 1 ? "" : "s"} attention.`);
      return;
    }
    onSubmit({ ...form, name: form.name.trim(), email: form.email.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        noValidate
        className="no-scrollbar my-6 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        {/* Gradient header with live avatar preview */}
        <div className="sticky top-0 z-20 overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="group relative h-14 w-14 shrink-0">
                {form.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/40" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-2 ring-white/40 backdrop-blur">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarRef.current?.click()}
                  title="Upload photo"
                  aria-label="Upload photo"
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-600 shadow ring-1 ring-black/5 transition hover:bg-blue-50"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{mode === "create" ? "Add New User" : "Edit User"}</h2>
                <p className="truncate text-sm text-blue-100">
                  {form.name.trim() || "New team member"}
                  {form.role && <span className="text-blue-200"> · {form.role}</span>}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="space-y-7 px-6 py-6">
          {/* Profile */}
          <Section title="Profile" icon="users">
            <Field label="Full name" required={isReq("name")} error={errors.name}>
              <Input name="name" setRef={setRef} value={form.name} onChange={(v) => set("name", v)} error={errors.name} placeholder="e.g. Priya Nair" />
            </Field>
            <Field label="Email" required={isReq("email")} error={errors.email}>
              <Input name="email" setRef={setRef} type="email" value={form.email} onChange={(v) => set("email", v)} error={errors.email} placeholder="name@educationvibes.in" />
            </Field>
            <Field label="Phone number" required={isReq("phone")} error={errors.phone}>
              <Input name="phone" setRef={setRef} value={form.phone} onChange={(v) => set("phone", v)} error={errors.phone} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Designation" required={isReq("designation")} error={errors.designation}>
              <SearchSelect name="designation" setRef={setRef} value={form.designation} onChange={(v) => set("designation", v)} options={designations} error={errors.designation} placeholder="Select designation" />
            </Field>
            <Field label="Department" required={isReq("department")} error={errors.department}>
              <SearchSelect name="department" setRef={setRef} value={form.department} onChange={(v) => set("department", v)} options={departments} error={errors.department} placeholder="Select department" />
            </Field>
            <Field label="Bio" full required={isReq("bio")} error={errors.bio}>
              <textarea
                ref={setRef("bio")}
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                rows={2}
                placeholder="Short summary about this user…"
                className={`w-full resize-none rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                  errors.bio ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
              />
            </Field>
          </Section>

          {/* Role & status */}
          <Section title="Role & Access" icon="settings">
            <Field label="Role" required={isReq("role")} error={errors.role}>
              <SearchSelect name="role" setRef={setRef} value={form.role} onChange={(v) => set("role", v)} options={roles.map((r) => r.name)} error={errors.role} placeholder="Select role" />
            </Field>
            <Field label="Status">
              <SearchSelect value={form.status} onChange={(v) => set("status", v)} options={STATUSES} searchable={false} />
            </Field>
          </Section>

          {/* Permissions */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Icon name="settings" className="h-4 w-4 text-slate-400" /> Permissions
              </p>
              <span className="text-xs text-slate-500">
                Inherited from <strong>{form.role || "—"}</strong>
                {extraCount > 0 && <span className="text-blue-600"> · +{extraCount} additional</span>}
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Granted by role (locked)</span>
              <span className="ml-4 inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Additional grant for this user</span>
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Module</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-3 py-2.5 text-center capitalize">{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m) => (
                    <tr key={m.key} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{m.label}</td>
                      {ACTIONS.map((a) => {
                        const inherited = base[m.key]?.[a];
                        const extra = form.extraPermissions[m.key]?.[a];
                        return (
                          <td key={a} className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!(inherited || extra)}
                              disabled={inherited}
                              onChange={() => toggleExtra(m.key, a)}
                              title={inherited ? "Granted by role" : extra ? "Additional grant" : "Grant as additional permission"}
                              aria-label={`${m.label} ${a}`}
                              className={`h-4 w-4 rounded border-slate-300 ${inherited ? "accent-slate-400" : "cursor-pointer accent-blue-600"}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Work */}
          <Section title="Work" icon="briefcase">
            <Field label="Company code" required={isReq("companyCode")} error={errors.companyCode}>
              <Input name="companyCode" setRef={setRef} value={form.companyCode} onChange={(v) => set("companyCode", v)} error={errors.companyCode} placeholder="EDV-001" />
            </Field>
            <Field label="Joining date" required={isReq("joiningDate")} error={errors.joiningDate}>
              <input
                ref={setRef("joiningDate")}
                type="date"
                value={toDateInput(form.joiningDate)}
                onChange={(e) => set("joiningDate", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                  errors.joiningDate ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
              />
            </Field>
          </Section>

          {/* Location */}
          <Section title="Location" icon="pin">
            <Field label="State" required={isReq("state")} error={errors.state}>
              <SearchSelect
                name="state"
                setRef={setRef}
                value={form.state}
                onChange={(v) => { set("state", v); if (!citiesOf(v).includes(form.city)) set("city", ""); }}
                options={STATE_NAMES}
                error={errors.state}
                placeholder="Select state"
              />
            </Field>
            <Field label="City" required={isReq("city")} error={errors.city}>
              <SearchSelect
                name="city"
                setRef={setRef}
                value={form.city}
                onChange={(v) => set("city", v)}
                options={citiesOf(form.state)}
                error={errors.city}
                placeholder={form.state ? "Select city" : "Select a state first"}
              />
            </Field>
            <Field label="Address" required={isReq("address")} error={errors.address}>
              <Input name="address" setRef={setRef} value={form.address} onChange={(v) => set("address", v)} error={errors.address} placeholder="12 MG Road" />
            </Field>
            <Field label="Zip" required={isReq("zip")} error={errors.zip}>
              <Input name="zip" setRef={setRef} value={form.zip} onChange={(v) => set("zip", v)} error={errors.zip} placeholder="400001" />
            </Field>
          </Section>

          {/* Social */}
          <Section title="Social" icon="chat">
            <Field label="LinkedIn" required={isReq("linkedin")} error={errors.linkedin}>
              <Input name="linkedin" setRef={setRef} value={form.linkedin} onChange={(v) => set("linkedin", v)} error={errors.linkedin} placeholder="https://linkedin.com/in/…" />
            </Field>
            <Field label="Twitter" required={isReq("twitter")} error={errors.twitter}>
              <Input name="twitter" setRef={setRef} value={form.twitter} onChange={(v) => set("twitter", v)} error={errors.twitter} placeholder="https://twitter.com/…" />
            </Field>
            <Field label="GitHub" required={isReq("github")} error={errors.github}>
              <Input name="github" setRef={setRef} value={form.github} onChange={(v) => set("github", v)} error={errors.github} placeholder="https://github.com/…" />
            </Field>
          </Section>

          {/* Security */}
          <Section title="Security" icon="ticket">
            <Field label={mode === "edit" ? "Reset password" : "Password"} required={isReq("password")} error={errors.password}>
              <Input name="password" setRef={setRef} value={form.password} onChange={(v) => set("password", v)} error={errors.password} placeholder={mode === "edit" ? "Leave blank to keep current" : "Set a password"} />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            {mode === "create" ? "Create User" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Convert a stored display date ("Jan 12, 2021") or ISO to a yyyy-mm-dd value.
function toDateInput(value: string): string {
  if (!value || value === "—") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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


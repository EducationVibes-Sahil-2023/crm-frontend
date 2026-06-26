"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { useToast } from "@/components/Toast";
import {
  DEFAULT_LEAD_FIELD_CONFIG,
  LEAD_FIELDS,
  loadCustomFields,
  loadLeadFieldConfig,
  makeCustomField,
  saveCustomFields,
  saveLeadFieldConfig,
  type LeadCustomField,
  type LeadCustomFieldType,
  type LeadFieldConfig,
} from "@/lib/leadFields";

const TYPE_LABELS: Record<LeadCustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
};

export default function LeadFieldSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<LeadFieldConfig>(loadLeadFieldConfig);
  const [custom, setCustom] = useState<LeadCustomField[]>([]);
  const [ready, setReady] = useState(false);

  // New custom field form
  const [label, setLabel] = useState("");
  const [type, setType] = useState<LeadCustomFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setCfg(loadLeadFieldConfig());
      setCustom(loadCustomFields());
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready) saveLeadFieldConfig(cfg);
  }, [cfg, ready]);

  useEffect(() => {
    if (ready) saveCustomFields(custom);
  }, [custom, ready]);

  const requiredCount = LEAD_FIELDS.filter((f) => cfg[f.key]).length + custom.filter((f) => f.required).length;

  function toggle(key: (typeof LEAD_FIELDS)[number]["key"], locked?: boolean) {
    if (locked) {
      toast.info("Always required", "This field is essential and can't be made optional.");
      return;
    }
    setCfg((c) => ({ ...c, [key]: !c[key] }));
  }

  function reset() {
    setCfg({ ...DEFAULT_LEAD_FIELD_CONFIG });
    toast.info("Reset", "Field requirements restored to defaults.");
  }

  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    const clash =
      LEAD_FIELDS.some((f) => f.label.toLowerCase() === trimmed.toLowerCase()) ||
      custom.some((f) => f.label.toLowerCase() === trimmed.toLowerCase());
    if (clash) {
      toast.error("Already exists", `A field called "${trimmed}" already exists.`);
      return;
    }
    const opts = optionsText.split(",").map((o) => o.trim()).filter(Boolean);
    if (type === "select" && opts.length === 0) {
      toast.error("Add options", "A dropdown field needs at least one option.");
      return;
    }
    setCustom((list) => [...list, makeCustomField(trimmed, type, opts, required)]);
    setLabel("");
    setType("text");
    setOptionsText("");
    setRequired(false);
    toast.success("Field added", `"${trimmed}" will now appear in the Create Lead form.`);
  }

  function removeCustom(id: string, nm: string) {
    setCustom((list) => list.filter((f) => f.id !== id));
    toast.info("Field removed", `"${nm}" was deleted.`);
  }

  function toggleCustomRequired(id: string) {
    setCustom((list) => list.map((f) => (f.id === id ? { ...f, required: !f.required } : f)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lead Form Fields</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose which fields are mandatory and add custom fields to the Create Lead form.
          </p>
        </div>
        <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Reset to defaults
        </button>
      </div>

      {/* Built-in fields */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Standard fields</span>
          <span><strong className="text-slate-700">{requiredCount}</strong> required</span>
        </div>
        <ul>
          {LEAD_FIELDS.map((f) => {
            const req = cfg[f.key];
            return (
              <li key={f.key} className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3 last:border-0 hover:bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{f.label}</span>
                  {f.locked && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Essential</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${req ? "text-blue-600" : "text-slate-400"}`}>{req ? "Mandatory" : "Optional"}</span>
                  <Toggle on={req} disabled={f.locked} onClick={() => toggle(f.key, f.locked)} label={`${f.label} mandatory`} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Add custom field */}
      <form onSubmit={addCustom} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-800">Add custom field</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Field label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Budget, Course Interested, Preferred City"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Field type</label>
            <SearchSelect
              value={TYPE_LABELS[type]}
              onChange={(v) => {
                const found = (Object.keys(TYPE_LABELS) as LeadCustomFieldType[]).find((k) => TYPE_LABELS[k] === v);
                if (found) setType(found);
              }}
              options={Object.values(TYPE_LABELS)}
              searchable={false}
            />
          </div>
          {type === "select" && (
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Dropdown options (comma separated)</label>
              <input
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="e.g. Low, Medium, High"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <Toggle on={required} onClick={() => setRequired((r) => !r)} label="Mandatory" />
            Mandatory field
          </label>
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <Icon name="plus" className="h-4 w-4" /> Add field
          </button>
        </div>
      </form>

      {/* Custom field list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Custom fields
        </div>
        {custom.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">No custom fields yet. Add one above to extend the lead form.</p>
        ) : (
          <ul>
            {custom.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3 last:border-0 hover:bg-slate-50/60">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-500">
                    {TYPE_LABELS[f.type]}
                    {f.type === "select" && f.options.length > 0 && <span className="text-slate-400"> · {f.options.join(", ")}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${f.required ? "text-blue-600" : "text-slate-400"}`}>{f.required ? "Mandatory" : "Optional"}</span>
                  <Toggle on={f.required} onClick={() => toggleCustomRequired(f.id)} label={`${f.label} mandatory`} />
                  <button onClick={() => removeCustom(f.id, f.label)} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                    <Icon name="trash" className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Email format is always validated when a value is entered. Custom fields are saved with each new lead.
      </p>
    </div>
  );
}

function Toggle({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${on ? "bg-blue-600" : "bg-slate-300"} ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

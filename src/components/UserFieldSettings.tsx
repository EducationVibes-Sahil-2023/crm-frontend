"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import {
  DEFAULT_FIELD_CONFIG,
  USER_FIELDS,
  loadFieldConfig,
  saveFieldConfig,
  type FieldConfig,
} from "@/lib/userFields";

export default function UserFieldSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<FieldConfig>(loadFieldConfig);

  // Persist on change (no-op on the server).
  useEffect(() => {
    saveFieldConfig(cfg);
  }, [cfg]);

  const requiredCount = USER_FIELDS.filter((f) => cfg[f.key]).length;

  function toggle(key: (typeof USER_FIELDS)[number]["key"], locked?: boolean) {
    if (locked) {
      toast.info("Always required", "This field is essential and can't be made optional.");
      return;
    }
    setCfg((c) => ({ ...c, [key]: !c[key] }));
  }

  function reset() {
    setCfg({ ...DEFAULT_FIELD_CONFIG });
    toast.info("Reset", "Field requirements restored to defaults.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Form Fields</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose which fields are mandatory when creating or editing a user.
          </p>
        </div>
        <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Reset to defaults
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Field</span>
          <span><strong className="text-slate-700">{requiredCount}</strong> required</span>
        </div>
        <ul>
          {USER_FIELDS.map((f) => {
            const required = cfg[f.key];
            return (
              <li key={f.key} className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3 last:border-0 hover:bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{f.label}</span>
                  {f.locked && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Essential
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${required ? "text-blue-600" : "text-slate-400"}`}>
                    {required ? "Mandatory" : "Optional"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={required}
                    aria-label={`${f.label} mandatory`}
                    onClick={() => toggle(f.key, f.locked)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                      required ? "bg-blue-600" : "bg-slate-300"
                    } ${f.locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${required ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs text-slate-400">
        Format checks (valid email, full URLs, numeric zip) always apply when a value is entered, regardless of whether the field is mandatory.
      </p>
    </div>
  );
}

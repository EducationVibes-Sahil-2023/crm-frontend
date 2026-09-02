"use client";

import { useMemo } from "react";
import { Icon, type IconName } from "@/components/icons";
import { PLATFORM_FEATURES, DEFAULT_PLAN_FEATURES, loadPlatform } from "@/lib/platform";

/**
 * Per-client permission editor for the super-admin console.
 *
 * Choosing a plan pre-selects everything that plan includes; ticking or
 * unticking a module records a DELTA against the plan rather than an absolute
 * list. That is what lets one client on "Pro" have Inventory while another does
 * not, and it means changing the plan later keeps the client's own grants.
 *
 * The same rule is implemented server-side in App\Libraries\FeatureAccess,
 * which is the authority — this is the editor, not the enforcement.
 */
export default function ClientPermissions({
  planId,
  extra,
  revoked,
  onChange,
}: {
  /** Lowercase plan id, e.g. "pro". */
  planId: string;
  extra: string[];
  revoked: string[];
  onChange: (next: { extra: string[]; revoked: string[] }) => void;
}) {
  // What the chosen plan includes, from Platform Settings (falling back to the
  // built-in defaults when the platform config hasn't loaded yet).
  const planSet = useMemo(() => {
    const cfg = loadPlatform();
    const list = cfg.planFeatures?.[planId] ?? DEFAULT_PLAN_FEATURES[planId] ?? [];
    return new Set(list);
  }, [planId]);

  const extraSet = useMemo(() => new Set(extra), [extra]);
  const revokedSet = useMemo(() => new Set(revoked), [revoked]);

  /** Is this module on for the client right now? (plan ∪ extra) − revoked */
  const isOn = (key: string) =>
    !revokedSet.has(key) && (planSet.has(key) || extraSet.has(key));

  function toggle(key: string) {
    const inPlan = planSet.has(key);
    const on = isOn(key);

    // Express the new state as the smallest delta against the plan, so a client
    // that matches its plan stores no override at all.
    const nextExtra = new Set(extraSet);
    const nextRevoked = new Set(revokedSet);

    if (on) {
      nextExtra.delete(key);
      if (inPlan) nextRevoked.add(key); // turning off something the plan grants
    } else {
      nextRevoked.delete(key);
      if (!inPlan) nextExtra.add(key); // turning on something the plan lacks
    }

    onChange({ extra: [...nextExtra], revoked: [...nextRevoked] });
  }

  const groups = useMemo(() => {
    const out: { name: string; items: typeof PLATFORM_FEATURES }[] = [];
    for (const f of PLATFORM_FEATURES) {
      const last = out[out.length - 1];
      if (last && last.name === f.group) last.items.push(f);
      else out.push({ name: f.group, items: [f] });
    }
    return out;
  }, []);

  const onCount = PLATFORM_FEATURES.filter((f) => isOn(f.key)).length;
  const changed = extra.length + revoked.length;

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Permissions</p>
          <p className="text-[11px] text-slate-500">
            {onCount} of {PLATFORM_FEATURES.length} modules enabled
            {changed > 0 && <span className="text-amber-600"> · {changed} customised for this client</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ extra: [], revoked: [] })}
            disabled={changed === 0}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Reset to plan
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                extra: PLATFORM_FEATURES.filter((f) => !planSet.has(f.key)).map((f) => f.key),
                revoked: [],
              })
            }
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Enable all
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto px-4 py-3">
        {groups.map((g) => (
          <div key={g.name} className="mb-3 last:mb-0">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g.name}</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {g.items.map((f) => {
                const on = isOn(f.key);
                const inPlan = planSet.has(f.key);
                // Flag anything that differs from the plan, so the super admin
                // can see at a glance what is bespoke about this client.
                const custom = (on && !inPlan) || (!on && inPlan);
                return (
                  <label
                    key={f.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      on ? "border-blue-200 bg-blue-50/60 text-slate-800" : "border-slate-200 text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(f.key)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <Icon name={f.icon as IconName} className={`h-3.5 w-3.5 ${on ? "text-blue-600" : "text-slate-300"}`} />
                    <span className="truncate">{f.label}</span>
                    {custom && (
                      <span
                        title={on ? "Granted beyond the plan" : "Removed from the plan"}
                        className={`ml-auto rounded px-1 text-[9px] font-bold ${
                          on ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {on ? "+" : "−"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

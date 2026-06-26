"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  PLANS,
  getPlan,
  loadSubscription,
  planRank,
  priceFor,
  saveSubscription,
  type BillingCycle,
  type Plan,
  type Subscription,
} from "@/lib/subscription";

function today(): string {
  try {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function SubscriptionPlans() {
  const toast = useToast();
  const [sub, setSub] = useState<Subscription>(loadSubscription);
  const [cycle, setCycle] = useState<BillingCycle>(sub.cycle);
  const [pending, setPending] = useState<Plan | null>(null);

  useEffect(() => {
    saveSubscription(sub);
  }, [sub]);

  const active = getPlan(sub.planId) ?? PLANS[0];
  const activeRank = planRank(sub.planId);

  function confirmChange() {
    if (!pending) return;
    const upgrade = planRank(pending.id) > activeRank;
    setSub({ planId: pending.id, cycle, since: today() });
    toast.success(upgrade ? "Plan upgraded" : "Plan changed", `You're now on ${pending.name} (${cycle}).`);
    setPending(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your plan, billing cycle, and upgrades.</p>
      </div>

      {/* Active plan summary */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${active.color} p-5 text-white shadow-sm`}>
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%),radial-gradient(circle_at_88%_80%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Active plan
            </span>
            <p className="mt-2 text-2xl font-bold">{active.name}</p>
            <p className="text-sm text-white/80">
              {active.monthly === 0 ? "Free forever" : `$${priceFor(active, sub.cycle).toLocaleString()} / ${sub.cycle === "yearly" ? "year" : "month"}`}
              {sub.since !== "—" && <span className="text-white/70"> · since {sub.since}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Stat label="Users" value={active.limits.users} />
            <Stat label="Leads" value={active.limits.leads} />
            <Stat label="Storage" value={active.limits.storage} />
          </div>
        </div>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          <button
            onClick={() => setCycle("monthly")}
            className={`rounded-md px-4 py-1.5 font-medium ${cycle === "monthly" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle("yearly")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 font-medium ${cycle === "yearly" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Yearly
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cycle === "yearly" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
              2 months free
            </span>
          </button>
        </div>
      </div>

      {/* Plan grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isActive = plan.id === sub.planId;
          const rank = planRank(plan.id);
          const isUpgrade = rank > activeRank;
          const price = priceFor(plan, cycle);
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
                isActive ? "border-blue-500 ring-2 ring-blue-200" : plan.popular ? "border-blue-200" : "border-slate-200"
              }`}
            >
              {plan.popular && !isActive && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Popular
                </span>
              )}
              {isActive && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Current
                </span>
              )}

              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${plan.color} text-white`}>
                  <Icon name="star" className="h-4 w-4" />
                </span>
                <p className="text-base font-bold text-slate-900">{plan.name}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{plan.tagline}</p>

              <div className="mt-3">
                <span className="text-3xl font-bold text-slate-900">${price.toLocaleString()}</span>
                <span className="text-sm text-slate-500">/{cycle === "yearly" ? "yr" : "mo"}</span>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-slate-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"><path d="m20 6-11 11-5-5" /></svg>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-5 pt-1">
                {isActive ? (
                  <button disabled className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => setPending(plan)}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      isUpgrade ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {isUpgrade ? "Upgrade" : "Downgrade"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400">
        Plan changes apply immediately in this workspace. Connect a payment provider to charge real cards.
      </p>

      {/* Confirm modal */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setPending(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const upgrade = planRank(pending.id) > activeRank;
              const price = priceFor(pending, cycle);
              return (
                <>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${pending.color} text-white`}>
                      <Icon name="star" className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{upgrade ? "Upgrade" : "Switch"} to {pending.name}?</h3>
                      <p className="text-sm text-slate-500">{pending.tagline}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <Row label="New plan" value={pending.name} />
                    <Row label="Billing" value={cycle === "yearly" ? "Yearly" : "Monthly"} />
                    <Row label="Price" value={price === 0 ? "Free" : `$${price.toLocaleString()} / ${cycle === "yearly" ? "year" : "month"}`} />
                    <Row label="From" value={active.name} />
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <button onClick={() => setPending(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Cancel
                    </button>
                    <button onClick={confirmChange} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                      Confirm {upgrade ? "upgrade" : "change"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/15 px-3 py-1.5 backdrop-blur">
      <p className="text-[10px] uppercase tracking-wide text-white/70">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

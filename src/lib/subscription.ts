// Subscription plans — active plan + upgrade/downgrade, stored per workspace.

export type BillingCycle = "monthly" | "yearly";

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthly: number; // price per month (USD); yearly billed at 10× (2 months free)
  popular?: boolean;
  color: string; // tailwind gradient classes for the accent
  limits: { users: string; leads: string; storage: string };
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For trying things out.",
    monthly: 0,
    color: "from-slate-500 to-slate-600",
    limits: { users: "3 users", leads: "500 leads", storage: "1 GB" },
    features: ["Core CRM", "Leads & tasks", "Email support", "1 integration"],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For small teams getting going.",
    monthly: 29,
    color: "from-sky-500 to-blue-600",
    limits: { users: "10 users", leads: "5,000 leads", storage: "10 GB" },
    features: ["Everything in Free", "Roles & permissions", "Web push", "5 integrations", "Standard support"],
  },
  {
    id: "pro",
    name: "Professional",
    tagline: "For growing sales teams.",
    monthly: 79,
    popular: true,
    color: "from-blue-600 to-indigo-600",
    limits: { users: "50 users", leads: "50,000 leads", storage: "100 GB" },
    features: ["Everything in Starter", "Google integrations", "Custom fields", "Activity logs", "Priority support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For large organisations.",
    monthly: 199,
    color: "from-violet-600 to-fuchsia-600",
    limits: { users: "Unlimited", leads: "Unlimited", storage: "1 TB" },
    features: ["Everything in Pro", "SSO & SAML", "Dedicated manager", "Unlimited integrations", "99.9% SLA"],
  },
];

export type Subscription = { planId: string; cycle: BillingCycle; since: string };

const STORAGE_KEY = "subscription_v1";
const DEFAULT_SUB: Subscription = { planId: "pro", cycle: "monthly", since: "—" };

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function planRank(id: string): number {
  return PLANS.findIndex((p) => p.id === id);
}

/** Price for a plan at a given cycle. Yearly = 10 months (2 free). */
export function priceFor(plan: Plan, cycle: BillingCycle): number {
  return cycle === "yearly" ? plan.monthly * 10 : plan.monthly;
}

// Cached so plan/feature gating doesn't re-parse localStorage on every render.
let _cache: Subscription | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY) _cache = null; });
}

export function loadSubscription(): Subscription {
  if (typeof window === "undefined") return { ...DEFAULT_SUB };
  if (_cache) return { ..._cache };
  let result: Subscription;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      result = { ...DEFAULT_SUB };
    } else {
      const p = JSON.parse(raw) as Partial<Subscription>;
      result = {
        planId: getPlan(p.planId ?? "") ? (p.planId as string) : DEFAULT_SUB.planId,
        cycle: p.cycle === "yearly" ? "yearly" : "monthly",
        since: typeof p.since === "string" ? p.since : DEFAULT_SUB.since,
      };
    }
  } catch {
    result = { ...DEFAULT_SUB };
  }
  _cache = result;
  return { ...result };
}

export function saveSubscription(sub: Subscription): void {
  _cache = { ...sub };
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sub));
}

/** Drop the cached subscription so the next loadSubscription() re-reads storage. */
export function clearSubscriptionCache(): void { _cache = null; }

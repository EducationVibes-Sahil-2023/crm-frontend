// Module access for the client app, gated by the workspace's subscription plan
// and the per-plan permissions the Super Admin configures in Platform Settings.

import { loadPlatform, ALL_FEATURE_KEYS, DEFAULT_PLAN_FEATURES } from "@/lib/platform";
import { loadSubscription } from "@/lib/subscription";

export { ALL_FEATURE_KEYS } from "@/lib/platform";

/** Map a nav href to a gateable feature key. `null` = always visible (core/admin). */
export function hrefFeature(href: string): string | null {
  const h = href.toLowerCase();
  if (h === "/dashboard") return null;
  if (h.startsWith("/assistant")) return "ai";
  if (h.startsWith("/leads")) return "leads";
  if (h.startsWith("/forms")) return "forms";
  if (h.startsWith("/lead-visitor")) return "leadVisitor";
  if (h.startsWith("/call-tracker")) return "callTracker";
  if (h.startsWith("/tasks")) return "tasks";
  if (h.startsWith("/gmail")) return "gmail";
  if (h.startsWith("/chat")) return "chat";
  if (h.startsWith("/whatsapp")) return "whatsapp";
  if (h.startsWith("/media")) return "media";
  if (h.startsWith("/announcement")) return "announcement";
  if (h.startsWith("/calendar")) return "calendar";
  if (h.startsWith("/downloads") || h.startsWith("/live-tracking") || h.startsWith("/app-security")) return "mobileApp";
  if (h.startsWith("/support-ticket")) return "support";
  if (h.startsWith("/vendors")) return "vendors";
  if (h.startsWith("/asset")) return "assets";
  if (h.startsWith("/inventory")) return "inventory";
  if (h.startsWith("/knowledge-base")) return "knowledge";
  if (h.startsWith("/account") || h.startsWith("/invoices") || h.startsWith("/payments") || h.startsWith("/quotations") || h.startsWith("/expenses") || h.startsWith("/bills") || h.startsWith("/ledger")) return "accounts";
  if (h.startsWith("/hrms") || h.startsWith("/attendance") || h.startsWith("/leaves") || h.startsWith("/holidays") || h.startsWith("/payroll") || h.startsWith("/payslips") || h.startsWith("/policies") || h.startsWith("/awards") || h.startsWith("/engagement") || h.startsWith("/posts") || h.startsWith("/medical") || h.startsWith("/letters")) return "hrms";
  // Everything else (users, activity-logs, subscription, admin-setup, profile…) is core.
  return null;
}

/** The set of feature keys the current workspace's plan unlocks. */
export function allowedFeatures(): Set<string> {
  const planId = loadSubscription().planId;
  const cfg = loadPlatform();
  const list = cfg.planFeatures?.[planId] ?? DEFAULT_PLAN_FEATURES[planId];
  // No configuration for this plan → don't hide anything.
  if (!list) return new Set(ALL_FEATURE_KEYS);
  return new Set(list);
}

/** Is a nav item (by href) allowed under the current plan? */
export function isHrefAllowed(href: string, allowed: Set<string>): boolean {
  const key = hrefFeature(href);
  return key === null || allowed.has(key);
}

/** Is a single feature key unlocked by the current workspace's plan? */
export function isFeatureAllowed(key: string): boolean {
  return allowedFeatures().has(key);
}

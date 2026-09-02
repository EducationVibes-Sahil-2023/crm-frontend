// Module access for the client app.
//
// The authority is the BACKEND: GET /api/access resolves this workspace's plan
// together with any per-client overrides the super admin has set, so two
// clients on the same plan can legitimately differ. Resolving it server-side
// also keeps it out of reach of the browser.
//
// The plan-only calculation below remains as a fallback for when that call
// hasn't completed or the backend is unreachable — it can only ever produce a
// per-plan answer, which is why it is not the primary path.

import { apiRequest } from "@/lib/api";
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
  if (h.startsWith("/marketing")) return "marketing";
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

export const ACCESS_EVENT = "nexus-access-changed";

// Server-resolved feature set for this workspace. null until /api/access answers.
let serverFeatures: Set<string> | null = null;

/**
 * Fetch this workspace's effective permissions. Called by AuthGuard at sign-in.
 *
 * A failure deliberately leaves `serverFeatures` null so the plan-only fallback
 * applies — hiding every module because one request failed would look like the
 * app was broken.
 */
export async function hydrateAccess(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await apiRequest<{ features: string[]; source: string }>("/access");
    // `source: "unavailable"` means the backend could not read the platform
    // config; its empty list is not an answer, so keep the fallback.
    if (res.source !== "unavailable" && Array.isArray(res.features)) {
      serverFeatures = new Set(res.features);
    }
  } catch {
    /* offline — fall back to the plan */
  } finally {
    window.dispatchEvent(new Event(ACCESS_EVENT));
  }
}

/** Drop the cached set (sign-out) so the next session re-resolves. */
export function resetAccess(): void {
  serverFeatures = null;
}

/** The set of feature keys this workspace may use. */
export function allowedFeatures(): Set<string> {
  // Server answer wins: it accounts for this client's own overrides.
  if (serverFeatures) return new Set(serverFeatures);

  // Fallback: the plan alone.
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

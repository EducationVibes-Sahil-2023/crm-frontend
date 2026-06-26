// Self-serve 1-month free trial captured from the public landing page.
// Stored client-side; the prospect is also dropped into the CRM as a lead.

export type TrialSource = "form" | "google";

export type Trial = {
  name: string;
  email: string;
  company: string;
  source: TrialSource;
  plan: string;
  startedAt: string; // ISO
  expiresAt: string; // ISO
};

const KEY = "nexus_trial_v1";
const PREFILL_KEY = "nexus_prefill_email";

export const TRIAL_DAYS = 30;
export const TRIAL_PLAN = "Professional";

export function loadTrial(): Trial | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Trial) : null;
  } catch {
    return null;
  }
}

export function startTrial(input: {
  name: string;
  email: string;
  company?: string;
  source?: TrialSource;
}): Trial {
  const now = new Date();
  const expires = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const trial: Trial = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: (input.company ?? "").trim(),
    source: input.source ?? "form",
    plan: TRIAL_PLAN,
    startedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(trial));
    window.localStorage.setItem(PREFILL_KEY, trial.email);
  }
  return trial;
}

export function trialDaysLeft(trial: Trial | null = loadTrial()): number | null {
  if (!trial) return null;
  const ms = new Date(trial.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** Read (and clear) an email stashed for the login form to prefill. */
export function consumePrefillEmail(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PREFILL_KEY);
  if (v) window.localStorage.removeItem(PREFILL_KEY);
  return v;
}

// Self-serve 1-month free trial offered on the public landing page.
//
// There is no client-side trial record: the signup is persisted by writing the
// prospect into the `leads` table (see startTrialFlow in app/page.tsx), which is
// the single source of truth. This module only carries the trial's terms.

export const TRIAL_DAYS = 30;

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, verifyTwoFactor, isAuthenticated, DEMO_CREDENTIALS } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useBranding } from "@/lib/branding";
import { usePlatform } from "@/lib/platform";
import { consumePrefillEmail } from "@/lib/trial";

type Errors = { email?: string; password?: string; form?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const branding = useBranding();
  const logoBg = usePlatform().brand.logoBg;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  // Two-step verification challenge (set after a correct password).
  const [twofa, setTwofa] = useState<{ challenge: string; name: string } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  // Already signed in? Skip the login screen.
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    } else {
      setCheckingSession(false);
    }
  }, [router]);

  // If AuthGuard signed us out because the account was deactivated, explain why.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("nexus_logout_reason") === "deactivated") {
      window.localStorage.removeItem("nexus_logout_reason");
      toast.error("Signed out", "Your account was deactivated by an administrator.");
    }
    // Prefill the email captured during a landing-page trial signup.
    const prefill = consumePrefillEmail();
    if (prefill) setEmail(prefill);
  }, [toast]);

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <svg className="h-7 w-7 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      </main>
    );
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim()))
      next.email = "Enter a valid email address.";

    if (!password) next.password = "Password is required.";
    else if (password.length < 6)
      next.password = "Password must be at least 6 characters.";

    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Check your details", "Some fields need your attention.");
      return;
    }

    setSubmitting(true);
    const result = await login(email, password);
    if (result.status === "ok") {
      toast.success("Welcome back!", `Signed in as ${result.user.name}.`);
      router.replace("/dashboard");
    } else if (result.status === "2fa") {
      setTwofa({ challenge: result.challenge, name: result.name });
      setSubmitting(false);
    } else {
      setErrors({ form: result.error });
      toast.error("Sign in failed", result.error);
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!twofa) return;
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6) {
      setCodeError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setCodeError(null);
    setSubmitting(true);
    const result = await verifyTwoFactor(twofa.challenge, clean);
    if (result.status === "ok") {
      toast.success("Welcome back!", `Signed in as ${result.user.name}.`);
      router.replace("/dashboard");
    } else {
      setCodeError(result.status === "error" ? result.error : "Verification failed.");
      toast.error("Verification failed", result.status === "error" ? result.error : "Try again.");
      setSubmitting(false);
    }
  }

  const inputBase =
    "w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2";
  const okClasses =
    "border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-blue-500/20";
  const errClasses =
    "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/25";

  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Form (right on desktop) */}
      <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10 lg:order-2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl text-white shadow-lg" style={{ backgroundColor: logoBg }}>
              {branding.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo} alt={branding.appName} className="h-full w-full object-cover" />
              ) : (
                <HubIcon className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-slate-900">{branding.appName}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {branding.tagline || "Core Version 2026.4"}
              </p>
            </div>
          </div>

          {twofa ? (
            <div>
              <button
                type="button"
                onClick={() => { setTwofa(null); setCode(""); setCodeError(null); }}
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                ← Back to sign in
              </button>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Two-step verification
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {twofa.name ? `Hi ${twofa.name.split(" ")[0]}, ` : ""}enter the 6-digit code from your authenticator app.
              </p>

              {codeError && (
                <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertIcon className="h-4 w-4 shrink-0" />
                  {codeError}
                </div>
              )}

              <form onSubmit={handleVerify} noValidate className="mt-7 space-y-5">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    if (codeError) setCodeError(null);
                  }}
                  placeholder="000000"
                  className={`${inputBase} text-center text-2xl font-bold tracking-[0.5em] ${codeError ? errClasses : okClasses}`}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl active:scale-[0.99] disabled:opacity-60"
                >
                  {submitting ? "Verifying…" : "Verify & Sign In"}
                </button>
              </form>
            </div>
          ) : (
          <>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Identity Access
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Secure gateway to your intelligence node.
          </p>

          {errors.form && (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertIcon className="h-4 w-4 shrink-0" />
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400"
              >
                Neural Identifier
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email || errors.form)
                      setErrors((p) => ({ ...p, email: undefined, form: undefined }));
                  }}
                  placeholder="email@nexus.io"
                  className={`${inputBase} pr-11 ${errors.email ? errClasses : okClasses}`}
                />
                <AtIcon
                  className={`pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 ${
                    errors.email ? "text-red-400" : "text-slate-400"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertIcon className="h-3.5 w-3.5" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400"
              >
                Security Protocol
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password || errors.form)
                      setErrors((p) => ({ ...p, password: undefined, form: undefined }));
                  }}
                  placeholder="••••••••"
                  className={`${inputBase} pr-11 ${errors.password ? errClasses : okClasses}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide" : "Show"}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                    errors.password ? "text-red-400" : "text-slate-400"
                  } hover:text-slate-600`}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertIcon className="h-3.5 w-3.5" />
                  {errors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Persistent session
              </label>
              <a
                href="#"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Recovery
              </a>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Execute Sign In"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              External Auth
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <GoogleIcon className="h-5 w-5" />
              Google
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <KeyIcon className="h-5 w-5 text-slate-500" />
              SSO
            </button>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 px-4 py-2.5 text-center text-xs text-slate-500">
            Demo — <strong>{DEMO_CREDENTIALS.email}</strong> /{" "}
            <strong>{DEMO_CREDENTIALS.password}</strong>
          </div>
          </>
          )}
        </div>
      </section>

      {/* Product showcase + person (left on desktop) */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-10 text-white lg:order-1 lg:flex lg:flex-col xl:p-14">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-blue-400/20 blur-2xl" />

        <div className="relative">
          <h2 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">
            One platform for your entire workforce.
          </h2>
          <p className="mt-3 max-w-md text-sm text-blue-100/90">
            Sales, people, and projects — unified. Manage relationships, your
            team, and daily execution from a single intelligent workspace.
          </p>
        </div>

        {/* Person illustration */}
        <div className="relative flex flex-1 items-center justify-center py-6">
          <PersonIllustration className="h-72 w-auto drop-shadow-2xl xl:h-80" />
        </div>

        {/* Product explanations */}
        <div className="relative grid gap-4 sm:grid-cols-3">
          <ProductCard
            title="CRM"
            desc="Track leads, score them with AI, and close more deals."
            icon={<UsersIcon className="h-5 w-5" />}
          />
          <ProductCard
            title="HRMS"
            desc="Onboard, manage people, attendance & payroll in one place."
            icon={<BadgeIcon className="h-5 w-5" />}
          />
          <ProductCard
            title="Task Management"
            desc="Plan, assign, and ship work with boards and reminders."
            icon={<TaskIcon className="h-5 w-5" />}
          />
        </div>

        <div className="relative mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium uppercase tracking-wider text-blue-100/70">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            System Optimal
          </span>
          <span>Secure L-30 Node</span>
          <span>© 2026 Nexus</span>
        </div>
      </section>
    </main>
  );
}

function ProductCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
        {icon}
      </div>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-blue-100/85">{desc}</p>
    </div>
  );
}

/* ---------- person illustration ---------- */
function PersonIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 340" fill="none">
      {/* ground shadow */}
      <ellipse cx="110" cy="322" rx="78" ry="12" fill="rgba(0,0,0,0.18)" />
      {/* back accent panel */}
      <rect x="36" y="40" width="148" height="120" rx="14" fill="rgba(255,255,255,0.10)" />
      <rect x="52" y="58" width="64" height="8" rx="4" fill="rgba(255,255,255,0.35)" />
      <rect x="52" y="74" width="96" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="52" y="88" width="80" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="52" y="110" width="40" height="28" rx="6" fill="#fbbf24" />

      {/* legs */}
      <path d="M92 232 h16 v74 a8 8 0 0 1-16 0 z" fill="#1e293b" />
      <path d="M112 232 h16 v74 a8 8 0 0 1-16 0 z" fill="#0f172a" />
      {/* shoes */}
      <path d="M84 306 h24 v10 a4 4 0 0 1-4 4 H84 z" fill="#0b1220" />
      <path d="M112 306 h24 v10 a4 4 0 0 1-4 4 h-20 z" fill="#0b1220" />

      {/* torso / shirt */}
      <path
        d="M84 150 q26-14 52 0 l8 56 q-34 16-68 0 z"
        fill="#ffffff"
      />
      <path d="M110 150 v62" stroke="#e2e8f0" strokeWidth="2" />
      {/* collar */}
      <path d="M98 150 l12 12 l12-12" stroke="#cbd5e1" strokeWidth="3" fill="none" />

      {/* arms */}
      <path d="M86 156 q-16 18-12 52 l12 2 q4-30 14-46 z" fill="#3b82f6" />
      <path d="M134 156 q16 18 12 52 l-12 2 q-4-30-14-46 z" fill="#3b82f6" />
      {/* hands */}
      <circle cx="80" cy="210" r="7" fill="#f1c27d" />
      <circle cx="140" cy="210" r="7" fill="#f1c27d" />

      {/* neck */}
      <rect x="103" y="120" width="14" height="20" rx="6" fill="#e8b074" />
      {/* head */}
      <circle cx="110" cy="98" r="26" fill="#f1c27d" />
      {/* hair */}
      <path
        d="M84 96 q2-30 26-30 t26 30 q-8-12-26-12 t-26 12 z"
        fill="#2f2a26"
      />
      {/* ears */}
      <circle cx="84" cy="100" r="5" fill="#e8b074" />
      <circle cx="136" cy="100" r="5" fill="#e8b074" />
      {/* face */}
      <circle cx="101" cy="98" r="2.4" fill="#2f2a26" />
      <circle cx="119" cy="98" r="2.4" fill="#2f2a26" />
      <path d="M104 110 q6 5 12 0" stroke="#b9763f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- icons ---------- */
type IconProps = { className?: string };

function HubIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="5" r="2.2" />
      <circle cx="19" cy="5" r="2.2" />
      <circle cx="5" cy="19" r="2.2" />
      <circle cx="19" cy="19" r="2.2" />
      <path
        d="M6.8 6.8 10 10m4 0 3.2-3.2M6.8 17.2 10 14m4 0 3.2 3.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function AtIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9" />
    </svg>
  );
}

function EyeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13 13 0 0 1-2.3 3M6.6 6.6A13 13 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 3.5-.7" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function AlertIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 1 21h22L12 2zm0 14a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-1-6h2v5h-2v-5z" />
    </svg>
  );
}

function KeyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 9.3-9.3M16 7l3 3" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BadgeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2.5" />
      <path d="M5 17c.6-2 2-3 4-3s3.4 1 4 3M15 9h4M15 13h3" />
    </svg>
  );
}

function TaskIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m8 11 2.5 2.5L15 9M8 17h6" />
    </svg>
  );
}

function GoogleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

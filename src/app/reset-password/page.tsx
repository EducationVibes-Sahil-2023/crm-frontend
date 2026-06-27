"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/auth";
import { useToast } from "@/components/Toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The reset token rides in on the emailed link (?token=…).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("This reset link is missing its token. Request a new one from the sign-in page.");
      return;
    }
    if (password.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      toast.success("Password reset", "You can now sign in with your new password.");
      setTimeout(() => router.replace("/login"), 1800);
    } catch (err) {
      setError((err as Error).message);
      toast.error("Couldn't reset password", (err as Error).message);
    } finally {
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {done ? "Password reset ✓" : "Choose a new password"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {done
            ? "Redirecting you to sign in…"
            : "Pick a strong password you haven't used before."}
        </p>

        {done ? (
          <Link
            href="/login"
            className="mt-7 block w-full rounded-xl bg-slate-900 py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white transition hover:bg-slate-800"
          >
            Go to sign in
          </Link>
        ) : (
          <>
            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="••••••••"
                    className={`${inputBase} pr-16 ${error ? errClasses : okClasses}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Confirm password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className={`${inputBase} ${error ? errClasses : okClasses}`}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? "Resetting…" : "Reset password"}
              </button>
            </form>
            <Link
              href="/login"
              className="mt-5 block text-center text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              ← Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

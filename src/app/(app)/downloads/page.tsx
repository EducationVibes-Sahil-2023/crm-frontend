"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { loadProfile, saveProfile, type Profile } from "@/lib/profile";

const APP_VERSION = "1.4.0";

type Build = { os: "Android" | "iOS"; icon: IconName; label: string; file: string; size: string; min: string };
type App = { id: string; name: string; tagline: string; icon: IconName; accent: string; features: string[]; builds: Build[] };

// Distribution catalogue. Point each `file` at the real signed build when the
// native app is compiled (drop the binaries in /public/downloads/).
const APPS: App[] = [
  {
    id: "crm",
    name: "Nexus CRM",
    tagline: "Leads, tasks, chat and call tracking — on the go.",
    icon: "dashboard",
    accent: "from-blue-600 to-indigo-600",
    features: ["Leads & follow-ups", "Tasks & calendar", "Automatic call tracking", "Offline-first sync"],
    builds: [
      { os: "Android", icon: "android", label: "Download APK", file: "/downloads/nexus-crm.apk", size: "24 MB", min: "Android 8.0+" },
      { os: "iOS", icon: "apple", label: "Download for iOS", file: "/downloads/nexus-crm.ipa", size: "31 MB", min: "iOS 15.0+" },
    ],
  },
  {
    id: "calltracker",
    name: "Nexus Call Tracker",
    tagline: "Lightweight companion that syncs your call log to the CRM.",
    icon: "call",
    accent: "from-emerald-500 to-teal-600",
    features: ["Auto-match calls to leads", "Primary & alternative numbers", "Runs in background", "Privacy-first"],
    builds: [
      { os: "Android", icon: "android", label: "Download APK", file: "/downloads/nexus-call-tracker.apk", size: "9 MB", min: "Android 8.0+" },
      { os: "iOS", icon: "apple", label: "Download for iOS", file: "/downloads/nexus-call-tracker.ipa", size: "12 MB", min: "iOS 15.0+" },
    ],
  },
];

const SETUP_STEPS = [
  { icon: "download" as IconName, title: "Install the app", desc: "Download the APK (Android) or install via TestFlight / App Store (iOS)." },
  { icon: "shield" as IconName, title: "Grant permissions", desc: "Allow Phone & Call Log access so the app can read your call history." },
  { icon: "users" as IconName, title: "Sign in", desc: "Use your CRM credentials — the same account you use here." },
  { icon: "phone" as IconName, title: "Confirm your number", desc: "The app verifies the phone number on your profile to attribute calls to you." },
  { icon: "refresh" as IconName, title: "Calls sync automatically", desc: "From install time onward, calls matching a CRM lead appear in Call Tracker." },
];

export default function DownloadsPage() {
  const toast = useToast();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");

  useEffect(() => {
    setUser(getUser());
    setProfile(loadProfile());
  }, []);

  const hasPhone = !!profile?.phone && profile.phone.trim() !== "" && profile.phone !== "—";

  function savePhone() {
    if (!profile) return;
    const v = phoneInput.trim();
    if (v.replace(/\D/g, "").length < 10) {
      toast.error("Enter a valid number", "Use at least 10 digits.");
      return;
    }
    const next = { ...profile, phone: v };
    setProfile(next);
    saveProfile(next);
    window.dispatchEvent(new Event("profile:updated"));
    setEditingPhone(false);
    toast.success("Number registered", "Your calls can now be tracked against this number.");
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
            <Icon name="download" className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mobile Apps</h1>
            <p className="mt-1 max-w-lg text-sm text-blue-100">
              Take Nexus with you. Install the mobile app to track calls automatically and work your leads from anywhere — available for Android and iOS.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Latest version {APP_VERSION}
            </div>
          </div>
        </div>
      </div>

      {/* Phone-number registration check */}
      <div
        className={`rounded-2xl border p-5 shadow-sm ${
          hasPhone ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${hasPhone ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
              <Icon name={hasPhone ? "check" : "alert"} className="h-5 w-5" />
            </span>
            <div>
              <p className={`text-sm font-semibold ${hasPhone ? "text-emerald-900" : "text-amber-900"}`}>
                {hasPhone ? "Your phone number is registered" : "Register your phone number first"}
              </p>
              <p className={`text-xs ${hasPhone ? "text-emerald-700" : "text-amber-700"}`}>
                {hasPhone
                  ? `Calls from ${profile?.phone} will be tracked against your account (${user?.email ?? "you"}).`
                  : "Call tracking needs your number to attribute device calls to your account."}
              </p>
            </div>
          </div>

          {hasPhone ? (
            <button
              onClick={() => {
                setPhoneInput(profile?.phone ?? "");
                setEditingPhone(true);
              }}
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Update
            </button>
          ) : (
            !editingPhone && (
              <button
                onClick={() => {
                  setPhoneInput("");
                  setEditingPhone(true);
                }}
                className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Add number
              </button>
            )
          )}
        </div>

        {editingPhone && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              autoFocus
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && savePhone()}
              placeholder="+91 98765 43210"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex gap-2">
              <button onClick={savePhone} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                Save
              </button>
              <button onClick={() => setEditingPhone(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* App cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {APPS.map((app) => (
          <AppCard key={app.id} app={app} canDownload={hasPhone} />
        ))}
      </div>

      {/* Setup guide */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Setup &amp; installation</h2>
        <p className="mt-1 text-sm text-slate-500">Five steps to start tracking calls from your phone.</p>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SETUP_STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">{i + 1}</span>
                <Icon name={s.icon} className="h-5 w-5 text-blue-600" />
              </div>
              <p className="mt-2.5 text-sm font-semibold text-slate-800">{s.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{s.desc}</p>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
          <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            Privacy: the app only uploads calls that match a CRM lead&apos;s primary or alternative number. Personal calls
            stay on your device and are never synced.
          </p>
        </div>
      </div>
    </div>
  );
}

function AppCard({ app, canDownload }: { app: App; canDownload: boolean }) {
  const toast = useToast();

  function download(b: Build) {
    if (!canDownload) {
      toast.error("Register your number", "Add your phone number above before installing.");
      return;
    }
    // Placeholder: real signed builds are served from /public/downloads/.
    toast.info(`${app.name} · ${b.os}`, `Starting download of ${b.label} (${b.size}).`);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`relative overflow-hidden bg-gradient-to-r ${app.accent} px-5 py-5 text-white`}>
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/25 backdrop-blur">
            <Icon name={app.icon} className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{app.name}</h3>
            <p className="text-xs text-white/80">{app.tagline}</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap gap-1.5">
          {app.features.map((f) => (
            <span key={f} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{f}</span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {app.builds.map((b) => (
            <button
              key={b.os}
              onClick={() => download(b)}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Icon name={b.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{b.label}</p>
                <p className="text-[11px] text-slate-400">{b.os} · {b.size} · {b.min}</p>
              </div>
              <Icon name="download" className="h-4 w-4 text-slate-400 transition group-hover:text-blue-600" />
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-400">Version {APP_VERSION} · scan or open this page on your phone to install</p>
      </div>
    </div>
  );
}

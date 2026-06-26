"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import { getUser, updateUser, type User } from "@/lib/auth";
import { CATEGORY_META, loadActivities, relativeTime, type Activity } from "@/lib/activity";
import { INDIAN_STATES } from "@/lib/hr";
import { optionNames } from "@/lib/setup";
import {
  COVERS,
  MAX_AVATAR_BYTES,
  TIMEZONES,
  coverClass,
  initials,
  loadProfile,
  localTime,
  memberSince,
  readAvatar,
  saveProfile,
  type NotifPrefs,
  type Profile,
} from "@/lib/profile";

type Tab = "overview" | "edit" | "security" | "preferences";

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "overview", label: "Overview", icon: "eye" },
  { key: "edit", label: "Edit Profile", icon: "edit" },
  { key: "security", label: "Security", icon: "shield" },
  { key: "preferences", label: "Preferences", icon: "settings" },
];

export default function ProfilePage() {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [tab, setTab] = useState<Tab>("overview");
  const [activity, setActivity] = useState<Activity[]>([]);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUser(getUser());
    setProfile(loadProfile());
    setActivity(loadActivities());
  }, []);

  const name = user?.name ?? "User";
  const myActivity = useMemo(
    () => activity.filter((a) => a.user === name).slice(0, 6),
    [activity, name],
  );

  function persist(next: Profile) {
    setProfile(next);
    saveProfile(next);
    window.dispatchEvent(new Event("profile:updated"));
  }

  async function onAvatar(file: File | null) {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image too large", "Use an image under 2 MB.");
      return;
    }
    try {
      const dataUrl = await readAvatar(file);
      persist({ ...profile, avatar: dataUrl });
      toast.success("Photo updated");
    } catch {
      toast.error("Couldn't load image");
    }
    if (avatarRef.current) avatarRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`relative h-36 bg-gradient-to-r ${coverClass(profile.coverColor)} sm:h-44`}>
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        </div>

        <div className="px-5 pb-5 sm:px-7">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              {/* Avatar */}
              <div className="relative shrink-0">
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar}
                    alt={name}
                    className="h-24 w-24 rounded-2xl border-4 border-white object-cover shadow-md sm:h-28 sm:w-28"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-bold text-white shadow-md sm:h-28 sm:w-28">
                    {initials(name)}
                  </div>
                )}
                <button
                  onClick={() => avatarRef.current?.click()}
                  aria-label="Change photo"
                  title="Change photo"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-blue-600"
                >
                  <Icon name="camera" className="h-4 w-4" />
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0] ?? null)} />
              </div>

              <div className="pb-1">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{name}</h1>
                <p className="text-sm font-medium text-slate-500">{profile.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="briefcase" className="h-3.5 w-3.5" />
                    {profile.department}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="pin" className="h-3.5 w-3.5" />
                    {profile.location}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="clock" className="h-3.5 w-3.5" />
                    {localTime(profile.timezone)} local
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setTab("edit")}
              className="flex items-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:self-auto"
            >
              <Icon name="edit" className="h-4 w-4" />
              Edit Profile
            </button>
          </div>

          {/* Tabs */}
          <div className="no-scrollbar mt-5 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                    active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  <Icon name={t.icon} className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {tab === "overview" && <Overview profile={profile} user={user} activity={myActivity} />}
      {tab === "edit" && (
        <EditProfile
          user={user}
          profile={profile}
          onSaveUser={(u) => setUser(u)}
          onSaveProfile={persist}
          onDone={() => setTab("overview")}
        />
      )}
      {tab === "security" && <Security />}
      {tab === "preferences" && <Preferences profile={profile} onSave={persist} />}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────────
function Overview({ profile, user, activity }: { profile: Profile; user: User | null; activity: Activity[] }) {
  const stats = [
    { label: "Role", value: profile.title, icon: "briefcase" as IconName },
    { label: "Department", value: profile.department, icon: "users" as IconName },
    { label: "Member since", value: memberSince(profile.joinedAt), icon: "calendar" as IconName },
    { label: "Local time", value: localTime(profile.timezone), icon: "clock" as IconName },
  ];
  const socials: { key: keyof Profile["social"]; label: string; value: string }[] = [
    { key: "website", label: "Website", value: profile.social.website },
    { key: "linkedin", label: "LinkedIn", value: profile.social.linkedin },
    { key: "twitter", label: "Twitter / X", value: profile.social.twitter },
    { key: "github", label: "GitHub", value: profile.social.github },
  ].filter((s) => s.value) as { key: keyof Profile["social"]; label: string; value: string }[];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon name={s.icon} className="h-[18px] w-[18px]" />
              </div>
              <p className="mt-2 truncate text-sm font-bold text-slate-900" title={s.value}>{s.value}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* About */}
        <Card title="About">
          <p className="text-sm leading-relaxed text-slate-600">{profile.bio || "No bio added yet."}</p>
        </Card>

        {/* Recent activity */}
        <Card title="Recent activity">
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400">No recent activity for this user.</p>
          ) : (
            <ul className="space-y-1">
              {activity.map((a) => {
                const meta = CATEGORY_META[a.category];
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.badge}`}>
                      <Icon name={meta.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{a.action}</p>
                      <p className="text-xs text-slate-400">{relativeTime(a.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Contact */}
      <div className="space-y-6">
        <Card title="Contact information">
          <ul className="space-y-3">
            <InfoRow icon="gmail" label="Email" value={user?.email ?? "—"} />
            <InfoRow icon="phone" label="Phone" value={profile.phone || "—"} />
            <InfoRow icon="pin" label="Location" value={profile.location || "—"} />
            <InfoRow icon="clock" label="Timezone" value={profile.timezone} />
            <InfoRow icon="users" label="Username" value={user?.username ?? "—"} />
          </ul>
        </Card>

        {socials.length > 0 && (
          <Card title="Links">
            <ul className="space-y-2">
              {socials.map((s) => (
                <li key={s.key}>
                  <a
                    href={normalizeUrl(s.value)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <Icon name="link" className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{s.label}</span>
                    <span className="ml-auto truncate text-xs text-slate-400">{s.value}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-slate-800">{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700">{value}</p>
      </div>
    </li>
  );
}

// ── Edit profile ───────────────────────────────────────────────────
function EditProfile({
  user,
  profile,
  onSaveUser,
  onSaveProfile,
  onDone,
}: {
  user: User | null;
  profile: Profile;
  onSaveUser: (u: User) => void;
  onSaveProfile: (p: Profile) => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [draft, setDraft] = useState<Profile>(profile);

  const deptOptions: SelectOption[] = useMemo(() => optionNames("department").map((d) => ({ value: d, label: d })), []);
  const titleOptions: SelectOption[] = useMemo(() => optionNames("designation").map((d) => ({ value: d, label: d })), []);
  const tzOptions: SelectOption[] = TIMEZONES.map((t) => ({ value: t, label: t }));
  const stateOptions: SelectOption[] = INDIAN_STATES.filter((s) => s !== "All India").map((s) => ({ value: s, label: s }));

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setSocial(key: keyof Profile["social"], value: string) {
    setDraft((d) => ({ ...d, social: { ...d.social, [key]: value } }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      toast.error("Add your name", "Use at least 2 characters.");
      return;
    }
    const updated = updateUser({ name: fullName.trim(), username: username.trim(), email: email.trim() });
    if (updated) onSaveUser(updated);
    onSaveProfile(draft);
    window.dispatchEvent(new Event("profile:updated"));
    toast.success("Profile saved", "Your changes have been updated.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title="Basic information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Full name" required>
            <Input value={fullName} onChange={setFullName} placeholder="Your name" />
          </FormField>
          <FormField label="Username">
            <Input value={username} onChange={setUsername} placeholder="username" />
          </FormField>
          <FormField label="Email">
            <Input type="email" value={email} onChange={setEmail} placeholder="name@company.com" />
          </FormField>
          <FormField label="Phone">
            <Input value={draft.phone} onChange={(v) => set("phone", v)} placeholder="+91 …" />
          </FormField>
          <FormField label="Job title">
            <SearchableSelect value={draft.title} onChange={(v) => set("title", v)} options={titleOptions} placeholder="Select…" />
          </FormField>
          <FormField label="Department">
            <SearchableSelect value={draft.department} onChange={(v) => set("department", v)} options={deptOptions} placeholder="Select…" />
          </FormField>
          <FormField label="Location">
            <Input value={draft.location} onChange={(v) => set("location", v)} placeholder="City, Country" />
          </FormField>
          <FormField label="State">
            <SearchableSelect value={draft.state} onChange={(v) => set("state", v)} options={stateOptions} placeholder="Select state…" />
          </FormField>
          <FormField label="Timezone">
            <SearchableSelect value={draft.timezone} onChange={(v) => set("timezone", v)} options={tzOptions} />
          </FormField>
        </div>
        <FormField label="Bio" className="mt-4">
          <textarea
            value={draft.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={4}
            placeholder="A short introduction about yourself…"
            className="no-scrollbar w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </FormField>
      </Card>

      <Card title="Social links">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Website">
            <Input value={draft.social.website} onChange={(v) => setSocial("website", v)} placeholder="https://…" />
          </FormField>
          <FormField label="LinkedIn">
            <Input value={draft.social.linkedin} onChange={(v) => setSocial("linkedin", v)} placeholder="linkedin.com/in/…" />
          </FormField>
          <FormField label="Twitter / X">
            <Input value={draft.social.twitter} onChange={(v) => setSocial("twitter", v)} placeholder="@handle" />
          </FormField>
          <FormField label="GitHub">
            <Input value={draft.social.github} onChange={(v) => setSocial("github", v)} placeholder="github.com/…" />
          </FormField>
        </div>
      </Card>

      <Card title="Cover">
        <div className="flex flex-wrap gap-2.5">
          {COVERS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => set("coverColor", c.key)}
              aria-label={c.key}
              className={`h-10 w-16 rounded-lg bg-gradient-to-r ${c.class} ring-offset-2 transition ${
                draft.coverColor === c.key ? "ring-2 ring-blue-500" : "hover:opacity-90"
              }`}
            />
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          Save Changes
        </button>
      </div>
    </form>
  );
}

// ── Security ───────────────────────────────────────────────────────
function Security() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Weak password", "Use at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords don't match", "Re-enter the new password.");
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password updated", "Use your new password next time you sign in.");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card title="Change password">
          <form onSubmit={submit} className="space-y-4">
            <FormField label="Current password">
              <Input type="password" value={current} onChange={setCurrent} placeholder="••••••••" />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="New password">
                <Input type="password" value={next} onChange={setNext} placeholder="At least 8 characters" />
              </FormField>
              <FormField label="Confirm new password">
                <Input type="password" value={confirm} onChange={setConfirm} placeholder="Repeat new password" />
              </FormField>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                Update Password
              </button>
            </div>
          </form>
        </Card>
      </div>

      <Card title="Active sessions">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <Icon name="shield" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">This device</p>
            <p className="text-xs text-slate-400">Active now · current session</p>
          </div>
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Current</span>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          You&apos;re signed in on this device only. Sign out from the top bar to end this session.
        </p>
      </Card>
    </div>
  );
}

// ── Preferences ────────────────────────────────────────────────────
function Preferences({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const toast = useToast();
  const items: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    { key: "productUpdates", label: "Product updates", desc: "New features and improvements." },
    { key: "security", label: "Security alerts", desc: "Sign-ins and password changes." },
    { key: "mentions", label: "Mentions & replies", desc: "When someone mentions you." },
    { key: "weeklyDigest", label: "Weekly digest", desc: "A summary of activity each week." },
  ];

  function toggle(key: keyof NotifPrefs) {
    const next = { ...profile, notif: { ...profile.notif, [key]: !profile.notif[key] } };
    onSave(next);
    toast.success("Preference saved");
  }

  return (
    <Card title="Notifications">
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{it.label}</p>
              <p className="text-xs text-slate-400">{it.desc}</p>
            </div>
            <Toggle on={profile.notif[it.key]} onClick={() => toggle(it.key)} label={it.label} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-blue-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// ── Small form helpers ─────────────────────────────────────────────
function FormField({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    />
  );
}

function normalizeUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

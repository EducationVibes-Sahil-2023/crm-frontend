// Local-first user profile store. Holds the "extra" profile fields that aren't
// part of the auth User (name/username/email live in auth). Persists to
// localStorage so it works without a backend; swap for `api` calls later.

export type SocialLinks = {
  website: string;
  linkedin: string;
  twitter: string;
  github: string;
};

export type NotifPrefs = {
  productUpdates: boolean;
  security: boolean;
  mentions: boolean;
  weeklyDigest: boolean;
};

export type Profile = {
  title: string; // job title
  department: string;
  phone: string;
  location: string;
  state: string; // home state — used for state-wise holidays
  timezone: string;
  bio: string;
  avatar: string | null; // base64 data URL
  coverColor: string; // a gradient key (see COVERS)
  social: SocialLinks;
  joinedAt: string; // ISO date
  notif: NotifPrefs;
};

// Selectable cover gradients for the profile banner.
export const COVERS: { key: string; class: string }[] = [
  { key: "blue", class: "from-blue-600 to-indigo-600" },
  { key: "violet", class: "from-violet-600 to-purple-600" },
  { key: "emerald", class: "from-emerald-500 to-teal-600" },
  { key: "rose", class: "from-rose-500 to-pink-600" },
  { key: "amber", class: "from-amber-500 to-orange-600" },
  { key: "slate", class: "from-slate-600 to-slate-800" },
];

export function coverClass(key: string): string {
  return COVERS.find((c) => c.key === key)?.class ?? COVERS[0].class;
}

export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const STORAGE_KEY = "nexus_profile";

const DEFAULT_PROFILE: Profile = {
  title: "Director of Sales",
  department: "Sales",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  state: "Karnataka",
  timezone: "Asia/Kolkata",
  bio: "Sales leader focused on building lasting customer relationships and a high-performing team.",
  avatar: null,
  coverColor: "blue",
  social: { website: "", linkedin: "", twitter: "", github: "" },
  joinedAt: "2024-01-15",
  notif: { productUpdates: true, security: true, mentions: true, weeklyDigest: false },
};

export function loadProfile(): Profile {
  if (typeof window === "undefined") return { ...DEFAULT_PROFILE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<Profile>;
    // Merge so newly-added fields always have a value.
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      social: { ...DEFAULT_PROFILE.social, ...(parsed.social ?? {}) },
      notif: { ...DEFAULT_PROFILE.notif, ...(parsed.notif ?? {}) },
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(p: Profile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota errors */
  }
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function memberSince(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function localTime(timezone: string): string {
  try {
    return new Date().toLocaleTimeString(undefined, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function readAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

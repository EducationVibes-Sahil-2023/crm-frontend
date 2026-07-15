// CRM appearance / theme settings. Persisted per workspace to MySQL (`app_store`
// via /api/store, hydrated at sign-in) and applied at runtime by overriding
// Tailwind v4's CSS color + radius tokens on <html>, plus the root font-size
// (density) and body font. Because Tailwind v4 utilities reference these
// variables, changing them re-themes the whole app — no per-component work.

import { useEffect, useState } from "react";
import { ICON_ANIMS, type IconAnim } from "@/lib/adminMenu";
import { loadPlatform } from "@/lib/platform";
import { dbGet, dbSet } from "@/lib/dbStore";

export { ICON_ANIMS, type IconAnim };

export type AccentKey = "blue" | "indigo" | "violet" | "emerald" | "rose" | "amber" | "cyan";
export type FontKey = "geist" | "system" | "rounded" | "serif" | "mono";
export type Density = "compact" | "comfortable" | "spacious";
export type Radius = "sharp" | "default" | "rounded";
export type BgKey = "slate" | "white" | "gray" | "zinc" | "stone" | "tinted";

export type Appearance = {
  accent: AccentKey;
  font: FontKey;
  density: Density;
  radius: Radius;
  bg: BgKey;
  tablePageSize: number;
  stickyHeader: boolean;
  // Sidebar (client menu) customization.
  sidebarBg: string;              // sidebar background — #rrggbb
  sidebarText: string;            // sidebar base text/icon colour — #rrggbb
  sidebarAccent: string;          // active-item colour ("" = follow the theme accent)
  sidebarIconChips: boolean;      // false = plain icons, true = coloured chip behind each icon
  sidebarIconStyle: "outline" | "filled";
  sidebarIconAnim: IconAnim;      // icon motion on hover (pulse = continuous, active item)
  sidebarDescriptions: boolean;   // show a one-line subtitle under each menu label
  sidebarQuickActions: boolean;   // show the quick-actions grid pinned above the nav
};

export const DEFAULT_APPEARANCE: Appearance = {
  accent: "blue",
  font: "geist",
  density: "comfortable",
  radius: "default",
  bg: "slate",
  tablePageSize: 25,
  stickyHeader: true,
  // Pre-defined default: a light menu that mirrors the admin control center
  // (white background, slate text, coloured icon chips). Clients can change it.
  sidebarBg: "#ffffff",
  sidebarText: "#334155",
  sidebarAccent: "",
  sidebarIconChips: true,
  sidebarIconStyle: "outline",
  sidebarIconAnim: "pop",
  sidebarDescriptions: true,
  sidebarQuickActions: true,
};

// Preset swatches for the sidebar colours (light options first, then dark).
export const SIDEBAR_BG_PRESETS = ["#ffffff", "#f8fafc", "#f1f5f9", "#1b2138", "#0f172a", "#111827", "#1e293b"];
export const SIDEBAR_TEXT_PRESETS = ["#334155", "#475569", "#0f172a", "#cbd5e1", "#e2e8f0", "#94a3b8"];

// Each accent remaps the brand palette (Tailwind `blue` → primary hue,
// `indigo`/`sky` → secondary hue) so gradients stay rich.
export const ACCENTS: Record<AccentKey, { label: string; primary: number; secondary: number; sat: number }> = {
  blue: { label: "Blue", primary: 217, secondary: 245, sat: 90 },
  indigo: { label: "Indigo", primary: 245, secondary: 266, sat: 84 },
  violet: { label: "Violet", primary: 269, secondary: 286, sat: 80 },
  emerald: { label: "Emerald", primary: 160, secondary: 174, sat: 76 },
  rose: { label: "Rose", primary: 347, secondary: 330, sat: 80 },
  amber: { label: "Amber", primary: 38, secondary: 25, sat: 90 },
  cyan: { label: "Cyan", primary: 192, secondary: 205, sat: 84 },
};

export const FONTS: Record<FontKey, { label: string; stack: string }> = {
  geist: { label: "Geist (default)", stack: "var(--font-geist-sans), system-ui, sans-serif" },
  system: { label: "System UI", stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  rounded: { label: "Rounded", stack: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" },
  serif: { label: "Serif", stack: "Georgia, 'Times New Roman', serif" },
  mono: { label: "Monospace", stack: "var(--font-geist-mono), ui-monospace, 'Courier New', monospace" },
};

export const DENSITIES: Record<Density, { label: string; px: number; desc: string }> = {
  compact: { label: "Compact", px: 14, desc: "Fit more on screen" },
  comfortable: { label: "Comfortable", px: 16, desc: "Balanced (default)" },
  spacious: { label: "Spacious", px: 18, desc: "Larger, roomier UI" },
};

export const RADII: Record<Radius, { label: string; scale: number }> = {
  sharp: { label: "Sharp", scale: 0.5 },
  default: { label: "Default", scale: 1 },
  rounded: { label: "Rounded", scale: 1.6 },
};

// Background color for the main content area (the "right panel" next to the
// sidebar). `tinted` is derived from the current accent so it stays in sync.
export const BACKGROUNDS: Record<BgKey, { label: string; value: string }> = {
  slate: { label: "Slate (default)", value: "#f1f5f9" },
  white: { label: "White", value: "#ffffff" },
  gray: { label: "Cool gray", value: "#f3f4f6" },
  zinc: { label: "Neutral", value: "#f4f4f5" },
  stone: { label: "Warm", value: "#f7f6f4" },
  tinted: { label: "Accent tint", value: "" }, // computed from the accent hue
};

// Resolve the panel background to a concrete color (tinted follows the accent).
export function bgValue(bg: BgKey, accent: AccentKey): string {
  if (bg === "tinted") {
    const a = ACCENTS[accent] ?? ACCENTS.blue;
    return `hsl(${a.primary} ${Math.min(a.sat, 60)}% 96.5%)`;
  }
  return (BACKGROUNDS[bg] ?? BACKGROUNDS.slate).value;
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Lightness curve (0–1) for palette steps 50…950.
const STEPS: [string, number][] = [
  ["50", 0.97], ["100", 0.93], ["200", 0.86], ["300", 0.77], ["400", 0.66],
  ["500", 0.56], ["600", 0.48], ["700", 0.4], ["800", 0.33], ["900", 0.27], ["950", 0.18],
];

// Base Tailwind radius scale (rem) we scale by the chosen factor.
const RADIUS_TOKENS: [string, number][] = [
  ["xs", 0.125], ["sm", 0.25], ["md", 0.375], ["lg", 0.5], ["xl", 0.75],
  ["2xl", 1], ["3xl", 1.5], ["4xl", 2],
];

export function accentSwatch(key: AccentKey): string {
  const a = ACCENTS[key];
  return `hsl(${a.primary} ${a.sat}% 48%)`;
}

const KEY = "nexus_appearance";

// The base theme = hardcoded defaults with the platform-wide default (set by the
// Super Admin under Platform Settings → Appearance) layered on top. A client's
// own local choices then layer over this base.
function baseAppearance(): Appearance {
  return { ...DEFAULT_APPEARANCE, ...(loadPlatform().appearance ?? {}) };
}

export function loadAppearance(): Appearance {
  if (typeof window === "undefined") return { ...DEFAULT_APPEARANCE };
  const base = baseAppearance();
  return { ...base, ...dbGet<Partial<Appearance>>(KEY, {}) };
}

export function saveAppearance(a: Appearance): void {
  if (typeof window === "undefined") return;
  dbSet(KEY, a);
  // Always notify live consumers (sidebar, etc.) so a save never leaves the UI
  // stale — callers no longer need to remember to dispatch the event themselves.
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

/**
 * Resolve the sidebar's active/highlight colours. A custom `sidebarAccent`
 * (#rrggbb) wins; otherwise the colours follow the app THEME accent, so changing
 * the theme recolours the menu's active item + icons too.
 */
export function sidebarAccentColors(a: Appearance): { solid: string; tint: string } {
  if (/^#[0-9a-fA-F]{6}$/.test(a.sidebarAccent || "")) {
    return { solid: a.sidebarAccent, tint: `${a.sidebarAccent}1a` };
  }
  const acc = ACCENTS[a.accent] ?? ACCENTS.blue;
  return {
    solid: `hsl(${acc.primary} ${acc.sat}% 48%)`,
    tint: `hsl(${acc.primary} ${Math.min(acc.sat, 72)}% 95%)`,
  };
}

export function getTablePageSize(): number {
  return loadAppearance().tablePageSize;
}

function setRamp(root: HTMLElement, token: string, hue: number, sat: number) {
  for (const [step, l] of STEPS) {
    root.style.setProperty(`--color-${token}-${step}`, `hsl(${hue} ${sat}% ${Math.round(l * 100)}%)`);
  }
}

// Apply the settings to the document. Safe to call repeatedly.
export function applyAppearance(a: Appearance): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Accent → remap brand palettes (blue=primary, indigo+sky=secondary).
  const acc = ACCENTS[a.accent] ?? ACCENTS.blue;
  setRamp(root, "blue", acc.primary, acc.sat);
  setRamp(root, "indigo", acc.secondary, acc.sat);
  setRamp(root, "sky", acc.secondary, acc.sat);
  root.style.setProperty("--accent", accentSwatch(a.accent));

  // Radius → scale Tailwind radius tokens.
  const scale = (RADII[a.radius] ?? RADII.default).scale;
  for (const [name, rem] of RADIUS_TOKENS) {
    root.style.setProperty(`--radius-${name}`, `${(rem * scale).toFixed(3)}rem`);
  }

  // Panel background → the main content area reads var(--app-bg).
  root.style.setProperty("--app-bg", bgValue(a.bg, a.accent));

  // Density → root font-size (Tailwind is rem-based, so this scales everything).
  root.style.fontSize = `${(DENSITIES[a.density] ?? DENSITIES.comfortable).px}px`;

  // Font family.
  document.body.style.fontFamily = (FONTS[a.font] ?? FONTS.geist).stack;
}

export const APPEARANCE_EVENT = "appearance:updated";

/**
 * Live appearance for client components (e.g. the sidebar) — re-renders when the
 * theme is saved (same tab via APPEARANCE_EVENT, other tabs via `storage`).
 * Starts from defaults to avoid an SSR/first-paint mismatch.
 */
export function useAppearance(): Appearance {
  const [a, setA] = useState<Appearance>(DEFAULT_APPEARANCE);
  useEffect(() => {
    const read = () => setA(loadAppearance());
    read();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === KEY) read(); };
    window.addEventListener(APPEARANCE_EVENT, read);
    window.addEventListener("platform:updated", read); // inherited default hydrated
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(APPEARANCE_EVENT, read);
      window.removeEventListener("platform:updated", read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return a;
}

// CRM appearance / theme settings. Stored in localStorage and applied at runtime
// by overriding Tailwind v4's CSS color + radius tokens on <html>, plus the root
// font-size (density) and body font. Because Tailwind v4 utilities reference
// these variables, changing them re-themes the whole app — no per-component work.

export type AccentKey = "blue" | "indigo" | "violet" | "emerald" | "rose" | "amber" | "cyan";
export type FontKey = "geist" | "system" | "rounded" | "serif" | "mono";
export type Density = "compact" | "comfortable" | "spacious";
export type Radius = "sharp" | "default" | "rounded";

export type Appearance = {
  accent: AccentKey;
  font: FontKey;
  density: Density;
  radius: Radius;
  tablePageSize: number;
  stickyHeader: boolean;
};

export const DEFAULT_APPEARANCE: Appearance = {
  accent: "blue",
  font: "geist",
  density: "comfortable",
  radius: "default",
  tablePageSize: 25,
  stickyHeader: true,
};

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

export function loadAppearance(): Appearance {
  if (typeof window === "undefined") return { ...DEFAULT_APPEARANCE };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return { ...DEFAULT_APPEARANCE, ...(JSON.parse(raw) as Partial<Appearance>) };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(a: Appearance): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
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

  // Density → root font-size (Tailwind is rem-based, so this scales everything).
  root.style.fontSize = `${(DENSITIES[a.density] ?? DENSITIES.comfortable).px}px`;

  // Font family.
  document.body.style.fontFamily = (FONTS[a.font] ?? FONTS.geist).stack;
}

export const APPEARANCE_EVENT = "appearance:updated";

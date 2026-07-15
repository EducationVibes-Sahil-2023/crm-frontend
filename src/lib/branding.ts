// CRM branding — logo + app name/tagline. Admins change it under
// Admin Setup → Branding; it's persisted per workspace to MySQL (`app_store`
// via /api/store, hydrated at sign-in) and applied live to the sidebar, login
// screen and browser tab title.

import { useEffect, useState } from "react";
import { dbGet, dbSet } from "@/lib/dbStore";

export type Branding = {
  appName: string;        // optional — falls back to the workspace/platform name
  tagline: string;        // optional — shown only when set
  logo: string | null;    // data URL
  favicon: string | null; // data URL for the browser-tab icon
  logoWidth: number;      // logo image width as % of its tile (40–100)
  logoHeight: number;     // logo image height as % of its tile (40–100)
  logoOnly: boolean;      // hide the name/tagline text and show only the logo
};

export const DEFAULT_BRANDING: Branding = {
  appName: "",   // falls back to the workspace/platform name in the UI
  tagline: "",   // shown only when explicitly set (no default "Enterprise")
  logo: null,
  favicon: null,
  logoWidth: 100,
  logoHeight: 100,
  logoOnly: false,
};

const KEY = "nexus_branding_v1";
const EVENT = "branding:updated";
export const MAX_LOGO_BYTES = 512 * 1024; // 512 KB

export function loadBranding(): Branding {
  if (typeof window === "undefined") return DEFAULT_BRANDING;
  return { ...DEFAULT_BRANDING, ...dbGet<Partial<Branding>>(KEY, {}) };
}

export function saveBranding(b: Branding): void {
  if (typeof window === "undefined") return;
  dbSet(KEY, b);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeBranding(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === KEY) cb();
  };
  window.addEventListener(EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

/** Read an image file to a data URL, rejecting non-images / oversize files. */
export function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      reject(new Error("Logo must be under 512 KB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/** Live branding for client components (re-renders on change, same tab + others). */
export function useBranding(): Branding {
  const [b, setB] = useState<Branding>(DEFAULT_BRANDING);
  useEffect(() => {
    const read = () => setB(loadBranding());
    read();
    return subscribeBranding(read);
  }, []);
  return b;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "N";
}

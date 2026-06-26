// CRM branding — logo + app name/tagline. Admins change it under
// Admin Setup → Branding; it's stored in localStorage and applied live to the
// sidebar, login screen and browser tab title.

import { useEffect, useState } from "react";

export type Branding = {
  appName: string;
  tagline: string;
  logo: string | null; // data URL
};

export const DEFAULT_BRANDING: Branding = {
  appName: "Nexus CRM",
  tagline: "Enterprise",
  logo: null,
};

const KEY = "nexus_branding_v1";
const EVENT = "branding:updated";
export const MAX_LOGO_BYTES = 512 * 1024; // 512 KB

export function loadBranding(): Branding {
  if (typeof window === "undefined") return DEFAULT_BRANDING;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_BRANDING, ...(JSON.parse(raw) as Partial<Branding>) } : DEFAULT_BRANDING;
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBranding(b: Branding): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(b));
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
    setB(loadBranding());
    return subscribeBranding(() => setB(loadBranding()));
  }, []);
  return b;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "N";
}

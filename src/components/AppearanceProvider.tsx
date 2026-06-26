"use client";

import { useEffect } from "react";
import { APPEARANCE_EVENT, applyAppearance, loadAppearance } from "@/lib/appearance";

// Applies the saved appearance/theme to the document on mount, and re-applies
// whenever it changes (same tab via a custom event, other tabs via storage).
export default function AppearanceProvider() {
  useEffect(() => {
    const apply = () => applyAppearance(loadAppearance());
    apply();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "nexus_appearance") apply();
    };
    window.addEventListener(APPEARANCE_EVENT, apply);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(APPEARANCE_EVENT, apply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

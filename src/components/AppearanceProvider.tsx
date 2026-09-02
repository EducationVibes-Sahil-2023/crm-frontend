"use client";

import { useEffect } from "react";
import { APPEARANCE_EVENT, applyAppearance, loadAppearance } from "@/lib/appearance";
import { STORE_EVENT } from "@/lib/dbStore";

// Applies the saved appearance/theme to the document on mount, and re-applies
// whenever it changes (same tab via a custom event, other tabs via storage).
export default function AppearanceProvider() {
  useEffect(() => {
    const apply = () => applyAppearance(loadAppearance());
    apply();
    window.addEventListener(APPEARANCE_EVENT, apply);
    window.addEventListener("platform:updated", apply); // re-apply once the inherited default loads
    // Appearance lives in the workspace store, so re-apply whenever the live
    // sync pulls a change made in another tab, device or session.
    window.addEventListener(STORE_EVENT, apply);
    return () => {
      window.removeEventListener(APPEARANCE_EVENT, apply);
      window.removeEventListener("platform:updated", apply);
      window.removeEventListener(STORE_EVENT, apply);
    };
  }, []);
  return null;
}

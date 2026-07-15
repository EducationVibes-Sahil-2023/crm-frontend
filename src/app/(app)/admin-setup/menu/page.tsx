"use client";

import { useEffect, useMemo, useState } from "react";
import MenuEditor from "@/components/MenuEditor";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";
import { EMPTY_NAV_CONFIG, loadNavConfig, saveNavConfig, type NavConfig } from "@/lib/navConfig";
import { allowedFeatures, isHrefAllowed } from "@/lib/access";
import { STORE_EVENT } from "@/lib/dbStore";

// System/admin groups clients shouldn't reorder or rename from the menu editor.
const EXCLUDE_GROUPS = ["Administration"];

export default function MenuSetupPage() {
  const toast = useToast();
  const [cfg, setCfg] = useState<NavConfig>(EMPTY_NAV_CONFIG);
  // Modules this workspace's plan unlocks — so the editor lists only real menus.
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCfg(loadNavConfig());
    const sync = () => setAllowed(allowedFeatures());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    return () => window.removeEventListener(STORE_EVENT, sync);
  }, []);

  // Until the plan is known (empty set), show everything to avoid a flash.
  const isItemVisible = useMemo(
    () => (href: string) => allowed.size === 0 || isHrefAllowed(href, allowed),
    [allowed],
  );

  const dirty = useMemo(
    () => Object.keys(cfg.items).length > 0 || Object.keys(cfg.groups).length > 0 || Object.keys(cfg.order).length > 0,
    [cfg],
  );

  // Persist + apply live to the sidebar (mirrors the appearance editor).
  function commit(next: NavConfig) {
    setCfg(next);
    saveNavConfig(next);
  }

  function reset() {
    commit({ items: {}, groups: {}, order: {} });
    toast.info("Menu reset", "Restored the default navigation.");
    logActivity("Reset sidebar menu", { category: "setup" });
  }

  function save() {
    saveNavConfig(cfg);
    toast.success("Menu saved", "Your navigation is applied for everyone.");
    logActivity("Updated sidebar menu", { category: "setup" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Menu / Navigation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reorder, rename, re-slug, re-icon or hide sidebar items. Changes apply to the sidebar for everyone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} disabled={!dirty} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Reset
          </button>
          <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>

      <MenuEditor value={cfg} onChange={commit} excludeGroupKeys={EXCLUDE_GROUPS} isItemVisible={isItemVisible} />
    </div>
  );
}

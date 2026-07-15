"use client";
/* eslint-disable @next/next/no-img-element -- arbitrary client-configured logo URLs */

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import SearchSelect from "@/components/SearchSelect";
import SearchableSelect from "@/components/SearchableSelect";
import { AUTOMATIONS, PLATFORM_FEATURES, ALL_FEATURE_KEYS, loadPlatform, refreshPlatform, rid, savePlatform, type PlatformConfig, type PlatformPlan, type Review } from "@/lib/platform";
import { readLogo } from "@/lib/branding";
import { createGmailClient } from "@/lib/gmailApi";
import { ensureSuperAdminToken, getSuperAdminToken, superAdminLogout } from "@/lib/superAdmin";
import MenuEditor from "@/components/MenuEditor";
import { type NavConfig } from "@/lib/navConfig";
import {
  ACCENTS, DENSITIES, RADII, BACKGROUNDS, SIDEBAR_BG_PRESETS, SIDEBAR_TEXT_PRESETS,
  DEFAULT_APPEARANCE, accentSwatch, bgValue,
  type Appearance, type AccentKey, type Density, type Radius, type BgKey,
} from "@/lib/appearance";

// On a 401 the super-admin session has expired — clear it and go sign in, so a
// stale token can't masquerade as a "save failed / backend down" error.
const superGmail = createGmailClient(getSuperAdminToken, () => {
  if (typeof window !== "undefined") {
    superAdminLogout();
    window.location.href = "/admin/login?expired=1";
  }
});

type Tab = "brand" | "appearance" | "landing" | "plans" | "permissions" | "reviews" | "payments" | "google" | "automation";
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "brand", label: "Branding", icon: "star" },
  { key: "appearance", label: "Appearance", icon: "grid" },
  { key: "landing", label: "Landing Page", icon: "dashboard" },
  { key: "plans", label: "Plans", icon: "payment" },
  { key: "permissions", label: "Permissions", icon: "shield" },
  { key: "reviews", label: "Reviews", icon: "chat" },
  { key: "payments", label: "Payments", icon: "revenue" },
  { key: "google", label: "Google", icon: "gmail" },
  { key: "automation", label: "Automation", icon: "refresh" },
];

export default function PlatformSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<PlatformConfig>(loadPlatform);
  const [tab, setTab] = useState<Tab>("brand");
  const [loaded, setLoaded] = useState(false);
  // Load the saved config from the backend first, so we never overwrite the DB
  // with defaults before it has hydrated.
  useEffect(() => {
    let active = true;
    refreshPlatform().then((c) => { if (active) { setCfg(c); setLoaded(true); } }).catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (loaded) savePlatform(cfg); }, [cfg, loaded]);

  const setBrand = (k: keyof PlatformConfig["brand"], v: string) => setCfg((c) => ({ ...c, brand: { ...c.brand, [k]: v } }));
  const setBrandNum = (k: "logoWidth" | "logoHeight", v: number) => setCfg((c) => ({ ...c, brand: { ...c.brand, [k]: v } }));
  const setBrandBool = (k: "logoOnly", v: boolean) => setCfg((c) => ({ ...c, brand: { ...c.brand, [k]: v } }));
  const setLanding = (k: keyof PlatformConfig["landing"], v: string) => setCfg((c) => ({ ...c, landing: { ...c.landing, [k]: v } }));
  const setPayment = <K extends keyof PlatformConfig["payment"]>(k: K, v: PlatformConfig["payment"][K]) => setCfg((c) => ({ ...c, payment: { ...c.payment, [k]: v } }));
  const setGoogle = <K extends keyof PlatformConfig["google"]>(k: K, v: PlatformConfig["google"][K]) => setCfg((c) => ({ ...c, google: { ...c.google, [k]: v } }));
  const setAppearance = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setCfg((c) => ({ ...c, appearance: { ...c.appearance, [k]: v } }));
  const setNav = (nav: NavConfig) => setCfg((c) => ({ ...c, nav }));

  const [gtest, setGtest] = useState<{ status: "idle" | "testing" | "ok" | "fail"; msg: string }>({ status: "idle", msg: "" });

  // Load the server's effective Gmail config so the UI reflects what the backend
  // actually uses (which may have come from .env, not just this localStorage cfg).
  useEffect(() => {
    let active = true;
    (async () => {
      await ensureSuperAdminToken();
      try {
        const sc = await superGmail.getConfig();
        if (active && sc.configured) setGtest({ status: "ok", msg: `Server configured · ${sc.clientId.slice(0, 24)}…` });
      } catch { /* backend offline — stay idle */ }
    })();
    return () => { active = false; };
  }, []);

  async function saveGoogleToServer() {
    const id = cfg.google.clientId.trim();
    const secret = cfg.google.clientSecret.trim();
    if (!id) {
      setGtest({ status: "fail", msg: "Enter an OAuth Client ID first." });
      return toast.error("No Client ID", "Enter your Google OAuth Client ID.");
    }
    if (!/\.apps\.googleusercontent\.com$/.test(id)) {
      setGtest({ status: "fail", msg: "Client ID must end with .apps.googleusercontent.com" });
      return toast.error("Invalid Client ID", "That doesn't look like a Google OAuth Client ID.");
    }
    setGtest({ status: "testing", msg: "Saving to server…" });
    try {
      await ensureSuperAdminToken();
      const res = await superGmail.saveConfig({ clientId: id, clientSecret: secret });
      if (res.configured) {
        setGtest({ status: "ok", msg: "Saved — the server can now connect Gmail." });
        toast.success("Google configured", "Gmail OAuth is live. Connect an inbox from the Mail page.");
      } else {
        setGtest({ status: "fail", msg: res.hasSecret ? "Saved, but not fully configured." : "Add the Client Secret to finish." });
        toast.error("Almost there", "Add the Client Secret and save again.");
      }
    } catch (e) {
      const msg = (e as Error).message || "Couldn't reach the server. Is the backend running on :8080?";
      setGtest({ status: "fail", msg });
      toast.error("Save failed", msg);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400"><Link href="/admin" className="hover:text-slate-600">Super Admin</Link> / Platform Settings</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Platform Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage branding, the public landing page, plans, payments and automation.</p>
        </div>
        <Link href="/" target="_blank" className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Icon name="export" className="h-4 w-4 text-slate-500" /> View landing page</Link>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Icon name={t.icon} className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Gate the content on the backend load so we never flash the stale/default
          logo & favicon before the saved config arrives ("old then new"). */}
      {!loaded ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-500 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" /> Loading settings…
        </div>
      ) : (
      <>
      {tab === "brand" && (
        <Card title="Branding & Logo" subtitle="Your platform identity across the app and landing page.">
          {/* Identity */}
          <SubHeading>Identity</SubHeading>
          <Grid>
            <Field label="Platform name"><Input value={cfg.brand.name} onChange={(v) => setBrand("name", v)} placeholder="CRM Cloud" /></Field>
            <Field label="Tagline"><Input value={cfg.brand.tagline} onChange={(v) => setBrand("tagline", v)} placeholder="The all-in-one CRM…" /></Field>
            <Field label="Logo text (initials)" full>
              <Input value={cfg.brand.logoText} onChange={(v) => setBrand("logoText", v)} placeholder="CC" />
              <p className="mt-1 text-[11px] text-slate-400">Shown in the logo box when no logo image is set.</p>
            </Field>
          </Grid>
          <ToggleRow
            label="Show logo only"
            desc="Hide the platform name, tagline & initials next to the logo — show just the logo image."
            checked={cfg.brand.logoOnly}
            onChange={(v) => setBrandBool("logoOnly", v)}
          />

          {/* Logo & favicon */}
          <SubHeading>Logo &amp; favicon</SubHeading>
          <ImageUploadField
            label="Logo image"
            value={cfg.brand.logoUrl}
            onChange={(v) => setBrand("logoUrl", v)}
            successMsg={["Logo updated", "Your new logo is live across the site."]}
            hint="PNG, SVG or JPG up to 512 KB. Uploaded images are embedded in your config."
            preview={
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl p-1.5 text-sm font-bold text-white" style={{ backgroundColor: cfg.brand.logoBg }}>
                {cfg.brand.logoUrl ? <img src={cfg.brand.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" style={{ width: `${cfg.brand.logoWidth}%`, height: `${cfg.brand.logoHeight}%` }} /> : cfg.brand.logoText}
              </span>
            }
          />
          {cfg.brand.logoUrl && (
            <Field label="Logo size" full>
              <div className="grid grid-cols-1 items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <SizeRange label="Width" value={cfg.brand.logoWidth} onChange={(v) => setBrandNum("logoWidth", v)} />
                  <SizeRange label="Height" value={cfg.brand.logoHeight} onChange={(v) => setBrandNum("logoHeight", v)} />
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg p-1" style={{ width: `${Math.round(120 * cfg.brand.logoWidth / 100)}px`, height: `${Math.round(40 * cfg.brand.logoHeight / 100)}px`, backgroundColor: cfg.brand.logoBg }}>
                    <img src={cfg.brand.logoUrl} alt="Logo size preview" className="max-h-full max-w-full object-contain" />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">{cfg.brand.logoWidth}% × {cfg.brand.logoHeight}%</span>
                </div>
              </div>
            </Field>
          )}
          <ImageUploadField
            label="Favicon (browser tab icon)"
            value={cfg.brand.favicon}
            onChange={(v) => setBrand("favicon", v)}
            successMsg={["Favicon updated", "The browser tab icon now uses your image."]}
            hint="Square PNG, SVG or ICO up to 512 KB. Shows in the browser tab."
            preview={
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                {cfg.brand.favicon ? <img src={cfg.brand.favicon} alt="Favicon" className="h-7 w-7 object-contain" /> : <Icon name="star" className="h-5 w-5" />}
              </span>
            }
          />

          {/* Colours */}
          <SubHeading>Colours</SubHeading>
          <Grid>
            <Field label="Primary color">
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.brand.primaryColor} onChange={(e) => setBrand("primaryColor", e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-300" />
                <Input value={cfg.brand.primaryColor} onChange={(v) => setBrand("primaryColor", v)} placeholder="#2563eb" />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Buttons &amp; accents.</p>
            </Field>
            <Field label="Logo background color">
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.brand.logoBg} onChange={(e) => setBrand("logoBg", e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-300" />
                <Input value={cfg.brand.logoBg} onChange={(v) => setBrand("logoBg", v)} placeholder="#2563eb" />
                <button type="button" onClick={() => setBrand("logoBg", cfg.brand.primaryColor)} title="Match primary color" className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Match</button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Box behind the logo/initials across the app.</p>
            </Field>
          </Grid>

          {/* Contact */}
          <SubHeading>Contact</SubHeading>
          <Grid>
            <Field label="Contact email"><Input value={cfg.brand.email} onChange={(v) => setBrand("email", v)} placeholder="sales@yourcrm.com" /></Field>
            <Field label="Contact phone"><Input value={cfg.brand.phone} onChange={(v) => setBrand("phone", v)} placeholder="+91 98765 43210" /></Field>
          </Grid>

          {/* Live preview */}
          <SubHeading>Preview</SubHeading>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl p-1.5 text-base font-bold text-white" style={{ backgroundColor: cfg.brand.logoBg }}>
              {cfg.brand.logoUrl ? <img src={cfg.brand.logoUrl} alt="" className="max-h-full max-w-full object-contain" style={{ width: `${cfg.brand.logoWidth}%`, height: `${cfg.brand.logoHeight}%` }} /> : cfg.brand.logoText}
            </span>
            {cfg.brand.logoOnly ? (
              <span className="text-xs italic text-slate-400">Logo-only mode — name &amp; tagline are hidden.</span>
            ) : (
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{cfg.brand.name || "Platform name"}</p>
                <p className="truncate text-xs text-slate-500">{cfg.brand.tagline || "Tagline"}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === "appearance" && (
        <div className="space-y-6">
          <Card title="Default theme" subtitle="The Theme & UI every client workspace inherits. Clients can still override it under their own Admin Setup → Theme & UI.">
            {/* Accent */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Accent color</p>
              <div className="flex flex-wrap gap-2.5">
                {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
                  const active = (cfg.appearance.accent ?? DEFAULT_APPEARANCE.accent) === key;
                  return (
                    <button key={key} type="button" onClick={() => setAppearance("accent", key)} title={ACCENTS[key].label} aria-label={ACCENTS[key].label}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ring-offset-2 transition ${active ? "ring-2 ring-slate-900" : "hover:scale-105"}`}
                      style={{ background: accentSwatch(key) }}>
                      {active && <Icon name="check" className="h-5 w-5 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Density + Radius */}
            <Grid>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Density</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DENSITIES) as Density[]).map((key) => (
                    <PillButton key={key} active={(cfg.appearance.density ?? DEFAULT_APPEARANCE.density) === key} onClick={() => setAppearance("density", key)}>{DENSITIES[key].label}</PillButton>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Corner roundness</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(RADII) as Radius[]).map((key) => (
                    <PillButton key={key} active={(cfg.appearance.radius ?? DEFAULT_APPEARANCE.radius) === key} onClick={() => setAppearance("radius", key)}>{RADII[key].label}</PillButton>
                  ))}
                </div>
              </div>
            </Grid>

            {/* Panel background */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Panel background</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BACKGROUNDS) as BgKey[]).map((key) => {
                  const accent = cfg.appearance.accent ?? DEFAULT_APPEARANCE.accent;
                  const active = (cfg.appearance.bg ?? DEFAULT_APPEARANCE.bg) === key;
                  return (
                    <button key={key} type="button" onClick={() => setAppearance("bg", key)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      <span className="h-5 w-5 rounded border border-slate-200" style={{ background: bgValue(key, accent) }} />
                      {BACKGROUNDS[key].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sidebar colors */}
            <Grid>
              <Field label="Sidebar background">
                <ColorField value={cfg.appearance.sidebarBg ?? DEFAULT_APPEARANCE.sidebarBg} onChange={(v) => setAppearance("sidebarBg", v)} presets={SIDEBAR_BG_PRESETS} />
              </Field>
              <Field label="Sidebar text / icons">
                <ColorField value={cfg.appearance.sidebarText ?? DEFAULT_APPEARANCE.sidebarText} onChange={(v) => setAppearance("sidebarText", v)} presets={SIDEBAR_TEXT_PRESETS} />
              </Field>
            </Grid>

            <Field label="Sidebar active color">
              <div className="flex flex-wrap items-center gap-2">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(cfg.appearance.sidebarAccent ?? "") ? cfg.appearance.sidebarAccent! : "#2563eb"} onChange={(e) => setAppearance("sidebarAccent", e.target.value)} className="h-9 w-10 cursor-pointer rounded-lg border border-slate-300" />
                <button type="button" onClick={() => setAppearance("sidebarAccent", "")} className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${!cfg.appearance.sidebarAccent ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>Follow theme accent</button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">The active menu-item highlight. Leave on “Follow theme accent” to track the accent above.</p>
            </Field>
          </Card>

          <Card title="Default menu" subtitle="The sidebar navigation clients start with — reorder, rename, re-slug, re-icon or hide items. Clients can further tweak their own." right={<button type="button" onClick={() => setNav({ items: {}, groups: {}, order: {} })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Reset menu</button>}>
            <MenuEditor value={cfg.nav} onChange={setNav} />
          </Card>
        </div>
      )}

      {tab === "landing" && (
        <div className="space-y-6">
          <Card title="Hero" subtitle="The headline section of your landing page.">
            <Field label="Hero title" full><Input value={cfg.landing.heroTitle} onChange={(v) => setLanding("heroTitle", v)} /></Field>
            <Field label="Hero subtitle" full><Textarea value={cfg.landing.heroSubtitle} onChange={(v) => setLanding("heroSubtitle", v)} /></Field>
            <Grid>
              <Field label="CTA label"><Input value={cfg.landing.ctaLabel} onChange={(v) => setLanding("ctaLabel", v)} /></Field>
              <Field label="CTA link"><Input value={cfg.landing.ctaUrl} onChange={(v) => setLanding("ctaUrl", v)} /></Field>
            </Grid>
          </Card>
          <Card title="Feature highlights" subtitle="Shown as cards on the landing page.">
            <div className="space-y-2">
              {cfg.landing.features.map((f, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_auto]">
                  <Input value={f.title} onChange={(v) => setCfg((c) => ({ ...c, landing: { ...c.landing, features: c.landing.features.map((x, j) => (j === i ? { ...x, title: v } : x)) } }))} placeholder="Title" />
                  <Input value={f.desc} onChange={(v) => setCfg((c) => ({ ...c, landing: { ...c.landing, features: c.landing.features.map((x, j) => (j === i ? { ...x, desc: v } : x)) } }))} placeholder="Description" />
                  <button onClick={() => setCfg((c) => ({ ...c, landing: { ...c.landing, features: c.landing.features.filter((_, j) => j !== i) } }))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setCfg((c) => ({ ...c, landing: { ...c.landing, features: [...c.landing.features, { icon: "star", title: "New feature", desc: "Description" }] } }))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">+ Add feature</button>
          </Card>
        </div>
      )}

      {tab === "plans" && <PlansTab plans={cfg.plans} onChange={(plans) => setCfg((c) => ({ ...c, plans }))} />}

      {tab === "permissions" && (
        <Card title="Module Permissions" subtitle="Choose which modules each subscription plan can access. Clients only see what their plan unlocks.">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-500">Module</th>
                  {cfg.plans.map((p) => (
                    <th key={p.id} className="border-b border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">
                      <div>{p.name}</div>
                      <div className="mt-1 flex justify-center gap-1 text-[10px] font-medium">
                        <button onClick={() => setCfg((c) => ({ ...c, planFeatures: { ...c.planFeatures, [p.id]: [...ALL_FEATURE_KEYS] } }))} className="rounded px-1.5 py-0.5 text-blue-600 hover:bg-blue-50">All</button>
                        <button onClick={() => setCfg((c) => ({ ...c, planFeatures: { ...c.planFeatures, [p.id]: [] } }))} className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100">None</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLATFORM_FEATURES.map((f, i) => {
                  const newGroup = i === 0 || PLATFORM_FEATURES[i - 1].group !== f.group;
                  return (
                    <Fragment key={f.key}>
                      {newGroup && (
                        <tr>
                          <td colSpan={cfg.plans.length + 1} className="bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{f.group}</td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50">
                        <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2.5">
                          <span className="flex items-center gap-2 font-medium text-slate-700">
                            <Icon name={f.icon as IconName} className="h-4 w-4 text-slate-400" /> {f.label}
                          </span>
                        </td>
                        {cfg.plans.map((p) => {
                          const on = (cfg.planFeatures[p.id] ?? []).includes(f.key);
                          return (
                            <td key={p.id} className="border-b border-slate-100 px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => setCfg((c) => {
                                  const cur = new Set(c.planFeatures[p.id] ?? []);
                                  if (cur.has(f.key)) cur.delete(f.key); else cur.add(f.key);
                                  return { ...c, planFeatures: { ...c.planFeatures, [p.id]: [...cur] } };
                                })}
                                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">Tip: tick a module to include it in that plan. Core areas (Dashboard, Users, Admin Setup, Subscription) are always available.</p>
        </Card>
      )}

      {tab === "reviews" && <ReviewsTab reviews={cfg.reviews} onChange={(reviews) => setCfg((c) => ({ ...c, reviews }))} />}

      {tab === "payments" && (
        <Card title="Razorpay" subtitle="Collect subscription payments from clients.">
          <ToggleRow label="Enable Razorpay" desc="Turn on payment collection across the platform." checked={cfg.payment.enabled} onChange={(v) => setPayment("enabled", v)} />
          <Grid>
            <Field label="Key ID"><Input value={cfg.payment.keyId} onChange={(v) => setPayment("keyId", v)} placeholder="rzp_live_…" /></Field>
            <Field label="Key Secret"><Secret value={cfg.payment.keySecret} onChange={(v) => setPayment("keySecret", v)} placeholder="••••••••" /></Field>
            <Field label="Currency"><SearchSelect value={cfg.payment.currency} onChange={(v) => setPayment("currency", v)} options={["INR", "USD", "EUR", "GBP", "AED"]} /></Field>
            <Field label="Webhook URL"><Input value={cfg.payment.webhookUrl} onChange={(v) => setPayment("webhookUrl", v)} /></Field>
          </Grid>
          <button onClick={() => toast[cfg.payment.keyId ? "success" : "error"](cfg.payment.keyId ? "Razorpay ready" : "Add a Key ID", cfg.payment.keyId ? "Test checkout would open." : "Enter your Razorpay Key ID first.")} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Test checkout</button>
        </Card>
      )}

      {tab === "google" && (
        <Card title="Google Integration" subtitle="Platform-level Gmail, Calendar and Meet for client workspaces.">
          <ToggleRow label="Enable Google" desc="Allow clients to connect Google services." checked={cfg.google.enabled} onChange={(v) => setGoogle("enabled", v)} />
          <Grid>
            <Field label="OAuth Client ID">
              <Input value={cfg.google.clientId} onChange={(v) => { setGoogle("clientId", v); setGtest({ status: "idle", msg: "" }); }} placeholder="xxxx.apps.googleusercontent.com" />
            </Field>
            <Field label="Client Secret"><Secret value={cfg.google.clientSecret} onChange={(v) => setGoogle("clientSecret", v)} placeholder="GOCSPX-…" /></Field>
          </Grid>

          {/* OAuth test */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <button onClick={saveGoogleToServer} disabled={gtest.status === "testing"} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {gtest.status === "testing"
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…</>
                : <><Icon name="shield" className="h-4 w-4" /> Save &amp; configure server</>}
            </button>
            {gtest.status === "ok" && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"><Icon name="check" className="h-3.5 w-3.5" /> {gtest.msg}</span>}
            {gtest.status === "fail" && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700"><Icon name="alert" className="h-3.5 w-3.5" /> {gtest.msg}</span>}
            {gtest.status === "idle" && <span className="text-xs text-slate-400">Sends the Client ID &amp; secret to the backend so Gmail can connect.</span>}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Services available to clients</p>
            <div className="flex flex-wrap gap-2">
              <ChipToggle label="Gmail" icon="gmail" on={cfg.google.gmail} onClick={() => setGoogle("gmail", !cfg.google.gmail)} />
              <ChipToggle label="Calendar" icon="calendar" on={cfg.google.calendar} onClick={() => setGoogle("calendar", !cfg.google.calendar)} />
              <ChipToggle label="Meet" icon="call" on={cfg.google.meet} onClick={() => setGoogle("meet", !cfg.google.meet)} />
            </div>
          </div>
        </Card>
      )}

      {tab === "automation" && (
        <Card title="Automation" subtitle="Platform automations that run for every client.">
          <div className="space-y-2">
            {AUTOMATIONS.map((a) => (
              <ToggleRow key={a.key} label={a.label} desc={a.desc} checked={!!cfg.automation[a.key]} onChange={(v) => setCfg((c) => ({ ...c, automation: { ...c.automation, [a.key]: v } }))} />
            ))}
          </div>
        </Card>
      )}
      </>
      )}
    </div>
  );
}

function PlansTab({ plans, onChange }: { plans: PlatformPlan[]; onChange: (p: PlatformPlan[]) => void }) {
  const upd = (id: string, patch: Partial<PlatformPlan>) => onChange(plans.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <Card title="Subscription Plans" subtitle="Shown on the landing page and used for client upgrades." right={<button onClick={() => onChange([...plans, { id: rid("plan"), name: "New plan", price: 0, period: "mo", features: ["Feature"] }])} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">+ Add plan</button>}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {plans.map((p) => (
          <div key={p.id} className={`rounded-xl border p-4 ${p.highlighted ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-center gap-2">
              <input value={p.name} onChange={(e) => upd(p.id, { name: e.target.value })} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500" />
              <div className="flex items-center rounded-lg border border-slate-300"><span className="px-2 text-sm text-slate-400">$</span><input type="number" value={p.price} onChange={(e) => upd(p.id, { price: Number(e.target.value) })} className="w-20 rounded-r-lg px-1 py-2 text-sm outline-none" /></div>
              <button onClick={() => onChange(plans.filter((x) => x.id !== p.id))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
            </div>
            <textarea value={p.features.join("\n")} onChange={(e) => upd(p.id, { features: e.target.value.split("\n").filter(Boolean) })} rows={4} placeholder="One feature per line" className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-500" />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={!!p.highlighted} onChange={(e) => upd(p.id, { highlighted: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-blue-600" /> Highlight as “most popular”</label>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReviewsTab({ reviews, onChange }: { reviews: Review[]; onChange: (r: Review[]) => void }) {
  const upd = (id: string, patch: Partial<Review>) => onChange(reviews.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <Card title="Client Reviews" subtitle="Testimonials displayed on the landing page." right={<button onClick={() => onChange([{ id: rid("rev"), name: "New client", role: "Role, Company", rating: 5, text: "Great product!" }, ...reviews])} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">+ Add review</button>}>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} placeholder="Name" className="min-w-32 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" />
              <input value={r.role} onChange={(e) => upd(r.id, { role: e.target.value })} placeholder="Role, Company" className="min-w-40 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <SearchableSelect value={String(r.rating)} onChange={(v) => upd(r.id, { rating: Number(v) })} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ★` }))} className="w-28" />
              <button onClick={() => onChange(reviews.filter((x) => x.id !== r.id))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
            </div>
            <textarea value={r.text} onChange={(e) => upd(r.id, { text: e.target.value })} rows={2} placeholder="Review text" className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- building blocks ----------
function Card({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{title}</p>{subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}</div>{right}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>; }

// Small section divider inside a Card — groups related fields for clean alignment.
function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-slate-100 pt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 first:border-t-0 first:pt-0">{children}</p>;
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${active ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{children}</button>
  );
}

// Hex color input with a native picker + preset swatches.
function ColorField({ value, onChange, presets }: { value: string; onChange: (v: string) => void; presets: string[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-300" />
        <Input value={value} onChange={onChange} placeholder="#ffffff" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p} type="button" onClick={() => onChange(p)} title={p} aria-label={p}
            className={`h-6 w-6 rounded-md ${value.toLowerCase() === p.toLowerCase() ? "ring-2 ring-slate-900 ring-offset-1" : "border border-slate-300"}`}
            style={{ background: p }} />
        ))}
      </div>
    </div>
  );
}

// Upload-or-URL image field. Hides long data: URLs behind a friendly chip so the
// textarea isn't flooded with base64, and still allows pasting a remote URL.
function ImageUploadField({ label, value, onChange, preview, hint, successMsg }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  preview: React.ReactNode;
  hint?: string;
  successMsg: [string, string];
}) {
  const toast = useToast();
  const isUploaded = value.startsWith("data:");
  return (
    <Field label={label} full>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          {preview}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Icon name="upload" className="h-4 w-4 text-slate-500" /> Upload image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  onChange(await readLogo(file));
                  toast.success(successMsg[0], successMsg[1]);
                } catch (err) {
                  toast.error("Couldn't use that image", err instanceof Error ? err.message : "Try another file.");
                }
              }}
            />
          </label>
          {value && <button type="button" onClick={() => onChange("")} className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">Remove</button>}
        </div>
        {isUploaded ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            <Icon name="check" className="h-3.5 w-3.5" /> Uploaded image embedded — the URL is hidden for readability.
          </div>
        ) : (
          <Input value={value} onChange={onChange} placeholder="…or paste an image URL: https://…" />
        )}
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
    </Field>
  );
}
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "sm:col-span-2" : ""}><label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>{children}</div>;
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20" />;
}
function SizeRange({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const min = 40, max = 100;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs font-medium text-slate-500">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="range-slim flex-1 cursor-pointer"
        style={{ background: `linear-gradient(to right, #2563eb ${pct}%, #e2e8f0 ${pct}%)` }}
      />
      <span className="w-11 shrink-0 rounded-md bg-white px-1.5 py-0.5 text-center text-[11px] font-bold text-blue-700 ring-1 ring-slate-200">{value}%</span>
    </div>
  );
}
function Textarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20" />;
}
function Secret({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs outline-none transition focus:border-blue-500 focus:bg-white" />
      <button type="button" onClick={() => setShow((s) => !s)} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50"><Icon name="eye" className="h-4 w-4" /></button>
    </div>
  );
}
function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
      <div><p className="text-sm font-medium text-slate-800">{label}</p><p className="text-xs text-slate-500">{desc}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} /></button>
    </div>
  );
}
function ChipToggle({ label, icon, on, onClick }: { label: string; icon: IconName; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${on ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-500"}`}>
      <Icon name={icon} className="h-4 w-4" /> {label} <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-slate-300"}`} />
    </button>
  );
}

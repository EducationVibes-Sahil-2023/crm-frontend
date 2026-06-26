"use client";
/* eslint-disable @next/next/no-img-element -- arbitrary client-configured logo URLs */

import { useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { loadPlatform, money } from "@/lib/platform";

export default function LandingPage() {
  const [cfg] = useState(loadPlatform);
  const accent = cfg.brand.primaryColor || "#2563eb";

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white" style={{ backgroundColor: accent }}>
              {cfg.brand.logoUrl ? <img src={cfg.brand.logoUrl} alt="" className="h-full w-full object-cover" /> : cfg.brand.logoText}
            </span>
            <span className="text-lg font-bold text-slate-900">{cfg.brand.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="#pricing" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">Pricing</a>
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>
            <Link href={cfg.landing.ctaUrl || "/login"} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: accent }}>{cfg.landing.ctaLabel}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 20% 10%, ${accent}, transparent 45%), radial-gradient(circle at 85% 30%, ${accent}, transparent 40%)` }} />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {cfg.brand.tagline}</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">{cfg.landing.heroTitle}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">{cfg.landing.heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={cfg.landing.ctaUrl || "/login"} className="rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg" style={{ backgroundColor: accent }}>{cfg.landing.ctaLabel}</Link>
            <a href="#pricing" className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">View pricing</a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cfg.landing.features.map((f, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: accent }}><Icon name={(f.icon as IconName) || "star"} className="h-5 w-5" /></span>
              <p className="mt-3 font-bold text-slate-900">{f.title}</p>
              <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">Simple, transparent pricing</h2>
            <p className="mt-2 text-slate-500">Start free, upgrade as you grow. {cfg.payment.enabled ? "Billed securely via Razorpay." : ""}</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cfg.plans.map((p) => (
              <div key={p.id} className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${p.highlighted ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"}`}>
                {p.highlighted && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: accent }}>Most popular</span>}
                <p className="text-base font-bold text-slate-900">{p.name}</p>
                <p className="mt-2"><span className="text-3xl font-extrabold text-slate-900">{money(p.price)}</span>{p.price > 0 && <span className="text-sm text-slate-400">/{p.period}</span>}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-slate-600"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {f}</li>
                  ))}
                </ul>
                <Link href={cfg.landing.ctaUrl || "/login"} className={`mt-5 rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${p.highlighted ? "text-white shadow-sm" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`} style={p.highlighted ? { backgroundColor: accent } : undefined}>
                  {p.price === 0 ? "Get started" : "Upgrade"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      {cfg.reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-center"><h2 className="text-3xl font-bold text-slate-900">Loved by teams everywhere</h2></div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Icon key={i} name="star" filled={i < r.rating} className={`h-4 w-4 ${i < r.rating ? "text-amber-400" : "text-slate-200"}`} />)}</div>
                <p className="mt-3 text-sm text-slate-600">“{r.text}”</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: accent }}>{r.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                  <div><p className="text-sm font-semibold text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.role}</p></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-12 text-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${accent}, #1e1b4b)` }}>
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="mx-auto mt-2 max-w-xl text-white/80">Spin up your workspace in minutes — your own isolated database included.</p>
          <Link href={cfg.landing.ctaUrl || "/login"} className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100">{cfg.landing.ctaLabel}</Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        © {cfg.brand.name}. All rights reserved.
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { initials } from "@/lib/branding";
import { isAuthenticated } from "@/lib/auth";
import { captureLead, makeIntakeLead } from "@/lib/leadStore";
import { startTrial, TRIAL_DAYS } from "@/lib/trial";
import { addDemo } from "@/lib/demos";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import SearchSelect from "@/components/SearchSelect";
import RotatingWord from "@/components/RotatingWord";
import { usePlatform } from "@/lib/platform";

// Stable Unsplash imagery (CDN) — professional product/office photography.
const IMG = {
  dashboard: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1280&q=80",
  team: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1100&q=80",
  cta: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  capture: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1100&q=80",
  engage: "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1100&q=80",
  grow: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1100&q=80",
  mobile: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1100&q=80",
};

const STEPS = [
  { n: 1, icon: "leads", img: "capture", title: "Capture every lead", desc: "Enquiries flow in automatically from your website, calls, WhatsApp, IndiaMART and more — nothing is lost." },
  { n: 2, icon: "refresh", img: "engage", title: "Engage & follow up", desc: "Auto-assign owners, set reminders and track every call and task so you follow up on time, every time." },
  { n: 3, icon: "trendUp", img: "grow", title: "Close & grow", desc: "Quote, invoice, collect payments and watch live dashboards show exactly what's working." },
] as const;

const CONTACT_FALLBACK = { phone: "+91 98765 43210", email: "sales@nexuscrm.in" };

const MODULES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "users", title: "HR Software", desc: "Central employee records, documents and org structure." },
  { icon: "phone", title: "Mobile Attendance App", desc: "GPS + selfie punch-in from the field, on iOS & Android." },
  { icon: "clock", title: "Time & Attendance", desc: "Shifts, late marks and worked hours tracked automatically." },
  { icon: "calendar", title: "Leave Management", desc: "Apply, approve and track leave with balances and policies." },
  { icon: "leads", title: "CRM Software", desc: "Capture leads, manage the pipeline and close more deals." },
  { icon: "payment", title: "Payroll Software", desc: "Run payroll with your rules and auto-generate payslips." },
  { icon: "ticket", title: "Claims Management", desc: "Submit and approve expense & medical claims online." },
  { icon: "win", title: "Performance Appraisal", desc: "Goals, reviews and ratings to grow your people." },
  { icon: "chat", title: "Employee Engagement", desc: "Awards, posts, events and announcements in one feed." },
  { icon: "briefcase", title: "Human Resource Suite", desc: "End-to-end HR operations unified in one platform." },
  { icon: "search", title: "Applicant Tracking", desc: "Post jobs, screen candidates and hire faster." },
  { icon: "knowledge", title: "Learning Management", desc: "Courses, training and progress tracking for staff." },
  { icon: "pin", title: "Field Tracking", desc: "Live location and visits for your field workforce." },
];

const INDUSTRIES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "asset", title: "Automobile", desc: "Dealerships & service centres — leads, AMC reminders, parts stock and field staff." },
  { icon: "shield", title: "Healthcare", desc: "Clinics & hospitals — patient enquiries, staff rosters, attendance and compliance." },
  { icon: "inventory", title: "Manufacturing", desc: "Plants — workforce attendance, payroll, inventory and dealer/distributor sales." },
  { icon: "revenue", title: "Retail", desc: "Stores & chains — walk-in leads, staff payroll, shift scheduling and stock." },
];

const CHANNELS = ["Website", "Facebook", "IndiaMART", "JustDial", "WhatsApp", "SMS", "IVR Calls", "Email"];

const ADVANTAGES = [
  { icon: "trendUp", title: "Close more deals", desc: "Timely follow-ups and a clear pipeline mean fewer leads go cold." },
  { icon: "refresh", title: "Automate the busywork", desc: "Auto-capture leads, auto-assign owners and auto-remind on follow-ups." },
  { icon: "shield", title: "Secure & role-based", desc: "Two-step verification, roles and per-user access keep data safe." },
  { icon: "phone", title: "Works on mobile", desc: "Native iOS & Android apps so your field team works on the go." },
  { icon: "activity", title: "Live dashboards", desc: "Real-time insight into sales, collections, attendance and stock." },
  { icon: "chat", title: "Friendly support", desc: "Onboarding help and responsive support whenever you need it." },
];

const STATS: { num?: number; decimals?: number; suffix?: string; text?: string; label: string }[] = [
  { num: 1200, suffix: "+", label: "Businesses onboarded" },
  { num: 4.9, decimals: 1, suffix: "★", label: "Average customer rating" },
  { num: 30, suffix: " days", label: "Free trial, no card" },
  { text: "24×7", label: "Support & onboarding" },
];

const TESTIMONIALS = [
  { quote: "Our follow-up rate doubled in the first month. Nothing falls through the cracks now.", name: "Rahul Mehta", role: "Director, Mehta Industries" },
  { quote: "CRM, payroll and inventory in one login saved us three separate subscriptions.", name: "Priya Nair", role: "Founder, BrightEdu" },
  { quote: "The AI assistant tells me exactly which leads to chase each morning. Brilliant.", name: "Arjun Shah", role: "Sales Head, Shah Motors" },
];

export default function Landing() {
  const router = useRouter();
  const toast = useToast();
  const [authed, setAuthed] = useState(false);
  const [modal, setModal] = useState<"demo" | "trial" | null>(null);
  // Branding + contact are all managed by Super Admin → Platform Settings → Branding,
  // and update live here as soon as they're saved.
  const platform = usePlatform();
  const brand = {
    appName: platform.brand.name || "Nexus CRM",
    logo: platform.brand.logoUrl || null,
    mark: platform.brand.logoText || initials(platform.brand.name || "Nexus CRM"),
    color: platform.brand.primaryColor || "#2563eb",
    logoBg: platform.brand.logoBg || platform.brand.primaryColor || "#2563eb",
  };
  const CONTACT = {
    phone: platform.brand.phone || CONTACT_FALLBACK.phone,
    email: platform.brand.email || CONTACT_FALLBACK.email,
  };

  useEffect(() => setAuthed(isAuthenticated()), []);

  function captureDemo(lead: LeadFields & { users?: string; message?: string }) {
    captureLead(makeIntakeLead({ ...lead, referenceName: "Demo Request" }, "Website Form", { status: "New", type: "Warm" }));
    const demo = addDemo(lead);
    toast.success("Demo booked!", `We'll meet on ${new Date(demo.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} — a Google Meet invite is on its way.`);
    setModal(null);
  }
  function startTrialFlow(lead: LeadFields) {
    captureLead(makeIntakeLead({ ...lead, referenceName: "Free Trial" }, "Website Form", { status: "New", type: "Hot" }));
    startTrial({ name: lead.name, email: lead.email, company: lead.company, source: "form" });
    toast.success(`Your ${TRIAL_DAYS}-day free trial is active 🎉`, "Sign in to get started — we've prefilled your email.");
    setModal(null);
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-white text-slate-900" style={{ "--brand": brand.color, "--logobg": brand.logoBg } as React.CSSProperties}>
      {/* Top contact bar */}
      <div className="hidden bg-slate-900 text-slate-200 sm:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2 text-xs">
          <div className="flex items-center gap-5">
            <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-white">
              <Icon name="phone" className="h-3.5 w-3.5" /> {CONTACT.phone}
            </a>
            <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-1.5 hover:text-white">
              <Icon name="gmail" className="h-3.5 w-3.5" /> {CONTACT.email}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {TRIAL_DAYS}-day free trial</span>
            <Link href="/login" className="hover:text-white">Customer Login</Link>
          </div>
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[var(--logobg)] text-sm font-bold text-white">
              {brand.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo} alt={brand.appName} className="h-full w-full object-cover" />
              ) : (
                brand.mark
              )}
            </span>
            <span className="text-lg font-extrabold tracking-tight">{brand.appName}</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            <a href="#modules" className="hover:text-blue-600">Solutions</a>
            <a href="#industries" className="hover:text-blue-600">Industries</a>
            <a href="#why" className="hover:text-blue-600">Why us</a>
            <a href="#pricing" className="hover:text-blue-600">Pricing</a>
          </nav>

          <div className="flex items-center gap-2">
            {authed ? (
              <Link href="/dashboard" className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <button onClick={() => setModal("trial")} className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:block">
                  Free Trial
                </button>
                <button onClick={() => setModal("demo")} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 hover:shadow-md">
                  Book Free Demo
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero with inline enquiry form */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="nx-blob pointer-events-none absolute -right-32 -top-24 h-96 w-96 rounded-full bg-blue-300/40 blur-3xl" />
        <div className="nx-blob pointer-events-none absolute -left-24 top-40 h-80 w-80 rounded-full bg-indigo-300/30 blur-3xl" style={{ animationDelay: "4s" }} />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1.1fr,0.9fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/80 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700 shadow-sm backdrop-blur">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white"><Icon name="win" className="h-2.5 w-2.5" /></span>
              India&apos;s all-in-one CRM + HRMS
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Stop your <RotatingWord words={["leads", "follow-ups", "enquiries", "payments", "deals"]} className="nx-gradient-text" /> from slipping every day
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              {brand.appName} brings your sales, team and operations into one easy, affordable platform —
              capture every enquiry, never miss a follow-up, and run CRM, HRMS, billing and inventory together.
            </p>
            <ul className="mt-6 grid max-w-lg gap-2 sm:grid-cols-2">
              {["Auto-capture leads from every channel", "Follow-up reminders & call tracking", "HRMS, payroll & attendance built in", "Mobile app for your field team"].map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Icon name="check" className="h-3 w-3" /></span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={() => setModal("trial")} className="rounded-xl bg-[var(--brand)] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 hover:shadow-xl active:scale-[0.99]">
                Start {TRIAL_DAYS}-day free trial
              </button>
              <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <Icon name="phone" className="h-4 w-4 text-blue-600" /> {CONTACT.phone}
              </a>
            </div>
          </div>

          {/* Inline demo form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-extrabold">Book your free demo</h2>
            <p className="mt-1 text-sm text-slate-500">See {brand.appName} in action. No credit card required.</p>
            <HeroForm onSubmit={captureDemo} />
          </div>
        </div>

        {/* Channels strip */}
        <div className="border-t border-slate-100 bg-white/70">
          <div className="mx-auto max-w-6xl px-5 py-5">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">Capture leads automatically from</p>
            <div className="nx-marquee-mask mt-3 overflow-hidden">
              <div className="nx-marquee gap-2.5 py-1">
                {[...CHANNELS, ...CHANNELS].map((c, i) => (
                  <span key={`${c}-${i}`} className="mr-2.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm">{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">How it works</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Up and running in three simple steps</h2>
          <p className="mt-3 text-slate-600">From first enquiry to closed deal — {brand.appName} guides every step.</p>
        </Reveal>
        <div className="relative mt-14 grid gap-10 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-[88px] hidden h-0.5 bg-gradient-to-r from-blue-200 via-indigo-300 to-blue-200 md:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 140} className="relative text-center">
              <div className="relative mx-auto h-44 max-w-[280px] overflow-hidden rounded-2xl shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG[s.img]} alt={s.title} className="h-full w-full object-cover transition duration-500 hover:scale-105" loading="lazy" />
                <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-600 shadow">{s.n}</span>
              </div>
              <span className="relative z-10 mx-auto -mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg ring-4 ring-white">
                <Icon name={s.icon} className="h-6 w-6" />
              </span>
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-600">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl px-5 py-20 pt-0">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">Complete HR + CRM suite</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Every tool your business needs, in one login</h2>
          <p className="mt-3 text-slate-600">From hiring to payroll to closing deals — stop juggling separate subscriptions. Run it all from {brand.appName}.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <Reveal key={m.title} delay={(i % 3) * 80}>
              <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-xl">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white transition group-hover:scale-110">
                  <Icon name={m.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-bold">{m.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{m.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">Built for your industry</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Tailored to how you work</h2>
            <p className="mt-3 text-slate-600">{brand.appName} adapts to the workflows of the industries we serve.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((ind, i) => (
              <Reveal key={ind.title} delay={i * 90}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-xl">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                    <Icon name={ind.icon} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{ind.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{ind.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard showcase — real imagery + floating stats */}
      <section className="relative overflow-hidden py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">One dashboard</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Run your whole business from one screen</h2>
            <p className="mt-3 text-slate-600">
              Real-time numbers on sales, collections, attendance and stock — with an AI assistant that tells your team what to do next.
            </p>
            <ul className="mt-5 space-y-2.5">
              {["Live pipeline, revenue and conversion metrics", "Today's follow-ups, tasks and pending approvals", "Low-stock alerts and collection summaries", "Works on web, iOS and Android"].map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Icon name="check" className="h-3 w-3" /></span>
                  {p}
                </li>
              ))}
            </ul>
            <button onClick={() => setModal("trial")} className="mt-7 rounded-xl bg-[var(--brand)] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl">
              Try it free for {TRIAL_DAYS} days
            </button>
          </Reveal>

          <Reveal delay={120} className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-blue-200/50 to-indigo-200/50 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.dashboard} alt={`${brand.appName} dashboard`} className="h-full w-full object-cover" loading="lazy" />
            </div>
            {/* floating stat cards */}
            <div className="nx-float absolute -left-5 top-8 hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:block">
              <p className="text-[11px] font-medium text-slate-400">This month</p>
              <p className="text-lg font-extrabold text-slate-900">₹12.4L <span className="text-xs font-semibold text-emerald-600">▲ 18%</span></p>
            </div>
            <div className="nx-float absolute -right-4 bottom-8 hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:block" style={{ animationDelay: "1.5s" }}>
              <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white"><Icon name="ai" className="h-3.5 w-3.5" /></span>
                3 leads to follow up
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Mobile app explainer */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="relative order-2 lg:order-1">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-indigo-200/50 to-blue-200/50 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.mobile} alt={`${brand.appName} mobile app`} className="h-[320px] w-full object-cover sm:h-[380px]" loading="lazy" />
            </div>
            <div className="nx-float absolute -right-4 top-10 hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:block">
              <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500 text-white"><Icon name="check" className="h-3.5 w-3.5" /></span>
                Checked in · 9:02 AM
              </p>
            </div>
          </Reveal>
          <Reveal delay={120} className="order-1 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">Mobile app</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Run your field team from your pocket</h2>
            <p className="mt-3 text-slate-600">Native iOS &amp; Android apps keep sales and field staff productive anywhere — capture leads, punch attendance and act on reminders on the go.</p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {["GPS + selfie attendance", "Capture leads on the move", "Push notifications & reminders", "Live field tracking"].map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Icon name="check" className="h-3 w-3" /></span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Icon name="apple" className="h-5 w-5" /> App Store</span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Icon name="android" className="h-5 w-5" /> Google Play</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why choose */}
      <section id="why" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">Why {brand.appName}</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Built to grow your business</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ADVANTAGES.map((a, i) => (
            <Reveal key={a.title} delay={(i % 3) * 80}>
              <div className="flex h-full gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon name={a.icon as IconName} className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold">{a.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{a.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-12 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold sm:text-4xl">
                {s.text ? s.text : <CountUp value={s.num ?? 0} decimals={s.decimals ?? 0} suffix={s.suffix ?? ""} />}
              </p>
              <p className="mt-1 text-sm text-blue-100">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">Loved by business owners</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Trusted by growing teams</h2>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 90} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex gap-0.5 text-amber-400">{"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">“{t.quote}”</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">{initials(t.name)}</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing / trial CTA */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 pb-20">
        <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 px-8 py-14 text-center text-white shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.cta} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-overlay" loading="lazy" />
          <div className="nx-blob pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Start free for {TRIAL_DAYS} days</h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-100">Get the full platform — CRM, HRMS, billing, inventory and AI. No credit card, cancel anytime.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => setModal("trial")} className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-blue-700 shadow-lg transition hover:bg-blue-50 active:scale-[0.99]">
              Start free trial
            </button>
            <button onClick={() => setModal("demo")} className="rounded-xl border border-white/40 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">
              Book a free demo
            </button>
          </div>
          <p className="mt-4 text-xs text-blue-100/80">Plans from ₹599/user/mo · GST invoicing · onboarding included</p>
        </Reveal>
      </section>

      {/* Footer / contact */}
      <footer id="contact" className="border-t border-slate-100 bg-slate-900 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[var(--logobg)] text-sm font-bold text-white">
                {brand.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  brand.mark
                )}
              </span>
              <span className="text-lg font-extrabold text-white">{brand.appName}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">All-in-one CRM + HRMS to capture leads, close deals and run your team.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#modules" className="hover:text-white">Features</a></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              <li><Link href="/login" className="hover:text-white">Customer login</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Company</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#why" className="hover:text-white">Why us</a></li>
              <li><button onClick={() => setModal("demo")} className="hover:text-white">Book a demo</button></li>
              <li><button onClick={() => setModal("trial")} className="hover:text-white">Free trial</button></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Contact</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-white"><Icon name="phone" className="h-4 w-4" /> {CONTACT.phone}</a></li>
              <li><a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 hover:text-white"><Icon name="gmail" className="h-4 w-4" /> {CONTACT.email}</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">© 2026 {brand.appName}. All rights reserved.</div>
      </footer>

      {modal && (
        <SignupModal
          mode={modal}
          brandName={brand.appName}
          onClose={() => setModal(null)}
          onDemo={captureDemo}
          onTrial={startTrialFlow}
        />
      )}
    </main>
  );
}

type LeadFields = { name: string; email: string; company: string; phone?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_OPTIONS = ["1–5 users", "6–15 users", "16–50 users", "50+ users"];

/* Inline hero enquiry form (Book a free demo). */
function HeroForm({ onSubmit }: { onSubmit: (lead: LeadFields & { users?: string }) => void }) {
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", users: USER_OPTIONS[0] });
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Enter your name.";
    if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email.";
    if (form.phone.replace(/\D/g, "").length < 8) next.phone = "Enter a valid phone number.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit(form);
    setForm({ name: "", company: "", email: "", phone: "", users: USER_OPTIONS[0] });
  }

  const f = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20";
  const fe = "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20";

  return (
    <form onSubmit={submit} noValidate className="mt-5 space-y-3">
      <div>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name *" className={`${f} ${errors.name ? fe : ""}`} />
        {errors.name && <p className="mt-1 text-xs font-medium text-red-600">{errors.name}</p>}
      </div>
      <input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Company name" className={f} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Work email *" className={`${f} ${errors.email ? fe : ""}`} />
          {errors.email && <p className="mt-1 text-xs font-medium text-red-600">{errors.email}</p>}
        </div>
        <div>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone *" className={`${f} ${errors.phone ? fe : ""}`} />
          {errors.phone && <p className="mt-1 text-xs font-medium text-red-600">{errors.phone}</p>}
        </div>
      </div>
      <SearchSelect value={form.users} onChange={(v) => set("users", v)} options={USER_OPTIONS} searchable={false} />
      <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl active:scale-[0.99]">
        Book my free demo
      </button>
      <p className="text-center text-[11px] text-slate-400">We&apos;ll call you to schedule. No spam, ever.</p>
    </form>
  );
}

/* Modal for the "Free trial" / "Book demo" buttons elsewhere on the page. */
function SignupModal({
  mode, brandName, onClose, onDemo, onTrial,
}: {
  mode: "demo" | "trial";
  brandName: string;
  onClose: () => void;
  onDemo: (lead: LeadFields & { users?: string; message?: string }) => void;
  onTrial: (lead: LeadFields) => void;
}) {
  const isDemo = mode === "demo";
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const lead: LeadFields = { name: form.name, email: form.email, company: form.company, phone: form.phone };
    if (isDemo) onDemo({ ...lead, message: form.message });
    else onTrial(lead);
  }

  const field = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20";
  const errField = "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white">
            <Icon name="close" className="h-5 w-5" />
          </button>
          <h3 className="text-xl font-bold">{isDemo ? "Book a free demo" : "Start your free trial"}</h3>
          <p className="mt-1 text-sm text-blue-100">
            {isDemo ? `See ${brandName} in action with a personalised walkthrough.` : `Full access to every module, free for ${TRIAL_DAYS} days. No card needed.`}
          </p>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Doe" className={`${field} ${errors.name ? errField : ""}`} />
            {errors.name && <p className="mt-1 text-xs font-medium text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Work email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@company.com" className={`${field} ${errors.email ? errField : ""}`} />
            {errors.email && <p className="mt-1 text-xs font-medium text-red-600">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Company</label>
              <input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Inc." className={field} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Optional" className={field} />
            </div>
          </div>
          {isDemo && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">What would you like to see?</label>
              <textarea value={form.message} onChange={(e) => set("message", e.target.value)} rows={2} placeholder="Optional" className={`${field} resize-none`} />
            </div>
          )}
          <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl active:scale-[0.99]">
            {isDemo ? "Request demo" : "Start free trial"}
          </button>
        </form>
      </div>
    </div>
  );
}

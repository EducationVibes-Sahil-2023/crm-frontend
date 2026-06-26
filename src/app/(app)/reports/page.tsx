"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

type ReportCard = {
  title: string;
  href: string;
  icon: IconName;
  desc: string;
  tone: string;
  points: string[];
};

const REPORTS: ReportCard[] = [
  {
    title: "Sales Report",
    href: "/reports/sales",
    icon: "revenue",
    tone: "bg-emerald-100 text-emerald-600",
    desc: "Revenue, collections and quotation conversion across your pipeline.",
    points: ["Revenue & paid vs outstanding", "Monthly sales trend", "Top customers", "Quote → invoice conversion"],
  },
  {
    title: "Leads Report",
    href: "/reports/leads",
    icon: "leads",
    tone: "bg-blue-100 text-blue-600",
    desc: "Lead volume, status funnel, sources and counsellor performance.",
    points: ["Status funnel & win rate", "By source & type", "Counsellor leaderboard", "City / state spread"],
  },
  {
    title: "Inventory Report",
    href: "/reports/inventory",
    icon: "inventory",
    tone: "bg-violet-100 text-violet-600",
    desc: "Stock valuation, low-stock alerts, categories and movements.",
    points: ["Stock valuation", "Low / out of stock", "Value by category", "Recent stock movements"],
  },
  {
    title: "Financial Report",
    href: "/account-reports",
    icon: "trendUp",
    tone: "bg-amber-100 text-amber-600",
    desc: "Profit & loss, receivables aging and spending trends.",
    points: ["P&L summary", "Income vs expenses", "Receivables aging", "Top expense categories"],
  },
];

export default function ReportsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Analytics across sales, leads, inventory and finance. Pick a report to dive in.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${r.tone}`}>
                <Icon name={r.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
                  {r.title}
                  <Icon name="chevronDown" className="h-4 w-4 -rotate-90 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">{r.desc}</p>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {r.points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-xs text-slate-500">
                  <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {p}
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
    </div>
  );
}

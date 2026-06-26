"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const TABS: { label: string; href: string; icon: IconName; match: string }[] = [
  { label: "Home", href: "/dashboard", icon: "dashboard", match: "/dashboard" },
  { label: "Leads", href: "/leads", icon: "leads", match: "/leads" },
  { label: "HRMS", href: "/hrms", icon: "users", match: "/hrms" },
  { label: "Tasks", href: "/tasks", icon: "task", match: "/tasks" },
];

export default function MobileTabBar({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(0,0,0,0.04)] backdrop-blur lg:hidden">
      {TABS.map((t) => {
        const active = pathname === t.match || pathname.startsWith(t.match + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
              active ? "text-blue-600" : "text-slate-500"
            }`}
          >
            <Icon name={t.icon} className="h-5 w-5" filled={active} />
            {t.label}
          </Link>
        );
      })}
      <button
        onClick={onMenu}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"
        aria-label="Open menu"
      >
        <Icon name="menu" className="h-5 w-5" />
        Menu
      </button>
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AuthGuard from "@/components/AuthGuard";
import AppearanceProvider from "@/components/AppearanceProvider";
import BrandingProvider from "@/components/BrandingProvider";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MobileTabBar from "@/components/MobileTabBar";

const ChatWidget = dynamic(() => import("@/components/ChatWidget"), { ssr: false });

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar_collapsed") === "1");
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <AuthGuard>
      <AppearanceProvider />
      <BrandingProvider />
      <div className="flex h-screen overflow-hidden bg-slate-100">
        {/* Sidebar (desktop) */}
        <div className="hidden shrink-0 lg:block">
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        </div>

        {/* Sidebar (mobile drawer) — always expanded */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full">
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setOpen(true)} onToggleCollapse={toggleCollapse} />
          <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:pb-6">{children}</main>
        </div>

        <MobileTabBar onMenu={() => setOpen(true)} />
        <ChatWidget />
      </div>
    </AuthGuard>
  );
}

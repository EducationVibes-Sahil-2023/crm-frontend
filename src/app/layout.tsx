import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import PwaRegister from "@/components/PwaRegister";
import MobileBridge from "@/components/MobileBridge";
import BrandHead from "@/components/BrandHead";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

// Resolve the favicon + title on the SERVER from the saved platform config, so
// the custom favicon is in the initial HTML <head> and shows the moment the page
// loads (on reload) — instead of flashing the default and swapping in after
// hydration. BrandHead still handles live updates without a reload.
export async function generateMetadata(): Promise<Metadata> {
  let favicon = "/icon.svg";
  let title = "Nexus CRM & HRMS";
  try {
    const res = await fetch(`${API_BASE}/platform`, { next: { revalidate: 60 } });
    if (res.ok) {
      const brand = (await res.json())?.config?.brand ?? {};
      if (typeof brand.favicon === "string" && brand.favicon) favicon = brand.favicon;
      if (typeof brand.name === "string" && brand.name.trim()) title = brand.name.trim();
    }
  } catch {
    /* backend offline — fall back to the build-time defaults */
  }
  return {
    title,
    description: "All-in-one CRM + HRMS — leads, tasks, payroll, attendance and more.",
    manifest: "/manifest.webmanifest",
    applicationName: "Nexus",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Nexus" },
    icons: { icon: favicon, apple: favicon },
  };
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
        <BrandHead />
        <PwaRegister />
        <MobileBridge />
      </body>
    </html>
  );
}

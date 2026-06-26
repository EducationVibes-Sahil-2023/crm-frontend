"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { listEmployees } from "@/lib/hr";
import { distanceMeters, loadLocations, nearestLocation } from "@/lib/locations";
import { fmtCoord, osmEmbed, watchLocation, type TrackPoint } from "@/lib/mobile";

const AVATAR = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
function durLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

type Field = { name: string; designation: string; lat: number; lng: number; status: "live" | "idle" | "offline"; agoLabel: string; office: string; dist: number };

function buildTeam(): Field[] {
  const locs = loadLocations();
  const base = locs[0] ?? { name: "Office", latitude: 19.06, longitude: 72.83, radius: 100 };
  return listEmployees().map((e, i) => {
    const office = locs[i % Math.max(1, locs.length)] ?? base;
    const lat = office.latitude + ((i % 5) - 2) * 0.006 + (i % 3) * 0.001;
    const lng = office.longitude + ((i % 4) - 1.5) * 0.006;
    const status = (i % 4 === 0 ? "offline" : i % 3 === 0 ? "idle" : "live") as Field["status"];
    const seconds = status === "idle" ? 600 + i * 40 : 5 + i * 3;
    return {
      name: e.name, designation: e.designation, lat, lng, status,
      agoLabel: status === "offline" ? "Offline" : durLabel(seconds),
      office: office.name,
      dist: distanceMeters(lat, lng, office.latitude, office.longitude),
    };
  });
}

export default function LiveTrackingPage() {
  const toast = useToast();
  const [tracking, setTracking] = useState(false);
  const [point, setPoint] = useState<TrackPoint | null>(null);
  const [trail, setTrail] = useState<TrackPoint[]>([]);
  const [mapPoint, setMapPoint] = useState<TrackPoint | null>(null);
  const [error, setError] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const team = useMemo(() => buildTeam(), []);

  useEffect(() => () => { stopRef.current?.(); }, []);

  function start() {
    setError("");
    setTracking(true);
    setTrail([]);
    stopRef.current = watchLocation(
      (p) => {
        setPoint(p);
        setTrail((t) => [...t.slice(-199), p]);
        setMapPoint((prev) => (!prev || distanceMeters(prev.lat, prev.lng, p.lat, p.lng) > 8 ? p : prev));
      },
      (msg) => { setError(msg); setTracking(false); stopRef.current?.(); stopRef.current = null; toast.error("Tracking failed", msg); },
    );
    toast.success("Live tracking started", "Your location is being shared.");
  }
  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    setTracking(false);
    toast.info("Tracking stopped", "Your location is no longer shared.");
  }

  const totalDist = useMemo(() => {
    let d = 0;
    for (let i = 1; i < trail.length; i++) d += distanceMeters(trail[i - 1].lat, trail[i - 1].lng, trail[i].lat, trail[i].lng);
    return d;
  }, [trail]);
  const near = point ? nearestLocation(point.lat, point.lng) : null;
  const speedKmh = point?.speed != null && point.speed >= 0 ? (point.speed * 3.6).toFixed(1) : "0.0";

  const liveCount = team.filter((t) => t.status === "live").length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-sm sm:p-6">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_20%,white,transparent_45%),radial-gradient(circle_at_88%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="pin" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Live Location Tracking</h1>
              <p className="mt-0.5 text-sm text-emerald-100">Real-time GPS for field staff · {liveCount} live now</p>
            </div>
          </div>
          {tracking ? (
            <button onClick={stop} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-rose-600 shadow hover:bg-rose-50">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Stop sharing
            </button>
          ) : (
            <button onClick={start} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 shadow hover:bg-emerald-50">
              <Icon name="pin" className="h-4 w-4" /> Start tracking
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Map + my location */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-[16/10] w-full bg-slate-100">
              {mapPoint ? (
                <iframe title="Live map" className="h-full w-full" src={osmEmbed(mapPoint.lat, mapPoint.lng)} loading="lazy" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <Icon name="pin" className="h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm">{error ? error : "Start tracking to see your live position on the map."}</p>
                </div>
              )}
              {tracking && <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live</span>}
            </div>
            {point && (
              <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
                <Metric label="Latitude" value={fmtCoord(point.lat)} />
                <Metric label="Longitude" value={fmtCoord(point.lng)} />
                <Metric label="Accuracy" value={`±${Math.round(point.accuracy ?? 0)} m`} />
                <Metric label="Speed" value={`${speedKmh} km/h`} />
              </div>
            )}
          </div>

          {point && (
            <div className="grid grid-cols-3 gap-3">
              <Mini icon="activity" label="Points" value={String(trail.length)} />
              <Mini icon="trendUp" label="Distance" value={totalDist >= 1000 ? `${(totalDist / 1000).toFixed(2)} km` : `${Math.round(totalDist)} m`} />
              <Mini icon="briefcase" label={near ? `Near ${near.location.name}` : "Office"} value={near ? `${near.distance.toLocaleString()} m` : "—"} tone={near?.within ? "emerald" : "amber"} />
            </div>
          )}
        </div>

        {/* Team */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <p className="text-sm font-semibold text-slate-800">Field staff</p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{liveCount} live</span>
          </div>
          <div className="no-scrollbar max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {team.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR[i % AVATAR.length]}`}>
                  {initials(t.name)}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${t.status === "live" ? "bg-emerald-500" : t.status === "idle" ? "bg-amber-400" : "bg-slate-300"}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                  <p className="truncate text-xs text-slate-400">{fmtCoord(t.lat)}, {fmtCoord(t.lng)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${t.status === "live" ? "text-emerald-600" : t.status === "idle" ? "text-amber-600" : "text-slate-400"}`}>{t.agoLabel}</p>
                  <p className="text-[11px] text-slate-400">{t.dist.toLocaleString()} m · {t.office}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">Location is read from your device GPS via the browser. The mobile app tracks continuously in the background; here it updates while this page is open.</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-mono text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
function Mini({ icon, label, value, tone = "blue" }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string; tone?: "blue" | "emerald" | "amber" }) {
  const t = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${t[tone]}`}><Icon name={icon} className="h-4 w-4" /></span>
      <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
      <p className="truncate text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

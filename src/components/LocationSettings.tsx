"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { colorBadge } from "@/lib/setup";
import {
  getPosition,
  loadLocations,
  loadWorkTypes,
  saveLocations,
  saveWorkTypes,
  type WorkLocation,
  type WorkType,
} from "@/lib/locations";

const COLOR_KEYS = ["blue", "emerald", "amber", "violet", "rose", "sky", "slate"];

export default function LocationSettings() {
  const toast = useToast();
  const [types, setTypes] = useState<WorkType[]>(loadWorkTypes);
  const [locations, setLocations] = useState<WorkLocation[]>(loadLocations);

  useEffect(() => { saveWorkTypes(types); }, [types]);
  useEffect(() => { saveLocations(locations); }, [locations]);

  // work-type form
  const [typeName, setTypeName] = useState("");
  const [typeGeo, setTypeGeo] = useState(false);

  function addType(e: React.FormEvent) {
    e.preventDefault();
    if (!typeName.trim()) return;
    if (types.some((t) => t.name.toLowerCase() === typeName.trim().toLowerCase())) return toast.error("Exists", "That work type already exists.");
    const color = COLOR_KEYS[types.length % COLOR_KEYS.length];
    setTypes((t) => [...t, { id: `${typeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`, name: typeName.trim(), geofenced: typeGeo, color }]);
    setTypeName(""); setTypeGeo(false);
    toast.success("Work type added", typeName.trim());
  }

  // location form
  const [loc, setLoc] = useState({ name: "", latitude: "", longitude: "", radius: "100", address: "" });
  const [locating, setLocating] = useState(false);
  const setL = (k: keyof typeof loc, v: string) => setLoc((s) => ({ ...s, [k]: v }));

  async function useMyLocation() {
    setLocating(true);
    try {
      const { lat, lng } = await getPosition();
      setLoc((s) => ({ ...s, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
      toast.success("Location captured", `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      toast.error("Location unavailable", "Allow location access to capture coordinates.");
    } finally {
      setLocating(false);
    }
  }
  function addLocation(e: React.FormEvent) {
    e.preventDefault();
    const lat = Number(loc.latitude), lng = Number(loc.longitude), radius = Number(loc.radius);
    if (!loc.name.trim()) return toast.error("Name required", "Enter a location name.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return toast.error("Coordinates required", "Enter valid latitude and longitude.");
    setLocations((l) => [...l, { id: `loc-${Date.now().toString(36)}`, name: loc.name.trim(), latitude: lat, longitude: lng, radius: radius || 100, address: loc.address.trim() }]);
    setLoc({ name: "", latitude: "", longitude: "", radius: "100", address: "" });
    toast.success("Location added", loc.name.trim());
  }
  function patchLoc(id: string, p: Partial<WorkLocation>) {
    setLocations((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Work Types &amp; Locations</h1>
        <p className="mt-1 text-sm text-slate-500">Define how users can log in. Geofenced types require the user to be within a location&apos;s radius.</p>
      </div>

      {/* Work types */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-800">Work Types</p>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <div key={t.id} className="group flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-3 pr-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colorBadge(t.color)}`}>{t.name}</span>
              <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-500" title="Require user to be inside a location radius">
                <input type="checkbox" checked={t.geofenced} onChange={(e) => setTypes((all) => all.map((x) => (x.id === t.id ? { ...x, geofenced: e.target.checked } : x)))} className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600" />
                Geofenced
              </label>
              <button onClick={() => setTypes((all) => all.filter((x) => x.id !== t.id))} title="Remove" className="rounded-full p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"><Icon name="close" className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        <form onSubmit={addType} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
          <div className="min-w-44 flex-1"><Lbl>New work type</Lbl><input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="e.g. Client Site" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600"><input type="checkbox" checked={typeGeo} onChange={(e) => setTypeGeo(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" /> Geofenced (radius check)</label>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">+ Add</button>
        </form>
      </div>

      {/* Add location */}
      <form onSubmit={addLocation} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Add Location</p>
          <button type="button" onClick={useMyLocation} disabled={locating} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Icon name="pin" className="h-3.5 w-3.5 text-blue-600" /> {locating ? "Locating…" : "Use my current location"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2"><Lbl>Name</Lbl><input value={loc.name} onChange={(e) => setL("name", e.target.value)} placeholder="e.g. Pune Office" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <div><Lbl>Latitude</Lbl><input value={loc.latitude} onChange={(e) => setL("latitude", e.target.value)} placeholder="19.0606" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <div><Lbl>Longitude</Lbl><input value={loc.longitude} onChange={(e) => setL("longitude", e.target.value)} placeholder="72.8362" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <div className="lg:col-span-3"><Lbl>Address</Lbl><input value={loc.address} onChange={(e) => setL("address", e.target.value)} placeholder="Street, city" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
          <div><Lbl>Radius (m)</Lbl><input type="number" value={loc.radius} onChange={(e) => setL("radius", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        </div>
        <div className="mt-3 flex justify-end"><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">+ Add Location</button></div>
      </form>

      {/* Locations list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3">Location</th><th className="px-4 py-3">Latitude</th><th className="px-4 py-3">Longitude</th><th className="px-4 py-3">Radius</th><th className="px-4 py-3 text-right">—</th>
          </tr></thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3"><p className="font-medium text-slate-800">{l.name}</p><p className="text-xs text-slate-400">{l.address || "—"}</p></td>
                <td className="px-4 py-3"><input value={l.latitude} onChange={(e) => patchLoc(l.id, { latitude: Number(e.target.value) })} className="w-24 rounded-md border border-slate-200 px-2 py-1 font-mono text-xs outline-none focus:border-blue-500" /></td>
                <td className="px-4 py-3"><input value={l.longitude} onChange={(e) => patchLoc(l.id, { longitude: Number(e.target.value) })} className="w-24 rounded-md border border-slate-200 px-2 py-1 font-mono text-xs outline-none focus:border-blue-500" /></td>
                <td className="px-4 py-3"><div className="flex items-center gap-1"><input type="number" value={l.radius} onChange={(e) => patchLoc(l.id, { radius: Number(e.target.value) })} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-500" /><span className="text-xs text-slate-400">m</span></div></td>
                <td className="px-4 py-3 text-right"><button onClick={() => setLocations((all) => all.filter((x) => x.id !== l.id))} title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {locations.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No locations yet. Add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-500">{children}</label>;
}

"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  COLORS,
  KIND_LABELS,
  badgeStyle,
  colorHex,
  dotStyle,
  isHexColor,
  loadSetup,
  saveSetup,
  type OptionKind,
  type SetupData,
  type SetupOption,
} from "@/lib/setup";

/** Preset swatches + a custom colour picker. A value is either a preset key
 * ("blue") or a literal "#rrggbb" chosen from the native colour input. */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const custom = isHexColor(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 p-2">
      {COLORS.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.key)}
          title={c.label}
          aria-label={c.label}
          className={`h-6 w-6 rounded-full ${c.dot} transition ${value === c.key ? "ring-2 ring-slate-900 ring-offset-2" : "hover:scale-110"}`}
        />
      ))}
      {/* Custom colour — native picker overlaid on a rainbow swatch. */}
      <label
        title="Custom colour"
        className={`relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full transition hover:scale-110 ${custom ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
        style={custom
          ? { backgroundColor: value }
          : { background: "conic-gradient(from 0deg, #f43f5e, #f59e0b, #10b981, #0ea5e9, #6366f1, #8b5cf6, #f43f5e)" }}
      >
        <input
          type="color"
          value={colorHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Custom colour"
        />
        {!custom && <Icon name="edit" className="h-3 w-3 text-white drop-shadow" />}
      </label>
      {custom && <span className="ml-0.5 font-mono text-[11px] uppercase text-slate-500">{value}</span>}
    </div>
  );
}

export default function SetupSection({ kind }: { kind: OptionKind }) {
  const toast = useToast();
  const [data, setData] = useState<SetupData>(loadSetup);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");

  useEffect(() => {
    setData(loadSetup());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveSetup(data);
  }, [data, ready]);

  const label = KIND_LABELS[kind];
  const items = data[kind];

  function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (items.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Already exists", `"${trimmed}" is already a ${label}.`);
      return;
    }
    const option: SetupOption = {
      id: `${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: trimmed,
      color,
      createdBy: getUser()?.name ?? "You",
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    };
    setData((d) => ({ ...d, [kind]: [...d[kind], option] }));
    setName("");
    toast.success(`${label} added`, `"${trimmed}" is now available.`);
    logActivity(`Added ${label} "${trimmed}"`, { category: "setup", target: trimmed });
  }

  function setItemColor(id: string, c: string) {
    setData((d) => ({ ...d, [kind]: d[kind].map((o) => (o.id === id ? { ...o, color: c } : o)) }));
  }

  function remove(id: string, nm: string) {
    setData((d) => ({ ...d, [kind]: d[kind].filter((o) => o.id !== id) }));
    toast.info(`${label} removed`, `"${nm}" was deleted.`);
    logActivity(`Removed ${label} "${nm}"`, { category: "setup", target: nm });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{label}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the {label} options available across your{" "}
          {kind === "department" || kind === "designation" ? "users" : "leads"}.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={add} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-800">Add new {label}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`New ${label.toLowerCase()} name`}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Colour — pick a preset or a custom colour</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Preview</label>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium" style={badgeStyle(color)}>
              <span className="h-1.5 w-1.5 rounded-full" style={dotStyle(color)} />
              {name.trim() || label}
            </span>
          </div>
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <span className="text-base leading-none">+</span> Add {label}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-6 py-3">{label}</th>
              <th className="px-6 py-3">Colour</th>
              <th className="px-6 py-3">Preview</th>
              <th className="px-6 py-3">Created By</th>
              <th className="px-6 py-3">Created</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-6 py-3">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <span className="h-2.5 w-2.5 rounded-full" style={dotStyle(o.color)} />
                    {o.name}
                  </span>
                </td>
                <td className="px-6 py-3">
                  {/* Click the swatch to recolour this option (native picker). */}
                  <label title="Change colour" className="inline-flex cursor-pointer items-center gap-2">
                    <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-slate-200" style={dotStyle(o.color)}>
                      <input
                        type="color"
                        value={colorHex(o.color)}
                        onChange={(e) => setItemColor(o.id, e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label={`Change colour of ${o.name}`}
                      />
                    </span>
                    <span className="font-mono text-[11px] uppercase text-slate-400">{colorHex(o.color)}</span>
                  </label>
                </td>
                <td className="px-6 py-3">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={badgeStyle(o.color)}>{o.name}</span>
                </td>
                <td className="px-6 py-3 text-slate-600">{o.createdBy}</td>
                <td className="px-6 py-3 text-slate-500">{o.createdAt}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => remove(o.id, o.name)} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                    <Icon name="trash" className="h-[18px] w-[18px]" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                  No {label.toLowerCase()} options yet. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

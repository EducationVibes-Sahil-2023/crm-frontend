"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  COLORS,
  KIND_LABELS,
  colorBadge,
  colorDot,
  loadSetup,
  saveSetup,
  type OptionKind,
  type SetupData,
  type SetupOption,
} from "@/lib/setup";

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
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Color</label>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 p-2">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setColor(c.key)}
                  title={c.label}
                  aria-label={c.label}
                  className={`h-6 w-6 rounded-full ${c.dot} transition ${color === c.key ? "ring-2 ring-slate-900 ring-offset-2" : "hover:scale-110"}`}
                />
              ))}
            </div>
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
                    <span className={`h-2.5 w-2.5 rounded-full ${colorDot(o.color)}`} />
                    {o.name}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorBadge(o.color)}`}>{o.name}</span>
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
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
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

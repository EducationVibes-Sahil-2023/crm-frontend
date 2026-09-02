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
  setSetupKind,
  type OptionKind,
  type SetupOption,
} from "@/lib/setup";
import { listConfig, createConfig, updateConfig, deleteConfig } from "@/lib/configApi";

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
  const [items, setItems] = useState<SetupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  // Inline rename of an existing option.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const label = KIND_LABELS[kind];

  // Keep the shared setup cache (used by lead forms/filters) in sync.
  const sync = (next: SetupOption[]) => { setItems(next); setSetupKind(kind, next); };

  useEffect(() => {
    let alive = true;
    const load = () => {
      setLoading(true);
      listConfig(kind)
        .then((rows) => { if (!alive) return; const mapped = rows.map((r) => ({ id: r.id, name: r.name, color: r.color || "slate", createdBy: "—", createdAt: "—" })); setItems(mapped); setSetupKind(kind, mapped); })
        .catch((e) => toast.error("Couldn't load", (e as Error).message))
        .finally(() => { if (alive) setLoading(false); });
    };
    load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (items.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Already exists", `"${trimmed}" is already a ${label}.`);
      return;
    }
    try {
      const created = await createConfig(kind, { name: trimmed, color });
      sync([...items, { id: created.id, name: created.name, color: created.color || color, createdBy: getUser()?.name ?? "You", createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) }]);
      setName("");
      toast.success(`${label} added`, `"${trimmed}" is now available.`);
      logActivity(`Added ${label} "${trimmed}"`, { category: "setup", target: trimmed });
    } catch (err) {
      toast.error("Couldn't add", (err as Error).message);
    }
  }

  function setItemColor(id: string, c: string) {
    sync(items.map((o) => (o.id === id ? { ...o, color: c } : o)));
    updateConfig(kind, id, { color: c }).catch((e) => toast.error("Couldn't save colour", (e as Error).message));
  }

  function startEdit(o: SetupOption) {
    setEditingId(o.id);
    setEditName(o.name);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }
  async function saveEdit(o: SetupOption) {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Name required", `A ${label.toLowerCase()} needs a name.`);
      return;
    }
    if (trimmed === o.name) {
      cancelEdit();
      return;
    }
    if (items.some((x) => x.id !== o.id && x.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Already exists", `"${trimmed}" is already a ${label}.`);
      return;
    }
    const prev = items;
    sync(items.map((x) => (x.id === o.id ? { ...x, name: trimmed } : x))); // optimistic
    cancelEdit();
    try {
      await updateConfig(kind, o.id, { name: trimmed });
      toast.success(`${label} updated`, `Renamed to "${trimmed}".`);
      logActivity(`Renamed ${label} "${o.name}" → "${trimmed}"`, { category: "setup", target: trimmed });
    } catch (err) {
      sync(prev); // revert on failure
      toast.error("Couldn't rename", (err as Error).message);
    }
  }

  async function remove(id: string, nm: string) {
    const prev = items;
    sync(items.filter((o) => o.id !== id));
    try {
      await deleteConfig(kind, id);
      toast.info(`${label} removed`, `"${nm}" was deleted.`);
      logActivity(`Removed ${label} "${nm}"`, { category: "setup", target: nm });
    } catch (err) {
      sync(prev);
      toast.error("Couldn't delete", (err as Error).message);
    }
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
                  {editingId === o.id ? (
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={dotStyle(o.color)} />
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(o); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus
                        className="w-full max-w-[16rem] rounded-md border border-blue-400 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  ) : (
                    <span className="flex items-center gap-2 font-medium text-slate-800">
                      <span className="h-2.5 w-2.5 rounded-full" style={dotStyle(o.color)} />
                      {o.name}
                    </span>
                  )}
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
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {editingId === o.id ? (
                      <>
                        <button onClick={() => saveEdit(o)} title="Save" aria-label="Save" className="rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50">
                          <Icon name="check" className="h-[18px] w-[18px]" />
                        </button>
                        <button onClick={cancelEdit} title="Cancel" aria-label="Cancel" className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100">
                          <Icon name="close" className="h-[18px] w-[18px]" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(o)} title="Rename" aria-label="Rename" className="rounded-md p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600">
                          <Icon name="edit" className="h-[18px] w-[18px]" />
                        </button>
                        <button onClick={() => remove(o.id, o.name)} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                          <Icon name="trash" className="h-[18px] w-[18px]" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                  {loading ? "Loading…" : `No ${label.toLowerCase()} options yet. Add one above.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

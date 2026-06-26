"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { COLORS, colorBadge, colorDot } from "@/lib/setup";
import {
  ACTIONS,
  MODULES,
  TOTAL_PERMS,
  countGranted,
  loadRoles,
  saveRoles,
  type Action,
  type Role,
} from "@/lib/roles";

export default function RolePermissions() {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>(loadRoles);
  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");

  // Persist on every change (saveRoles is a no-op on the server).
  useEffect(() => {
    saveRoles(roles);
  }, [roles]);

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];

  function addRole(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (roles.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Already exists", `"${trimmed}" is already a role.`);
      return;
    }
    const id = `${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const role: Role = {
      id,
      name: trimmed,
      color,
      description: description.trim(),
      permissions: Object.fromEntries(
        MODULES.map((m) => [m.key, { view: false, create: false, edit: false, delete: false }]),
      ),
    };
    setRoles((rs) => [...rs, role]);
    setSelectedId(id);
    setName("");
    setDescription("");
    setColor("blue");
    setAdding(false);
    toast.success("Role created", `"${trimmed}" is ready — set its permissions.`);
  }

  function removeRole(role: Role) {
    if (role.system) {
      toast.error("Protected role", `"${role.name}" cannot be deleted.`);
      return;
    }
    setRoles((rs) => {
      const next = rs.filter((r) => r.id !== role.id);
      if (selectedId === role.id) setSelectedId(next[0]?.id ?? "");
      return next;
    });
    toast.info("Role removed", `"${role.name}" was deleted.`);
  }

  function toggle(moduleKey: string, action: Action) {
    if (!selected) return;
    setRoles((rs) =>
      rs.map((r) =>
        r.id !== selected.id
          ? r
          : {
              ...r,
              permissions: {
                ...r.permissions,
                [moduleKey]: { ...r.permissions[moduleKey], [action]: !r.permissions[moduleKey][action] },
              },
            },
      ),
    );
  }

  function setModule(moduleKey: string, value: boolean) {
    if (!selected) return;
    setRoles((rs) =>
      rs.map((r) =>
        r.id !== selected.id
          ? r
          : { ...r, permissions: { ...r.permissions, [moduleKey]: { view: value, create: value, edit: value, delete: value } } },
      ),
    );
  }

  function setAll(value: boolean) {
    if (!selected) return;
    setRoles((rs) =>
      rs.map((r) =>
        r.id !== selected.id
          ? r
          : {
              ...r,
              permissions: Object.fromEntries(
                MODULES.map((m) => [m.key, { view: value, create: value, edit: value, delete: value }]),
              ),
            },
      ),
    );
    toast.info(value ? "Granted all" : "Cleared all", `${selected.name} permissions updated.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Define roles and what each can do, then assign them to users.
          </p>
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <span className="text-base leading-none">+</span> New Role
        </button>
      </div>

      {/* Add role form */}
      {adding && (
        <form onSubmit={addRole} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-800">Create a new role</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Role name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Regional Manager"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="min-w-48 flex-[2]">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary of this role"
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
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              Create role
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Roles list */}
        <div className="space-y-2">
          {roles.map((r) => {
            const active = selected?.id === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                  active ? "border-blue-500 bg-blue-50/60 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${colorDot(r.color)}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-slate-800">{r.name}</span>
                    {r.system && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        System
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{r.description || "No description"}</span>
                  <span className="mt-1 block text-[11px] font-medium text-slate-400">
                    {countGranted(r)}/{TOTAL_PERMS} permissions
                  </span>
                </span>
              </button>
            );
          })}
          {roles.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              No roles yet. Create one above.
            </p>
          )}
        </div>

        {/* Permission matrix */}
        {selected ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${colorBadge(selected.color)}`}>{selected.name}</span>
                <span className="text-sm text-slate-500">{selected.description}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setAll(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  Grant all
                </button>
                <button onClick={() => setAll(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  Clear all
                </button>
                {!selected.system && (
                  <button
                    onClick={() => removeRole(selected)}
                    title="Delete role"
                    aria-label="Delete role"
                    className="rounded-lg border border-slate-300 p-1.5 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Icon name="trash" className="h-[18px] w-[18px]" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Module</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-4 py-3 text-center capitalize">{a}</th>
                    ))}
                    <th className="px-4 py-3 text-center">All</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m) => {
                    const p = selected.permissions[m.key];
                    const allOn = ACTIONS.every((a) => p[a]);
                    return (
                      <tr key={m.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-medium text-slate-700">{m.label}</td>
                        {ACTIONS.map((a) => (
                          <td key={a} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={p[a]}
                              onChange={() => toggle(m.key, a)}
                              aria-label={`${m.label} ${a}`}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={allOn}
                            onChange={(e) => setModule(m.key, e.target.checked)}
                            aria-label={`${m.label} all`}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
            Select or create a role to edit its permissions.
          </div>
        )}
      </div>
    </div>
  );
}

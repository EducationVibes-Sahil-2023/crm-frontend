"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import WaConversation from "@/components/WaConversation";
import LeadDetailModal from "@/components/LeadDetailModal";
import { getUser } from "@/lib/auth";
import { listDirectory } from "@/lib/directory";
import { getTablePageSize } from "@/lib/appearance";
import { optionNames } from "@/lib/setup";
import { STATE_NAMES, allCities, citiesOf } from "@/lib/places";
import { logActivity } from "@/lib/activity";
import { logLeadActivity } from "@/lib/leadExtras";
import { loadIntakeLeads, subscribeLeads } from "@/lib/leadStore";
import {
  LEAD_FIELDS,
  loadCustomFields,
  loadLeadFieldConfig,
  type LeadCustomField,
  type LeadFieldKey,
} from "@/lib/leadFields";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Lead = {
  id: string;
  deleted?: boolean;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  status: string;
  source: string;
  type: string;
  followUpDate: string;
  connectedDate: string;
  lastUpdated: string;
  assignationDate: string;
  responseTime: string;
  referenceName: string;
  totalCallCount: number;
  callCount: number;
  duration: string;
  createdDate: string;
  updatedDate: string;
  createdBy: string;
  assignedTo: string;
  channel?: string;
  custom?: Record<string, string>;
};

type ColKey = keyof Lead | "actions";
type ColSeed = { key: ColKey; label: string; pinned?: boolean; defaultVisible?: boolean };
type ColState = { key: ColKey; label: string; visible: boolean; pinned: boolean };

const COLUMN_SEED: ColSeed[] = [
  { key: "name", label: "Name", pinned: true, defaultVisible: true },
  { key: "phone", label: "Phone Number", defaultVisible: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "city", label: "City", defaultVisible: true },
  { key: "state", label: "State", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "assignedTo", label: "Assigned To", defaultVisible: true },
  { key: "source", label: "Source", defaultVisible: true },
  { key: "type", label: "Type", defaultVisible: true },
  { key: "followUpDate", label: "Follow Up Date" },
  { key: "connectedDate", label: "Connected Date" },
  { key: "lastUpdated", label: "Last Updated" },
  { key: "assignationDate", label: "Assignation Date" },
  { key: "responseTime", label: "Response Time" },
  { key: "referenceName", label: "Reference Name" },
  { key: "totalCallCount", label: "Total Call Count" },
  { key: "callCount", label: "Call Count" },
  { key: "duration", label: "Duration" },
  { key: "createdDate", label: "Created Date" },
  { key: "updatedDate", label: "Updated Date" },
  { key: "createdBy", label: "Created By" },
  { key: "actions", label: "Actions", pinned: true, defaultVisible: true },
];

const STORAGE_KEY = "leads_columns_v1";

function defaultColumns(): ColState[] {
  return normalize(
    COLUMN_SEED.map((c) => ({
      key: c.key,
      label: c.label,
      visible: Boolean(c.pinned || c.defaultVisible),
      pinned: Boolean(c.pinned),
    })),
  );
}

// Keep "name" first and "actions" last regardless of reordering.
function normalize(cols: ColState[]): ColState[] {
  const name = cols.find((c) => c.key === "name");
  const actions = cols.find((c) => c.key === "actions");
  const mid = cols.filter((c) => c.key !== "name" && c.key !== "actions");
  return [name, ...mid, actions].filter(Boolean) as ColState[];
}

function loadColumns(): ColState[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { key: string; label: string; visible: boolean }[];
    const defKeys = COLUMN_SEED.map((c) => c.key);
    const savedKeys = new Set(saved.map((s) => s.key));
    if (saved.length !== defKeys.length || !defKeys.every((k) => savedKeys.has(k))) {
      return null;
    }
    const pinnedByKey = Object.fromEntries(COLUMN_SEED.map((c) => [c.key, Boolean(c.pinned)]));
    return normalize(
      saved.map((s) => ({
        key: s.key as ColKey,
        label: s.label,
        visible: pinnedByKey[s.key] ? true : s.visible,
        pinned: pinnedByKey[s.key],
      })),
    );
  } catch {
    return null;
  }
}

// Team members a lead can be assigned to (shared directory).
const ASSIGNEES = listDirectory().map((u) => u.name);

const STATUS_STYLE: Record<string, string> = {
  New: "bg-sky-100 text-sky-700",
  Contacted: "bg-amber-100 text-amber-700",
  Qualified: "bg-indigo-100 text-indigo-700",
  Proposal: "bg-violet-100 text-violet-700",
  Won: "bg-emerald-100 text-emerald-700",
  Lost: "bg-rose-100 text-rose-700",
};
const STATUS_BAR: Record<string, string> = {
  New: "bg-sky-400",
  Contacted: "bg-amber-400",
  Qualified: "bg-indigo-400",
  Proposal: "bg-violet-400",
  Won: "bg-emerald-400",
  Lost: "bg-rose-400",
};
const TYPE_STYLE: Record<string, string> = {
  Hot: "bg-rose-100 text-rose-700",
  Warm: "bg-amber-100 text-amber-700",
  Cold: "bg-sky-100 text-sky-700",
};
const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];

const PAGE_SIZES = [25, 50, 100];

export default function LeadsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [source, setSource] = useState("All Sources");
  const [type, setType] = useState("All Types");
  const [city, setCity] = useState("All Cities");
  const [stateF, setStateF] = useState("All States");

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<ColState[]>(defaultColumns);
  const [colsReady, setColsReady] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => getTablePageSize());
  const [formOpen, setFormOpen] = useState(false);

  // View / edit / delete state.
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [waLead, setWaLead] = useState<Lead | null>(null);

  // Load persisted column config (visibility / order / labels).
  useEffect(() => {
    const saved = loadColumns();
    if (saved) setColumns(saved);
    setColsReady(true);
  }, []);

  // Persist column config so it becomes the default next time.
  useEffect(() => {
    if (!colsReady) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(columns.map((c) => ({ key: c.key, label: c.label, visible: c.visible }))),
    );
  }, [columns, colsReady]);

  useEffect(() => {
    // Merge sample leads with anything captured via the Forms/intake channels,
    // newest first. Re-merge live whenever a new lead is captured (this tab or
    // another) so the table updates in real time.
    // Show only real leads from the backend (intake/Forms channels). The empty
    // workspace starts with no leads instead of demo rows.
    const merge = () => setLeads([...(loadIntakeLeads() as unknown as Lead[])]);
    const t = setTimeout(() => {
      merge();
      setLoading(false);
    }, 900);
    const unsub = subscribeLeads(() => {
      merge();
      const latest = loadIntakeLeads()[0];
      if (latest) toast.info("New lead captured", `${latest.name} via ${latest.channel}`);
    });
    return () => {
      clearTimeout(t);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateOptions = useMemo(() => ["All States", ...STATE_NAMES], []);
  // City filter follows the selected state (all cities when no state is picked).
  const cityOptions = useMemo(() => ["All Cities", ...(stateF !== "All States" ? citiesOf(stateF) : allCities())], [stateF]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (showDeleted ? !l.deleted : l.deleted) return false;
      const mq = !q || l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.city.toLowerCase().includes(q);
      return (
        mq &&
        (status === "All Statuses" || l.status === status) &&
        (source === "All Sources" || l.source === source) &&
        (type === "All Types" || l.type === type) &&
        (city === "All Cities" || l.city === city) &&
        (stateF === "All States" || l.state === stateF)
      );
    });
  }, [leads, query, status, source, type, city, stateF, showDeleted]);

  const deletedCount = useMemo(() => leads.filter((l) => l.deleted).length, [leads]);

  // Summary stats for the hero (active leads only).
  const stats = useMemo(() => {
    const active = leads.filter((l) => !l.deleted);
    const by = (s: string) => active.filter((l) => l.status === s).length;
    const order = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
    const t = active.length || 1;
    return {
      total: active.length,
      qualified: by("Qualified"),
      won: by("Won"),
      hot: active.filter((l) => l.type === "Hot").length,
      conversion: Math.round((by("Won") / t) * 100),
      breakdown: order.map((s) => ({ status: s, count: by(s) })),
    };
  }, [leads]);

  useEffect(() => {
    setPage(1);
  }, [query, status, source, type, city, stateF, pageSize, showDeleted]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  const shownColumns = columns.filter((c) => c.visible);

  // ---- column manager helpers ----
  function toggleColumn(key: ColKey, on: boolean) {
    setColumns((cs) => cs.map((c) => (c.key === key && !c.pinned ? { ...c, visible: on } : c)));
  }
  function renameColumn(key: ColKey, label: string) {
    setColumns((cs) => cs.map((c) => (c.key === key ? { ...c, label } : c)));
  }
  function moveColumn(index: number, dir: -1 | 1) {
    const j = index + dir;
    // Keep within the movable middle range (exclude pinned name at 0 and actions at end).
    if (j < 1 || j > columns.length - 2) return;
    setColumns((cs) => {
      const a = [...cs];
      [a[index], a[j]] = [a[j], a[index]];
      return a;
    });
  }
  function resetColumns() {
    setColumns(defaultColumns());
    toast.info("Columns reset", "Restored the default columns.");
  }

  function handleCreate(lead: Lead) {
    setLeads((prev) => [lead, ...prev]);
    setPage(1);
    setFormOpen(false);
    toast.success("Lead created", `${lead.name} was added to your leads.`);
    logActivity(`Created lead "${lead.name}"`, { category: "lead", target: lead.company });
    logLeadActivity(lead.id, "created", `Lead created by ${lead.createdBy}`, lead.createdBy);
  }

  function handleReassign(lead: Lead, toName: string) {
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, assignedTo: toName, assignationDate: today, updatedDate: today, lastUpdated: "just now" } : l)));
    setViewLead((v) => (v && v.id === lead.id ? { ...v, assignedTo: toName } : v));
    logActivity(`Assigned lead "${lead.name}" to ${toName}`, { category: "lead", target: toName });
  }

  function handleUpdate(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setEditLead(null);
    toast.success("Lead updated", `${updated.name}'s details were saved.`);
    logActivity(`Edited lead "${updated.name}"`, { category: "lead", target: updated.company });
    logLeadActivity(updated.id, "edit", "Lead details updated", getUser()?.name ?? "You");
  }

  // Quick in-modal patch (e.g. status change) — keeps list + open modal in sync.
  function handleLeadPatch(lead: Lead, patch: Partial<Lead>) {
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...patch, updatedDate: today, lastUpdated: "just now" } : l)));
    setViewLead((v) => (v && v.id === lead.id ? { ...v, ...patch } : v));
  }

  // Soft delete — flag the record, keep it for restore.
  function handleDelete(lead: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, deleted: true } : l)));
    setConfirmDelete(null);
    setViewLead((v) => (v?.id === lead.id ? null : v));
    toast.success("Lead deleted", `${lead.name} was moved to deleted leads.`);
    logActivity(`Deleted lead "${lead.name}"`, { category: "lead", target: lead.company });
  }

  function handleRestore(lead: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, deleted: false } : l)));
    toast.success("Lead restored", `${lead.name} was restored.`);
    logActivity(`Restored lead "${lead.name}"`, { category: "lead", target: lead.company });
  }

  function stickyClass(key: ColKey, header: boolean) {
    if (header) {
      const z = key === "name" || key === "actions" ? "z-30" : "z-20";
      const corner =
        key === "name"
          ? "left-0 border-r border-slate-100"
          : key === "actions"
            ? "right-0 border-l border-slate-100"
            : "";
      return `sticky top-0 ${z} ${corner}`;
    }
    if (key === "name") return "sticky left-0 z-10 border-r border-slate-100";
    if (key === "actions") return "sticky right-0 z-10 border-l border-slate-100";
    return "";
  }
  const stickyBg = (key: ColKey) =>
    key === "name" || key === "actions" ? "bg-white group-hover:bg-slate-50" : "";

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 p-6 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_12%_18%,white,transparent_45%),radial-gradient(circle_at_88%_92%,white,transparent_42%)]" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">Lead Management</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Leads</h1>
            <p className="mt-1 text-sm text-blue-100">
              Manage and track your <strong className="font-semibold text-white">{stats.total}</strong> active opportunities.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowDeleted((s) => !s)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ring-1 backdrop-blur transition ${showDeleted ? "bg-white text-rose-700 ring-white" : "bg-white/15 text-white ring-white/25 hover:bg-white/25"}`}
            >
              <Icon name="trash" className="h-4 w-4" />
              {showDeleted ? "Showing deleted" : "Deleted"}
              {deletedCount > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${showDeleted ? "bg-rose-100 text-rose-700" : "bg-white/25 text-white"}`}>{deletedCount}</span>}
            </button>
            <button onClick={() => toast.info("Export", "Preparing your leads export…")} className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25">
              <Icon name="export" className="h-4 w-4" /> Export
            </button>
            <button onClick={() => setFormOpen(true)} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              <span className="text-base leading-none">+</span> Create Lead
            </button>
          </div>
        </div>

        {/* Stat chips */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
          <HeroStat label="Total leads" value={stats.total} icon="leads" />
          <HeroStat label="Qualified" value={stats.qualified} icon="check" />
          <HeroStat label="Won" value={stats.won} icon="win" />
          <HeroStat label="Hot leads" value={stats.hot} icon="trendUp" />
          <HeroStat label="Conversion" value={`${stats.conversion}%`} icon="deals" />
        </div>

        {/* Status distribution */}
        <div className="relative mt-5">
          <div className="flex h-2 overflow-hidden rounded-full bg-white/20">
            {stats.breakdown.map((b) => {
              const pct = stats.total ? (b.count / stats.total) * 100 : 0;
              if (pct === 0) return null;
              return <div key={b.status} className={STATUS_BAR[b.status]} style={{ width: `${pct}%` }} title={`${b.status}: ${b.count}`} />;
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {stats.breakdown.map((b) => (
              <span key={b.status} className="flex items-center gap-1.5 text-[11px] text-blue-100">
                <span className={`h-2 w-2 rounded-full ${STATUS_BAR[b.status]}`} />
                {b.status} <span className="font-semibold text-white">{b.count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <FilterLabel>Search Leads</FilterLabel>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, company, or email..." className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
          <Select label="Status" value={status} onChange={setStatus} options={["All Statuses", "New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]} />
          <Select label="Lead Source" value={source} onChange={setSource} options={["All Sources", "Website", "Referral", "Social", "Email", "Cold Call"]} />
          <Select label="Type" value={type} onChange={setType} options={["All Types", "Hot", "Warm", "Cold"]} />
          <Select label="State" value={stateF} onChange={(v) => { setStateF(v); if (v !== "All States" && !citiesOf(v).includes(city)) setCity("All Cities"); }} options={stateOptions} />
          <Select label="City" value={city} onChange={setCity} options={cityOptions} />
          <div>
            <FilterLabel>Date Range</FilterLabel>
            <button className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              Oct 1 – Oct 31, 2023
              <Icon name="calendar" className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <div className="relative flex items-end">
            <button onClick={() => setColumnsOpen((o) => !o)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Icon name="dashboard" className="h-4 w-4 text-slate-500" /> Columns
              <Icon name="chevronDown" className="h-4 w-4 text-slate-400" />
            </button>
            {columnsOpen && (
              <ColumnManager
                columns={columns}
                onToggle={toggleColumn}
                onRename={renameColumn}
                onMove={moveColumn}
                onReset={resetColumns}
                onClose={() => setColumnsOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-scrollbar max-h-[60vh] overflow-auto rounded-t-2xl">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {shownColumns.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 ${c.key === "actions" ? "text-right" : ""} ${stickyClass(c.key, true)}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={shownColumns.length} />
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={shownColumns.length} className="px-6 py-12 text-center text-sm text-slate-400">
                    No leads match your filters.
                  </td>
                </tr>
              ) : (
                paged.map((l, i) => (
                  <tr key={l.id} className="group border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    {shownColumns.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap px-4 py-2.5 text-slate-600 ${c.key === "actions" ? "text-right" : ""} ${stickyClass(c.key, false)} ${stickyBg(c.key)}`}>
                        {c.key === "actions" ? (
                          <ActionButtons
                            lead={l}
                            onView={() => setViewLead(l)}
                            onEdit={() => setEditLead(l)}
                            onDelete={() => setConfirmDelete(l)}
                            onRestore={() => handleRestore(l)}
                            onWhatsApp={() => setWaLead(l)}
                          />
                        ) : (
                          renderCell(c.key, l, start + i)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500">
              {loading ? (
                <Skeleton className="h-4 w-44" />
              ) : (
                <>
                  Showing <strong>{total === 0 ? 0 : start + 1}</strong> to{" "}
                  <strong>{Math.min(start + pageSize, total)}</strong> of{" "}
                  <strong>{total.toLocaleString()}</strong> leads
                </>
              )}
            </p>
            <label className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              Rows:
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500">
                {Array.from(new Set([pageSize, ...PAGE_SIZES])).sort((a, b) => a - b).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={current === 1 || loading} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            {pageNumbers(current, totalPages).map((n, idx) =>
              typeof n === "number" ? (
                <button key={idx} onClick={() => setPage(n)} className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium ${n === current ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  {n}
                </button>
              ) : (
                <span key={idx} className="px-1 text-slate-400">…</span>
              ),
            )}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={current === totalPages || loading} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label="Next">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {formOpen && (
        <CreateLeadForm onClose={() => setFormOpen(false)} onCreate={handleCreate} />
      )}

      {waLead && <LeadWhatsApp lead={waLead} onClose={() => setWaLead(null)} />}
      {editLead && (
        <CreateLeadForm
          initial={editLead}
          onClose={() => setEditLead(null)}
          onCreate={handleUpdate}
        />
      )}
      {viewLead && (
        <LeadDetailModal
          lead={viewLead}
          onClose={() => setViewLead(null)}
          onEdit={() => { setViewLead(null); setEditLead(viewLead); }}
          onDelete={() => setConfirmDelete(viewLead)}
          onReassign={(toName) => handleReassign(viewLead, toName)}
          onUpdate={(patch) => handleLeadPatch(viewLead, patch)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete lead?"
          message={`"${confirmDelete.name}" will be moved to deleted leads. You can restore it later — nothing is permanently removed.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}
    </div>
  );
}

function CreateLeadForm({
  initial,
  onClose,
  onCreate,
}: {
  initial?: Lead;
  onClose: () => void;
  onCreate: (lead: Lead) => void;
}) {
  const isEdit = !!initial;
  const clean = (v?: string) => (v && v !== "—" ? v : "");
  const [statusOpts] = useState(() => optionNames("status"));
  const [sourceOpts] = useState(() => optionNames("source"));
  const [typeOpts] = useState(() => optionNames("type"));
  const [cfg] = useState(() => loadLeadFieldConfig());
  const [customFields] = useState<LeadCustomField[]>(() => loadCustomFields());
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    company: clean(initial?.company),
    email: initial?.email ?? "",
    phone: clean(initial?.phone),
    city: clean(initial?.city),
    state: clean(initial?.state),
    status: initial?.status ?? statusOpts[0] ?? "New",
    source: initial?.source ?? sourceOpts[0] ?? "Website",
    type: initial?.type ?? (typeOpts.includes("Warm") ? "Warm" : typeOpts[0] ?? "Warm"),
    referenceName: clean(initial?.referenceName),
    assignedTo: initial?.assignedTo || (getUser()?.name ?? ASSIGNEES[0] ?? ""),
  }));
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (initial?.custom) for (const f of customFields) if (initial.custom[f.label] != null) init[f.id] = initial.custom[f.label];
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function setCustom(id: string, value: string) {
    setCustomValues((v) => ({ ...v, [id]: value }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: "" }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};

    // Mandatory checks for standard fields (driven by Admin Setup).
    for (const f of LEAD_FIELDS) {
      if (cfg[f.key] && !String(form[f.key as keyof typeof form] ?? "").trim()) {
        next[f.key] = `${f.label} is required.`;
      }
    }
    // Email format always applies when present.
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }
    // Mandatory checks for custom fields.
    for (const f of customFields) {
      if (f.required && !(customValues[f.id] ?? "").trim()) {
        next[f.id] = `${f.label} is required.`;
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

    // Collect filled custom field values keyed by label.
    const custom: Record<string, string> = {};
    for (const f of customFields) {
      const v = (customValues[f.id] ?? "").trim();
      if (v) custom[f.label] = v;
    }

    onCreate({
      id: initial?.id ?? `lead-${Date.now()}`,
      deleted: initial?.deleted,
      name: form.name.trim(),
      company: form.company.trim() || "—",
      email: form.email.trim(),
      phone: form.phone.trim() || "—",
      city: form.city.trim() || "—",
      state: form.state.trim() || "—",
      status: form.status,
      source: form.source,
      type: form.type,
      followUpDate: initial?.followUpDate ?? "—",
      connectedDate: initial?.connectedDate ?? "—",
      lastUpdated: "just now",
      assignationDate: initial?.assignationDate ?? "—",
      responseTime: initial?.responseTime ?? "—",
      referenceName: form.referenceName.trim() || "—",
      totalCallCount: initial?.totalCallCount ?? 0,
      callCount: initial?.callCount ?? 0,
      duration: initial?.duration ?? "0m",
      createdDate: initial?.createdDate ?? today,
      updatedDate: today,
      createdBy: initial?.createdBy ?? getUser()?.name ?? "You",
      assignedTo: form.assignedTo || getUser()?.name || "You",
      ...(Object.keys(custom).length > 0 ? { custom } : {}),
    });
  }

  const req = (key: LeadFieldKey) => cfg[key];

  const inputCls = (err?: boolean) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 ${
      err
        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
        : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
    }`;

  const initials =
    form.name.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        noValidate
        className="no-scrollbar my-6 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        {/* Gradient header with live avatar preview */}
        <div className="sticky top-0 z-20 overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-2 ring-white/40 backdrop-blur">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{isEdit ? "Edit Lead" : "Create Lead"}</h2>
                <p className="truncate text-sm text-blue-100">
                  {form.name.trim() || "New lead"}
                  {form.company.trim() && <span className="text-blue-200"> · {form.company.trim()}</span>}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="space-y-7 px-6 py-6">
          {/* Contact */}
          <Section title="Contact" icon="leads">
            <Field label="Full name" required={req("name")} error={errors.name}>
              <input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Jane Cooper" className={inputCls(!!errors.name)} />
            </Field>
            <Field label="Company" required={req("company")} error={errors.company}>
              <input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Acme Inc." className={inputCls(!!errors.company)} />
            </Field>
            <Field label="Email" required={req("email")} error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@company.com" className={inputCls(!!errors.email)} />
            </Field>
            <Field label="Phone number" required={req("phone")} error={errors.phone}>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" className={inputCls(!!errors.phone)} />
            </Field>
          </Section>

          {/* Location */}
          <Section title="Location" icon="pin">
            <Field label="State" required={req("state")} error={errors.state}>
              <SearchSelect value={form.state} onChange={(v) => { set("state", v); if (!citiesOf(v).includes(form.city)) set("city", ""); }} options={STATE_NAMES} error={errors.state} placeholder="Select state" />
            </Field>
            <Field label="City" required={req("city")} error={errors.city}>
              <SearchSelect value={form.city} onChange={(v) => set("city", v)} options={citiesOf(form.state)} error={errors.city} placeholder={form.state ? "Select city" : "Select a state first"} />
            </Field>
          </Section>

          {/* Lead details — searchable dropdowns */}
          <Section title="Lead details" icon="deals">
            <Field label="Status" required={req("status")} error={errors.status}>
              <SearchSelect value={form.status} onChange={(v) => set("status", v)} options={statusOpts} error={errors.status} placeholder="Select status" />
            </Field>
            <Field label="Type" required={req("type")} error={errors.type}>
              <SearchSelect value={form.type} onChange={(v) => set("type", v)} options={typeOpts} error={errors.type} placeholder="Select type" />
            </Field>
            <Field label="Lead source" required={req("source")} error={errors.source}>
              <SearchSelect value={form.source} onChange={(v) => set("source", v)} options={sourceOpts} error={errors.source} placeholder="Select source" />
            </Field>
            <Field label="Assigned to">
              <SearchSelect value={form.assignedTo} onChange={(v) => set("assignedTo", v)} options={ASSIGNEES} placeholder="Select assignee" />
            </Field>
            <Field label="Reference name" required={req("referenceName")} error={errors.referenceName} full>
              <input value={form.referenceName} onChange={(e) => set("referenceName", e.target.value)} placeholder="e.g. Webinar Q3" className={inputCls(!!errors.referenceName)} />
            </Field>
          </Section>

          {/* Custom fields defined in Admin Setup → Lead Fields */}
          {customFields.length > 0 && (
            <Section title="Additional details" icon="edit">
              {customFields.map((f) => (
                <Field key={f.id} label={f.label} required={f.required} error={errors[f.id]} full={f.type === "select"}>
                  {f.type === "select" ? (
                    <SearchSelect
                      value={customValues[f.id] ?? ""}
                      onChange={(v) => setCustom(f.id, v)}
                      options={f.options}
                      error={errors[f.id]}
                      placeholder={`Select ${f.label.toLowerCase()}`}
                    />
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={customValues[f.id] ?? ""}
                      onChange={(e) => setCustom(f.id, e.target.value)}
                      placeholder={f.type === "text" ? f.label : undefined}
                      className={inputCls(!!errors[f.id])}
                    />
                  )}
                </Field>
              ))}
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            {isEdit ? "Save Changes" : "Create Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: Parameters<typeof Icon>[0]["name"]; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Icon name={icon} className="h-4 w-4 text-slate-400" /> {title}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          {error}
        </p>
      )}
    </div>
  );
}

function ActionButtons({
  lead,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onWhatsApp,
}: {
  lead: Lead;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onWhatsApp: () => void;
}) {
  if (lead.deleted) {
    return (
      <div className="flex items-center justify-end gap-1">
        <button onClick={onView} title="View" aria-label="View" className="rounded-md p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
        <button onClick={onRestore} title="Restore" aria-label="Restore" className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50">
          <Icon name="refresh" className="h-4 w-4" /> Restore
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={onView} title="View" aria-label="View" className="rounded-md p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
      </button>
      <button onClick={onWhatsApp} title="WhatsApp" aria-label="WhatsApp" className="rounded-md p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600">
        <Icon name="whatsapp" className="h-[18px] w-[18px]" />
      </button>
      <button onClick={onEdit} title="Edit" aria-label="Edit" className="rounded-md p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
      </button>
      <button onClick={onDelete} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
      </button>
    </div>
  );
}

function LeadWhatsApp({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3.5 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold ring-2 ring-white/40">
              <Icon name="whatsapp" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{lead.name}</p>
              <p className="truncate text-xs text-emerald-50">{lead.phone}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <WaConversation phone={lead.phone} className="flex-1" />
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm }: { title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="px-6 pt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <Icon name="trash" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-1.5 text-sm text-slate-500">{message}</p>
        </div>
        <div className="mt-6 flex gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ColumnManager({
  columns,
  onToggle,
  onRename,
  onMove,
  onReset,
  onClose,
}: {
  columns: ColState[];
  onToggle: (key: ColKey, on: boolean) => void;
  onRename: (key: ColKey, label: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute bottom-full right-0 z-20 mb-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Manage columns
          </p>
          <button onClick={onReset} className="text-xs font-medium text-blue-600 hover:underline">
            Reset
          </button>
        </div>

        {columns.map((c, i) => {
          const canMove = !c.pinned;
          return (
            <div key={c.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                disabled={c.pinned}
                checked={c.visible}
                onChange={(e) => onToggle(c.key, e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 disabled:opacity-40"
                title={c.pinned ? "Always visible" : "Show column"}
              />
              <input
                value={c.label}
                onChange={(e) => onRename(c.key, e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-700 outline-none hover:border-slate-200 focus:border-blue-500 focus:bg-white"
                aria-label={`Rename ${c.label}`}
              />
              <div className="flex shrink-0 flex-col">
                <button
                  onClick={() => canMove && onMove(i, -1)}
                  disabled={!canMove || i <= 1}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-25"
                  aria-label="Move up"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path d="m18 15-6-6-6 6" /></svg>
                </button>
                <button
                  onClick={() => canMove && onMove(i, 1)}
                  disabled={!canMove || i >= columns.length - 2}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-25"
                  aria-label="Move down"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </div>
              {c.pinned && <span className="shrink-0 text-[10px] text-slate-400">pinned</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function pageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  const s = Math.max(2, current - 1);
  const e = Math.min(total - 1, current + 1);
  if (s > 2) pages.push("…");
  for (let p = s; p <= e; p++) pages.push(p);
  if (e < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

function renderCell(key: ColKey, l: Lead, i: number): ReactNode {
  if (key === "name") {
    return (
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
          {l.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div>
          <p className="font-medium text-slate-900">{l.name}</p>
          <p className="text-[11px] text-slate-500">{l.company}</p>
        </div>
      </div>
    );
  }
  if (key === "status")
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[l.status] ?? "bg-slate-100 text-slate-600"}`}>{l.status}</span>;
  if (key === "type")
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLE[l.type] ?? "bg-slate-100 text-slate-600"}`}>{l.type}</span>;
  if (key === "assignedTo") {
    const who = l.assignedTo || "—";
    if (who === "—") return <span className="text-slate-400">Unassigned</span>;
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AVATAR_COLORS[(who.charCodeAt(0) + who.length) % AVATAR_COLORS.length]}`}>
          {who.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </span>
        <span className="text-slate-700">{who}</span>
      </span>
    );
  }
  return <>{String(l[key as keyof Lead])}</>;
}

function HeroStat({ label, value, icon }: { label: string; value: number | string; icon: IconName }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
      <div className="flex items-center gap-2 text-blue-100">
        <Icon name={icon} className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold leading-none text-white">{value}</p>
    </div>
  );
}

function FilterLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-600">{children}</label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <FilterLabel>{label}</FilterLabel>
      <SearchSelect value={value} onChange={onChange} options={options} />
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, r) => (
        <tr key={r} className="group border-b border-slate-100 last:border-0">
          {Array.from({ length: cols }).map((_, c) => {
            const pinnedLeft = c === 0;
            const pinnedRight = c === cols - 1;
            const sticky = pinnedLeft ? "sticky left-0 z-10 bg-white" : pinnedRight ? "sticky right-0 z-10 bg-white" : "";
            return (
              <td key={c} className={`px-4 py-2.5 ${sticky}`}>
                {pinnedLeft ? (
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                ) : (
                  <Skeleton className="h-3 w-20" />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

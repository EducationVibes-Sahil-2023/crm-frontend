"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { listDirectory } from "@/lib/directory";
import {
  TRANSFER_STATUS,
  initials,
  loadTransferRequests,
  newTransferId,
  relativeTime,
  saveTransferRequests,
  type TransferRequest,
  type TransferStatus,
} from "@/lib/transferRequests";

type Filter = "all" | TransferStatus;

const FILTER_OPTIONS: SelectOption[] = [
  { value: "all", label: "All requests" },
  ...(Object.keys(TRANSFER_STATUS) as TransferStatus[]).map((s) => ({ value: s, label: TRANSFER_STATUS[s].label, dotClass: TRANSFER_STATUS[s].dot })),
];

export default function LeadTransfersPage() {
  const toast = useToast();
  const me = getUser()?.name || "You";
  const [items, setItems] = useState<TransferRequest[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

  const users = useMemo(() => listDirectory().map((u) => u.name), []);

  useEffect(() => {
    setItems(loadTransferRequests());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveTransferRequests(items);
  }, [items, ready]);

  const stats = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((t) => t.status === "Pending").length,
      approved: items.filter((t) => t.status === "Approved").length,
      rejected: items.filter((t) => t.status === "Rejected").length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((t) => filter === "all" || t.status === filter)
      .filter((t) => !q || t.leadName.toLowerCase().includes(q) || t.fromUser.toLowerCase().includes(q) || t.toUser.toLowerCase().includes(q))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [items, query, filter]);

  function create(draft: { leadName: string; fromUser: string; toUser: string; reason: string }) {
    const req: TransferRequest = {
      ...draft,
      id: newTransferId(),
      status: "Pending",
      requestedBy: me,
      requestedAt: new Date().toISOString(),
    };
    setItems((l) => [req, ...l]);
    setCreating(false);
    toast.success("Request submitted", `Transfer of ${req.leadName} sent for approval.`);
    logActivity(`Requested lead transfer: ${req.leadName} → ${req.toUser}`, { category: "lead", target: req.leadName });
  }

  function decide(t: TransferRequest, status: TransferStatus) {
    setItems((l) =>
      l.map((x) =>
        x.id === t.id ? { ...x, status, decidedBy: me, decidedAt: new Date().toISOString() } : x,
      ),
    );
    if (status === "Approved") toast.success("Transfer approved", `${t.leadName} now belongs to ${t.toUser}.`);
    else if (status === "Rejected") toast.info("Transfer rejected", t.leadName);
    else toast.info("Request cancelled", t.leadName);
    logActivity(`Lead transfer ${status.toLowerCase()}: ${t.leadName}`, { category: "lead", target: t.leadName });
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name="refresh" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Lead Transfer Requests</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">
                Request to reassign a lead to another counsellor — approved by a manager before it moves.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
          >
            <Icon name="plus" className="h-4 w-4" />
            New Request
          </button>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Total" value={stats.total} />
          <Stat label="Pending" value={stats.pending} />
          <Stat label="Approved" value={stats.approved} />
          <Stat label="Rejected" value={stats.rejected} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lead or counsellor…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <SearchableSelect value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTER_OPTIONS} className="w-full sm:w-52" />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Icon name="refresh" className="h-8 w-8" />
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-800">{items.length ? "No matching requests" : "No transfer requests yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{items.length ? "Try another status or search." : "Raise a request to hand a lead to another counsellor."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <TransferCard key={t.id} t={t} onDecide={(s) => decide(t, s)} />
          ))}
        </div>
      )}

      {creating && <RequestModal users={users} defaultFrom={me} onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}

function Person({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
        {initials(name)}
      </span>
      <span className="truncate text-sm font-medium text-slate-700">{name}</span>
    </div>
  );
}

function TransferCard({ t, onDecide }: { t: TransferRequest; onDecide: (s: TransferStatus) => void }) {
  const meta = TRANSFER_STATUS[t.status];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="leads" className="h-4 w-4 text-slate-400" />
            <p className="truncate text-sm font-bold text-slate-900">{t.leadName}</p>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Requested by {t.requestedBy} · {relativeTime(t.requestedAt)}
          </p>
        </div>

        {t.status === "Pending" && (
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => onDecide("Rejected")} className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50">
              <Icon name="close" className="h-4 w-4" />
              Reject
            </button>
            <button onClick={() => onDecide("Approved")} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
              <Icon name="check" className="h-4 w-4" />
              Approve
            </button>
          </div>
        )}
      </div>

      {/* From → To */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <Person name={t.fromUser} />
        <Icon name="refresh" className="h-4 w-4 text-blue-500" />
        <Person name={t.toUser} />
      </div>

      {t.reason && <p className="mt-3 text-sm text-slate-600">{t.reason}</p>}

      {t.status !== "Pending" && t.decidedBy && (
        <p className="mt-2 text-xs text-slate-400">
          {t.status} by {t.decidedBy} · {t.decidedAt ? relativeTime(t.decidedAt) : ""}
          {t.decisionNote ? ` — ${t.decisionNote}` : ""}
        </p>
      )}
    </div>
  );
}

function RequestModal({
  users,
  defaultFrom,
  onClose,
  onCreate,
}: {
  users: string[];
  defaultFrom: string;
  onClose: () => void;
  onCreate: (draft: { leadName: string; fromUser: string; toUser: string; reason: string }) => void;
}) {
  const toast = useToast();
  const [leadName, setLeadName] = useState("");
  const [fromUser, setFromUser] = useState(users.includes(defaultFrom) ? defaultFrom : users[0] ?? "");
  const [toUser, setToUser] = useState("");
  const [reason, setReason] = useState("");

  const userOptions: SelectOption[] = users.map((u) => ({ value: u, label: u }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (leadName.trim().length < 2) {
      toast.error("Add the lead", "Which lead should be transferred?");
      return;
    }
    if (!toUser) {
      toast.error("Pick a counsellor", "Choose who should receive the lead.");
      return;
    }
    if (toUser === fromUser) {
      toast.error("Same counsellor", "Transfer must be to a different person.");
      return;
    }
    onCreate({ leadName: leadName.trim(), fromUser, toUser, reason: reason.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_80%,white,transparent_40%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">New Transfer Request</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label="Lead" required>
            <input
              autoFocus
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="Lead name or company"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="From (current owner)">
              <SearchableSelect value={fromUser} onChange={setFromUser} options={userOptions} />
            </Field>
            <Field label="To (new owner)" required>
              <SearchableSelect value={toUser} onChange={setToUser} options={userOptions} placeholder="Select counsellor…" />
            </Field>
          </div>
          <Field label="Reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why should this lead be transferred?"
              className="no-scrollbar w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            Submit Request
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

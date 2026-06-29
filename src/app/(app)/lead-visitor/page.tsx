"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import SearchableSelect from "@/components/SearchableSelect";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import VisitorRequestForm from "@/components/VisitorRequestForm";
import { getUser } from "@/lib/auth";
import { formatVisitDate, loadVisitorRequests, saveVisitorRequests, type VisitorRequest, type VisitorStatus } from "@/lib/leadExtras";

const ALL_STATUSES: VisitorStatus[] = ["Pending", "Approved", "Completed", "Cancelled"];
const STATUS_DOT: Record<VisitorStatus, string> = {
  Pending: "bg-amber-500",
  Approved: "bg-sky-500",
  Completed: "bg-emerald-500",
  Cancelled: "bg-rose-500",
};

export default function LeadVisitorPage() {
  const toast = useToast();
  const me = getUser()?.name ?? "You";
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [filter, setFilter] = useState<"All" | VisitorStatus>("All");
  const [open, setOpen] = useState(false);
  const [reschedule, setReschedule] = useState<VisitorRequest | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setRequests(loadVisitorRequests()); setLoading(false); setReady(true); }, 500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (ready) saveVisitorRequests(requests); }, [requests, ready]);

  const shown = useMemo(() => requests.filter((r) => filter === "All" || r.status === filter), [requests, filter]);
  const counts = useMemo(() => ({
    Pending: requests.filter((r) => r.status === "Pending").length,
    Approved: requests.filter((r) => r.status === "Approved").length,
    Completed: requests.filter((r) => r.status === "Completed").length,
  }), [requests]);

  // Admin can override any request to any status.
  function setStatus(r: VisitorRequest, status: VisitorStatus) {
    if (r.status === status) return;
    setRequests((all) => all.map((x) => (x.id === r.id ? { ...x, status } : x)));
    toast.success("Status updated", `${r.leadName}'s visit → ${status}.`);
  }
  function doReschedule(newDate: string) {
    if (!reschedule) return;
    const id = reschedule.id;
    // A new date re-enters the pipeline — the visit goes back to Pending for (re)approval.
    setRequests((all) => all.map((x) => (x.id === id ? { ...x, dateOfVisit: newDate, status: "Pending" as VisitorStatus } : x)));
    toast.success("Rescheduled", `${reschedule.leadName}'s visit moved to ${formatVisitDate(newDate)} (pending).`);
    setReschedule(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lead Visitor Requests</h1>
          <p className="mt-1 text-sm text-slate-500">Scheduled visits — {counts.Pending} pending, {counts.Approved} approved.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><span className="text-base leading-none">+</span> New Request</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          {(["All", "Pending", "Approved", "Completed", "Cancelled"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === f ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{f}</button>
          ))}
        </div>
        <div className="no-scrollbar max-h-[62vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-6 py-3">Lead</th><th className="px-6 py-3">Date of Visit</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Location</th><th className="px-6 py-3">Attendee</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, r) => <tr key={r} className="border-b border-slate-100">{Array.from({ length: 7 }).map((_, c) => <td key={c} className="px-6 py-4"><Skeleton className="h-3.5 w-20" /></td>)}</tr>)
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">No visitor requests. Create one with “New Request”.</td></tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.id} className="group border-b border-slate-100 last:border-0 align-top hover:bg-slate-50">
                    <td className="px-6 py-4"><p className="font-medium text-slate-900">{r.leadName}</p><p className="text-xs text-slate-500">by {r.requestedBy}</p></td>
                    <td className="px-6 py-4 text-slate-700">{formatVisitDate(r.dateOfVisit)}</td>
                    <td className="px-6 py-4 text-slate-600">{r.visitorType}</td>
                    <td className="px-6 py-4 text-slate-600"><p>{r.location}</p><p className="max-w-[200px] truncate text-xs text-slate-400" title={r.address}>{r.address}</p></td>
                    <td className="px-6 py-4 text-slate-600">{r.attendee}</td>
                    <td className="px-6 py-4"><StatusSelect value={r.status} onChange={(s) => setStatus(r, s)} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setReschedule(r)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700">
                          <Icon name="calendar" className="h-3.5 w-3.5" /> Reschedule
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && <VisitorRequestForm requestedBy={me} onClose={() => setOpen(false)} onCreated={(req) => { setRequests((all) => [req, ...all.filter((x) => x.id !== req.id)]); setOpen(false); }} />}
      {reschedule && <RescheduleModal request={reschedule} onClose={() => setReschedule(null)} onSave={doReschedule} />}
    </div>
  );
}

function StatusSelect({ value, onChange }: { value: VisitorStatus; onChange: (s: VisitorStatus) => void }) {
  return (
    <SearchableSelect
      value={value}
      onChange={(v) => onChange(v as VisitorStatus)}
      options={ALL_STATUSES.map((s) => ({ value: s, label: s, dotClass: STATUS_DOT[s] }))}
      className="w-36"
      buttonClassName="py-1 text-xs font-semibold"
    />
  );
}

function RescheduleModal({ request, onClose, onSave }: { request: VisitorRequest; onClose: () => void; onSave: (newDate: string) => void }) {
  const [date, setDate] = useState(request.dateOfVisit);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Reschedule visit</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-slate-500">{request.leadName} · {request.visitorType}</p>
          <p className="text-xs text-slate-400">Current: {formatVisitDate(request.dateOfVisit)}</p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">New date &amp; time</label>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
          </div>
          {request.status !== "Pending" && <p className="text-xs text-amber-600">Rescheduling moves this <strong>{request.status}</strong> visit back to <strong>Pending</strong>.</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={() => date && onSave(date)} disabled={!date} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">Save new date</button>
        </div>
      </div>
    </div>
  );
}

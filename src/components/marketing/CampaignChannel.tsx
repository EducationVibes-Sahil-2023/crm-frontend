"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  CHANNEL_META,
  STATUS_META,
  deleteCampaign,
  emptyStats,
  loadMarketing,
  relativeTime,
  setCampaignStatus,
  subscribeMarketing,
  upsertCampaign,
  type Campaign,
  type Channel,
  type MarketingData,
} from "@/lib/marketing";

// One reusable view for a marketing channel (WhatsApp / Email / SMS). Lists that
// channel's campaigns, exposes a create form, and simulates sending so stats are
// populated locally — the same pattern the other local-first modules use.

export default function CampaignChannel({ channel }: { channel: Channel }) {
  const toast = useToast();
  const meta = CHANNEL_META[channel];
  const [data, setData] = useState<MarketingData>({ campaigns: [], templates: [], audiences: [] });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const refresh = () => setData(loadMarketing());
    refresh();
    return subscribeMarketing(refresh);
  }, []);

  const campaigns = useMemo(
    () => data.campaigns.filter((c) => c.channel === channel).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data, channel],
  );
  const templates = data.templates.filter((t) => t.channel === channel);
  const audiences = data.audiences;

  const stats = useMemo(() => {
    const totalRecipients = campaigns.reduce((s, c) => s + c.stats.recipients, 0);
    const delivered = campaigns.reduce((s, c) => s + c.stats.delivered, 0);
    const opened = campaigns.reduce((s, c) => s + c.stats.opened, 0);
    return {
      count: campaigns.length,
      recipients: totalRecipients,
      delivered,
      openRate: delivered ? Math.round((opened / delivered) * 100) : 0,
    };
  }, [campaigns]);

  function send(c: Campaign) {
    const recipients = c.stats.recipients || audiences.find((a) => a.id === c.audienceId)?.count || 0;
    if (recipients === 0) {
      toast.error("No recipients", "Pick an audience with contacts before sending.");
      return;
    }
    const delivered = Math.round(recipients * 0.96);
    const opened = Math.round(delivered * (channel === "email" ? 0.42 : 0.72));
    const clicked = Math.round(opened * 0.22);
    upsertCampaign({
      ...c,
      status: "sent",
      stats: { recipients, sent: recipients, delivered, opened, clicked, failed: recipients - delivered },
    });
    toast.success("Campaign sent", `${meta.short} campaign "${c.name}" delivered to ${delivered.toLocaleString("en-IN")} contacts.`);
  }

  function remove(c: Campaign) {
    deleteCampaign(c.id);
    toast.info("Campaign deleted", `"${c.name}" was removed.`);
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-7">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur">
              <Icon name={meta.icon} className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{meta.label}</h1>
              <p className="mt-1 max-w-md text-sm text-blue-100">
                Create broadcast campaigns, target a saved audience, and track delivery & engagement.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
          >
            <Icon name={creating ? "close" : "plus"} className="h-4 w-4" />
            {creating ? "Close" : "New campaign"}
          </button>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Campaigns" value={String(stats.count)} />
          <Stat label="Recipients" value={stats.recipients.toLocaleString("en-IN")} />
          <Stat label="Delivered" value={stats.delivered.toLocaleString("en-IN")} />
          <Stat label="Open rate" value={`${stats.openRate}%`} />
        </div>
      </div>

      {/* Create form */}
      {creating && (
        <CampaignForm
          channel={channel}
          audiences={audiences}
          templates={templates}
          onDone={() => setCreating(false)}
        />
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <EmptyState channel={channel} onCreate={() => setCreating(true)} hasAudiences={audiences.length > 0} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Campaign</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Recipients</th>
                <th className="px-5 py-3 text-right">Delivered</th>
                <th className="px-5 py-3 text-right">Opened</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const s = STATUS_META[c.status];
                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{c.name}</p>
                      <p className="truncate text-xs text-slate-400">{c.message || "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{c.stats.recipients.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{c.stats.delivered.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{c.stats.opened.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{relativeTime(c.updatedAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(c.status === "draft" || c.status === "scheduled" || c.status === "paused") && (
                          <button onClick={() => send(c)} title="Send now" className="rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50">
                            Send
                          </button>
                        )}
                        {c.status === "sending" && (
                          <button onClick={() => setCampaignStatus(c.id, "paused")} title="Pause" className="rounded-md px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50">
                            Pause
                          </button>
                        )}
                        <button onClick={() => remove(c)} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                          <Icon name="trash" className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CampaignForm({
  channel,
  audiences,
  templates,
  onDone,
}: {
  channel: Channel;
  audiences: MarketingData["audiences"];
  templates: MarketingData["templates"];
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setMessage(t.body);
      if (channel === "email" && t.subject) setSubject(t.subject);
    }
  }

  function submit(sendNow: boolean) {
    if (!name.trim()) {
      toast.error("Name required", "Give the campaign a name.");
      return;
    }
    if (!message.trim()) {
      toast.error("Message required", "Write a message or pick a template.");
      return;
    }
    const audience = audiences.find((a) => a.id === audienceId);
    const recipients = audience?.count ?? 0;
    const scheduled = when === "later" && scheduledAt;

    if (sendNow && recipients === 0) {
      toast.error("No recipients", "Pick an audience with contacts to send now.");
      return;
    }

    if (sendNow) {
      const delivered = Math.round(recipients * 0.96);
      const opened = Math.round(delivered * (channel === "email" ? 0.42 : 0.72));
      const clicked = Math.round(opened * 0.22);
      upsertCampaign({
        name, channel, status: "sent", audienceId: audienceId || null, templateId: templateId || null,
        subject, message, scheduledAt: "",
        stats: { recipients, sent: recipients, delivered, opened, clicked, failed: recipients - delivered },
      });
      toast.success("Campaign sent", `"${name}" delivered to ${delivered.toLocaleString("en-IN")} contacts.`);
    } else {
      upsertCampaign({
        name, channel, status: scheduled ? "scheduled" : "draft", audienceId: audienceId || null,
        templateId: templateId || null, subject, message, scheduledAt: scheduled ? new Date(scheduledAt).toISOString() : "",
        stats: emptyStats(recipients),
      });
      toast.success(scheduled ? "Campaign scheduled" : "Draft saved", `"${name}" ${scheduled ? "is scheduled" : "saved as a draft"}.`);
    }
    onDone();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-slate-800">New {CHANNEL_META[channel].short} campaign</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campaign name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. July offer blast" className={inputCls} />
        </Field>
        <Field label="Audience">
          <select value={audienceId} onChange={(e) => setAudienceId(e.target.value)} className={inputCls}>
            <option value="">Select an audience…</option>
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.count.toLocaleString("en-IN")})</option>
            ))}
          </select>
        </Field>
        {templates.length > 0 && (
          <Field label="Template (optional)">
            <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className={inputCls}>
              <option value="">Start from scratch…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        )}
        {channel === "email" && (
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" className={inputCls} />
          </Field>
        )}
        <Field label="Message" full>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={`Your ${CHANNEL_META[channel].short} message…`} className={`${inputCls} resize-y`} />
        </Field>
        <Field label="Schedule" full>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="radio" checked={when === "now"} onChange={() => setWhen("now")} className="accent-blue-600" /> Send now
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="radio" checked={when === "later"} onChange={() => setWhen("later")} className="accent-blue-600" /> Schedule
            </label>
            {when === "later" && (
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={`${inputCls} w-auto`} />
            )}
          </div>
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button onClick={() => submit(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          {when === "later" ? "Schedule" : "Save draft"}
        </button>
        <button onClick={() => submit(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          <Icon name="send" className="h-4 w-4" /> Send now
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}

function EmptyState({ channel, onCreate, hasAudiences }: { channel: Channel; onCreate: () => void; hasAudiences: boolean }) {
  const meta = CHANNEL_META[channel];
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon name={meta.icon} className="h-8 w-8" />
      </div>
      <p className="mt-4 text-lg font-semibold text-slate-800">No {meta.short} campaigns yet</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {hasAudiences
          ? `Create your first ${meta.short} campaign to broadcast to a saved audience.`
          : "Create an audience first, then launch a campaign to it."}
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={onCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">New campaign</button>
        {!hasAudiences && (
          <Link href="/marketing/audiences" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Add audience
          </Link>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  CHANNELS,
  CHANNEL_META,
  deleteTemplate,
  loadMarketing,
  subscribeMarketing,
  upsertTemplate,
  type Channel,
  type MarketingData,
} from "@/lib/marketing";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export default function TemplatesPage() {
  const toast = useToast();
  const [data, setData] = useState<MarketingData>({ campaigns: [], templates: [], audiences: [] });
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    const refresh = () => setData(loadMarketing());
    refresh();
    return subscribeMarketing(refresh);
  }, []);

  const templates = useMemo(
    () => [...data.templates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data],
  );

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      toast.error("Missing fields", "A template needs a name and a message body.");
      return;
    }
    upsertTemplate({ name, channel, subject, body });
    toast.success("Template saved", `"${name.trim()}" is ready to use in campaigns.`);
    setName(""); setSubject(""); setBody("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Campaign Templates</h1>
        <p className="mt-1 text-sm text-slate-500">Reusable message templates for your WhatsApp, Email and SMS campaigns.</p>
      </div>

      {/* Create */}
      <form onSubmit={add} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-800">New template</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome message" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className={inputCls}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{CHANNEL_META[c].label}</option>
              ))}
            </select>
          </div>
          {channel === "email" && (
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" className={inputCls} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Message body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Use {{name}} to personalise…" className={`${inputCls} resize-y`} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <span className="text-base leading-none">+</span> Save template
          </button>
        </div>
      </form>

      {/* List */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          No templates yet. Create one above to reuse across campaigns.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const meta = CHANNEL_META[t.channel];
            return (
              <div key={t.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
                    <Icon name={meta.icon} className="h-3.5 w-3.5" /> {meta.short}
                  </span>
                  <button onClick={() => { deleteTemplate(t.id); toast.info("Template deleted", `"${t.name}" removed.`); }} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                    <Icon name="trash" className="h-[18px] w-[18px]" />
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{t.name}</p>
                {t.channel === "email" && t.subject && <p className="mt-0.5 text-xs font-medium text-slate-500">Subject: {t.subject}</p>}
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-slate-500">{t.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

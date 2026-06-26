"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { optionNames } from "@/lib/setup";
import { listDirectory } from "@/lib/directory";
import {
  captureLead,
  captureMany,
  findDuplicate,
  loadIntakeLeads,
  makeIntakeLead,
  subscribeLeads,
  type IntakeLead,
} from "@/lib/leadStore";
import { notifyLeadTransferred, notifyNewLead } from "@/lib/leadNotify";
import {
  DEDUPE_FIELDS,
  DEFAULT_FIELDS,
  embedSnippet,
  loadForms,
  MAPPABLE_KEYS,
  newForm,
  parseCsv,
  pickAssignee,
  publicFormUrl,
  recordToLead,
  sampleCurl,
  saveForms,
  webhookUrl,
  type AutoAssign,
  type FieldType,
  type FormField,
  type LeadFormDef,
} from "@/lib/forms";
import {
  loadNotifs,
  loadPrefs,
  pushPermission,
  pushSupported,
  requestPush,
  saveNotifs,
  savePrefs,
  type Notif,
  type NotifPrefs,
} from "@/lib/notify";

const SAMPLE_FIRST = ["Aarav", "Diya", "Vivaan", "Ananya", "Arjun", "Saanvi", "Ishaan", "Myra", "Kabir", "Aditya"];
const SAMPLE_LAST = ["Sharma", "Patel", "Reddy", "Nair", "Iyer", "Khanna", "Joshi", "Mehta", "Verma", "Rao"];
const SAMPLE_COMP = ["Infosys", "TCS", "Wipro", "HCL", "Reliance", "Flipkart", "Zomato", "Paytm"];
const SAMPLE_CITY = ["Mumbai", "Bengaluru", "Delhi", "Hyderabad", "Chennai", "Pune"];

// Module-level (not "during render") — builds a realistic Indian sample lead.
function randomSampleLead(formId: string): Partial<IntakeLead> & { name: string } {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const fn = pick(SAMPLE_FIRST);
  const ln = pick(SAMPLE_LAST);
  return {
    name: `${fn} ${ln}`,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
    phone: `+91 ${90000 + Math.floor(Math.random() * 9999)} ${10000 + Math.floor(Math.random() * 89999)}`,
    company: pick(SAMPLE_COMP),
    city: pick(SAMPLE_CITY),
    formId,
  };
}

export default function FormsPage() {
  const toast = useToast();
  const [forms, setForms] = useState<LeadFormDef[]>(loadForms);
  const [intake, setIntake] = useState<IntakeLead[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [prefs, setPrefs] = useState<NotifPrefs>({ push: false, email: true });
  const [ready, setReady] = useState(false);

  const [builder, setBuilder] = useState<{ open: boolean; editing: LeadFormDef | null }>({ open: false, editing: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    setForms(loadForms());
    setIntake(loadIntakeLeads());
    setNotifs(loadNotifs());
    setPrefs(loadPrefs());
    setReady(true);
    // Live updates: any capture (this tab or another) refreshes the feed + alerts.
    return subscribeLeads(() => {
      setIntake(loadIntakeLeads());
      setNotifs(loadNotifs());
    });
  }, []);
  useEffect(() => { if (ready) saveForms(forms); }, [forms, ready]);
  useEffect(() => { if (ready) saveNotifs(notifs); }, [notifs, ready]);
  useEffect(() => { if (ready) savePrefs(prefs); }, [prefs, ready]);

  const detail = detailId ? forms.find((f) => f.id === detailId) ?? null : null;
  const unread = notifs.filter((n) => !n.read).length;
  const todayCount = useMemo(() => intake.length, [intake]);

  // Capture one lead: applies duplicate rules, auto-assignment and alerts.
  // Returns "ok" or "duplicate" (blocked because duplicates aren't allowed).
  function capture(form: LeadFormDef, partial: Partial<IntakeLead> & { name: string }, channel: IntakeLead["channel"], seq: number): "ok" | "duplicate" {
    const assignedTo = pickAssignee(form, seq, listDirectory());
    const lead = makeIntakeLead({ ...partial, assignedTo }, channel, form.defaults);
    if (!form.allowDuplicates && findDuplicate(lead, form.dedupeFields)) return "duplicate";
    captureLead(lead);
    notifyNewLead(lead);
    if (form.notifyOnTransfer && assignedTo) notifyLeadTransferred(lead);
    return "ok";
  }

  function simulate(form: LeadFormDef, channel: IntakeLead["channel"]) {
    const res = capture(form, randomSampleLead(form.id), channel, form.submissions);
    if (res === "duplicate") {
      toast.error("Duplicate blocked", "A lead with the same email/phone already exists.");
      return;
    }
    setForms((list) => list.map((f) => (f.id === form.id ? { ...f, submissions: f.submissions + 1 } : f)));
    setIntake(loadIntakeLeads());
    setNotifs(loadNotifs());
    const lead = loadIntakeLeads()[0];
    toast.success("Lead captured", `${lead?.name} via ${channel}${lead?.assignedTo ? ` → ${lead.assignedTo}` : ""}`);
  }

  function importCsv(form: LeadFormDef, text: string): { added: number; skipped: number } {
    const { rows } = parseCsv(text);
    const candidates = rows.map((r) => recordToLead(r)).filter((r) => r.name && r.name !== "Unknown");
    const toAdd: IntakeLead[] = [];
    let skipped = 0;
    candidates.forEach((r) => {
      const assignedTo = pickAssignee(form, form.submissions + toAdd.length, listDirectory());
      const lead = makeIntakeLead({ ...r, formId: form.id, assignedTo }, "Excel Import", form.defaults);
      // Dedupe against the store and within this batch.
      const dupInBatch = !form.allowDuplicates && toAdd.some((l) => form.dedupeFields.some((f) => (l as unknown as Record<string, string>)[f] && (l as unknown as Record<string, string>)[f] === (lead as unknown as Record<string, string>)[f]));
      if (!form.allowDuplicates && (findDuplicate(lead, form.dedupeFields) || dupInBatch)) { skipped++; return; }
      toAdd.push(lead);
    });
    if (toAdd.length) {
      captureMany(toAdd);
      toAdd.forEach((l) => { notifyNewLead(l); if (form.notifyOnTransfer && l.assignedTo) notifyLeadTransferred(l); });
      setForms((list) => list.map((f) => (f.id === form.id ? { ...f, submissions: f.submissions + toAdd.length } : f)));
      setIntake(loadIntakeLeads());
      setNotifs(loadNotifs());
    }
    return { added: toAdd.length, skipped };
  }

  function saveForm(def: LeadFormDef) {
    setForms((list) => (list.some((f) => f.id === def.id) ? list.map((f) => (f.id === def.id ? def : f)) : [def, ...list]));
    setBuilder({ open: false, editing: null });
    toast.success(builder.editing ? "Form updated" : "Form created", def.name);
  }
  function deleteForm(id: string) {
    setForms((list) => list.filter((f) => f.id !== id));
    setDetailId(null);
    toast.info("Form deleted");
  }

  async function enablePush() {
    const perm = await requestPush();
    if (perm === "granted") { setPrefs((p) => ({ ...p, push: true })); toast.success("Push notifications on"); }
    else toast.error("Push blocked", "Allow notifications in your browser.");
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_45%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur"><Icon name="edit" className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Lead Forms &amp; Intake</h1>
              <p className="mt-1 max-w-lg text-sm text-blue-100">Capture leads from your website, Excel/CSV and webhooks — straight into the CRM in real time, with push &amp; email alerts.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNotifOpen(true)} className="relative flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20">
              <Icon name="bell" className="h-4 w-4" />
              {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">{unread}</span>}
            </button>
            <button onClick={() => setBuilder({ open: true, editing: null })} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              <Icon name="folderPlus" className="h-4 w-4" /> New Form
            </button>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Stat label="Forms" value={forms.length} />
          <Stat label="Leads captured" value={todayCount} />
          <Stat label="Channels" value={3} />
        </div>
      </div>

      {/* Forms list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {forms.map((f) => (
          <FormCard key={f.id} form={f} onOpen={() => setDetailId(f.id)} onSimulate={() => simulate(f, "Website Form")} />
        ))}
      </div>

      {/* Live intake feed */}
      <LiveFeed intake={intake} />

      {builder.open && (
        <FormBuilder editing={builder.editing} onClose={() => setBuilder({ open: false, editing: null })} onSave={saveForm} />
      )}
      {detail && (
        <FormDetail
          form={detail}
          intake={intake.filter((l) => l.formId === detail.id)}
          onClose={() => setDetailId(null)}
          onEdit={() => setBuilder({ open: true, editing: detail })}
          onDelete={() => deleteForm(detail.id)}
          onSimulate={(ch) => simulate(detail, ch)}
          onImport={(text) => importCsv(detail, text)}
        />
      )}
      {notifOpen && (
        <NotifCenter
          notifs={notifs} prefs={prefs}
          onClose={() => setNotifOpen(false)}
          onMarkAll={() => setNotifs((l) => l.map((n) => ({ ...n, read: true })))}
          onClear={() => setNotifs([])}
          onEnablePush={enablePush}
          onTogglePush={() => (prefs.push ? setPrefs((p) => ({ ...p, push: false })) : enablePush())}
          onToggleEmail={() => setPrefs((p) => ({ ...p, email: !p.email }))}
        />
      )}
    </div>
  );
}

// ---- bits ----

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-100">{label}</p>
    </div>
  );
}

const CHANNEL_META: { key: "website" | "excel" | "webhook"; label: string; icon: IconName }[] = [
  { key: "website", label: "Website", icon: "visitor" },
  { key: "excel", label: "Excel/CSV", icon: "fileText" },
  { key: "webhook", label: "Webhook", icon: "plug" },
];

function FormCard({ form, onOpen, onSimulate }: { form: LeadFormDef; onOpen: () => void; onSimulate: () => void }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="min-w-0 text-left">
          <h3 className="truncate text-base font-semibold text-slate-900 hover:text-blue-700">{form.name}</h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{form.description || `${form.fields.length} fields`}</p>
        </button>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{form.submissions} leads</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CHANNEL_META.filter((c) => form.channels[c.key]).map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"><Icon name={c.icon} className="h-3 w-3" />{c.label}</span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button onClick={onOpen} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"><Icon name="plug" className="h-3.5 w-3.5" /> Connect</button>
        <button onClick={onSimulate} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"><Icon name="refresh" className="h-3.5 w-3.5" /> Test capture</button>
      </div>
    </div>
  );
}

function LiveFeed({ intake }: { intake: IntakeLead[] }) {
  const recent = intake.slice(0, 8);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          Live intake
        </h2>
        <span className="text-xs text-slate-400">{intake.length} captured</span>
      </div>
      {recent.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No leads captured yet. Use “Test capture”, import a CSV, or submit the public form.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-50">
          {recent.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{l.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{l.name} <span className="font-normal text-slate-400">· {l.company}</span></p>
                <p className="truncate text-xs text-slate-400">{l.email} · {l.city}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{l.channel}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Copyable code block ----

function Copyable({ text, mono = true }: { text: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }
  return (
    <div className="relative">
      <pre className={`max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 pr-12 text-xs text-slate-700 ${mono ? "font-mono" : ""} whitespace-pre-wrap break-all`}>{text}</pre>
      <button onClick={copy} className="absolute right-2 top-2 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

// ---- Form detail / connect drawer ----

function FormDetail({ form, intake, onClose, onEdit, onDelete, onSimulate, onImport }: {
  form: LeadFormDef; intake: IntakeLead[];
  onClose: () => void; onEdit: () => void; onDelete: () => void;
  onSimulate: (ch: IntakeLead["channel"]) => void; onImport: (text: string) => { added: number; skipped: number };
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"website" | "excel" | "webhook" | "submissions">("website");
  const [csv, setCsv] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function doImport() {
    const { added, skipped } = onImport(csv);
    if (added > 0) {
      toast.success("Imported", `${added} lead${added > 1 ? "s" : ""} added${skipped ? `, ${skipped} duplicate${skipped > 1 ? "s" : ""} skipped` : ""}.`);
      setCsv("");
    } else if (skipped > 0) {
      toast.error("All duplicates", `${skipped} row${skipped > 1 ? "s" : ""} skipped (already in CRM).`);
    } else {
      toast.error("Nothing imported", "Add a header row with a 'name' column.");
    }
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file.text().then((t) => setCsv(t)).catch(() => toast.error("Couldn't read file"));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="no-scrollbar flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_80%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{form.name}</h2>
              <p className="text-xs text-blue-100">{form.submissions} leads · {form.fields.length} fields</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onEdit} aria-label="Edit" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="edit" className="h-4 w-4" /></button>
              <button onClick={onDelete} aria-label="Delete" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="trash" className="h-4 w-4" /></button>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
            </div>
          </div>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-6">
          <DTab active={tab === "website"} onClick={() => setTab("website")} label="Website" />
          <DTab active={tab === "excel"} onClick={() => setTab("excel")} label="Excel/CSV" />
          <DTab active={tab === "webhook"} onClick={() => setTab("webhook")} label="Webhook" />
          <DTab active={tab === "submissions"} onClick={() => setTab("submissions")} label={`Leads (${intake.length})`} />
        </div>

        <div className="flex-1 space-y-4 px-6 py-5">
          {tab === "website" && (
            <>
              <Hint icon="visitor">Share the public link or embed the form on your site. Submissions land in the CRM in real time.</Hint>
              <Labelled label="Public form link">
                <div className="flex gap-2">
                  <input readOnly value={publicFormUrl(form.id)} className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600" />
                  <a href={publicFormUrl(form.id)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="expand" className="h-4 w-4" /> Open</a>
                </div>
              </Labelled>
              <Labelled label="Embed snippet (iframe)"><Copyable text={embedSnippet(form)} /></Labelled>
              <button onClick={() => onSimulate("Website Form")} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Icon name="refresh" className="h-4 w-4" /> Simulate a website submission</button>
            </>
          )}

          {tab === "excel" && (
            <>
              <Hint icon="fileText">Paste rows from Excel/Google Sheets or upload a .csv. Include a header row — we map name, email, phone, company, city, state automatically.</Hint>
              <div className="flex items-center gap-2">
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Icon name="upload" className="h-4 w-4" /> Upload .csv</button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
                <span className="text-xs text-slate-400">or paste below</span>
              </div>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} placeholder={"name,email,phone,company,city\nAarav Sharma,aarav@example.com,+91 98765 43210,Infosys,Mumbai"} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              <button onClick={doImport} disabled={!csv.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"><Icon name="download" className="h-4 w-4" /> Import to CRM</button>
            </>
          )}

          {tab === "webhook" && (
            <>
              <Hint icon="plug">POST JSON to this endpoint from any external system. Each request creates a lead and notifies the CRM. Secure it with the secret header.</Hint>
              <Labelled label="Endpoint URL"><Copyable text={webhookUrl(form.id)} /></Labelled>
              <Labelled label="Secret header"><Copyable text={`X-Webhook-Secret: ${form.webhookSecret}`} /></Labelled>
              <Labelled label="Sample request"><Copyable text={sampleCurl(form)} /></Labelled>
              <button onClick={() => onSimulate("Webhook")} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Icon name="refresh" className="h-4 w-4" /> Send test webhook</button>
            </>
          )}

          {tab === "submissions" && (
            intake.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No leads from this form yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {intake.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">{l.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{l.name}</p><p className="truncate text-xs text-slate-400">{l.email} · {l.channel}</p></div>
                    <span className="shrink-0 text-xs text-slate-400">{l.createdDate}</span>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Hint({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-800"><Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" /><span>{children}</span></div>;
}
function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>{children}</div>;
}
function DTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-xs font-semibold transition ${active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{label}</button>;
}

// ---- Form builder ----

const FIELD_TYPES: FieldType[] = ["text", "email", "phone", "textarea", "select"];

const WIZARD_STEPS = ["Form information", "Form builder", "Integration"];
const LOCATION_FIELDS: FormField[] = [
  { key: "city", label: "City", type: "text", required: false },
  { key: "state", label: "State", type: "text", required: false },
];

function FormBuilder({ editing, onClose, onSave }: { editing: LeadFormDef | null; onClose: () => void; onSave: (f: LeadFormDef) => void }) {
  const toast = useToast();
  const base = useMemo(() => editing ?? newForm("New form"), [editing]);
  const statuses = useMemo(() => optionNames("status"), []);
  const sources = useMemo(() => optionNames("source"), []);
  const types = useMemo(() => optionNames("type"), []);
  const directory = useMemo(() => listDirectory(), []);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(base.description);
  const [fields, setFields] = useState<FormField[]>(base.fields.length ? base.fields : DEFAULT_FIELDS);
  const [defaults, setDefaults] = useState(base.defaults);
  const [channels, setChannels] = useState(base.channels);
  const [isPublic, setIsPublic] = useState(base.isPublic);
  const [successMessage, setSuccessMessage] = useState(base.successMessage);
  const [allowDuplicates, setAllowDuplicates] = useState(base.allowDuplicates);
  const [dedupeFields, setDedupeFields] = useState<string[]>(base.dedupeFields);
  const [autoAssign, setAutoAssign] = useState<AutoAssign>(base.autoAssign);
  const [notifyOnTransfer, setNotifyOnTransfer] = useState(base.notifyOnTransfer);

  const assembled: LeadFormDef = {
    ...base,
    name: name.trim() || "Untitled form",
    description: description.trim(),
    fields, defaults, channels, isPublic, successMessage, allowDuplicates, dedupeFields, autoAssign, notifyOnTransfer,
  };

  function addField() { setFields((l) => [...l, { key: `custom_${l.length}`, label: "New field", type: "text", required: false }]); }
  function updateField(i: number, patch: Partial<FormField>) { setFields((l) => l.map((f, idx) => (idx === i ? { ...f, ...patch } : f))); }
  function removeField(i: number) { setFields((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : l)); }
  function addLocationFields() {
    setFields((l) => [...l, ...LOCATION_FIELDS.filter((lf) => !l.some((f) => f.key === lf.key)).map((f) => ({ ...f }))]);
  }
  const hasLocation = fields.some((f) => f.key === "city") && fields.some((f) => f.key === "state");

  function next() {
    if (step === 0 && name.trim().length < 2) return toast.error("Name your form");
    if (step === 1 && !fields.some((f) => f.key === "name")) return toast.error("Add a name field", "A field must map to 'name'.");
    setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
  }
  function save() {
    if (name.trim().length < 2) { setStep(0); return toast.error("Name your form"); }
    if (!fields.some((f) => f.key === "name")) { setStep(1); return toast.error("Add a name field"); }
    onSave(assembled);
  }

  function toggleDedupe(k: string) {
    setDedupeFields((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="no-scrollbar my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_15%_20%,white,transparent_80%)]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? "Edit Form" : "New Form"}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white"><Icon name="close" className="h-5 w-5" /></button>
          </div>
          {/* Stepper */}
          <div className="relative mt-4 flex items-center gap-2">
            {WIZARD_STEPS.map((s, i) => (
              <button key={s} type="button" onClick={() => setStep(i)} className="flex flex-1 items-center gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === step ? "bg-white text-blue-700" : i < step ? "bg-white/40 text-white" : "bg-white/15 text-white/70"}`}>{i < step ? "✓" : i + 1}</span>
                <span className={`hidden truncate text-xs font-medium sm:block ${i === step ? "text-white" : "text-blue-100"}`}>{s}</span>
                {i < WIZARD_STEPS.length - 1 && <span className="h-px flex-1 bg-white/25" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          {/* STEP 1 — Form information */}
          {step === 0 && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Form name <span className="text-rose-500">*</span></label>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Admission Enquiry" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown at the top of the public form" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Success message <span className="text-slate-400">(shown after submit)</span></label>
                <textarea value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Defaults applied to captured leads</label>
                <div className="grid grid-cols-3 gap-2">
                  <SelectMini label="Status" value={defaults.status} options={statuses} onChange={(v) => setDefaults((d) => ({ ...d, status: v }))} />
                  <SelectMini label="Source" value={defaults.source} options={sources} onChange={(v) => setDefaults((d) => ({ ...d, source: v }))} />
                  <SelectMini label="Type" value={defaults.type} options={types} onChange={(v) => setDefaults((d) => ({ ...d, type: v }))} />
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <SwitchRow label="Mark form as public" sub="Auto-publish so the link/embed works immediately." on={isPublic} onToggle={() => setIsPublic((v) => !v)} />
                <SwitchRow label="Allow duplicate leads" sub="Insert a lead even if it matches an existing one." on={allowDuplicates} onToggle={() => setAllowDuplicates((v) => !v)} />
                {!allowDuplicates && (
                  <div className="pl-1">
                    <p className="mb-1.5 text-[11px] font-medium text-slate-500">Prevent duplicates on:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DEDUPE_FIELDS.map((k) => (
                        <button key={k} type="button" onClick={() => toggleDedupe(k)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${dedupeFields.includes(k) ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>{k}</button>
                      ))}
                    </div>
                  </div>
                )}
                <SwitchRow label="Notify when lead is transferred" sub="Alert when a lead is auto-assigned to a counsellor." on={notifyOnTransfer} onToggle={() => setNotifyOnTransfer((v) => !v)} />
                <SwitchRow label="Auto-assignation" sub="Automatically assign each new lead." on={autoAssign.enabled} onToggle={() => setAutoAssign((a) => ({ ...a, enabled: !a.enabled }))} />
                {autoAssign.enabled && (
                  <div className="grid grid-cols-2 gap-2 pl-1">
                    <SelectMini label="Mode" value={autoAssign.mode} options={["round-robin", "specific"]} onChange={(v) => setAutoAssign((a) => ({ ...a, mode: v as AutoAssign["mode"] }))} />
                    {autoAssign.mode === "specific" && (
                      <div>
                        <p className="mb-1 text-[11px] text-slate-400">Counsellor</p>
                        <select value={autoAssign.userEmail} onChange={(e) => setAutoAssign((a) => ({ ...a, userEmail: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-blue-500">
                          <option value="">Select…</option>
                          {directory.map((u) => <option key={u.email} value={u.email}>{u.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP 2 — Form builder */}
          {step === 1 && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Fields used in this form</label>
                <div className="flex gap-2">
                  {!hasLocation && <button type="button" onClick={addLocationFields} className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><Icon name="pin" className="h-3.5 w-3.5" /> Add City &amp; State</button>}
                  <button type="button" onClick={addField} className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><Icon name="plus" className="h-3.5 w-3.5" /> Add field</button>
                </div>
              </div>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Label" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
                    <select value={MAPPABLE_KEYS.includes(f.key as typeof MAPPABLE_KEYS[number]) ? f.key : "custom"} onChange={(e) => updateField(i, { key: e.target.value === "custom" ? `custom_${i}` : e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500" title="Maps to">
                      {MAPPABLE_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                      <option value="custom">custom</option>
                    </select>
                    <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FieldType })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600" /> req</label>
                    <button type="button" onClick={() => removeField(i)} aria-label="Remove" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="close" className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Enabled channels</label>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_META.map((c) => {
                    const on = channels[c.key];
                    return (
                      <button key={c.key} type="button" onClick={() => setChannels((s) => ({ ...s, [c.key]: !s[c.key] }))} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
                        <Icon name={c.icon} className="h-3.5 w-3.5" /> {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* STEP 3 — Integration + docs */}
          {step === 2 && <IntegrationDocs form={assembled} saved={!!editing} />}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{step === 0 ? "Cancel" : "Back"}</button>
          <div className="flex items-center gap-2">
            {step < WIZARD_STEPS.length - 1 && <button type="button" onClick={next} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Next</button>}
            <button type="button" onClick={save} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{editing ? "Save Changes" : "Create Form"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SwitchRow({ label, sub, on, onToggle }: { label: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400">{sub}</p></div>
      <button type="button" onClick={onToggle} aria-pressed={on} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function IntegrationDocs({ form, saved }: { form: LeadFormDef; saved: boolean }) {
  return (
    <div className="space-y-4">
      {!saved && <Hint icon="alert">Save the form to activate these endpoints. The code below is ready to copy now.</Hint>}
      <div>
        <p className="mb-1 text-sm font-semibold text-slate-800">1. Website — public link</p>
        <p className="mb-2 text-xs text-slate-500">Share this link, or send people straight to the hosted form.</p>
        <Copyable text={publicFormUrl(form.id)} mono={false} />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-slate-800">2. Website — embed on your site</p>
        <p className="mb-2 text-xs text-slate-500">Paste this snippet where you want the form to appear.</p>
        <Copyable text={embedSnippet(form)} />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-slate-800">3. Webhook — push from any system</p>
        <p className="mb-2 text-xs text-slate-500">POST JSON to your endpoint with the secret header. Each request creates a lead in real time.</p>
        <Copyable text={sampleCurl(form)} />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-slate-800">4. Excel / CSV</p>
        <p className="text-xs text-slate-500">Open this form → <strong>Excel/CSV</strong> tab, then paste rows or upload a .csv with a header row. Columns auto-map to name, email, phone, company, city and state.</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">How it works</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>Every submission lands in <strong>Leads</strong> instantly with status <strong>{form.defaults.status}</strong>, source <strong>{form.defaults.source}</strong>.</li>
          <li>{form.allowDuplicates ? "Duplicates are allowed." : `Duplicates are blocked by: ${form.dedupeFields.join(", ") || "—"}.`}</li>
          <li>{form.autoAssign.enabled ? `Auto-assigned (${form.autoAssign.mode}).` : "No auto-assignment."} {form.notifyOnTransfer ? "Transfer alerts on." : ""}</li>
          <li>You get a push + email + in-app notification on every new lead.</li>
        </ul>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function SelectMini({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-slate-400">{label}</p>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-blue-500">
        {(options.length ? options : [value]).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ---- Notification center ----

function NotifCenter({ notifs, prefs, onClose, onMarkAll, onClear, onEnablePush, onTogglePush, onToggleEmail }: {
  notifs: Notif[]; prefs: NotifPrefs; onClose: () => void; onMarkAll: () => void; onClear: () => void;
  onEnablePush: () => void; onTogglePush: () => void; onToggleEmail: () => void;
}) {
  const perm = pushSupported() ? pushPermission() : "denied";
  const icon: Record<Notif["channel"], IconName> = { push: "bell", email: "gmail", app: "message" };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="no-scrollbar flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Icon name="bell" className="h-5 w-5 text-blue-600" /> Notifications</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Alerts</p>
          <Toggle icon="bell" label="Browser push" sub={!pushSupported() ? "Not supported" : perm === "denied" ? "Blocked" : prefs.push ? "On" : "Off"} on={prefs.push && perm === "granted"} onClick={onTogglePush} disabled={!pushSupported() || perm === "denied"} />
          <Toggle icon="gmail" label="Email alerts" sub={prefs.email ? "On" : "Off"} on={prefs.email} onClick={onToggleEmail} />
          {pushSupported() && perm === "default" && <button onClick={onEnablePush} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Enable browser push</button>}
        </div>
        <div className="flex items-center justify-between px-5 py-2.5 text-xs">
          <span className="text-slate-400">{notifs.length} notification{notifs.length === 1 ? "" : "s"}</span>
          <div className="flex gap-3"><button onClick={onMarkAll} className="font-semibold text-blue-600 hover:underline">Mark all read</button><button onClick={onClear} className="font-semibold text-slate-400 hover:text-slate-600">Clear</button></div>
        </div>
        <ul className="flex-1 divide-y divide-slate-100">
          {notifs.length === 0 ? (
            <li className="flex flex-col items-center justify-center py-16 text-center"><Icon name="bell" className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-400">No notifications yet.</p></li>
          ) : notifs.map((n) => (
            <li key={n.id} className={`flex gap-3 px-5 py-3 ${n.read ? "" : "bg-blue-50/40"}`}>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.channel === "email" ? "bg-violet-100 text-violet-600" : n.channel === "push" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}><Icon name={icon[n.channel]} className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{n.channel}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Toggle({ icon, label, sub, on, onClick, disabled }: { icon: IconName; label: string; sub: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200"><Icon name={icon} className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400">{sub}</p></div>
      <button onClick={onClick} disabled={disabled} aria-pressed={on} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-blue-600" : "bg-slate-300"} ${disabled ? "opacity-40" : ""}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

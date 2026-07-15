"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { listTenants } from "@/lib/tenantsApi";
import {
  listDatabases, dbOverview, tableInfo, tableData, getSchedule, saveSchedule, listBackups, runBackup, fmtBytes,
  type DbEntry, type Overview, type TableInfo, type TableData, type Schedule, type Backup,
} from "@/lib/dbAdmin";

export default function DatabasePage() {
  const toast = useToast();
  const [dbs, setDbs] = useState<DbEntry[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [db, setDb] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [table, setTable] = useState<string | null>(null);
  const [tab, setTab] = useState<"structure" | "data">("structure");
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [search, setSearch] = useState("");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState<string>("");

  // Initial load: databases, client labels, schedule, backups.
  useEffect(() => {
    (async () => {
      try {
        const [ds, tenants] = await Promise.all([listDatabases(), listTenants().catch(() => ({ clients: [] as { company: string; database: string }[] }))]);
        setDbs(ds);
        const map: Record<string, string> = {};
        for (const c of tenants.clients ?? []) map[c.database] = c.company;
        setLabels(map);
        const first = ds.find((d) => d.isMain)?.database ?? ds[0]?.database ?? "";
        setDb(first);
        getSchedule().then(setSchedule).catch(() => {});
        listBackups().then(setBackups).catch(() => {});
      } catch (e) {
        toast.error("Couldn't load databases", (e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load overview when the selected DB changes; auto-select the first table.
  useEffect(() => {
    if (!db) return;
    let alive = true;
    const load = () => {
      setOverview(null); setTable(null); setInfo(null); setData(null);
      dbOverview(db)
        .then((o) => { if (!alive) return; setOverview(o); if (o.tables[0]) selectTable(o.tables[0].name, db); })
        .catch((e) => toast.error("Couldn't load database", (e as Error).message));
    };
    load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  function selectTable(t: string, forDb = db) {
    setTable(t); setInfo(null); setData(null);
    tableInfo(forDb, t).then(setInfo).catch(() => {});
    tableData(forDb, t, 50, 0).then(setData).catch(() => {});
  }

  const label = (name: string, isMain: boolean) => (isMain ? `Main database (${name})` : labels[name] ?? name);
  const clientDbs = dbs.filter((d) => !d.isMain);
  const currentIsMain = dbs.find((d) => d.database === db)?.isMain ?? true;

  const shownTables = useMemo(
    () => (overview?.tables ?? []).filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase())),
    [overview, search],
  );

  async function doBackup(scope: "main" | "client") {
    setBusy(scope);
    try {
      const res = await runBackup(scope, scope === "client" ? db : undefined);
      setBackups(res.backups);
      if (res.files.length) toast.success("Backup complete", `${res.files.length} database(s) dumped.`);
      else toast.error("Backup issue", res.warning ?? "No backup produced. Check mysqldump on the server.");
    } catch (e) {
      toast.error("Backup failed", (e as Error).message);
    } finally { setBusy(""); }
  }

  async function saveSched() {
    if (!schedule) return;
    setBusy("sched");
    try { await saveSchedule(schedule); toast.success("Schedule saved", "Backup schedule updated."); }
    catch (e) { toast.error("Save failed", (e as Error).message); }
    finally { setBusy(""); }
  }

  async function runNow() {
    if (!schedule) return;
    setBusy("run");
    try {
      const res = await runBackup(schedule.scope === "client" ? "client" : schedule.scope, db);
      setBackups(res.backups);
      getSchedule().then(setSchedule).catch(() => {});
      if (res.files.length) toast.success("Backup complete", `${res.files.length} database(s) dumped.`);
      else toast.error("Backup issue", res.warning ?? "No backup produced.");
    } catch (e) { toast.error("Backup failed", (e as Error).message); }
    finally { setBusy(""); }
  }

  const cron = "0 2 * * *  cd /path/to/backend && php spark backup:run >> writable/logs/backup.log 2>&1";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Database</h1>
          <p className="mt-1 text-sm text-slate-500">Inspect the structure of any client&apos;s isolated database.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => doBackup("main")} disabled={busy !== ""} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Icon name="download" className="h-4 w-4 text-slate-500" /> Backup main DB
          </button>
          <button onClick={() => doBackup("client")} disabled={busy !== "" || currentIsMain} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            <Icon name="download" className="h-4 w-4" /> Backup this client
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Client</span>
            <select value={db} onChange={(e) => setDb(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-500">
              {dbs.map((d) => <option key={d.database} value={d.database}>{label(d.database, d.isMain)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Automatic backups */}
      {schedule && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Automatic backups</h2>
              <p className="mt-0.5 text-xs text-slate-500">Schedule for the <b>main database</b> and client DBs. The scope applies to &ldquo;Run now&rdquo; and the cron job.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input type="checkbox" checked={!schedule.enabled} onChange={(e) => setSchedule({ ...schedule, enabled: !e.target.checked })} className="rounded border-slate-300" /> Disabled
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Frequency">
              <select value={schedule.frequency} onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value as Schedule["frequency"] })} className={inputCls}>
                <option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
              </select>
            </Field>
            <Field label="Keep for (days)">
              <input type="number" min={1} max={365} value={schedule.keepDays} onChange={(e) => setSchedule({ ...schedule, keepDays: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Scope">
              <select value={schedule.scope} onChange={(e) => setSchedule({ ...schedule, scope: e.target.value as Schedule["scope"] })} className={inputCls}>
                <option value="main">Main database only</option><option value="all">Main + all client DBs</option><option value="client">Selected client only</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={saveSched} disabled={busy !== ""} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">{busy === "sched" ? "Saving…" : "Save schedule"}</button>
            <button onClick={runNow} disabled={busy !== ""} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Icon name="refresh" className="h-4 w-4" /> {busy === "run" ? "Running…" : "Run now"}</button>
            <span className="text-xs text-slate-400">{schedule.lastRunAt ? `Last run ${new Date(schedule.lastRunAt).toLocaleString()}` : "Never run yet"}</span>
          </div>
          <div className="mt-4 rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
            <p className="mb-1 text-slate-500">Add this to your server crontab (runs daily; the schedule above decides when it backs up):</p>
            <code className="break-all text-emerald-300">{cron}</code>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Stored backups ({backups.length})</p>
            {backups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">No backups on disk yet. Click &ldquo;Run now&rdquo; or wait for the schedule.</div>
            ) : (
              <div className="divide-y divide-slate-50 overflow-hidden rounded-lg border border-slate-200">
                {backups.slice(0, 8).map((b) => (
                  <div key={b.name} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="truncate font-mono text-slate-700">{b.name}</span>
                    <span className="shrink-0 text-slate-400">{fmtBytes(b.bytes)} · {new Date(b.at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon="list" tone="bg-indigo-50 text-indigo-600" value={overview ? String(overview.tableCount) : "—"} label="Tables" />
        <StatCard icon="grid" tone="bg-emerald-50 text-emerald-600" value={overview ? overview.totalRows.toLocaleString() : "—"} label="Total rows" />
        <StatCard icon="asset" tone="bg-violet-50 text-violet-600" value={overview ? fmtBytes(overview.totalBytes) : "—"} label="Size on disk" />
      </div>

      {/* DB breadcrumb */}
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
        <Icon name="plus" className="h-3.5 w-3.5" /> Database <span className="rounded bg-white px-2 py-0.5 font-mono font-semibold text-slate-700">{db}</span>
        {!currentIsMain && <span>— isolated to {labels[db] ?? db}</span>}
        <span className="ml-auto text-slate-400">{clientDbs.length} client database{clientDbs.length === 1 ? "" : "s"}</span>
      </div>

      {/* Browser */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Table list */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="relative mb-2">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tables…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 focus:bg-white" />
          </div>
          <div className="no-scrollbar max-h-[560px] space-y-0.5 overflow-y-auto">
            {!overview && <p className="py-6 text-center text-xs text-slate-400">Loading tables…</p>}
            {shownTables.map((t) => (
              <button key={t.name} onClick={() => selectTable(t.name)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${table === t.name ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>
                <span className="truncate font-mono text-xs">{t.name}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${t.rows ? "bg-slate-100 text-slate-500" : "bg-slate-50 text-slate-400"}`}>{t.rows.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Table detail */}
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!table ? (
            <p className="py-16 text-center text-sm text-slate-400">Select a table to inspect its structure and data.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h3 className="font-mono text-sm font-bold text-slate-900">{table}</h3>
                {info && <span className="text-xs text-slate-400">{info.columns.length} columns · {(overview?.tables.find((t) => t.name === table)?.rows ?? 0).toLocaleString()} rows</span>}
                <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-0.5">
                  {(["structure", "data"] as const).map((tk) => (
                    <button key={tk} onClick={() => setTab(tk)} className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${tab === tk ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{tk}</button>
                  ))}
                </div>
              </div>

              {tab === "structure" ? (
                <div className="space-y-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                        <tr>{["Column", "Type", "Null", "Key", "Default", "Extra"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {info?.columns.map((c) => (
                          <tr key={c.name}>
                            <td className="px-3 py-2 font-mono font-medium text-slate-800">{c.name}</td>
                            <td className="px-3 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{c.type}</span></td>
                            <td className="px-3 py-2 text-xs text-slate-500">{c.nullable ? "NULL" : "NOT NULL"}</td>
                            <td className="px-3 py-2">{c.key ? <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.key === "PRI" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{c.key === "PRI" ? "Primary" : c.key === "UNI" ? "Unique" : "Index"}</span> : <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{c.default ?? <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{c.extra || <span className="text-slate-300">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {info && info.indexes.length > 0 && (
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Indexes</p>
                      <div className="flex flex-wrap gap-2">
                        {info.indexes.map((ix) => (
                          <span key={ix.name} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200">
                            <span className={`h-1.5 w-1.5 rounded-full ${ix.name === "PRIMARY" ? "bg-amber-500" : ix.unique ? "bg-violet-500" : "bg-emerald-500"}`} />
                            <span className="font-semibold text-slate-700">{ix.name}</span>
                            <span className="font-mono text-slate-400">({ix.columns.join(", ")})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {!data ? <p className="py-8 text-center text-xs text-slate-400">Loading…</p> : data.rows.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-400">No rows in this table.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                        <tr>{data.columns.map((c) => <th key={c} className="px-3 py-2 font-mono">{c}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.rows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            {data.columns.map((c) => <td key={c} className="max-w-[240px] truncate px-3 py-2 font-mono text-slate-600" title={String(r[c] ?? "")}>{r[c] === null ? <span className="text-slate-300">NULL</span> : String(r[c])}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {data && data.total > data.rows.length && <p className="mt-2 text-center text-[11px] text-slate-400">Showing first {data.rows.length} of {data.total.toLocaleString()} rows.</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>{children}</div>;
}

function StatCard({ icon, tone, value, label }: { icon: Parameters<typeof Icon>[0]["name"]; tone: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon name={icon} className="h-5 w-5" /></span>
      <div><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-xs font-medium text-slate-400">{label}</p></div>
    </div>
  );
}

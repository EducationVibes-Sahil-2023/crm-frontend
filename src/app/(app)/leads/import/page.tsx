"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";
import { captureMany, findDuplicate, makeIntakeLead } from "@/lib/leadStore";

// CRM target fields the spreadsheet columns map onto. `aliases` drive the
// auto-mapping guess from the file's header names.
type Target = { key: string; label: string; required?: boolean; aliases: string[] };
const TARGETS: Target[] = [
  { key: "name", label: "Name", required: true, aliases: ["name", "full name", "lead name", "contact", "customer"] },
  { key: "email", label: "Email", aliases: ["email", "e-mail", "mail"] },
  { key: "phone", label: "Phone", aliases: ["phone", "mobile", "contact number", "number", "cell", "tel"] },
  { key: "company", label: "Company", aliases: ["company", "organization", "organisation", "business", "firm"] },
  { key: "city", label: "City", aliases: ["city", "town"] },
  { key: "state", label: "State", aliases: ["state", "province", "region"] },
  { key: "status", label: "Status", aliases: ["status", "stage"] },
  { key: "source", label: "Source", aliases: ["source", "channel", "origin"] },
  { key: "type", label: "Type", aliases: ["type", "category", "temperature"] },
];

const norm = (s: string) => s.toString().trim().toLowerCase().replace(/[_\-\s]+/g, " ");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digitsOf = (s: string) => (s || "").replace(/\D/g, "");

type Row = Record<string, string>;
type Checked = { idx: number; values: Record<string, string>; errors: string[]; warnings: string[] };

export default function LeadImportPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "review" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // targetKey -> header
  const [skipDupes, setSkipDupes] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errored: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) e.target.value = "";
    if (!file) return;
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
      if (!json.length) {
        toast.error("Empty file", "No rows found in the first sheet.");
        return;
      }
      const hs = Object.keys(json[0]).filter((h) => h.trim() !== "");
      const parsed: Row[] = json.map((r) => {
        const o: Row = {};
        for (const h of hs) o[h] = String(r[h] ?? "").trim();
        return o;
      });
      // Auto-guess the column mapping from header names.
      const guess: Record<string, string> = {};
      for (const t of TARGETS) {
        const hit = hs.find((h) => t.aliases.some((a) => norm(h) === a) )
          ?? hs.find((h) => t.aliases.some((a) => norm(h).includes(a)));
        if (hit) guess[t.key] = hit;
      }
      setFileName(file.name);
      setHeaders(hs);
      setRows(parsed);
      setMapping(guess);
      setStep("map");
    } catch {
      toast.error("Couldn't read that file", "Use a valid .xlsx, .xls or .csv file.");
    } finally {
      setParsing(false);
    }
  }

  // Validate every row against the current mapping.
  const checked = useMemo<Checked[]>(() => {
    if (step === "upload") return [];
    const seenEmail = new Set<string>();
    const seenPhone = new Set<string>();
    return rows.map((r, i) => {
      const values: Record<string, string> = {};
      for (const t of TARGETS) {
        const col = mapping[t.key];
        values[t.key] = col ? (r[col] ?? "").trim() : "";
      }
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!values.name) errors.push("Name is required");
      if (values.email && !EMAIL_RE.test(values.email)) errors.push("Invalid email");
      if (values.phone && digitsOf(values.phone).length < 7) errors.push("Invalid phone");
      if (!values.email && !values.phone) errors.push("No email or phone");

      // Duplicate within the file.
      const em = values.email.toLowerCase();
      const ph = digitsOf(values.phone);
      if ((em && seenEmail.has(em)) || (ph && seenPhone.has(ph))) warnings.push("Duplicate in file");
      if (em) seenEmail.add(em);
      if (ph) seenPhone.add(ph);

      // Duplicate against existing CRM leads.
      if (!errors.length && findDuplicate({ email: values.email, phone: values.phone } as unknown as Parameters<typeof findDuplicate>[0], ["email", "phone"])) {
        warnings.push("Already in CRM");
      }
      return { idx: i + 1, values, errors, warnings };
    });
  }, [rows, mapping, step]);

  const stats = useMemo(() => {
    const errored = checked.filter((c) => c.errors.length).length;
    const dupes = checked.filter((c) => !c.errors.length && c.warnings.length).length;
    const clean = checked.length - errored - dupes;
    return { total: checked.length, errored, dupes, clean };
  }, [checked]);

  function runImport() {
    const toImport = checked.filter((c) => !c.errors.length && (!skipDupes || !c.warnings.length));
    if (!toImport.length) {
      toast.error("Nothing to import", "Every row has an error" + (skipDupes ? " or is a duplicate." : "."));
      return;
    }
    const leads = toImport.map((c) =>
      makeIntakeLead(
        {
          name: c.values.name,
          email: c.values.email || undefined,
          phone: c.values.phone || undefined,
          company: c.values.company || undefined,
          city: c.values.city || undefined,
          state: c.values.state || undefined,
          status: c.values.status || undefined,
          source: c.values.source || "Excel Import",
          type: c.values.type || undefined,
        },
        "Excel Import",
      ),
    );
    const imported = captureMany(leads);
    logActivity(`Imported ${imported} leads from ${fileName}`, { category: "lead" });
    setResult({ imported, skipped: skipDupes ? stats.dupes : 0, errored: stats.errored });
    setStep("done");
    toast.success("Import complete", `${imported} lead${imported === 1 ? "" : "s"} added to the CRM.`);
  }

  function reset() {
    setStep("upload"); setRows([]); setHeaders([]); setMapping({}); setFileName(""); setResult(null);
  }

  function downloadTemplate() {
    const cols = TARGETS.map((t) => t.label);
    const sample = ["Aarav Sharma", "aarav@example.com", "98765 43210", "Acme Corp", "Mumbai", "Maharashtra", "New", "Excel Import", "Warm"];
    const csv = [cols.join(","), sample.join(",")].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "lead-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400"><Link href="/leads" className="hover:text-slate-600">Leads</Link> / Import</p>
          <h1 className="text-2xl font-bold text-slate-900">Excel / CSV Import</h1>
          <p className="mt-1 text-sm text-slate-500">Bring leads from a spreadsheet into the CRM — with column mapping and per-row validation.</p>
        </div>
        <button onClick={downloadTemplate} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Icon name="download" className="h-4 w-4 text-slate-500" /> Download template
        </button>
      </div>

      {/* Steps */}
      <Steps step={step} />

      {step === "upload" && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Icon name="upload" className="h-7 w-7" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-800">Upload a spreadsheet</p>
          <p className="mt-1 text-xs text-slate-500">Accepts .xlsx, .xls and .csv — the first sheet&apos;s header row becomes your columns.</p>
          <button onClick={() => fileRef.current?.click()} disabled={parsing} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60">
            {parsing ? "Reading…" : <><Icon name="upload" className="h-4 w-4" /> Choose file</>}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={onFile} className="hidden" />
        </div>
      )}

      {(step === "map" || step === "review") && (
        <>
          {/* Mapping */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Map columns</h2>
              <span className="text-xs text-slate-400">{fileName} · {rows.length} rows</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TARGETS.map((t) => (
                <div key={t.key}>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    {t.label} {t.required && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={mapping[t.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [t.key]: e.target.value }))}
                    className={`w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${t.required && !mapping[t.key] ? "border-rose-300" : "border-slate-300"}`}
                  >
                    <option value="">— not mapped —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Validation summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total rows" value={stats.total} tone="slate" />
            <Stat label="Ready" value={stats.clean} tone="emerald" />
            <Stat label="Duplicates" value={stats.dupes} tone="amber" />
            <Stat label="Errors" value={stats.errored} tone="rose" />
          </div>

          {/* Preview */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {checked.slice(0, 200).map((c) => {
                    const tone = c.errors.length ? "bg-rose-50/60" : c.warnings.length ? "bg-amber-50/50" : "";
                    return (
                      <tr key={c.idx} className={tone}>
                        <td className="px-3 py-2 align-top text-xs text-slate-400">
                          {c.idx}
                          {c.errors.length > 0 && <span title={c.errors.join(", ")} className="ml-1 text-rose-500">●</span>}
                          {!c.errors.length && c.warnings.length > 0 && <span title={c.warnings.join(", ")} className="ml-1 text-amber-500">●</span>}
                        </td>
                        <td className="px-3 py-2 align-top font-medium text-slate-800">{c.values.name || <span className="text-rose-500">—</span>}</td>
                        <td className="px-3 py-2 align-top text-slate-600">{c.values.email || "—"}</td>
                        <td className="px-3 py-2 align-top text-slate-600">{c.values.phone || "—"}</td>
                        <td className="px-3 py-2 align-top text-slate-600">{c.values.company || "—"}</td>
                        <td className="px-3 py-2 align-top text-slate-600">{c.values.status || "New"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {checked.length > 200 && <p className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-400">Showing first 200 of {checked.length} rows — all rows will be imported.</p>}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} className="rounded border-slate-300" />
              Skip duplicates ({stats.dupes})
            </label>
            <div className="flex items-center gap-2">
              <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Start over</button>
              <button
                onClick={runImport}
                disabled={!mapping.name || stats.clean + (skipDupes ? 0 : stats.dupes) === 0}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Import {skipDupes ? stats.clean : stats.clean + stats.dupes} lead{(skipDupes ? stats.clean : stats.clean + stats.dupes) === 1 ? "" : "s"}
              </button>
            </div>
          </div>
          {!mapping.name && <p className="text-right text-xs text-rose-500">Map the required <b>Name</b> column to continue.</p>}
        </>
      )}

      {step === "done" && result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Icon name="check" className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Import complete</h2>
          <p className="mt-1 text-sm text-slate-500">
            <b className="text-emerald-600">{result.imported}</b> imported · <b className="text-amber-600">{result.skipped}</b> duplicates skipped · <b className="text-rose-600">{result.errored}</b> errored rows left out.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link href="/leads" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">View leads</Link>
            <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Import another</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ step }: { step: string }) {
  const items = [["upload", "Upload"], ["map", "Map & validate"], ["done", "Done"]];
  const activeIdx = step === "upload" ? 0 : step === "done" ? 2 : 1;
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      {items.map(([, label], i) => (
        <div key={label} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${i <= activeIdx ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
          <span className={i <= activeIdx ? "text-slate-800" : "text-slate-400"}>{label}</span>
          {i < items.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" />}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "amber" | "rose" }) {
  const tones = {
    slate: "text-slate-700",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  } as const;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

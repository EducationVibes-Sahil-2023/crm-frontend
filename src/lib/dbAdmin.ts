// Super-admin database inspector + backup API client. Authenticated with the
// super-admin JWT; a 401 clears the session and redirects to sign in.

import { ensureSuperAdminToken, superAdminLogout } from "@/lib/superAdmin";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type DbEntry = { database: string; isMain: boolean };
export type TableRow = { name: string; rows: number; bytes: number; engine: string };
export type Overview = { database: string; tableCount: number; totalRows: number; totalBytes: number; tables: TableRow[] };
export type Column = { name: string; type: string; nullable: boolean; key: string; default: string | null; extra: string };
export type IndexInfo = { name: string; unique: boolean; columns: string[] };
export type TableInfo = { columns: Column[]; indexes: IndexInfo[] };
export type TableData = { columns: string[]; rows: Record<string, unknown>[]; total: number; limit: number; offset: number };
export type Schedule = { enabled: boolean; frequency: "hourly" | "daily" | "weekly"; keepDays: number; scope: "main" | "all" | "client"; lastRunAt: string | null };
export type Backup = { name: string; bytes: number; at: string; database: string };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await ensureSuperAdminToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers as Record<string, string>) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      superAdminLogout();
      window.location.href = "/admin/login?expired=1";
    }
    throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const listDatabases = () => req<{ databases: DbEntry[] }>("/db/databases").then((d) => d.databases);
export const dbOverview = (db: string) => req<Overview>(`/db/overview?db=${encodeURIComponent(db)}`);
export const tableInfo = (db: string, table: string) => req<TableInfo>(`/db/table?db=${encodeURIComponent(db)}&table=${encodeURIComponent(table)}`);
export const tableData = (db: string, table: string, limit = 50, offset = 0) =>
  req<TableData>(`/db/data?db=${encodeURIComponent(db)}&table=${encodeURIComponent(table)}&limit=${limit}&offset=${offset}`);
export const getSchedule = () => req<Schedule>("/db/schedule");
export const saveSchedule = (s: Partial<Schedule>) => req<{ ok: true }>("/db/schedule", { method: "POST", body: JSON.stringify(s) });
export const listBackups = () => req<{ backups: Backup[] }>("/db/backups").then((d) => d.backups);
export const runBackup = (scope: "main" | "all" | "client", db?: string) =>
  req<{ ok: boolean; files: string[]; backups: Backup[]; warning?: string }>("/db/backup", { method: "POST", body: JSON.stringify({ scope, db }) });

/** Human byte size (0 B, 1.3 MB, …). */
export function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

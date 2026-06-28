"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import SearchSelect from "@/components/SearchSelect";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { colorBadge, optionNames } from "@/lib/setup";
import { STATE_NAMES, allCities, citiesOf } from "@/lib/places";
import { listDirectory } from "@/lib/directory";
import { directoryApi, type DirectoryEntry } from "@/lib/directoryApi";
import { smtpApi } from "@/lib/smtpApi";
import { getUser } from "@/lib/auth";
import { DEFAULT_ROLES, TOTAL_PERMS, countGranted, emptyMatrix, loadRoles, roleNames, type Perm } from "@/lib/roles";
import { usePermissions } from "@/components/PermissionsProvider";
import UserForm, { type UserDraft } from "@/components/UserForm";

type User = {
  id?: number;
  name: string;
  email: string;
  phone: string;
  designation: string;
  bio: string;
  profile: string; // avatar initials / image url placeholder
  password: string;
  linkedin: string;
  twitter: string;
  github: string;
  joiningDate: string;
  employeeId: string;
  companyCode: string;
  city: string;
  state: string;
  address: string;
  zip: string;
  department: string;
  role: string;
  status: string;
  extraPermissions?: Record<string, Perm>;
};

type ColKey = keyof User | "social" | "actions";
type Column = { key: ColKey; label: string; pinned?: boolean; defaultVisible?: boolean };

const COLUMNS: Column[] = [
  { key: "name", label: "Name", pinned: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "phone", label: "Phone Number", defaultVisible: true },
  { key: "designation", label: "Designation", defaultVisible: true },
  { key: "department", label: "Department", defaultVisible: true },
  { key: "role", label: "Role", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "companyCode", label: "Company Code", defaultVisible: true },
  { key: "city", label: "City", defaultVisible: true },
  { key: "state", label: "State", defaultVisible: true },
  { key: "joiningDate", label: "Joining Date", defaultVisible: true },
  { key: "social", label: "Social", defaultVisible: true },
  { key: "employeeId", label: "Employee ID" },
  { key: "address", label: "Address" },
  { key: "zip", label: "Zip" },
  { key: "bio", label: "Bio" },
  { key: "password", label: "Password" },
  { key: "actions", label: "", pinned: true },
];

// ---- deterministic sample data ----
const PLACES: [string, string][] = [["Mumbai", "Maharashtra"], ["Bengaluru", "Karnataka"], ["New Delhi", "Delhi"], ["Hyderabad", "Telangana"], ["Chennai", "Tamil Nadu"], ["Pune", "Maharashtra"], ["Kolkata", "West Bengal"], ["Ahmedabad", "Gujarat"], ["Jaipur", "Rajasthan"], ["Kochi", "Kerala"]];
const STREETS = ["12 MG Road", "88 Brigade Road", "204 Linking Road", "57 Anna Salai", "31 Park Street", "9 Jubilee Hills", "415 FC Road", "72 Banjara Hills"];
const STATUSES_D = ["Active", "Inactive"];
const JOIN = ["Jan 12, 2021", "Mar 03, 2022", "Jul 19, 2020", "Sep 28, 2023", "Feb 14, 2022", "Nov 05, 2021", "Apr 22, 2023", "Aug 09, 2020"];
const BIOS = [
  "Guides students through course selection and admissions with care.",
  "Specialises in career planning and university applications.",
  "Patient listener who helps learners set and reach their goals.",
  "Connects families with the right programmes and financial aid.",
  "Calm under pressure, supports students through every milestone.",
  "Data-informed counsellor focused on student outcomes.",
];
const COMPANY_CODES = ["EDV-001", "EDV-002", "EDV-003", "NEX-010", "NEX-011"];
// Role → color, from the default Admin Setup roles (sample users only use these names).
const ROLE_NAMES = DEFAULT_ROLES.map((r) => r.name);
const ROLE_COLOR: Record<string, string> = Object.fromEntries(DEFAULT_ROLES.map((r) => [r.name, r.color]));

// The currently signed-in administrator — shown at the top of the list so the
// admin account's own information appears in the Admin section too.
function adminUser(): User {
  const u = getUser();
  const name = u?.name?.trim() || "Admin User";
  const parts = name.split(/\s+/);
  const profile = `${parts[0]?.[0] ?? "A"}${parts[1]?.[0] ?? ""}`.toUpperCase();
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return {
    name,
    email: u?.email || "admin@educationvibes.in",
    phone: "+91 90000 00000",
    designation: "Administrator",
    bio: "System administrator with full access to all modules and settings.",
    profile,
    password: "Passw0rd!",
    linkedin: `https://linkedin.com/in/${handle}`,
    twitter: `https://twitter.com/${handle}`,
    github: `https://github.com/${handle}`,
    joiningDate: "Jan 01, 2020",
    employeeId: "EMP-0001",
    companyCode: "EDV-001",
    city: "Mumbai",
    state: "Maharashtra",
    address: "Head Office",
    zip: "400001",
    department: "Administration",
    role: "Administrator",
    status: "Active",
  };
}

// The team is a single Counsellor department — sourced from the shared directory.
const DIRECTORY_USERS: User[] = listDirectory().map((u, i) => {
  const [first, last] = u.name.split(" ");
  const [city, state] = PLACES[(i * 5) % PLACES.length];
  const handle = `${first.toLowerCase()}${last.toLowerCase()}`;
  return {
    name: u.name,
    email: u.email,
    phone: `+91 ${String(70000 + (i % 29999)).padStart(5, "0")} ${String(10000 + ((i * 7) % 89999)).padStart(5, "0")}`,
    designation: u.designation,
    bio: BIOS[i % BIOS.length],
    profile: `${first[0]}${last[0]}`,
    password: "Passw0rd!",
    linkedin: `https://linkedin.com/in/${handle}`,
    twitter: `https://twitter.com/${handle}`,
    github: `https://github.com/${handle}`,
    joiningDate: JOIN[i % JOIN.length],
    employeeId: `EMP-${String(1000 + i)}`,
    companyCode: COMPANY_CODES[i % COMPANY_CODES.length],
    city,
    state,
    address: STREETS[i % STREETS.length],
    zip: String(110000 + ((i * 37) % 789999)),
    department: u.department,
    role: ROLE_NAMES[(i * 3) % ROLE_NAMES.length],
    status: STATUSES_D[i % STATUSES_D.length],
  };
});

// Admin first, then the rest of the team.
const ALL_USERS: User[] = [adminUser(), ...DIRECTORY_USERS];

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-600",
};
const STATUS_DOT: Record<string, string> = {
  Active: "bg-emerald-500",
  Inactive: "bg-slate-400",
};
const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
// Faux barcode strip for the ID-card footer.
const BARCODE = "repeating-linear-gradient(90deg,#0f172a 0 1px,transparent 1px 3px,#0f172a 3px 5px,transparent 5px 6px,#0f172a 6px 9px,transparent 9px 11px)";

const PAGE_SIZES = [25, 50, 100];
const CARD_BATCH = 12; // how many cards to reveal per infinite-scroll step

type Filters = {
  query: string;
  designation: string;
  department: string;
  role: string;
  status: string;
  city: string;
  stateF: string;
};
const DEFAULT_FILTERS: Filters = {
  query: "",
  designation: "All Designations",
  department: "All Departments",
  role: "All Roles",
  status: "All Statuses",
  city: "All Cities",
  stateF: "All States",
};

export default function UsersPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  const [view, setView] = useState<"table" | "cards">("table");
  // `draft` is what's in the filter inputs; `applied` is what actually filters.
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const setF = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const filtersDirty = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).some((k) => draft[k] !== applied[k]);
  const filtersActive = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).some((k) => applied[k] !== DEFAULT_FILTERS[k]);
  function applyFilters() {
    setApplied(draft);
  }
  function resetFilters() {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  }

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, Boolean(c.pinned || c.defaultVisible)])),
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Infinite scroll (cards view).
  const [cardCount, setCardCount] = useState(CARD_BATCH);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Create / edit form.
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  function openCreate() {
    setEditingUser(null);
    setFormMode("create");
    setFormOpen(true);
  }
  function openEdit(u: User) {
    setEditingUser(u);
    setFormMode("edit");
    setFormOpen(true);
  }
  async function removeUser(u: User) {
    if (!u.id) {
      toast.error("Can't delete", "The signed-in admin account can't be removed here.");
      return;
    }
    try {
      await directoryApi.remove(u.id);
      setUsers((us) => us.filter((x) => x.id !== u.id));
      toast.info("User removed", `${u.name} was deleted.`);
    } catch (e) {
      toast.error("Couldn't delete", (e as Error).message);
    }
  }
  async function handleSubmit(draft: UserDraft) {
    const initials = draft.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";
    const profile = draft.avatar || initials;
    const joiningDate = formatJoin(draft.joiningDate);
    const payload = { ...draft, profile, joiningDate } as unknown as Partial<DirectoryEntry>;
    try {
      if (formMode === "edit" && editingUser) {
        if (editingUser.id) await directoryApi.update(editingUser.id, payload);
        toast.success("User updated", draft.name);
      } else {
        await directoryApi.create({ ...payload, employeeId: `EMP-${Date.now().toString().slice(-5)}` } as Omit<DirectoryEntry, "id">);
        toast.success("User created", `${draft.name} was added.`);
      }
      await reloadUsers();
      setFormOpen(false);
    } catch (e) {
      toast.error("Couldn't save", (e as Error).message);
    }
  }
  // Email a user their sign-in credentials via the SMTP relay.
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  async function sendCredentials(u: User) {
    if (!u.email) {
      toast.error("No email", "This user has no email address to send to.");
      return;
    }
    if (!u.password) {
      toast.error("No password set", `Set a password for ${u.name} before sending credentials.`);
      return;
    }
    const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
    const subject = "Your account credentials";
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
        <h2 style="margin:0 0 12px">Welcome${u.name ? `, ${u.name}` : ""} 👋</h2>
        <p style="margin:0 0 16px;color:#475569">An account has been created for you. Use the credentials below to sign in.</p>
        <table style="border-collapse:collapse;width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
          <tr><td style="padding:10px 14px;color:#64748b;width:120px">Email</td><td style="padding:10px 14px;font-weight:600">${u.email}</td></tr>
          <tr><td style="padding:10px 14px;color:#64748b;border-top:1px solid #e2e8f0">Password</td><td style="padding:10px 14px;font-weight:600;font-family:monospace;border-top:1px solid #e2e8f0">${u.password}</td></tr>
        </table>
        <p style="margin:18px 0">
          <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Sign in</a>
        </p>
        <p style="margin:0;color:#94a3b8;font-size:12px">For your security, please change your password after your first sign-in.</p>
      </div>`;
    setSendingTo(u.email);
    try {
      await smtpApi.send(u.email, subject, html, true);
      toast.success("Credentials sent", `Login details were emailed to ${u.email}.`);
    } catch (e) {
      toast.error("Couldn't send", (e as Error).message);
    } finally {
      setSendingTo(null);
    }
  }
  const rowHandlers = {
    onView: openEdit,
    onEdit: openEdit,
    onDelete: removeUser,
    onSend: sendCredentials,
    sendingTo,
    canEdit: can("users", "edit"),
    canDelete: can("users", "delete"),
  };

  // Designation / Department / Role master lists are managed in Admin Setup.
  const [designationOptions, setDesignationOptions] = useState<string[]>(["All Designations"]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(["All Departments"]);
  const [roleOptions, setRoleOptions] = useState<string[]>(["All Roles"]);
  // Role → { color, granted, total } for badges and permission summaries.
  const [roleMeta, setRoleMeta] = useState<Record<string, { color: string; granted: number; total: number }>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      // Real team comes from the per-tenant DB; demo data is only an
      // offline fallback (when the backend can't be reached).
      const rows = await directoryApi.list().catch(() => null);
      if (!active) return;
      // Master lists come from Admin Setup (localStorage) — read on the client.
      setDesignationOptions(["All Designations", ...optionNames("designation")]);
      setDepartmentOptions(["All Departments", ...optionNames("department")]);
      setRoleOptions(["All Roles", ...roleNames()]);
      const meta: Record<string, { color: string; granted: number; total: number }> = {};
      for (const r of loadRoles()) meta[r.name] = { color: r.color, granted: countGranted(r), total: TOTAL_PERMS };
      setRoleMeta(meta);
      setUsers(rows ? [adminUser(), ...(rows as unknown as User[])] : ALL_USERS);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  async function reloadUsers() {
    const rows = await directoryApi.list().catch(() => null);
    if (rows) setUsers([adminUser(), ...(rows as unknown as User[])]);
  }

  const stateOptions = useMemo(() => ["All States", ...STATE_NAMES], []);
  // City filter follows the chosen state (all cities when none picked).
  const cityOptions = useMemo(() => ["All Cities", ...(draft.stateF !== "All States" ? citiesOf(draft.stateF) : allCities())], [draft.stateF]);

  const filtered = useMemo(() => {
    const q = applied.query.trim().toLowerCase();
    return users.filter((u) => {
      const mq = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.designation.toLowerCase().includes(q) || u.city.toLowerCase().includes(q) || u.employeeId.toLowerCase().includes(q);
      return (
        mq &&
        (applied.designation === "All Designations" || u.designation === applied.designation) &&
        (applied.department === "All Departments" || u.department === applied.department) &&
        (applied.role === "All Roles" || u.role === applied.role) &&
        (applied.status === "All Statuses" || u.status === applied.status) &&
        (applied.city === "All Cities" || u.city === applied.city) &&
        (applied.stateF === "All States" || u.state === applied.stateF)
      );
    });
  }, [users, applied]);

  // Reset table page / card count whenever applied filters / page size / view change.
  const filterKey = [...Object.values(applied), pageSize, view].join("|");
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
    setCardCount(CARD_BATCH);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  // Cards view: reveal a growing slice, extended as the sentinel scrolls into view.
  const cardsShown = filtered.slice(0, cardCount);
  const hasMore = cardCount < total;

  useEffect(() => {
    if (view !== "cards" || loading || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCardCount((c) => Math.min(c + CARD_BATCH, total));
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [view, loading, hasMore, total, cardCount]);

  const shownColumns = COLUMNS.filter((c) => visible[c.key]);

  function stickyClass(key: ColKey, header: boolean) {
    const z = header ? "z-20" : "z-10";
    if (key === "name") return `sticky left-0 ${z} border-r border-slate-100`;
    if (key === "actions") return `sticky right-0 ${z} border-l border-slate-100`;
    return "";
  }
  const stickyBg = (key: ColKey) =>
    key === "name" || key === "actions" ? "bg-white group-hover:bg-slate-50" : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your team&apos;s <strong>{ALL_USERS.length}</strong> user accounts, roles, and profiles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5">
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === "table" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon name="menu" className="h-4 w-4" /> Table
            </button>
            <button
              onClick={() => setView("cards")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === "cards" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon name="dashboard" className="h-4 w-4" /> Cards
            </button>
          </div>
          <button onClick={() => toast.info("Export", "Preparing your users export…")} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Icon name="export" className="h-4 w-4 text-slate-500" /> Export
          </button>
          {can("users", "create") && (
            <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <span className="text-base leading-none">+</span> Add User
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2 xl:col-span-1">
            <FilterLabel>Search</FilterLabel>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={draft.query}
                onChange={(e) => setF("query", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="Name, email, ID…"
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <Select label="Designation" value={draft.designation} onChange={(v) => setF("designation", v)} options={designationOptions} />
          <Select label="Department" value={draft.department} onChange={(v) => setF("department", v)} options={departmentOptions} />
          <Select label="Role" value={draft.role} onChange={(v) => setF("role", v)} options={roleOptions} />
          <Select label="Status" value={draft.status} onChange={(v) => setF("status", v)} options={["All Statuses", ...STATUSES_D]} />
          <Select label="State" value={draft.stateF} onChange={(v) => { setF("stateF", v); if (v !== "All States" && !citiesOf(v).includes(draft.city)) setF("city", "All Cities"); }} options={stateOptions} />
          <Select label="City" value={draft.city} onChange={(v) => setF("city", v)} options={cityOptions} />
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <div className="relative">
            <button
              onClick={() => setColumnsOpen((o) => !o)}
              disabled={view !== "table"}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Icon name="dashboard" className="h-3.5 w-3.5 text-slate-500" /> Columns
              <Icon name="chevronDown" className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {columnsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setColumnsOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Show columns</p>
                  {COLUMNS.filter((c) => c.key !== "actions").map((c) => (
                    <label key={c.key} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${c.pinned ? "text-slate-400" : "cursor-pointer text-slate-700 hover:bg-slate-50"}`}>
                      <input type="checkbox" disabled={c.pinned} checked={!!visible[c.key]} onChange={(e) => setVisible((v) => ({ ...v, [c.key]: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                      {c.label || "Name"}
                      {c.pinned && <span className="ml-auto text-[10px]">pinned</span>}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetFilters}
              disabled={!filtersActive && !filtersDirty}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              onClick={applyFilters}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Icon name="search" className="h-3.5 w-3.5" />
              Apply Filter
              {filtersDirty && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-white/90" />}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {view === "table" ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="no-scrollbar max-h-[70vh] overflow-auto rounded-t-2xl">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-30">
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {shownColumns.map((c) => (
                    <th key={c.key} className={`whitespace-nowrap bg-slate-50 px-6 py-4 ${c.key === "actions" ? "text-right" : ""} ${stickyClass(c.key, true)}`}>
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
                      No users match your filters.
                    </td>
                  </tr>
                ) : (
                  paged.map((u, i) => (
                    <tr key={u.email} className="group border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      {shownColumns.map((c) => (
                        <td key={c.key} className={`whitespace-nowrap px-6 py-4 text-slate-600 ${c.key === "actions" ? "text-right" : ""} ${stickyClass(c.key, false)} ${stickyBg(c.key)}`}>
                          {renderCell(c.key, u, start + i, rowHandlers)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            loading={loading}
            total={total}
            start={start}
            pageSize={pageSize}
            setPageSize={setPageSize}
            current={current}
            totalPages={totalPages}
            setPage={setPage}
            noun="users"
          />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
            ) : cardsShown.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
                No users match your filters.
              </div>
            ) : (
              <>
                {cardsShown.map((u, i) => (
                  <UserCard key={u.email} user={u} idx={i} roleMeta={roleMeta} onView={openEdit} onEdit={openEdit} onSend={sendCredentials} sending={sendingTo === u.email} canEdit={can("users", "edit")} />
                ))}
                {/* Infinite-scroll loaders */}
                {hasMore && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={`more-${i}`} />)}
              </>
            )}
          </div>

          {/* Sentinel + status line */}
          {!loading && cardsShown.length > 0 && (
            <>
              <div ref={sentinelRef} className="h-px w-full" />
              <p className="pb-2 text-center text-sm text-slate-400">
                {hasMore ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                    Loading more users…
                  </span>
                ) : (
                  <>You&apos;ve reached the end · <strong>{total.toLocaleString()}</strong> users</>
                )}
              </p>
            </>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {formOpen && (
        <UserForm
          mode={formMode}
          initial={editingUser ? userToDraft(editingUser) : null}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ---------- helpers ----------

type RowHandlers = {
  onView: (u: User) => void;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
  onSend: (u: User) => void;
  sendingTo: string | null;
  canEdit: boolean;
  canDelete: boolean;
};

function userToDraft(u: User): UserDraft {
  return {
    name: u.name,
    email: u.email,
    phone: u.phone,
    designation: u.designation,
    department: u.department,
    role: u.role,
    status: u.status,
    companyCode: u.companyCode,
    joiningDate: u.joiningDate,
    city: u.city,
    state: u.state,
    address: u.address,
    zip: u.zip,
    bio: u.bio,
    password: u.password,
    linkedin: u.linkedin,
    twitter: u.twitter,
    github: u.github,
    avatar: u.profile?.startsWith("data:") ? u.profile : null,
    extraPermissions: u.extraPermissions ?? emptyMatrix(),
  };
}

function formatJoin(value: string): string {
  if (!value || value === "—") return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

// ---------- cells ----------

function renderCell(key: ColKey, u: User, i: number, on?: RowHandlers): ReactNode {
  if (key === "name") {
    return (
      <div className="flex items-center gap-3">
        {u.profile?.startsWith("data:") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.profile} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
            {u.profile}
          </div>
        )}
        <div>
          <p className="font-medium text-slate-900">{u.name}</p>
          <p className="text-xs text-slate-500">{u.designation}</p>
        </div>
      </div>
    );
  }
  if (key === "email")
    return <a href={`mailto:${u.email}`} className="text-blue-600 hover:underline">{u.email}</a>;
  if (key === "role")
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorBadge(ROLE_COLOR[u.role] ?? "blue")}`}>{u.role}</span>;
  if (key === "status")
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[u.status] ?? "bg-slate-100 text-slate-600"}`}>{u.status}</span>;
  if (key === "companyCode")
    return <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{u.companyCode}</span>;
  if (key === "employeeId")
    return <span className="font-mono text-xs text-slate-700">{u.employeeId}</span>;
  if (key === "social") return <SocialLinks user={u} />;
  if (key === "password") return <PasswordCell value={u.password} />;
  if (key === "bio")
    return <p className="max-w-xs truncate text-slate-600" title={u.bio}>{u.bio}</p>;
  if (key === "address")
    return <span className="text-slate-600">{u.address}</span>;
  if (key === "actions") return <ActionButtons user={u} on={on} />;
  return <>{String(u[key as keyof User])}</>;
}

function ActionButtons({ user, on }: { user: User; on?: RowHandlers }) {
  const sending = on?.sendingTo === user.email;
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => on?.onView(user)}
        title="View"
        aria-label="View"
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
      >
        <Icon name="eye" className="h-[18px] w-[18px]" />
      </button>
      {on?.canEdit && (
        <button
          onClick={() => on?.onSend(user)}
          disabled={sending}
          title="Email credentials to user"
          aria-label="Send credentials"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
        >
          {sending ? (
            <span className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          ) : (
            <Icon name="send" className="h-[18px] w-[18px]" />
          )}
        </button>
      )}
      {on?.canEdit && (
        <button
          onClick={() => on?.onEdit(user)}
          title="Edit"
          aria-label="Edit"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
        >
          <Icon name="edit" className="h-[18px] w-[18px]" />
        </button>
      )}
      {on?.canDelete && (
        <button
          onClick={() => on?.onDelete(user)}
          title="Delete"
          aria-label="Delete"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Icon name="trash" className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  );
}

function PasswordCell({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  return (
    <button
      onClick={() => setShow((s) => !s)}
      className="flex items-center gap-2 font-mono text-xs text-slate-600 hover:text-slate-900"
      title={show ? "Hide" : "Reveal"}
    >
      <span>{show ? value : "••••••••"}</span>
      <Icon name={show ? "visitor" : "search"} className="h-3.5 w-3.5 text-slate-400" />
    </button>
  );
}

function SocialLinks({ user }: { user: User }) {
  const links: { href: string; label: string; path: ReactNode }[] = [
    { href: user.linkedin, label: "LinkedIn", path: <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM6 9H2v12h4zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /> },
    { href: user.twitter, label: "Twitter", path: <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" /> },
    { href: user.github, label: "GitHub", path: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /> },
  ];
  return (
    <div className="flex items-center gap-2">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.label} className="text-slate-400 hover:text-blue-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{l.path}</svg>
        </a>
      ))}
    </div>
  );
}

// ---------- card view ----------

function UserCard({
  user,
  idx,
  roleMeta,
  onView,
  onEdit,
  onSend,
  sending,
  canEdit,
}: {
  user: User;
  idx: number;
  roleMeta: Record<string, { color: string; granted: number; total: number }>;
  onView: (u: User) => void;
  onEdit: (u: User) => void;
  onSend: (u: User) => void;
  sending: boolean;
  canEdit: boolean;
}) {
  const rm = roleMeta[user.role];
  const active = user.status === "Active";
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl">
      {/* hover actions */}
      <div className="absolute right-2.5 top-2.5 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button onClick={() => onView(user)} title="View profile" aria-label="View profile" className="rounded-md bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur transition hover:bg-blue-50 hover:text-blue-600">
          <Icon name="eye" className="h-3.5 w-3.5" />
        </button>
        {canEdit && (
          <button onClick={() => onEdit(user)} title="Edit" aria-label="Edit" className="rounded-md bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur transition hover:bg-amber-50 hover:text-amber-600">
            <Icon name="edit" className="h-3.5 w-3.5" />
          </button>
        )}
        {canEdit && (
          <button onClick={() => onSend(user)} disabled={sending} title="Email credentials to user" aria-label="Send credentials" className="rounded-md bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50">
            {sending ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" /> : <Icon name="send" className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Lanyard slot */}
      <div className="flex justify-center pt-3">
        <span className="h-1.5 w-12 rounded-full bg-slate-200 ring-1 ring-slate-300" />
      </div>

      {/* Photo */}
      <div className="mt-2 flex justify-center">
        {user.profile?.startsWith("data:") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.profile} alt={user.name} className="h-16 w-16 rounded-full object-cover shadow-md ring-4 ring-white" />
        ) : (
          <div className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold shadow-md ring-4 ring-white ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
            {user.profile}
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="mt-2 px-3 text-center">
        <h3 className="truncate text-base font-bold text-slate-900">{user.name}</h3>
        <p className="truncate text-xs font-medium text-blue-600">{user.designation}</p>
        <div className="mt-1.5 flex justify-center">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${colorBadge(ROLE_COLOR[user.role] ?? rm?.color ?? "blue")}`}>
            <Icon name="settings" className="h-3 w-3" />{user.role}
          </span>
        </div>
      </div>

      {/* Detail grid */}
      <div className="mx-3 mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-3">
        <Detail label="Employee ID" value={user.employeeId} mono />
        <Detail label="Department" value={user.department} />
        <Detail label="Joined" value={user.joiningDate} />
        <Detail label="Location" value={`${user.city}, ${user.state}`} />
      </div>

      {/* Email */}
      <a href={`mailto:${user.email}`} className="mx-3 mt-2 flex items-center justify-center gap-1.5 truncate text-[11px] text-slate-500 hover:text-blue-600">
        <Icon name="gmail" className="h-3 w-3 shrink-0" /><span className="truncate">{user.email}</span>
      </a>

      {/* Barcode footer */}
      <div className="mt-auto flex items-end justify-between gap-2 px-3 pb-3 pt-3">
        <div>
          <div className="h-7 w-24 rounded-sm" style={{ background: BARCODE }} aria-hidden />
          <p className="mt-1 font-mono text-[9px] tracking-wider text-slate-400">{user.companyCode} · {user.employeeId}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[user.status] ?? "bg-slate-400"}`} />{user.status}
        </span>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`truncate text-[11px] font-medium text-slate-700 ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

// ---------- shared ----------

function Pagination({
  loading, total, start, pageSize, setPageSize, current, totalPages, setPage, noun,
}: {
  loading: boolean;
  total: number;
  start: number;
  pageSize: number;
  setPageSize: (n: number) => void;
  current: number;
  totalPages: number;
  setPage: (fn: number | ((p: number) => number)) => void;
  noun: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
      <div className="flex items-center gap-4">
        <p className="text-sm text-slate-500">
          {loading ? (
            <Skeleton className="h-4 w-44" />
          ) : (
            <>
              Showing <strong>{total === 0 ? 0 : start + 1}</strong> to{" "}
              <strong>{Math.min(start + pageSize, total)}</strong> of{" "}
              <strong>{total.toLocaleString()}</strong> {noun}
            </>
          )}
        </p>
        <label className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
          Rows:
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={current === 1 || loading}
          className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Previous"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        {pageNumbers(current, totalPages).map((n, idx) =>
          typeof n === "number" ? (
            <button
              key={idx}
              onClick={() => setPage(n)}
              className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium ${n === current ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {n}
            </button>
          ) : (
            <span key={idx} className="px-1 text-slate-400">…</span>
          ),
        )}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={current === totalPages || loading}
          className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Next"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    </div>
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

function FilterLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-[11px] font-medium text-slate-500">{children}</label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="min-w-0">
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
              <td key={c} className={`px-6 py-4 ${sticky}`}>
                {pinnedLeft ? (
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ) : (
                  <Skeleton className="h-3.5 w-24" />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex justify-center pt-3"><Skeleton className="h-1.5 w-12 rounded-full" /></div>
      <div className="mx-3 mt-2 h-12 rounded-xl bg-slate-100" />
      <div className="-mt-7 flex justify-center"><Skeleton className="h-16 w-16 rounded-full ring-4 ring-white" /></div>
      <div className="mt-2 flex flex-col items-center gap-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className="mx-3 mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}><Skeleton className="h-2 w-12" /><Skeleton className="mt-1.5 h-2.5 w-20" /></div>
        ))}
      </div>
      <div className="mt-3 flex items-end justify-between px-3 pb-3 pt-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
    </div>
  );
}

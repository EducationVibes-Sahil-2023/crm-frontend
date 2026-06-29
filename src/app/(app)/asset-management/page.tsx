"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import SearchSelect from "@/components/SearchSelect";
import { getUser } from "@/lib/auth";
import {
  assetsApi,
  EVENT_META,
  formatDate,
  formatMoney,
  nextAssetTag,
  STATUS_META,
  timeAgo,
  userCanEdit,
  type Actor,
  type Asset,
  type AssetFields,
  type AssetStatus,
  type Role,
} from "@/lib/assets";
import {
  clearAll,
  loadAssetNotifs,
  markAllRead,
  markRead,
  pushAssetNotif,
  unreadCount,
  type AssetNotif,
  type Recipient,
} from "@/lib/assetNotify";
import { optionNames } from "@/lib/setup";

const ROLE_KEY = "nexus_asset_view_role";
const CONDITIONS = ["New", "Excellent", "Good", "Fair", "Poor"];
const STATUS_TABS: ("all" | AssetStatus)[] = ["all", "pending", "submitted", "verified", "rejected"];

export default function AssetManagementPage() {
  const toast = useToast();
  const me = useMemo(() => getUser(), []);

  const [role, setRole] = useState<Role>("admin");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | AssetStatus>("all");

  const [detail, setDetail] = useState<Asset | null>(null);
  const [draft, setDraft] = useState<AssetFields>({});
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AssetFields>({});
  const [assetCategories] = useState<string[]>(() => optionNames("assetCategory"));
  const [vendors] = useState<string[]>(() => optionNames("vendor"));
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const [notifs, setNotifs] = useState<AssetNotif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const actor: Actor = useMemo(() => ({ actor: me?.name ?? "You", role }), [me, role]);
  const recipient: Recipient = role === "admin" ? "user" : "admin";

  // ---- init --------------------------------------------------------------
  const load = useCallback(async () => {
    try {
      const list = await assetsApi.list();
      setAssets(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const saved = window.localStorage.getItem(ROLE_KEY);
      if (saved === "user" || saved === "admin") setRole(saved);
      setNotifs(loadAssetNotifs());
      load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  function switchRole(r: Role) {
    setRole(r);
    if (typeof window !== "undefined") window.localStorage.setItem(ROLE_KEY, r);
  }

  // ---- notifications ------------------------------------------------------
  const myUnread = unreadCount(notifs, role);

  function notify(to: Recipient, title: string, body: string, asset: Asset) {
    setNotifs((list) =>
      pushAssetNotif(
        list,
        { assetId: asset.id, assetName: asset.name, to, title, body },
        to === "user" ? asset.owner_email : null,
      ),
    );
  }

  // ---- detail helpers -----------------------------------------------------
  const toDraft = (a: Asset): AssetFields => ({
    name: a.name ?? "",
    tag: a.tag ?? "",
    category: a.category ?? "",
    description: a.description ?? "",
    serial_number: a.serial_number ?? "",
    manufacturer: a.manufacturer ?? "",
    model: a.model ?? "",
    location: a.location ?? "",
    condition: a.condition ?? "",
    vendor: a.vendor ?? "",
    owner_name: a.owner_name ?? "",
    owner_email: a.owner_email ?? "",
    purchase_date: a.purchase_date ?? "",
    purchase_cost: a.purchase_cost == null ? "" : String(a.purchase_cost),
    repair_cost: a.repair_cost == null ? "" : String(a.repair_cost),
    warranty_years: a.warranty_years == null ? "" : String(a.warranty_years),
  });

  const applyDetail = useCallback((a: Asset) => {
    setDetail(a);
    setDraft(toDraft(a));
    setAssets((list) => {
      const stripped: Asset = { ...a };
      delete stripped.events;
      return list.some((x) => x.id === a.id)
        ? list.map((x) => (x.id === a.id ? stripped : x))
        : [stripped, ...list];
    });
  }, []);

  async function openAsset(a: Asset) {
    applyDetail(a);
    try {
      const full = await assetsApi.get(a.id);
      applyDetail(full);
    } catch {
      /* keep list copy */
    }
  }

  const editable = detail ? userCanEdit(detail.status) : false;
  const dirty = useMemo(() => {
    if (!detail) return false;
    const base = toDraft(detail);
    return (Object.keys(draft) as (keyof AssetFields)[]).some((k) => (draft[k] ?? "") !== (base[k] ?? ""));
  }, [draft, detail]);

  function setField(k: keyof AssetFields, v: string) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  // ---- actions ------------------------------------------------------------
  async function saveChanges() {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await assetsApi.update(detail.id, draft, actor);
      applyDetail(updated);
      toast.success("Changes saved", "Asset information updated");
    } catch (e) {
      toast.error("Could not save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    fn: () => Promise<Asset>,
    okTitle: string,
    notifTo: Recipient,
    notifTitle: string,
    notifBody: (a: Asset) => string,
  ) {
    setSaving(true);
    try {
      const updated = await fn();
      applyDetail(updated);
      toast.success(okTitle);
      notify(notifTo, notifTitle, notifBody(updated), updated);
    } catch (e) {
      toast.error("Action failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const submitAsset = () => {
    if (!detail) return;
    runAction(
      () => assetsApi.submit(detail.id, actor),
      "Submitted for verification",
      "admin",
      "Asset submitted for verification",
      (a) => `${a.name} was submitted by ${actor.actor} and needs your verification.`,
    );
  };

  const verifyAsset = () => {
    if (!detail) return;
    runAction(
      () => assetsApi.verify(detail.id, actor),
      "Asset verified & locked",
      "user",
      "Your asset was verified",
      (a) => `${a.name} has been verified and is now locked. No further changes can be made.`,
    );
  };

  const reopenAsset = () => {
    if (!detail) return;
    runAction(
      () => assetsApi.reopen(detail.id, actor),
      "Asset re-opened",
      "user",
      "Asset re-opened for editing",
      (a) => `${a.name} was re-opened. You can update the information again.`,
    );
  };

  async function confirmReject() {
    if (!detail || !rejectReason.trim()) return;
    const reason = rejectReason.trim();
    setSaving(true);
    try {
      const updated = await assetsApi.reject(detail.id, reason, actor);
      applyDetail(updated);
      setRejectOpen(false);
      setRejectReason("");
      toast.success("Asset rejected", "The user has been notified");
      notify("user", "Your asset was rejected", `${updated.name} was rejected: ${reason}`, updated);
    } catch (e) {
      toast.error("Could not reject", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function sendComment() {
    if (!detail || !comment.trim()) return;
    const msg = comment.trim();
    setComment("");
    try {
      const updated = await assetsApi.comment(detail.id, msg, actor);
      applyDetail(updated);
      notify(recipient, `New comment from ${actor.actor}`, msg, updated);
    } catch (e) {
      toast.error("Comment failed", e instanceof Error ? e.message : undefined);
    }
  }

  async function deleteAsset(a: Asset) {
    if (!confirm(`Delete asset "${a.name}"? This removes its history too.`)) return;
    try {
      await assetsApi.remove(a.id);
      setAssets((list) => list.filter((x) => x.id !== a.id));
      if (detail?.id === a.id) setDetail(null);
      toast.success("Asset deleted", a.name);
    } catch (e) {
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    }
  }

  async function createAsset() {
    if (!createForm.name?.trim()) return;
    setSaving(true);
    try {
      // Tag is system-assigned, never entered by a user.
      const created = await assetsApi.create({ ...createForm, tag: nextAssetTag(assets) }, actor);
      setCreateOpen(false);
      setCreateForm({});
      toast.success("Asset assigned", `${created.name} assigned to ${created.owner_name || "user"}`);
      notify(
        "user",
        "New asset assigned to you",
        `${created.name} was assigned to you. Please fill in all the required information and submit for verification.`,
        created,
      );
      openAsset(created);
    } catch (e) {
      toast.error("Could not create asset", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAssetFile(
    field: "image_url" | "bill_url" | "warranty_doc_url",
    file: File | undefined,
  ) {
    if (!file) return;
    setUploadingField(field);
    try {
      const url = await assetsApi.upload(file);
      setCreateForm((f) => ({ ...f, [field]: url }));
      toast.success("Uploaded", file.name);
    } catch (e) {
      toast.error("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploadingField(null);
    }
  }

  const renderUpload = (
    label: string,
    field: "image_url" | "bill_url" | "warranty_doc_url",
    accept: string,
  ) => {
    const val = createForm[field];
    return (
      <Field label={label}>
        {val ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <span className="flex items-center gap-1 truncate">
              <Icon name="check" className="h-3.5 w-3.5 shrink-0" /> Uploaded
            </span>
            <button
              type="button"
              onClick={() => setCreateForm((f) => ({ ...f, [field]: null }))}
              className="shrink-0 text-emerald-700/70 hover:text-emerald-900"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/40">
            <Icon name="upload" className="h-4 w-4" />
            {uploadingField === field ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept={accept}
              className="hidden"
              disabled={uploadingField === field}
              onChange={(e) => uploadAssetFile(field, e.target.files?.[0])}
            />
          </label>
        )}
      </Field>
    );
  };

  // ---- derived ------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      const mt = tab === "all" || a.status === tab;
      const mq =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.tag || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.owner_name || "").toLowerCase().includes(q);
      return mt && mq;
    });
  }, [assets, query, tab]);

  const stats = useMemo(() => {
    const by = (s: AssetStatus) => assets.filter((a) => a.status === s).length;
    const value = assets.reduce((sum, a) => sum + Number(a.purchase_cost || 0) + Number(a.repair_cost || 0), 0);
    return { total: assets.length, pending: by("pending"), submitted: by("submitted"), verified: by("verified"), value };
  }, [assets]);

  // ------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Asset Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track assets, costs &amp; warranty, and run the admin verification workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoleSwitch role={role} onChange={switchRole} />
          <NotifBell
            open={notifOpen}
            onToggle={() => setNotifOpen((o) => !o)}
            count={myUnread}
            notifs={notifs.filter((n) => n.to === role)}
            onMarkAll={() => setNotifs((l) => markAllRead(l, role))}
            onClear={() => setNotifs((l) => clearAll(l, role))}
            onOpenItem={(n) => {
              setNotifs((l) => markRead(l, n.id));
              const a = assets.find((x) => x.id === n.assetId);
              if (a) openAsset(a);
              setNotifOpen(false);
            }}
          />
          {role === "admin" && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Icon name="plus" className="h-4 w-4" /> New Asset
            </button>
          )}
        </div>
      </div>

      {/* Role context note */}
      <div
        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${
          role === "admin" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        <Icon name={role === "admin" ? "settings" : "users"} className="h-4 w-4" />
        {role === "admin" ? (
          <span>You are viewing as <b>Admin</b> — assign assets, verify submissions, reject with a reason, or re-open.</span>
        ) : (
          <span>You are viewing as <b>User</b> — fill in assigned assets and submit for verification. Verified assets are locked.</span>
        )}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="asset" label="Total assets" value={stats.total} wrap="bg-slate-100 text-slate-600" />
        <Stat icon="edit" label="Awaiting info" value={stats.pending} wrap="bg-amber-100 text-amber-600" />
        <Stat icon="eye" label="Under review" value={stats.submitted} wrap="bg-blue-100 text-blue-600" />
        <Stat icon="revenue" label="Total value" value={formatMoney(stats.value)} wrap="bg-emerald-100 text-emerald-600" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${
                tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {t === "all" ? "All" : STATUS_META[t].label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState role={role} onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Asset</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Purchase</th>
                  <th className="px-5 py-3 text-right">Repair</th>
                  <th className="px-5 py-3">Warranty</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const sm = STATUS_META[a.status];
                  return (
                    <tr
                      key={a.id}
                      onClick={() => openAsset(a)}
                      className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <Icon name="asset" className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{a.name}</p>
                            <p className="text-xs text-slate-500">
                              {a.tag ? `${a.tag} · ` : ""}
                              {a.category || "Uncategorized"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.owner_name || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${sm.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">{formatMoney(a.purchase_cost)}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{formatMoney(a.repair_cost)}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {Number(a.warranty_years || 0) > 0 ? (
                          <span>
                            {a.warranty_years}y <span className="text-slate-400">· till {formatDate(a.warranty_expiry)}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500">{timeAgo(a.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail slide-over */}
      {detail && (
        <DetailDrawer
          asset={detail}
          draft={draft}
          role={role}
          editable={editable}
          dirty={dirty}
          saving={saving}
          comment={comment}
          onComment={setComment}
          onSendComment={sendComment}
          onField={setField}
          categories={assetCategories}
          vendors={vendors}
          onClose={() => setDetail(null)}
          onSave={saveChanges}
          onSubmit={submitAsset}
          onVerify={verifyAsset}
          onReject={() => setRejectOpen(true)}
          onReopen={reopenAsset}
          onDelete={() => deleteAsset(detail)}
        />
      )}

      {/* Reject reason modal */}
      {rejectOpen && (
        <Modal title="Reject asset" onClose={() => setRejectOpen(false)}>
          <p className="mb-3 text-sm text-slate-500">
            Tell the user what needs fixing. They&apos;ll be notified and can edit again.
          </p>
          <textarea
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            placeholder="e.g. Serial number doesn't match the device label."
            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setRejectOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={confirmReject}
              disabled={!rejectReason.trim() || saving}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              Reject &amp; notify
            </button>
          </div>
        </Modal>
      )}

      {/* New asset modal */}
      {createOpen && (
        <Modal title="Assign new asset" onClose={() => setCreateOpen(false)}>
          <p className="mb-4 text-sm text-slate-500">
            Create the asset and assign it to a user. They&apos;ll be notified to fill in the details.
          </p>
          <div className="space-y-3">
            <Field label="Asset name" required>
              <input className={inputCls} autoFocus value={createForm.name ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Dell Latitude 7440" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Asset tag">
                <input className={inputCls} value="Auto-generated (AST-####)" disabled readOnly />
              </Field>
              <Field label="Category">
                <SearchSelect
                  value={createForm.category ?? ""}
                  onChange={(v) => setCreateForm((f) => ({ ...f, category: v }))}
                  options={assetCategories}
                  placeholder="Select category…"
                />
              </Field>
            </div>
            <Field label="Vendor / supplier">
              <SearchSelect
                value={createForm.vendor ?? ""}
                onChange={(v) => setCreateForm((f) => ({ ...f, vendor: v }))}
                options={vendors}
                placeholder="Select vendor…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Assign to (name)"><input className={inputCls} value={createForm.owner_name ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, owner_name: e.target.value }))} placeholder="Asha Sharma" /></Field>
              <Field label="User email"><input className={inputCls} value={createForm.owner_email ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, owner_email: e.target.value }))} placeholder="asha@company.com" /></Field>
            </div>

            {/* Attachments: photo, purchase bill, warranty document */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Attachments</p>
              <div className="grid grid-cols-3 gap-3">
                {renderUpload("Image", "image_url", "image/*")}
                {renderUpload("Purchase bill", "bill_url", "image/*,application/pdf")}
                {renderUpload("Warranty doc", "warranty_doc_url", "image/*,application/pdf")}
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setCreateOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cancel</button>
            <button onClick={createAsset} disabled={!createForm.name?.trim() || saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
              Assign &amp; notify
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Sub-components                                                          */
/* ---------------------------------------------------------------------- */

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

function RoleSwitch({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
      <span className="px-2 text-xs font-medium text-slate-400">View as</span>
      {(["admin", "user"] as Role[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${
            role === r ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function NotifBell({
  open,
  onToggle,
  count,
  notifs,
  onMarkAll,
  onClear,
  onOpenItem,
}: {
  open: boolean;
  onToggle: () => void;
  count: number;
  notifs: AssetNotif[];
  onMarkAll: () => void;
  onClear: () => void;
  onOpenItem: (n: AssetNotif) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-label="Notifications"
        className="relative rounded-lg border border-slate-300 bg-white p-2 text-slate-500 transition hover:bg-slate-50"
      >
        <Icon name="bell" className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={onMarkAll} className="text-blue-600 hover:underline">Mark read</button>
              <span className="text-slate-300">·</span>
              <button onClick={onClear} className="text-slate-400 hover:text-rose-600">Clear</button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">No notifications yet</div>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onOpenItem(n)}
                  className={`flex w-full items-start gap-2 border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 ${n.read ? "" : "bg-blue-50/40"}`}
                >
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  <div className={`min-w-0 ${n.read ? "pl-4" : ""}`}>
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, wrap }: { icon: IconName; label: string; value: ReactNode; wrap: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrap}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function DetailDrawer({
  asset,
  draft,
  role,
  editable,
  dirty,
  saving,
  comment,
  onComment,
  onSendComment,
  onField,
  categories,
  vendors,
  onClose,
  onSave,
  onSubmit,
  onVerify,
  onReject,
  onReopen,
  onDelete,
}: {
  asset: Asset;
  draft: AssetFields;
  role: Role;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  comment: string;
  onComment: (v: string) => void;
  onSendComment: () => void;
  onField: (k: keyof AssetFields, v: string) => void;
  categories: string[];
  vendors: string[];
  onClose: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onVerify: () => void;
  onReject: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const sm = STATUS_META[asset.status];
  const fieldDisabled = !editable;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Icon name="asset" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900">{asset.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${sm.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                  {sm.label}
                </span>
                {asset.tag && <span>{asset.tag}</span>}
                {asset.owner_name && <span>· {asset.owner_name}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {asset.status === "rejected" && asset.reject_reason && (
            <Banner tone="rose" icon="close" title="Changes requested">{asset.reject_reason}</Banner>
          )}
          {asset.status === "verified" && (
            <Banner tone="emerald" icon="check" title="Verified & locked">
              Verified by {asset.verified_by || "admin"} on {formatDate(asset.verified_at)}. The information is locked and can no longer be changed.
            </Banner>
          )}
          {asset.status === "submitted" && (
            <Banner tone="blue" icon="eye" title="Under review">
              Submitted and awaiting admin verification. Editing is locked until it&apos;s verified or sent back.
            </Banner>
          )}
          {asset.status === "pending" && (
            <Banner tone="amber" icon="edit" title="Awaiting information">
              {role === "user" ? "Fill in all the details below and submit for verification." : "Waiting for the user to complete and submit this asset."}
            </Banner>
          )}

          <Section title="Asset details">
            <Grid>
              <Field label="Asset name" required><input className={inputCls} disabled={fieldDisabled} value={draft.name ?? ""} onChange={(e) => onField("name", e.target.value)} /></Field>
              <Field label="Asset tag"><input className={inputCls} value={draft.tag || "Auto-assigned"} disabled readOnly title="System-generated — cannot be edited" /></Field>
              <Field label="Category">
                <SearchSelect disabled={fieldDisabled} value={draft.category ?? ""} onChange={(v) => onField("category", v)} options={categories} placeholder="Select…" />
              </Field>
              <Field label="Condition">
                <SearchSelect disabled={fieldDisabled} value={draft.condition ?? ""} onChange={(v) => onField("condition", v)} options={CONDITIONS} placeholder="Select…" />
              </Field>
              <Field label="Serial number"><input className={inputCls} disabled={fieldDisabled} value={draft.serial_number ?? ""} onChange={(e) => onField("serial_number", e.target.value)} /></Field>
              <Field label="Manufacturer"><input className={inputCls} disabled={fieldDisabled} value={draft.manufacturer ?? ""} onChange={(e) => onField("manufacturer", e.target.value)} /></Field>
              <Field label="Model"><input className={inputCls} disabled={fieldDisabled} value={draft.model ?? ""} onChange={(e) => onField("model", e.target.value)} /></Field>
              <Field label="Location"><input className={inputCls} disabled={fieldDisabled} value={draft.location ?? ""} onChange={(e) => onField("location", e.target.value)} /></Field>
              <Field label="Vendor / supplier">
                <SearchSelect disabled={fieldDisabled} value={draft.vendor ?? ""} onChange={(v) => onField("vendor", v)} options={vendors} placeholder="Select…" />
              </Field>
            </Grid>
            <Field label="Description" className="mt-3">
              <textarea rows={2} className={`${inputCls} resize-none`} disabled={fieldDisabled} value={draft.description ?? ""} onChange={(e) => onField("description", e.target.value)} />
            </Field>
          </Section>

          <Section title="Assignment">
            <Grid>
              <Field label="Owner name"><input className={inputCls} disabled={fieldDisabled} value={draft.owner_name ?? ""} onChange={(e) => onField("owner_name", e.target.value)} /></Field>
              <Field label="Owner email"><input className={inputCls} disabled={fieldDisabled} value={draft.owner_email ?? ""} onChange={(e) => onField("owner_email", e.target.value)} /></Field>
            </Grid>
          </Section>

          <Section title="Costing & warranty">
            <Grid>
              <Field label="Purchase date"><input type="date" className={inputCls} disabled={fieldDisabled} value={draft.purchase_date ?? ""} onChange={(e) => onField("purchase_date", e.target.value)} /></Field>
              <Field label="Purchase cost (₹)"><input type="number" min="0" step="0.01" className={inputCls} disabled={fieldDisabled} value={draft.purchase_cost ?? ""} onChange={(e) => onField("purchase_cost", e.target.value)} /></Field>
              <Field label="Repair cost (₹)"><input type="number" min="0" step="0.01" className={inputCls} disabled={fieldDisabled} value={draft.repair_cost ?? ""} onChange={(e) => onField("repair_cost", e.target.value)} /></Field>
              <Field label="Warranty (years)"><input type="number" min="0" step="0.5" className={inputCls} disabled={fieldDisabled} value={draft.warranty_years ?? ""} onChange={(e) => onField("warranty_years", e.target.value)} /></Field>
            </Grid>
            <div className="mt-3 flex flex-wrap gap-3">
              <Pill label="Total cost" value={formatMoney(Number(draft.purchase_cost || 0) + Number(draft.repair_cost || 0))} />
              <Pill label="Warranty until" value={formatDate(asset.warranty_expiry)} />
            </div>
          </Section>

          <Section title="Activity & comments">
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => onComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSendComment()}
                placeholder="Write a comment…"
                className={inputCls}
              />
              <button
                onClick={onSendComment}
                disabled={!comment.trim()}
                className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
              >
                Send
              </button>
            </div>
            <ol className="mt-4 space-y-3">
              {(asset.events ?? []).map((ev) => {
                const em = EVENT_META[ev.type] ?? EVENT_META.updated;
                return (
                  <li key={ev.id} className="flex gap-3">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${em.wrap}`}>
                      <Icon name={em.icon} className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">{ev.actor || "System"}</span>
                        {ev.role && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{ev.role}</span>}
                        {ev.type === "comment" ? ":" : ""} {ev.message}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{timeAgo(ev.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>
        </div>

        {/* footer action bar */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <div>
            {role === "admin" && (
              <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-600">
                <Icon name="trash" className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <button
                onClick={onSave}
                disabled={!dirty || saving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
            {role === "user" && editable && (
              <button onClick={onSubmit} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                <Icon name="upload" className="h-4 w-4" /> Submit for verification
              </button>
            )}
            {role === "admin" && asset.status === "submitted" && (
              <>
                <button onClick={onReject} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">
                  <Icon name="close" className="h-4 w-4" /> Reject
                </button>
                <button onClick={onVerify} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  <Icon name="check" className="h-4 w-4" /> Verify &amp; lock
                </button>
              </>
            )}
            {role === "admin" && (asset.status === "verified" || asset.status === "rejected") && (
              <button onClick={onReopen} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50">
                <Icon name="edit" className="h-4 w-4" /> Re-open
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Banner({ tone, icon, title, children }: { tone: "rose" | "emerald" | "blue" | "amber"; icon: IconName; title: string; children: ReactNode }) {
  const map = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  } as const;
  return (
    <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 ${map[tone]}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm opacity-90">{children}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Pill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-100 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 transition hover:text-slate-600">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ role, onCreate }: { role: Role; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="asset" className="h-8 w-8" />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">No assets yet</p>
      <p className="mt-1 text-sm text-slate-500">
        {role === "admin" ? "Create an asset and assign it to a user to start the workflow." : "Assets assigned to you will appear here."}
      </p>
      {role === "admin" && (
        <button onClick={onCreate} className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
          <Icon name="plus" className="h-4 w-4" /> New Asset
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 py-16 text-center">
      <p className="text-sm font-semibold text-rose-700">Couldn&apos;t load assets</p>
      <p className="mt-1 max-w-md text-xs text-rose-500">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">
        Retry
      </button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

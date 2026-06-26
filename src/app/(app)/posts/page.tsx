"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getUser } from "@/lib/auth";
import { Field, HrEmpty, HrFooter, HrHero, HrModal, inputCls } from "@/components/HrUi";
import { POST_CATEGORIES, loadPosts, savePosts, type Post } from "@/lib/hr";

const CAT_STYLE: Record<string, string> = {
  Notice: "bg-blue-100 text-blue-700",
  Celebration: "bg-rose-100 text-rose-700",
  Update: "bg-emerald-100 text-emerald-700",
  Reminder: "bg-amber-100 text-amber-700",
};

export default function PostsPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setPosts(loadPosts()); setReady(true); }, []);
  useEffect(() => { if (ready) savePosts(posts); }, [posts, ready]);

  const sorted = [...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  function add(p: Omit<Post, "id">) { setPosts((l) => [{ ...p, id: `po-${Date.now()}` }, ...l]); setOpen(false); toast.success("Notice posted", p.title); }
  function togglePin(id: string) { setPosts((l) => l.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p))); }
  function remove(id: string) { setPosts((l) => l.filter((p) => p.id !== id)); toast.info("Notice deleted"); }

  return (
    <div className="space-y-6">
      <HrHero icon="announcement" title="Posts & Notices" sub="Company-wide announcements for the whole team." actionLabel="New Post" onAction={() => setOpen(true)} stats={[["Total", String(posts.length)], ["Pinned", String(posts.filter((p) => p.pinned).length)]]} />

      {posts.length === 0 ? <HrEmpty icon="announcement" title="No notices yet" sub="Post your first company-wide notice." /> : (
        <div className="space-y-3">
          {sorted.map((p) => (
            <div key={p.id} className={`group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${p.pinned ? "border-blue-200 ring-1 ring-blue-100" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CAT_STYLE[p.category] ?? "bg-slate-100 text-slate-600"}`}>{p.category}</span>
                  {p.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600"><Icon name="pin" className="h-3 w-3" /> Pinned</span>}
                </div>
                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => togglePin(p.id)} title={p.pinned ? "Unpin" : "Pin"} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="pin" className="h-4 w-4" /></button>
                  <button onClick={() => remove(p.id)} title="Delete" className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="h-4 w-4" /></button>
                </div>
              </div>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{p.body}</p>
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400"><Icon name="users" className="h-3.5 w-3.5" /> {p.author} · {p.date}</div>
            </div>
          ))}
        </div>
      )}

      {open && <PostModal onClose={() => setOpen(false)} onSave={add} />}
    </div>
  );
}

function PostModal({ onClose, onSave }: { onClose: () => void; onSave: (p: Omit<Post, "id">) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(POST_CATEGORIES[0]);
  const [pinned, setPinned] = useState(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) return toast.error("Add a title");
    if (body.trim().length < 5) return toast.error("Add some content");
    onSave({ title: title.trim(), body: body.trim(), category, pinned, author: getUser()?.name || "HR Team", date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) });
  }
  return (
    <HrModal title="New Post" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="space-y-4 px-6 py-6">
          <Field label="Title"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Office closed for Diwali" className={inputCls} /></Field>
          <Field label="Category"><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>{POST_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Message"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={`${inputCls} resize-none`} placeholder="Write the notice…" /></Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" /> Pin to top</label>
        </div>
        <HrFooter onClose={onClose} submitLabel="Post Notice" />
      </form>
    </HrModal>
  );
}

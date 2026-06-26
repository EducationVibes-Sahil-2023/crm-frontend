"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  formatBytes,
  formatDate,
  kindOf,
  mediaApi,
  type MediaFile,
  type MediaFolder,
  type MediaKind,
} from "@/lib/media";

type View = "grid" | "list";
type Sort = "name" | "date" | "size";
type DragPayload = { id: number; kind: "folder" | "file" };

const KIND_META: Record<MediaKind, { icon: IconName; wrap: string }> = {
  image: { icon: "image", wrap: "bg-violet-100 text-violet-600" },
  video: { icon: "video", wrap: "bg-rose-100 text-rose-600" },
  audio: { icon: "audio", wrap: "bg-amber-100 text-amber-600" },
  pdf: { icon: "fileText", wrap: "bg-red-100 text-red-600" },
  doc: { icon: "fileText", wrap: "bg-blue-100 text-blue-600" },
  file: { icon: "fileText", wrap: "bg-slate-100 text-slate-500" },
};

export default function MediaPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentId, setCurrentId] = useState<number | null>(null);
  const [allMode, setAllMode] = useState(false); // "All files" — flat list of every file
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>("name");
  const [query, setQuery] = useState("");

  const [uploading, setUploading] = useState(0);
  const [dropActive, setDropActive] = useState(false);
  const dragDepth = useRef(0);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [preview, setPreview] = useState<MediaFile | null>(null);
  const [rename, setRename] = useState<{ id: number; kind: "folder" | "file"; name: string } | null>(null);
  const [dragId, setDragId] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null | "root">(null);

  const load = useCallback(async () => {
    try {
      const [f, m] = await Promise.all([mediaApi.listFolders(), mediaApi.listFiles()]);
      setFolders(f);
      setFiles(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Breadcrumb path: root → … → current
  const breadcrumb = useMemo(() => {
    const trail: MediaFolder[] = [];
    let cursor = currentId;
    const byId = new Map(folders.map((f) => [f.id, f]));
    while (cursor != null) {
      const f = byId.get(cursor);
      if (!f) break;
      trail.unshift(f);
      cursor = f.parent_id;
    }
    return trail;
  }, [currentId, folders]);

  const searching = query.trim().length > 0;

  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    // "All files" hides the folder grid (it's a flat file view).
    const base = searching
      ? folders.filter((f) => f.name.toLowerCase().includes(q))
      : allMode
        ? []
        : folders.filter((f) => f.parent_id === currentId);
    return [...base].sort((a, b) => {
      if (sort === "date") return b.created_at.localeCompare(a.created_at);
      return a.name.localeCompare(b.name);
    });
  }, [folders, currentId, allMode, query, searching, sort]);

  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = searching
      ? files.filter((f) => f.name.toLowerCase().includes(q))
      : allMode
        ? files // every file, regardless of folder
        : files.filter((f) => f.folder_id === currentId);
    return [...base].sort((a, b) => {
      if (sort === "date") return b.created_at.localeCompare(a.created_at);
      if (sort === "size") return b.size - a.size;
      return a.name.localeCompare(b.name);
    });
  }, [files, currentId, allMode, query, searching, sort]);

  const totalSize = useMemo(() => files.reduce((s, f) => s + (f.size || 0), 0), [files]);
  const isEmpty = visibleFolders.length === 0 && visibleFiles.length === 0;

  // ---- Uploads -----------------------------------------------------------
  const uploadFiles = useCallback(
    async (list: File[]) => {
      if (list.length === 0) return;
      setUploading((n) => n + list.length);
      try {
        const created = await mediaApi.uploadFiles(list, currentId);
        setFiles((prev) => [...created, ...prev]);
        toast.success(
          "Upload complete",
          `${created.length} file${created.length === 1 ? "" : "s"} added`,
        );
      } catch (e) {
        toast.error("Upload failed", e instanceof Error ? e.message : undefined);
      } finally {
        setUploading((n) => Math.max(0, n - list.length));
      }
    },
    [currentId, toast],
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    uploadFiles(list);
    e.target.value = "";
  }

  // ---- Desktop drag-and-drop (whole canvas) ------------------------------
  function isFileDrag(e: DragEvent) {
    return Array.from(e.dataTransfer.types || []).includes("Files");
  }
  function onCanvasDragEnter(e: DragEvent) {
    if (!isFileDrag(e)) return;
    dragDepth.current += 1;
    setDropActive(true);
  }
  function onCanvasDragOver(e: DragEvent) {
    if (isFileDrag(e)) e.preventDefault();
  }
  function onCanvasDragLeave(e: DragEvent) {
    if (!isFileDrag(e)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDropActive(false);
    }
  }
  function onCanvasDrop(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    uploadFiles(Array.from(e.dataTransfer.files || []));
  }

  // ---- Internal drag-to-move ---------------------------------------------
  async function moveInto(target: number | null) {
    if (!dragId) return;
    const payload = dragId;
    setDragId(null);
    setDropTarget(null);
    if (payload.kind === "folder" && payload.id === target) return;
    try {
      if (payload.kind === "file") {
        await mediaApi.moveFile(payload.id, target);
        setFiles((prev) =>
          prev.map((f) => (f.id === payload.id ? { ...f, folder_id: target } : f)),
        );
      } else {
        await mediaApi.moveFolder(payload.id, target);
        setFolders((prev) =>
          prev.map((f) => (f.id === payload.id ? { ...f, parent_id: target } : f)),
        );
      }
      toast.success("Moved", "Item moved successfully");
    } catch (e) {
      toast.error("Move failed", e instanceof Error ? e.message : undefined);
    }
  }

  // ---- CRUD --------------------------------------------------------------
  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const folder = await mediaApi.createFolder(name, currentId);
      setFolders((prev) => [...prev, folder]);
      setNewFolderOpen(false);
      setNewFolderName("");
      toast.success("Folder created", name);
    } catch (e) {
      toast.error("Could not create folder", e instanceof Error ? e.message : undefined);
    }
  }

  async function submitRename() {
    if (!rename) return;
    const name = rename.name.trim();
    if (!name) return;
    try {
      if (rename.kind === "folder") {
        const updated = await mediaApi.renameFolder(rename.id, name);
        setFolders((prev) => prev.map((f) => (f.id === rename.id ? updated : f)));
      } else {
        const updated = await mediaApi.renameFile(rename.id, name);
        setFiles((prev) => prev.map((f) => (f.id === rename.id ? updated : f)));
      }
      setRename(null);
      toast.success("Renamed", name);
    } catch (e) {
      toast.error("Rename failed", e instanceof Error ? e.message : undefined);
    }
  }

  async function removeFolder(f: MediaFolder) {
    if (!confirm(`Delete folder "${f.name}" and everything inside it?`)) return;
    try {
      await mediaApi.deleteFolder(f.id);
      await load();
      toast.success("Folder deleted", f.name);
    } catch (e) {
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    }
  }

  async function removeFile(f: MediaFile) {
    if (!confirm(`Delete "${f.name}"?`)) return;
    try {
      await mediaApi.deleteFile(f.id);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      toast.success("File deleted", f.name);
    } catch (e) {
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    }
  }

  // ---- folder tree navigation ----
  const childrenOf = (pid: number | null) =>
    folders.filter((f) => f.parent_id === pid).sort((a, b) => a.name.localeCompare(b.name));
  function selectFolder(id: number) {
    setAllMode(false);
    setQuery("");
    setCurrentId(id);
    setExpanded((s) => new Set(s).add(id));
  }
  function selectHome() {
    setAllMode(false);
    setQuery("");
    setCurrentId(null);
  }
  function selectAll() {
    setAllMode(true);
    setQuery("");
  }
  function toggleExpand(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function renderTree(pid: number | null, depth: number): ReactNode {
    return childrenOf(pid).map((f) => {
      const kids = childrenOf(f.id);
      const isOpen = expanded.has(f.id);
      const count = files.filter((x) => x.folder_id === f.id).length;
      const active = !allMode && !searching && currentId === f.id;
      return (
        <div key={f.id}>
          <div
            onClick={() => selectFolder(f.id)}
            onDragOver={(e) => {
              if (dragId && !(dragId.kind === "folder" && dragId.id === f.id)) {
                e.preventDefault();
                setDropTarget(f.id);
              }
            }}
            onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
            onDrop={(e) => {
              e.preventDefault();
              moveInto(f.id);
            }}
            style={{ paddingLeft: depth * 14 + 4 }}
            className={`group flex cursor-pointer items-center gap-1 rounded-lg py-1.5 pr-2 text-sm transition ${
              active
                ? "bg-blue-50 font-medium text-blue-700"
                : dropTarget === f.id
                  ? "bg-blue-50 ring-1 ring-blue-300"
                  : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(f.id); }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200"
              aria-label={isOpen ? "Collapse" : "Expand"}
            >
              {kids.length > 0 ? (
                <Icon name="chevronDown" className={`h-3.5 w-3.5 transition ${isOpen ? "" : "-rotate-90"}`} />
              ) : (
                <span className="h-3.5 w-3.5" />
              )}
            </button>
            <Icon name="folder" filled className={`h-4 w-4 shrink-0 ${active ? "text-blue-500" : "text-amber-500"}`} />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            {count > 0 && <span className="shrink-0 text-[10px] text-slate-400">{count}</span>}
          </div>
          {isOpen && kids.length > 0 && renderTree(f.id, depth + 1)}
        </div>
      );
    });
  }

  // ------------------------------------------------------------------------
  return (
    <div
      className="relative space-y-6"
      onDragEnter={onCanvasDragEnter}
      onDragOver={onCanvasDragOver}
      onDragLeave={onCanvasDragLeave}
      onDrop={onCanvasDrop}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Media</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload, organize and share files. Drag files anywhere to upload.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewFolderOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Icon name="folderPlus" className="h-4 w-4" />
            New Folder
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Icon name="upload" className="h-4 w-4" />
            Upload
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPick} />
        </div>
      </div>

      {/* Two-pane: folder tree + content */}
      <div className="flex gap-4">
        {/* Folder tree sidebar (Drive-style) */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <button
              onClick={selectAll}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition ${allMode ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <Icon name="list" className="h-4 w-4 shrink-0" /> All files
              <span className="ml-auto text-[11px] text-slate-400">{files.length}</span>
            </button>
            <button
              onClick={selectHome}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setDropTarget("root"); } }}
              onDragLeave={() => setDropTarget((t) => (t === "root" ? null : t))}
              onDrop={(e) => { e.preventDefault(); moveInto(null); }}
              className={`mt-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                !allMode && !searching && currentId === null ? "bg-blue-50 text-blue-700" : dropTarget === "root" ? "bg-blue-50 ring-1 ring-blue-300" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon name="folder" filled className="h-4 w-4 shrink-0 text-amber-500" /> My Drive
            </button>
            <div className="no-scrollbar mt-1 max-h-[55vh] overflow-y-auto border-t border-slate-100 pt-1">
              {folders.length === 0 ? (
                <p className="px-2.5 py-4 text-center text-xs text-slate-400">No folders yet</p>
              ) : (
                renderTree(null, 0)
              )}
            </div>
          </div>
        </aside>

        {/* Content column */}
        <div className="min-w-0 flex-1 space-y-4">

      {/* Toolbar: breadcrumb + search + sort + view */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <nav className="flex min-w-0 items-center gap-1 text-base font-semibold">
          {allMode && !searching ? (
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-slate-900"><Icon name="list" className="h-4 w-4" /> All files</span>
          ) : (
          <>
          <Crumb
            label="Home"
            icon="folder"
            active={currentId === null && !searching}
            onClick={selectHome}
            isDrop={dropTarget === "root"}
            onDropHere={() => moveInto(null)}
            onDragOver={(e) => {
              if (dragId) {
                e.preventDefault();
                setDropTarget("root");
              }
            }}
            onDragLeave={() => setDropTarget((t) => (t === "root" ? null : t))}
          />
          {breadcrumb.map((f) => (
            <span key={f.id} className="flex min-w-0 items-center gap-1">
              <span className="text-slate-300">/</span>
              <Crumb
                label={f.name}
                active={currentId === f.id}
                onClick={() => {
                  setQuery("");
                  setCurrentId(f.id);
                }}
                isDrop={dropTarget === f.id}
                onDropHere={() => moveInto(f.id)}
                onDragOver={(e) => {
                  if (dragId) {
                    e.preventDefault();
                    setDropTarget(f.id);
                  }
                }}
                onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
              />
            </span>
          ))}
          </>
          )}
          {searching && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              Search results
            </span>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {uploading > 0 && (
            <span className="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:flex">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
              Uploading {uploading}…
            </span>
          )}
          <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 lg:flex" title={`${files.length} files`}>
            <Icon name="asset" className="h-3.5 w-3.5" /> {formatBytes(totalSize)} used
          </span>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in Drive…"
              className="w-44 rounded-lg border border-slate-300 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="name">Name</option>
            <option value="date">Newest</option>
            <option value="size">Largest</option>
          </select>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {(["grid", "list"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={`${v} view`}
                className={`p-2 transition ${
                  view === v ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon name={v} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : isEmpty ? (
        <EmptyState
          searching={searching}
          onUpload={() => fileInputRef.current?.click()}
          onNewFolder={() => setNewFolderOpen(true)}
        />
      ) : view === "grid" ? (
        <div className="space-y-6">
          {visibleFolders.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Folders{searching ? "" : ` · ${visibleFolders.length}`}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleFolders.map((f) => (
                  <FolderCard
                    key={`fo-${f.id}`}
                    folder={f}
                    count={
                      files.filter((x) => x.folder_id === f.id).length +
                      folders.filter((x) => x.parent_id === f.id).length
                    }
                    isDropTarget={dropTarget === f.id}
                    onOpen={() => setCurrentId(f.id)}
                    onRename={() => setRename({ id: f.id, kind: "folder", name: f.name })}
                    onDelete={() => removeFolder(f)}
                    onDragStart={() => setDragId({ id: f.id, kind: "folder" })}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(e) => {
                      if (dragId && !(dragId.kind === "folder" && dragId.id === f.id)) {
                        e.preventDefault();
                        setDropTarget(f.id);
                      }
                    }}
                    onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
                    onDrop={() => moveInto(f.id)}
                  />
                ))}
              </div>
            </section>
          )}
          {visibleFiles.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Files{searching ? "" : ` · ${visibleFiles.length}`}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visibleFiles.map((f) => (
                  <FileCard
                    key={`fi-${f.id}`}
                    file={f}
                    onOpen={() => setPreview(f)}
                    onRename={() => setRename({ id: f.id, kind: "file", name: f.name })}
                    onDelete={() => removeFile(f)}
                    onDragStart={() => setDragId({ id: f.id, kind: "file" })}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <ListView
          folders={visibleFolders}
          files={visibleFiles}
          dropTarget={dropTarget}
          onOpenFolder={(id) => setCurrentId(id)}
          onOpenFile={(f) => setPreview(f)}
          onRenameFolder={(f) => setRename({ id: f.id, kind: "folder", name: f.name })}
          onRenameFile={(f) => setRename({ id: f.id, kind: "file", name: f.name })}
          onDeleteFolder={removeFolder}
          onDeleteFile={removeFile}
          onDragStart={setDragId}
          onDragEndClear={() => {
            setDragId(null);
            setDropTarget(null);
          }}
          onFolderDragOver={(id, e) => {
            if (dragId && !(dragId.kind === "folder" && dragId.id === id)) {
              e.preventDefault();
              setDropTarget(id);
            }
          }}
          onFolderDragLeave={(id) => setDropTarget((t) => (t === id ? null : t))}
          onDropInFolder={moveInto}
        />
      )}
        </div>
      </div>

      {/* Desktop drop overlay */}
      {dropActive && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-blue-600/10 p-8 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-blue-400 bg-white/90 px-16 py-12 shadow-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Icon name="upload" className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold text-slate-900">Drop to upload</p>
            <p className="text-sm text-slate-500">
              Files will be added to {currentId ? `“${breadcrumb.at(-1)?.name}”` : "Home"}
            </p>
          </div>
        </div>
      )}

      {/* New folder modal */}
      {newFolderOpen && (
        <Modal title="New folder" onClose={() => setNewFolderOpen(false)}>
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
            placeholder="Folder name"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <ModalActions
            onCancel={() => setNewFolderOpen(false)}
            onConfirm={createFolder}
            confirmLabel="Create"
            disabled={!newFolderName.trim()}
          />
        </Modal>
      )}

      {/* Rename modal */}
      {rename && (
        <Modal title={`Rename ${rename.kind}`} onClose={() => setRename(null)}>
          <input
            autoFocus
            value={rename.name}
            onChange={(e) => setRename({ ...rename, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <ModalActions
            onCancel={() => setRename(null)}
            onConfirm={submitRename}
            confirmLabel="Save"
            disabled={!rename.name.trim()}
          />
        </Modal>
      )}

      {/* Preview lightbox */}
      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} onDelete={removeFile} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Sub-components                                                          */
/* ---------------------------------------------------------------------- */

function Crumb({
  label,
  icon,
  active,
  onClick,
  isDrop,
  onDropHere,
  onDragOver,
  onDragLeave,
}: {
  label: string;
  icon?: IconName;
  active: boolean;
  onClick: () => void;
  isDrop: boolean;
  onDropHere: () => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDropHere();
      }}
      className={`flex max-w-[12rem] items-center gap-1.5 truncate rounded-md px-2 py-1 font-medium transition ${
        isDrop
          ? "bg-blue-100 text-blue-700 ring-2 ring-blue-400"
          : active
            ? "text-slate-900"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      {icon && <Icon name={icon} className="h-4 w-4" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function CardMenu({ onRename, onDelete, onDownload }: { onRename: () => void; onDelete: () => void; onDownload?: () => void }) {
  return (
    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
      {onDownload && (
        <IconBtn label="Download" onClick={onDownload} icon="download" hover="hover:bg-blue-50 hover:text-blue-600" />
      )}
      <IconBtn label="Rename" onClick={onRename} icon="edit" hover="hover:bg-slate-100 hover:text-slate-700" />
      <IconBtn label="Delete" onClick={onDelete} icon="trash" hover="hover:bg-rose-50 hover:text-rose-600" />
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  icon,
  hover,
}: {
  label: string;
  onClick: () => void;
  icon: IconName;
  hover: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-md bg-white/80 p-1.5 text-slate-400 shadow-sm backdrop-blur transition ${hover}`}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function FolderCard({
  folder,
  count,
  isDropTarget,
  onOpen,
  onRename,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  folder: MediaFolder;
  count: number;
  isDropTarget: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDoubleClick={onOpen}
      className={`group relative flex cursor-pointer items-center gap-3 rounded-xl border bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100 ${
        isDropTarget ? "border-blue-400 bg-blue-50 ring-2 ring-blue-400" : "border-transparent"
      }`}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Icon name="folder" className="h-5 w-5 shrink-0 text-slate-500" filled />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">{folder.name}</span>
          <span className="block text-[11px] text-slate-400">{count} item{count === 1 ? "" : "s"}</span>
        </span>
      </button>
      <CardMenu onRename={onRename} onDelete={onDelete} />
    </div>
  );
}

function Thumb({ file, className }: { file: MediaFile; className?: string }) {
  const kind = kindOf(file.mime, file.name);
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.url} alt={file.name} className={className} loading="lazy" />;
  }
  if (kind === "video") {
    return <video src={file.url} className={className} muted preload="metadata" />;
  }
  const meta = KIND_META[kind];
  return (
    <div className={`flex items-center justify-center ${className ?? ""}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${meta.wrap}`}>
        <Icon name={meta.icon} className="h-6 w-6" />
      </div>
    </div>
  );
}

function FileCard({
  file,
  onOpen,
  onRename,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  file: MediaFile;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const kind = kindOf(file.mime, file.name);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md"
    >
      <CardMenu
        onRename={onRename}
        onDelete={onDelete}
        onDownload={() => downloadFile(file)}
      />
      {/* Header: type icon + name (Drive style) */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${KIND_META[kind].wrap}`}>
          <Icon name={KIND_META[kind].icon} className="h-3.5 w-3.5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800" title={file.name}>{file.name}</p>
      </div>
      {/* Preview */}
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden border-t border-slate-100 bg-slate-50">
        <Thumb file={file} className="h-full w-full object-cover" />
      </div>
    </div>
  );
}

function ListView({
  folders,
  files,
  dropTarget,
  onOpenFolder,
  onOpenFile,
  onRenameFolder,
  onRenameFile,
  onDeleteFolder,
  onDeleteFile,
  onDragStart,
  onDragEndClear,
  onFolderDragOver,
  onFolderDragLeave,
  onDropInFolder,
}: {
  folders: MediaFolder[];
  files: MediaFile[];
  dropTarget: number | null | "root";
  onOpenFolder: (id: number) => void;
  onOpenFile: (f: MediaFile) => void;
  onRenameFolder: (f: MediaFolder) => void;
  onRenameFile: (f: MediaFile) => void;
  onDeleteFolder: (f: MediaFolder) => void;
  onDeleteFile: (f: MediaFile) => void;
  onDragStart: (p: DragPayload) => void;
  onDragEndClear: () => void;
  onFolderDragOver: (id: number, e: DragEvent) => void;
  onFolderDragLeave: (id: number) => void;
  onDropInFolder: (id: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Size</th>
            <th className="px-5 py-3">Added</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {folders.map((f) => (
            <tr
              key={`fo-${f.id}`}
              draggable
              onDragStart={() => onDragStart({ id: f.id, kind: "folder" })}
              onDragEnd={onDragEndClear}
              onDragOver={(e) => onFolderDragOver(f.id, e)}
              onDragLeave={() => onFolderDragLeave(f.id)}
              onDrop={(e) => {
                e.preventDefault();
                onDropInFolder(f.id);
              }}
              onDoubleClick={() => onOpenFolder(f.id)}
              className={`cursor-pointer border-b border-slate-100 transition last:border-0 ${
                dropTarget === f.id ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : "hover:bg-slate-50"
              }`}
            >
              <td className="px-5 py-3">
                <button onClick={() => onOpenFolder(f.id)} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <Icon name="folder" className="h-4 w-4" filled />
                  </span>
                  <span className="font-medium text-slate-900">{f.name}</span>
                </button>
              </td>
              <td className="px-5 py-3 text-slate-500">Folder</td>
              <td className="px-5 py-3 text-slate-400">—</td>
              <td className="px-5 py-3 text-slate-500">{formatDate(f.created_at)}</td>
              <td className="px-5 py-3">
                <RowActions
                  onRename={() => onRenameFolder(f)}
                  onDelete={() => onDeleteFolder(f)}
                />
              </td>
            </tr>
          ))}
          {files.map((f) => {
            const kind = kindOf(f.mime, f.name);
            return (
              <tr
                key={`fi-${f.id}`}
                draggable
                onDragStart={() => onDragStart({ id: f.id, kind: "file" })}
                onDragEnd={onDragEndClear}
                onClick={() => onOpenFile(f)}
                className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${KIND_META[kind].wrap}`}>
                      <Icon name={KIND_META[kind].icon} className="h-4 w-4" />
                    </span>
                    <span className="font-medium text-slate-900">{f.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 capitalize text-slate-500">{kind}</td>
                <td className="px-5 py-3 text-slate-500">{formatBytes(f.size)}</td>
                <td className="px-5 py-3 text-slate-500">{formatDate(f.created_at)}</td>
                <td className="px-5 py-3">
                  <RowActions
                    onDownload={() => downloadFile(f)}
                    onRename={() => onRenameFile(f)}
                    onDelete={() => onDeleteFile(f)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({
  onRename,
  onDelete,
  onDownload,
}: {
  onRename: () => void;
  onDelete: () => void;
  onDownload?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onDownload && (
        <IconBtn label="Download" onClick={onDownload} icon="download" hover="hover:bg-blue-50 hover:text-blue-600" />
      )}
      <IconBtn label="Rename" onClick={onRename} icon="edit" hover="hover:bg-slate-100 hover:text-slate-700" />
      <IconBtn label="Delete" onClick={onDelete} icon="trash" hover="hover:bg-rose-50 hover:text-rose-600" />
    </div>
  );
}

function PreviewModal({
  file,
  onClose,
  onDelete,
}: {
  file: MediaFile;
  onClose: () => void;
  onDelete: (f: MediaFile) => void;
}) {
  const kind = kindOf(file.mime, file.name);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-900/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${KIND_META[kind].wrap}`}>
            <Icon name={KIND_META[kind].icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{file.name}</p>
            <p className="text-xs text-white/60">
              {formatBytes(file.size)} · {formatDate(file.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadFile(file)}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <Icon name="download" className="h-4 w-4" /> Download
          </button>
          <button
            onClick={() => {
              onDelete(file);
              onClose();
            }}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-6" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.url} alt={file.name} className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl" />
          ) : kind === "video" ? (
            <video src={file.url} controls autoPlay className="max-h-[80vh] max-w-full rounded-lg shadow-2xl" />
          ) : kind === "audio" ? (
            <div className="rounded-2xl bg-white p-8 shadow-2xl">
              <audio src={file.url} controls autoPlay className="w-80" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-12 shadow-2xl">
              <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${KIND_META[kind].wrap}`}>
                <Icon name={KIND_META[kind].icon} className="h-10 w-10" />
              </div>
              <p className="text-sm text-slate-500">No inline preview for this file type.</p>
              <button
                onClick={() => downloadFile(file)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Download to view
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
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

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        onClick={onCancel}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function EmptyState({
  searching,
  onUpload,
  onNewFolder,
}: {
  searching: boolean;
  onUpload: () => void;
  onNewFolder: () => void;
}) {
  if (searching) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <Icon name="search" className="h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">No matching media</p>
        <p className="text-sm text-slate-400">Try a different search term.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <Icon name="upload" className="h-8 w-8" />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">This folder is empty</p>
      <p className="mt-1 text-sm text-slate-500">Drag &amp; drop files here, or use the buttons below.</p>
      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={onNewFolder}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Icon name="folderPlus" className="h-4 w-4" /> New Folder
        </button>
        <button
          onClick={onUpload}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Icon name="upload" className="h-4 w-4" /> Upload Files
        </button>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 py-16 text-center">
      <p className="text-sm font-semibold text-rose-700">Couldn’t load media</p>
      <p className="mt-1 max-w-md text-xs text-rose-500">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
      >
        Retry
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-24 rounded-xl bg-slate-100" />
          <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function downloadFile(file: MediaFile) {
  const a = document.createElement("a");
  a.href = file.url;
  a.download = file.name;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Documentation media — the screenshots, walkthrough videos and demo notes the
// platform owner attaches to each module of the manual.
//
// The manual text itself is code (see docsManual.ts). Only the media is data,
// and it lives in the platform `settings` table under `platform.docs` so it is
// authored once in the Super Admin console and shown to every client workspace
// inside their Knowledge Base. Reads are public (no token needed — clients are
// already behind their own login); writes require the super-admin JWT.

import { useEffect, useState } from "react";

import { getSuperAdminToken } from "@/lib/superAdmin";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export const DOCS_MEDIA_EVENT = "docs-media:changed";

export type DocAssetKind = "screenshot" | "video";

export type DocAsset = {
  id: string;
  /** ManualModule key this asset illustrates. */
  module: string;
  kind: DocAssetKind;
  title: string;
  caption: string;
  /** 0 = general/hero shot; 1..n pins the asset to that numbered step. */
  step: number;
  /** External link (YouTube / Vimeo / Loom / Drive / direct file). Empty when uploaded. */
  url: string;
  /** Uploaded file name, streamed back through /platform/docs/file/{file}. */
  file: string;
  mime: string;
  order: number;
  updatedAt: string;
};

/** Free-text note the owner can add per module (release notes, gotchas, script). */
export type DocsNotes = Record<string, string>;

export type DocsMedia = { assets: DocAsset[]; notes: DocsNotes; updatedAt: string };

export const EMPTY_DOCS_MEDIA: DocsMedia = { assets: [], notes: {}, updatedAt: "" };

// ---- normalisation ------------------------------------------------------

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function normalizeAsset(raw: unknown, index: number): DocAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const url = str(a.url);
  const file = str(a.file);
  if (!url && !file) return null;
  const kind: DocAssetKind = a.kind === "video" ? "video" : "screenshot";
  return {
    id: str(a.id) || `doc-${index}-${Math.random().toString(36).slice(2, 8)}`,
    module: str(a.module),
    kind,
    title: str(a.title),
    caption: str(a.caption),
    step: Number.isFinite(Number(a.step)) ? Math.max(0, Math.trunc(Number(a.step))) : 0,
    url,
    file,
    mime: str(a.mime),
    order: Number.isFinite(Number(a.order)) ? Number(a.order) : index,
    updatedAt: str(a.updatedAt),
  };
}

function normalize(json: unknown): DocsMedia {
  const j = (json ?? {}) as Record<string, unknown>;
  const assets = (Array.isArray(j.assets) ? j.assets : [])
    .map(normalizeAsset)
    .filter((a): a is DocAsset => a !== null)
    .sort((a, b) => a.order - b.order);
  const notesIn = (j.notes && typeof j.notes === "object" ? j.notes : {}) as Record<string, unknown>;
  const notes: DocsNotes = {};
  for (const [k, v] of Object.entries(notesIn)) if (typeof v === "string" && v.trim()) notes[k] = v;
  return { assets, notes, updatedAt: str(j.updatedAt) };
}

// ---- transport ----------------------------------------------------------

/** Read the published documentation media (public — used by clients too). */
export async function fetchDocsMedia(): Promise<DocsMedia> {
  try {
    const res = await fetch(`${API_BASE}/platform/docs`, { cache: "no-store" });
    if (!res.ok) return EMPTY_DOCS_MEDIA;
    return normalize(await res.json());
  } catch {
    return EMPTY_DOCS_MEDIA; // backend offline — the manual still reads fine without media
  }
}

/** Publish the media set. Super-admin only; throws with the server's message. */
export async function saveDocsMedia(media: Pick<DocsMedia, "assets" | "notes">): Promise<void> {
  const token = getSuperAdminToken();
  if (!token) throw new Error("Sign in to the super-admin console first.");
  const res = await fetch(`${API_BASE}/platform/docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ assets: media.assets, notes: media.notes }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg.slice(0, 200) || `Save failed (${res.status}).`);
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DOCS_MEDIA_EVENT));
}

export type UploadedDoc = { file: string; name: string; mime: string; size: number };

/** Upload a screenshot / recording. Returns the stored file reference. */
export async function uploadDocsFile(file: File): Promise<UploadedDoc> {
  const token = getSuperAdminToken();
  if (!token) throw new Error("Sign in to the super-admin console first.");
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_BASE}/platform/docs/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      (json && (json.messages?.file || json.message)) ||
      `Upload failed (${res.status}). Large videos may exceed the server's upload limit.`;
    throw new Error(String(detail));
  }
  return json as UploadedDoc;
}

// ---- rendering helpers --------------------------------------------------

/** Absolute source for an asset — an uploaded file streams through the API. */
export function assetSrc(a: Pick<DocAsset, "url" | "file">): string {
  if (a.file) return `${API_BASE}/platform/docs/file/${encodeURIComponent(a.file)}`;
  return a.url;
}

/**
 * Turn a share link into something an <iframe> can play. YouTube, Vimeo, Loom
 * and Google Drive all need a different embed path; anything else (a direct
 * .mp4/.webm, or an uploaded file) is returned as null so the caller uses a
 * plain <video> element instead.
 */
export function embedUrl(src: string): string | null {
  const s = src.trim();
  if (!s) return null;

  const yt = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;

  const vimeo = s.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  const loom = s.match(/loom\.com\/(?:share|embed)\/([\w-]+)/i);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;

  const drive = s.match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;

  return null;
}

/** True when the source should render in a native <video> player. */
export function isPlayableFile(src: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src) || src.includes("/platform/docs/file/");
}

// ---- hook ---------------------------------------------------------------

/**
 * Live documentation media for any page (client or console). Re-reads when this
 * tab publishes a change, and once on mount. `reload` lets the console refresh
 * after a save without a full page reload.
 */
export function useDocsMedia(): { media: DocsMedia; loading: boolean; reload: () => void } {
  const [media, setMedia] = useState<DocsMedia>(EMPTY_DOCS_MEDIA);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // A reload keeps the current media on screen until the new set arrives, so
  // there's no flash of empty state between polls.
  useEffect(() => {
    let alive = true;
    fetchDocsMedia().then((m) => {
      if (!alive) return;
      setMedia(m);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [nonce]);

  useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    window.addEventListener(DOCS_MEDIA_EVENT, bump);
    return () => window.removeEventListener(DOCS_MEDIA_EVENT, bump);
  }, []);

  return { media, loading, reload: () => setNonce((n) => n + 1) };
}

/** Assets for one module, ordered, optionally filtered to a step. */
export function assetsFor(media: DocsMedia, moduleKey: string, step?: number): DocAsset[] {
  return media.assets
    .filter((a) => a.module === moduleKey && (step === undefined || a.step === step))
    .sort((a, b) => a.order - b.order);
}

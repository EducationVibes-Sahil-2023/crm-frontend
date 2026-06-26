// Media library API client — talks to the CodeIgniter backend
// (folders are a nested tree, files are uploaded to public/uploads/media).

import { getToken } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type MediaFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
};

export type MediaFile = {
  id: number;
  name: string;
  folder_id: number | null;
  mime: string;
  size: number;
  path: string;
  url: string;
  created_at: string;
  updated_at: string;
};

export type MediaKind = "image" | "video" | "audio" | "pdf" | "doc" | "file";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function json<T>(path: string, method: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const mediaApi = {
  listFolders: () => request<MediaFolder[]>("/media/folders"),
  listFiles: () => request<MediaFile[]>("/media/files"),

  createFolder: (name: string, parentId: number | null) =>
    json<MediaFolder>("/media/folders", "POST", { name, parent_id: parentId }),

  renameFolder: (id: number, name: string) =>
    json<MediaFolder>(`/media/folders/${id}`, "PUT", { name }),

  moveFolder: (id: number, parentId: number | null) =>
    json<MediaFolder>(`/media/folders/${id}`, "PUT", { parent_id: parentId }),

  deleteFolder: (id: number) =>
    request<unknown>(`/media/folders/${id}`, { method: "DELETE" }),

  uploadFiles: (files: File[], folderId: number | null) => {
    const form = new FormData();
    files.forEach((f) => form.append("file[]", f));
    if (folderId != null) form.append("folder_id", String(folderId));
    return request<MediaFile[]>("/media/files", { method: "POST", body: form });
  },

  renameFile: (id: number, name: string) =>
    json<MediaFile>(`/media/files/${id}`, "PUT", { name }),

  moveFile: (id: number, folderId: number | null) =>
    json<MediaFile>(`/media/files/${id}`, "PUT", { folder_id: folderId }),

  deleteFile: (id: number) =>
    request<unknown>(`/media/files/${id}`, { method: "DELETE" }),
};

export function kindOf(mime: string, name = ""): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (/\.(docx?|pptx?|xlsx?|txt|csv|md|rtf)$/i.test(name)) return "doc";
  return "file";
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso.replace(" ", "T")).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

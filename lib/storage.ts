import { del, list, head } from "@vercel/blob";
import { randomBytes } from "crypto";

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wma: "audio/x-ms-wma",
  aac: "audio/aac",
  aiff: "audio/aiff",
  opus: "audio/opus",
  weba: "audio/webm",
  mid: "audio/midi",
  midi: "audio/midi",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export function detectMimeType(fileName: string, fallback?: string): string {
  if (fallback && fallback !== "application/octet-stream") return fallback;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? fallback ?? "application/octet-stream";
}

// Per-type file size limits
const AUDIO_EXTENSIONS = ["m4a", "mp3", "wav", "flac", "aac", "ogg", "wma"];
const ARCHIVE_EXTENSIONS = ["zip", "rar", "7z", "tar", "gz"];
const VIDEO_EXTENSIONS = ["mov", "mp4", "avi", "mkv", "webm"];

export const SIZE_LIMITS = {
  audio: 120 * 1024 * 1024,       // 120 MB
  archive: 2 * 1024 * 1024 * 1024, // 2 GB
  video: 500 * 1024 * 1024,        // 500 MB
  other: 100 * 1024 * 1024,        // 100 MB
} as const;

export function getMaxFileSize(fileName: string): { limit: number; category: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_EXTENSIONS.includes(ext)) return { limit: SIZE_LIMITS.audio, category: "audio" };
  if (ARCHIVE_EXTENSIONS.includes(ext)) return { limit: SIZE_LIMITS.archive, category: "archive" };
  if (VIDEO_EXTENSIONS.includes(ext)) return { limit: SIZE_LIMITS.video, category: "video" };
  return { limit: SIZE_LIMITS.other, category: "other" };
}

export function getStorageKey(
  projectId: string,
  folderPath: string,
  filename: string,
): string {
  const uniqueName = `${randomBytes(8).toString("hex")}_${filename}`;
  return `${projectId}/${folderPath}/${uniqueName}`.replace(/\/+/g, "/");
}

export async function deleteFile(storageKey: string): Promise<void> {
  try {
    const blob = await head(storageKey);
    await del(blob.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("not found")) return;
    throw err;
  }
}

export async function deleteFolderContents(
  projectId: string,
  folderPath: string,
): Promise<void> {
  let cursor: string | undefined;
  do {
    const result = await list({ prefix: `${projectId}/${folderPath}/`, cursor });
    if (result.blobs.length > 0) {
      await del(result.blobs.map((b) => b.url));
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
}

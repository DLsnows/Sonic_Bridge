import { put, del, list, head } from "@vercel/blob";
import { randomBytes } from "crypto";

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

export async function saveFile(
  projectId: string,
  folderPath: string,
  file: File,
): Promise<{ storageKey: string }> {
  const storageKey = getStorageKey(projectId, folderPath, file.name);
  await put(storageKey, file, { access: "private", addRandomSuffix: false });
  return { storageKey };
}

export async function getFileUrl(storageKey: string): Promise<string> {
  const blob = await head(storageKey);
  return blob.downloadUrl;
}

export interface FileBodyResult {
  body: ReadableStream<Uint8Array> | null;
  contentType: string;
  size: number;
  contentLength: number;
  isRange: boolean;
  rangeStart: number;
  rangeEnd: number;
}

export async function getFileBody(
  storageKey: string,
  options?: { range?: string },
): Promise<FileBodyResult> {
  const blob = await head(storageKey);
  const headers: Record<string, string> = {};
  if (options?.range) headers.Range = options.range;

  const response = await fetch(blob.downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch blob content: HTTP ${response.status}`);
  }

  if (response.status === 206) {
    const contentRange = response.headers.get("content-range");
    if (!contentRange) {
      throw new Error("Received 206 but missing Content-Range header");
    }
    const match = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+)/);
    if (!match) {
      throw new Error(`Unparseable Content-Range header: ${contentRange}`);
    }
    return {
      body: response.body,
      contentType: blob.contentType || "application/octet-stream",
      size: Number(match[3]),
      contentLength: Number(response.headers.get("content-length") || "0"),
      isRange: true,
      rangeStart: Number(match[1]),
      rangeEnd: Number(match[2]),
    };
  }

  if (!response.body) {
    throw new Error("Blob fetch returned empty body");
  }

  return {
    body: response.body,
    contentType: blob.contentType || "application/octet-stream",
    size: blob.size,
    contentLength: blob.size,
    isRange: false,
    rangeStart: 0,
    rangeEnd: blob.size - 1,
  };
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

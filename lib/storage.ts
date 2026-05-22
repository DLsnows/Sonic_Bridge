import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost as s3CreatePresignedPost } from "@aws-sdk/s3-presigned-post";
import { randomBytes } from "crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "sonicbridge-files";
const rawUrl = process.env.R2_PUBLIC_URL;
const R2_PUBLIC_URL = rawUrl ? rawUrl.replace(/\/+$/, "") : undefined;

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
      throw new Error("Missing R2 environment variables.");
    }
    try { new URL(R2_PUBLIC_URL); } catch {
      throw new Error("R2_PUBLIC_URL is not a valid URL.");
    }
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }
  return _s3;
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", m4a: "audio/mp4",
  ogg: "audio/ogg", wma: "audio/x-ms-wma", aac: "audio/aac", aiff: "audio/aiff",
  opus: "audio/opus", weba: "audio/webm", mid: "audio/midi", midi: "audio/midi",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  avi: "video/x-msvideo", mkv: "video/x-matroska",
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", gif: "image/gif", webp: "image/webp",
};

export function detectMimeType(fileName: string, fallback?: string): string {
  if (fallback && fallback !== "application/octet-stream") return fallback;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? fallback ?? "application/octet-stream";
}

const AUDIO_EXTENSIONS = ["m4a", "mp3", "wav", "flac", "aac", "ogg", "wma"];
const ARCHIVE_EXTENSIONS = ["zip", "rar", "7z", "tar", "gz"];
const VIDEO_EXTENSIONS = ["mov", "mp4", "avi", "mkv", "webm"];

export const SIZE_LIMITS = {
  audio: 120 * 1024 * 1024,
  archive: 2 * 1024 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  other: 100 * 1024 * 1024,
} as const;

export function getMaxFileSize(fileName: string): { limit: number; category: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_EXTENSIONS.includes(ext)) return { limit: SIZE_LIMITS.audio, category: "audio" };
  if (ARCHIVE_EXTENSIONS.includes(ext)) return { limit: SIZE_LIMITS.archive, category: "archive" };
  if (VIDEO_EXTENSIONS.includes(ext)) return { limit: SIZE_LIMITS.video, category: "video" };
  return { limit: SIZE_LIMITS.other, category: "other" };
}

export function getStorageKey(projectId: string, folderPath: string, filename: string): string {
  const safeFilename = filename.replace(/\.\.|[/\\]/g, "_").replace(/^_+/, "");
  const uniqueName = `${randomBytes(8).toString("hex")}_${safeFilename}`;
  return `${projectId}/${folderPath}/${uniqueName}`.replace(/\/+/g, "/");
}

export async function uploadFile(projectId: string, folderPath: string, file: File): Promise<{ storageKey: string; publicUrl: string }> {
  const storageKey = getStorageKey(projectId, folderPath, file.name);
  const contentType = detectMimeType(file.name, file.type);
  const buffer = Buffer.from(await file.arrayBuffer());
  await getS3().send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey, Body: buffer, ContentType: contentType, ContentLength: buffer.length }));
  return { storageKey, publicUrl: `${R2_PUBLIC_URL}/${storageKey}` };
}

export async function createPresignedPost(
  projectId: string,
  folderPath: string,
  filename: string,
  contentType: string,
): Promise<{ url: string; fields: Record<string, string>; storageKey: string }> {
  const storageKey = getStorageKey(projectId, folderPath, filename);
  const { url, fields } = await s3CreatePresignedPost(getS3(), {
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
    Conditions: [
      ["content-length-range", 0, SIZE_LIMITS.other],
      ["eq", "$Content-Type", contentType],
    ],
    Expires: 300,
  });
  return { url, fields, storageKey };
}

export function normalizeKey(storageKey: string): string {
  if (storageKey.startsWith("http")) return storageKey;
  if (!R2_PUBLIC_URL) {
    console.error("normalizeKey: R2_PUBLIC_URL is not configured, returning raw key");
    return storageKey;
  }
  return `${R2_PUBLIC_URL}/${storageKey}`;
}

export async function deleteFile(urlOrKey: string): Promise<void> {
  let key = urlOrKey;
  if (urlOrKey.startsWith("http")) {
    try {
      key = new URL(urlOrKey).pathname.slice(1);
    } catch { /* not a valid URL */ }
  }
  try {
    await getS3().send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
  } catch (err: unknown) {
    const e = err as Record<string, unknown> | undefined;
    const code = (e?.Code as string) || (e?.name as string) || "";
    const httpCode = (e?.$metadata as Record<string, unknown> | undefined)?.httpStatusCode as number | undefined;
    if (code === "NoSuchKey" || code === "NotFound" || httpCode === 404) {
      return; // already deleted, not an error
    }
    throw err;
  }
}

export async function deleteFolderContents(projectId: string, folderPath: string): Promise<void> {
  console.warn(`Folder delete for ${projectId}/${folderPath} — individual files must be deleted separately.`);
}

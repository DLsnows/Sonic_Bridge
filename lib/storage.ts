const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "sonicbridge-files";
const rawUrl = process.env.R2_PUBLIC_URL;
const R2_PUBLIC_URL = rawUrl ? rawUrl.replace(/\/+$/, "") : undefined;

// ---------------------------------------------------------------------------
// Web Crypto helpers — no Node.js APIs, safe for EdgeOne V8 isolates
// ---------------------------------------------------------------------------

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(data: Uint8Array | string): Promise<string> {
  const enc = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: Uint8Array | CryptoKey, data: string): Promise<ArrayBuffer> {
  let cryptoKey: CryptoKey;
  if (key instanceof CryptoKey) {
    cryptoKey = key;
  } else {
    cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// AWS Signature V4 for Cloudflare R2 (S3-compatible REST API via fetch)
// ---------------------------------------------------------------------------

async function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<CryptoKey> {
  const kDate = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode("AWS4" + secretKey),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const kRegion = await crypto.subtle.importKey(
    "raw", new Uint8Array(await hmacSha256(kDate, dateStamp)),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const kService = await crypto.subtle.importKey(
    "raw", new Uint8Array(await hmacSha256(kRegion, region)),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return crypto.subtle.importKey(
    "raw", new Uint8Array(await hmacSha256(kService, "aws4_request")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
}

interface S3RequestOptions {
  body?: Uint8Array;
  contentType?: string;
  queryParams?: Record<string, string>;
}

async function s3Request(
  method: string,
  key: string,
  options?: S3RequestOptions,
): Promise<Response> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing R2 environment variables.");
  }

  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const rawQuery = options?.queryParams
    ? new URLSearchParams(options.queryParams).toString()
    : "";
  const url = `${endpoint}/${encodeKey(R2_BUCKET_NAME!)}/${encodeKey(key)}${rawQuery ? "?" + rawQuery : ""}`;

  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const emptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const payloadHash = options?.body ? await sha256(options.body) : emptyHash;

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = `${method}\n/${encodeKey(R2_BUCKET_NAME!)}/${encodeKey(key)}\n${rawQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signingKey = await getSigningKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = arrayBufferToHex(await hmacSha256(signingKey, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    "Host": host,
    "X-Amz-Content-SHA256": payloadHash,
    "X-Amz-Date": amzDate,
    "Authorization": authorization,
  };
  if (options?.contentType) headers["Content-Type"] = options.contentType;

  const response = await fetch(url, { method, headers, body: options?.body });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`S3 request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`);
  }
  return response;
}

// ---------------------------------------------------------------------------
// MIME detection & size limits (no Node.js deps — unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Storage key generation — Web Crypto randomHex, no Buffer
// ---------------------------------------------------------------------------

export function getStorageKey(projectId: string, folderPath: string, filename: string): string {
  // Sanitize filename: remove path traversal, then strip URI-unsafe characters
  const safeFilename = filename
    .replace(/\.\.|[/\\]/g, "_")
    .replace(/^_+/, "")
    .replace(/[?#&%'"<>{}|^~\`\s]/g, "_"); // remove characters unsafe in URLs
  const uniqueName = `${randomHex(8)}_${safeFilename}`;
  return `${projectId}/${folderPath}/${uniqueName}`.replace(/\/+/g, "/");
}

// Encode a storage key for use in S3 URL paths, preserving "/" separators
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

// ---------------------------------------------------------------------------
// Presigned upload URL — signed S3 PUT via fetch
// ---------------------------------------------------------------------------

export async function createPresignedUploadUrl(
  projectId: string,
  folderPath: string,
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string; storageKey: string }> {
  const storageKey = getStorageKey(projectId, folderPath, filename);

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY.");
  }
  if (!R2_PUBLIC_URL) {
    throw new Error("Missing R2_PUBLIC_URL environment variable.");
  }

  const region = "auto";
  const service = "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // Presigned URLs must use UNSIGNED-PAYLOAD because the client's body hash
  // is not known at signing time. Don't include x-amz-content-sha256 in
  // signed headers or the client's varying body hash will break the signature.
  const signedHeaders = "content-type;host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const canonicalQuery = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(`${R2_ACCESS_KEY_ID!}/${credentialScope}`)}&X-Amz-Date=${amzDate}&X-Amz-Expires=300&X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}`;
  const canonicalRequest = `PUT\n/${encodeKey(R2_BUCKET_NAME!)}/${encodeKey(storageKey)}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signingKey = await getSigningKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = arrayBufferToHex(await hmacSha256(signingKey, stringToSign));

  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const uploadUrl = `${endpoint}/${encodeKey(R2_BUCKET_NAME!)}/${encodeKey(storageKey)}`
    + `?X-Amz-Algorithm=AWS4-HMAC-SHA256`
    + `&X-Amz-Credential=${encodeURIComponent(`${R2_ACCESS_KEY_ID!}/${credentialScope}`)}`
    + `&X-Amz-Date=${amzDate}`
    + `&X-Amz-Expires=300`
    + `&X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}`
    + `&X-Amz-Signature=${signature}`;

  return { uploadUrl, publicUrl: `${R2_PUBLIC_URL}/${storageKey}`, storageKey };
}

// ---------------------------------------------------------------------------
// Direct file upload — Uint8Array body, no Buffer
// ---------------------------------------------------------------------------

export async function uploadFile(
  projectId: string,
  folderPath: string,
  file: File,
): Promise<{ storageKey: string; publicUrl: string }> {
  const storageKey = getStorageKey(projectId, folderPath, file.name);
  const contentType = detectMimeType(file.name, file.type);
  const body = new Uint8Array(await file.arrayBuffer());
  await s3Request("PUT", storageKey, { body, contentType });
  return { storageKey, publicUrl: `${R2_PUBLIC_URL}/${storageKey}` };
}

// ---------------------------------------------------------------------------
// Presigned POST — policy signed with Web Crypto HMAC
// ---------------------------------------------------------------------------

export async function createPresignedPost(
  projectId: string,
  folderPath: string,
  filename: string,
  contentType: string,
): Promise<{ url: string; fields: Record<string, string>; storageKey: string }> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing R2 environment variables.");
  }

  const storageKey = getStorageKey(projectId, folderPath, filename);
  const { limit } = getMaxFileSize(filename);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`;

  const policy = {
    expiration: new Date(now.getTime() + 300 * 1000).toISOString(),
    conditions: [
      { bucket: R2_BUCKET_NAME },
      { key: storageKey },
      ["content-length-range", 0, limit],
      ["eq", "$Content-Type", contentType],
      { "x-amz-algorithm": "AWS4-HMAC-SHA256" },
      { "x-amz-credential": credential },
      { "x-amz-date": amzDate },
    ],
  };

  const policyBase64 = btoa(JSON.stringify(policy));
  const signingKey = await getSigningKey(R2_SECRET_ACCESS_KEY, dateStamp, "auto", "s3");
  const signature = arrayBufferToHex(await hmacSha256(signingKey, policyBase64));

  return {
    url: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeKey(R2_BUCKET_NAME!)}`,
    fields: {
      key: storageKey,
      "Content-Type": contentType,
      "x-amz-algorithm": "AWS4-HMAC-SHA256",
      "x-amz-credential": credential,
      "x-amz-date": amzDate,
      policy: policyBase64,
      "x-amz-signature": signature,
    },
    storageKey,
  };
}

// ---------------------------------------------------------------------------
// Public URL normalization — unchanged
// ---------------------------------------------------------------------------

export function normalizeKey(storageKey: string): string {
  if (storageKey.startsWith("http")) return storageKey;
  if (!R2_PUBLIC_URL) {
    console.error("normalizeKey: R2_PUBLIC_URL is not configured, returning raw key");
    return storageKey;
  }
  return `${R2_PUBLIC_URL}/${storageKey}`;
}

// ---------------------------------------------------------------------------
// Delete & folder cleanup
// ---------------------------------------------------------------------------

export async function deleteFile(urlOrKey: string): Promise<void> {
  let key = urlOrKey;
  if (urlOrKey.startsWith("http")) {
    try {
      key = new URL(urlOrKey).pathname.slice(1);
    } catch { /* not a valid URL */ }
  }
  try {
    await s3Request("DELETE", key);
  } catch (err: unknown) {
    const msg = (err as Error).message ?? "";
    // S3 returns 404 Not Found for objects that don't exist — idempotent
    if (/ S3 request failed: 404\b/.test(msg)) return;
    throw err;
  }
}

export async function deleteFolderContents(projectId: string, folderPath: string): Promise<void> {
  console.warn(`Folder delete for ${projectId}/${folderPath} — individual files must be deleted separately.`);
}

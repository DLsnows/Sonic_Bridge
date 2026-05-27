import pc from "picocolors";
import { promises as fs, createReadStream, createWriteStream } from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mime from "mime-types";

import {
  apiFetch,
  ApiError,
  formatApiError,
  resolveActiveProject,
  wantsJson,
  type ApiFetchOptions,
} from "../api.js";
import { DEFAULT_BASE_URL, loadConfig } from "../config.js";
import { renderTable } from "../util/table.js";
import { Progress } from "../util/progress.js";
import { promptPassword } from "../util/prompt.js";

interface FilesListResponse {
  files: Array<{
    id: string;
    name: string;
    size: number;
    mimeType: string;
    storageKey: string;
    folderId: string | null;
    uploadedBy: string;
    uploaderName: string;
    uploadedAt: string;
  }>;
  folderId: string | null;
}

interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  storageKey: string;
}

interface CreateFileResponse {
  file: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    folderId: string | null;
    uploadedAt: string;
  };
}

interface VerifyPasswordResponse {
  // Spec'd shape — verify-password endpoint owned by sub-PR 2 (agent beta).
  // Assumed contract: { challenge: "ch_<hex>", expiresAt: <iso> }.
  challenge: string;
  expiresAt: string;
}

export interface FilesFlags {
  folder?: string;
  project?: string;
  json?: boolean;
  out?: string;
  to?: string;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const precision = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(precision)} ${units[i]}`;
}

export async function runFilesLs(flags: FilesFlags): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const qs = new URLSearchParams();
    if (flags.folder) qs.set("folderId", flags.folder);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const result = await apiFetch<FilesListResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/files${suffix}`,
    );
    if (wantsJson(flags)) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (result.files.length === 0) {
      console.log(pc.dim("(no files)"));
      return;
    }
    const rows = result.files.map((f) => ({
      id: f.id,
      name: f.name,
      size: formatBytes(f.size),
      mimeType: f.mimeType,
      uploader: f.uploaderName,
      uploadedAt: f.uploadedAt,
    }));
    console.log(
      renderTable(
        [
          { header: "id", key: "id" },
          { header: "name", key: "name" },
          { header: "size", key: "size" },
          { header: "mime", key: "mimeType" },
          { header: "uploader", key: "uploader" },
          { header: "uploadedAt", key: "uploadedAt" },
        ],
        rows,
      ),
    );
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runFilesUpload(
  localPath: string,
  flags: FilesFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const absPath = path.resolve(localPath);
    const stat = await fs.stat(absPath);
    if (!stat.isFile()) {
      console.error(pc.red(`Not a regular file: ${absPath}`));
      process.exit(1);
    }
    const fileName = path.basename(absPath);
    const mimeType =
      mime.lookup(fileName) || "application/octet-stream";

    // 1. Get a presigned upload URL.
    const qs = new URLSearchParams();
    qs.set("name", fileName);
    qs.set("size", String(stat.size));
    qs.set("type", mimeType);
    if (flags.folder) qs.set("folderId", flags.folder);
    const upload = await apiFetch<UploadUrlResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/files/upload-url?${qs.toString()}`,
    );

    // 2. PUT the file body to the presigned URL.
    const progress = new Progress({
      total: stat.size,
      label: `uploading ${fileName}`,
    });
    const fileStream = createReadStream(absPath);
    fileStream.on("data", (chunk) => {
      progress.add((chunk as Buffer).length);
    });

    // Convert Node stream to web ReadableStream — Node 20+ has Readable.toWeb.
    const webStream = Readable.toWeb(fileStream) as unknown as ReadableStream;

    const putRes = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(stat.size),
      },
      body: webStream,
      // Node's undici fetch requires duplex:'half' when streaming a body.
      // The type is not in lib.dom.d.ts; cast through unknown to satisfy TS.
      ...({ duplex: "half" } as Record<string, unknown>),
    } as RequestInit);
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      progress.finish(`upload failed: HTTP ${putRes.status}`);
      console.error(pc.red(`Storage PUT failed: ${putRes.status} ${text}`));
      process.exit(1);
    }
    progress.finish(`uploaded ${fileName} (${formatBytes(stat.size)})`);

    // 3. Register the file in the project.
    const created = await apiFetch<CreateFileResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/files`,
      {
        method: "POST",
        body: {
          storageKey: upload.storageKey,
          name: fileName,
          size: stat.size,
          mimeType,
          folderId: flags.folder ?? null,
        },
      },
    );

    if (wantsJson(flags)) {
      console.log(JSON.stringify(created, null, 2));
    } else {
      console.log(pc.green(`Created file ${created.file.id}`));
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runFilesDownload(
  fileId: string,
  flags: FilesFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const baseUrl = cfg?.baseUrl ?? DEFAULT_BASE_URL;
    const url = `${baseUrl.replace(/\/+$/, "")}/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`;
    const headers: Record<string, string> = {};
    if (cfg?.token) headers["Authorization"] = `Bearer ${cfg.token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ApiError(res.status, url, body);
    }
    if (!res.body) {
      throw new Error("Empty response body");
    }

    // Resolve output path
    let outPath = flags.out;
    let toStdout = false;
    if (outPath === "-") {
      toStdout = true;
    } else if (!outPath) {
      // Derive from content-disposition or fall back to fileId
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/i.exec(cd);
      outPath = match ? match[1]! : fileId;
    }

    const total = (() => {
      const cl = res.headers.get("content-length");
      return cl ? Number(cl) : undefined;
    })();
    const progress = new Progress({
      total,
      label: `downloading ${toStdout ? "(stdout)" : path.basename(outPath ?? fileId)}`,
    });

    const nodeStream = Readable.fromWeb(
      res.body as unknown as import("node:stream/web").ReadableStream,
    );
    nodeStream.on("data", (chunk: Buffer) => progress.add(chunk.length));

    if (toStdout) {
      await pipeline(nodeStream, process.stdout);
      progress.finish();
    } else {
      const absOut = path.resolve(outPath!);
      const writeStream = createWriteStream(absOut);
      await pipeline(nodeStream, writeStream);
      progress.finish(`downloaded to ${absOut}`);
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runFilesMv(
  fileId: string,
  flags: FilesFlags,
): Promise<void> {
  if (!flags.to) {
    console.error(pc.red("--to <folderId|root> is required"));
    process.exit(1);
  }
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const folderId = flags.to === "root" ? null : flags.to;
    // NOTE: PATCH endpoint added by sub-PR 1 (agent alpha).
    // Assumed contract per spec section A1: PATCH /api/projects/[id]/files/[fileId]
    // with body { folderId?: string|null, name?: string } returns updated row.
    const result = await apiFetch(
      `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
      {
        method: "PATCH",
        body: { folderId },
      },
    );
    if (wantsJson(flags)) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        pc.green(
          `Moved ${fileId} to ${folderId === null ? "root" : folderId}.`,
        ),
      );
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runFilesRm(
  fileId: string,
  flags: FilesFlags,
): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg?.token) {
    console.error(pc.red("Not logged in. Run `sonicbridge login`."));
    process.exit(1);
  }
  try {
    const projectId = resolveActiveProject(cfg, flags.project);

    // 1. Prompt for password (never via argv).
    const password = await promptPassword(
      "Password (required to delete files)",
    );
    if (!password) {
      console.error(pc.red("Cancelled."));
      process.exit(1);
    }

    // 2. Verify-password → challenge.
    // ASSUMED CONTRACT (sub-PR 2 / agent beta):
    //   POST /api/user/verify-password { password }
    //   200 → { challenge, expiresAt }
    //   401 → { error: "invalid_password" }
    //   429 → rate-limited
    let challenge: string;
    try {
      const verified = await apiFetch<VerifyPasswordResponse>(
        "/api/user/verify-password",
        { method: "POST", body: { password } },
      );
      challenge = verified.challenge;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        console.error(pc.red("Incorrect password."));
        process.exit(1);
      }
      if (err instanceof ApiError && err.status === 429) {
        console.error(
          pc.red("Too many password attempts. Try again in a few minutes."),
        );
        process.exit(1);
      }
      throw err;
    }

    // 3. DELETE with X-Delete-Challenge header.
    const opts: ApiFetchOptions = {
      method: "DELETE",
      headers: { "X-Delete-Challenge": challenge },
    };
    await apiFetch(
      `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
      opts,
    );
    console.log(pc.green(`Deleted file ${fileId}.`));
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

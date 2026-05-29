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
import { resolveByPrefix } from "../util/resolve-id.js";

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

// Disallow path separators and ASCII control characters in user-supplied
// file names. Mirrors the server-side `FILE_NAME_FORBIDDEN_RE`.
// eslint-disable-next-line no-control-regex
const CLIENT_NAME_FORBIDDEN_RE = /[\\/\x00-\x1f\x7f]/;

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  // idx <= 0: either no dot, or a leading-dot dotfile (e.g. ".gitignore").
  // Both → empty extension, matching the server's rule.
  return idx <= 0 ? "" : name.slice(idx + 1).toLowerCase();
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

    // Resolve --folder via the prefix rule, so users can paste the same
    // 8-char id shown by `folders ls`. Without --folder, upload goes to root.
    let resolvedFolderId: string | null = null;
    if (flags.folder) {
      try {
        interface FolderRow { id: string; name: string }
        interface FoldersListResp { folders: FolderRow[] }
        const folder = await resolveByPrefix(
          flags.folder,
          async () => {
            const res = await apiFetch<FoldersListResp>(
              `/api/projects/${encodeURIComponent(projectId)}/folders`,
            );
            return res.folders;
          },
          "folder",
        );
        resolvedFolderId = folder.id;
      } catch (err) {
        if (err instanceof Error && /No folder matches|prefix.*ambiguous/.test(err.message)) {
          console.error(pc.red(err.message));
          process.exit(1);
        }
        throw err;
      }
    }

    // 1. Get a presigned upload URL.
    const qs = new URLSearchParams();
    qs.set("name", fileName);
    qs.set("size", String(stat.size));
    qs.set("type", mimeType);
    if (resolvedFolderId) qs.set("folderId", resolvedFolderId);
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
          folderId: resolvedFolderId,
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

    // Resolve output path.
    //
    // SECURITY: when the filename is derived from the server's
    // Content-Disposition header, run it through `path.basename` before
    // resolving against cwd. A malicious or compromised server can return
    // `filename="../../../.ssh/authorized_keys"` and overwrite arbitrary
    // user files. An explicit `--out <path>` is honored verbatim because
    // the user opted in to that path.
    let absOut: string | undefined;
    let toStdout = false;
    if (flags.out === "-") {
      toStdout = true;
    } else if (flags.out) {
      absOut = path.resolve(flags.out);
    } else {
      // Derive from content-disposition or fall back to fileId.
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/i.exec(cd);
      const parsedName = match ? match[1]! : "";
      let safeName = path.basename(parsedName);
      if (!safeName || safeName === "." || safeName === "..") {
        safeName = `${fileId}.bin`;
      }
      absOut = path.resolve(process.cwd(), safeName);
    }

    const total = (() => {
      const cl = res.headers.get("content-length");
      return cl ? Number(cl) : undefined;
    })();
    const progress = new Progress({
      total,
      label: `downloading ${toStdout ? "(stdout)" : path.basename(absOut ?? fileId)}`,
    });

    const nodeStream = Readable.fromWeb(
      res.body as unknown as import("node:stream/web").ReadableStream,
    );
    nodeStream.on("data", (chunk: Buffer) => progress.add(chunk.length));

    if (toStdout) {
      await pipeline(nodeStream, process.stdout);
      progress.finish();
    } else {
      const writeStream = createWriteStream(absOut!);
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

/**
 * Walks the whole project (root + every folder) and returns the union of
 * files. Used for fileId prefix resolution. O(folders+1) network calls;
 * acceptable for typical project sizes.
 */
async function fetchAllFilesInProject(
  projectId: string,
): Promise<Array<{ id: string; name: string; folderId: string | null }>> {
  interface FolderRow {
    id: string;
  }
  interface FoldersListResp {
    folders: FolderRow[];
  }
  const foldersRes = await apiFetch<FoldersListResp>(
    `/api/projects/${encodeURIComponent(projectId)}/folders`,
  );
  const folderIds: (string | null)[] = [null, ...foldersRes.folders.map((f) => f.id)];
  const all: Array<{ id: string; name: string; folderId: string | null }> = [];
  for (const folderId of folderIds) {
    const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
    const res = await apiFetch<FilesListResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/files${qs}`,
    );
    for (const f of res.files) {
      all.push({ id: f.id, name: f.name, folderId: f.folderId });
    }
  }
  return all;
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

    // 1. Resolve 8-char prefix → full UUID via project-wide files walk.
    let resolvedId: string;
    let resolvedName: string;
    try {
      const match = await resolveByPrefix(
        fileId,
        () => fetchAllFilesInProject(projectId),
        "file",
      );
      resolvedId = match.id;
      resolvedName = match.name;
    } catch (err) {
      if (err instanceof Error && /No file matches|prefix.*ambiguous/.test(err.message)) {
        console.error(pc.red(err.message));
        process.exit(1);
        return;
      }
      throw err;
    }

    // 2. Pre-flight HEAD on the resolved UUID — short-circuit a typo or
    //    just-deleted file BEFORE asking for the user's password.
    try {
      await apiFetch(
        `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(resolvedId)}`,
        { method: "HEAD" },
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        console.error(pc.red(`File ${resolvedId} not found.`));
        process.exit(1);
        return;
      }
      throw err;
    }

    // 3. Prompt for password (never via argv).
    const password = await promptPassword(
      `Password (required to delete ${resolvedName})`,
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
      if (err instanceof ApiError && err.status === 503) {
        // Server failed to mint a challenge (DB / migration / dependency
        // issue, not credentials). Distinguishing from 401 prevents users
        // from chasing a phantom password bug.
        console.error(
          pc.red(
            "Server failed to mint a delete challenge (server-side error, not a password problem). Try again, or contact an admin.",
          ),
        );
        process.exit(1);
      }
      throw err;
    }

    // 4. DELETE with X-Delete-Challenge header.
    const opts: ApiFetchOptions = {
      method: "DELETE",
      headers: { "X-Delete-Challenge": challenge },
    };
    await apiFetch(
      `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(resolvedId)}`,
      opts,
    );
    console.log(pc.green(`Deleted ${resolvedName} (${resolvedId}).`));
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runFilesRename(
  fileId: string,
  newName: string,
  flags: FilesFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);

    // Client-side validation: catch obvious problems before the server.
    // The server has the final say (max 255 chars, FILE_NAME_FORBIDDEN_RE,
    // extension lock); these checks just give the user a snappy error for
    // the cases that don't need a round-trip.
    if (!newName || newName.length === 0) {
      console.error(pc.red("New name cannot be empty."));
      process.exit(1);
      return;
    }
    if (newName.length > 200) {
      console.error(pc.red("New name is too long (max 200 chars)."));
      process.exit(1);
      return;
    }
    if (CLIENT_NAME_FORBIDDEN_RE.test(newName)) {
      console.error(
        pc.red("Invalid name — no path separators or control characters."),
      );
      process.exit(1);
      return;
    }

    // Resolve 8-char prefix → full UUID + current name.
    let resolvedId: string;
    let oldName: string;
    try {
      const match = await resolveByPrefix(
        fileId,
        () => fetchAllFilesInProject(projectId),
        "file",
      );
      resolvedId = match.id;
      oldName = match.name;
    } catch (err) {
      if (err instanceof Error && /No file matches|prefix.*ambiguous/.test(err.message)) {
        console.error(pc.red(err.message));
        process.exit(1);
        return;
      }
      throw err;
    }

    // Extension sanity check (warn only — let the server be the source of
    // truth via its 422 response).
    const currentExt = extOf(oldName);
    const newExt = extOf(newName);
    if (currentExt !== newExt) {
      const note = currentExt
        ? `Warning: extension differs (.${currentExt} → ${newExt ? `.${newExt}` : "(none)"}). Server may reject.`
        : `Warning: original has no extension; new name does. Server may reject.`;
      process.stderr.write(pc.yellow(`${note}\n`));
    }

    // Send the PATCH; surface 422 with a friendly extension message.
    try {
      const result = await apiFetch<{ file: { id: string; name: string } }>(
        `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(resolvedId)}`,
        { method: "PATCH", body: { name: newName } },
      );

      if (wantsJson(flags)) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const prefix = resolvedId.slice(0, 8);
      console.log(
        pc.green(`Renamed ${oldName} → ${result.file.name} (id: ${prefix}).`),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const body = err.body as
          | { error?: string; currentExt?: string; newExt?: string }
          | null;
        if (body?.error === "extension_change_not_allowed") {
          const cur = body.currentExt ? `.${body.currentExt}` : "(none)";
          const nxt = body.newExt ? `.${body.newExt}` : "(none)";
          console.error(
            pc.red(
              `Extension cannot be changed (${cur} → ${nxt}). Use the same extension as the original.`,
            ),
          );
          process.exit(1);
          return;
        }
      }
      if (err instanceof ApiError && err.status === 404) {
        console.error(pc.red(`File ${resolvedId} not found.`));
        process.exit(1);
        return;
      }
      throw err;
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

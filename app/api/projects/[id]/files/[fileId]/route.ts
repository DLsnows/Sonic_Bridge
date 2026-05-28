import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { files, folders, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { deleteFile, normalizeKey } from "@/lib/storage";
import { resolveProjectId } from "@/lib/project-utils";
import { createHash } from "crypto";

export const maxDuration = 300;

// Disallow path separators and control chars; allow most other unicode characters.
// eslint-disable-next-line no-control-regex
const FILE_NAME_FORBIDDEN_RE = /[\\/\x00-\x1f\x7f]/;

const patchFileSchema = z
  .object({
    folderId: z.string().uuid().nullable().optional(),
    name: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => !FILE_NAME_FORBIDDEN_RE.test(value), {
        message: "Name contains invalid characters",
      })
      .optional(),
  })
  .refine(
    (value) =>
      Object.prototype.hasOwnProperty.call(value, "folderId") ||
      value.name !== undefined,
    { message: "At least one of folderId or name must be provided" },
  );

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;
  const [file] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.projectId, id))).limit(1);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const url = normalizeKey(file.storageKey);
  const isInline = request.nextUrl.searchParams.has("inline");
  const rangeHeader = request.headers.get("range");

  // Inline playback without Range: redirect to R2 for native CDN streaming
  if (isInline && !rangeHeader) {
    return NextResponse.redirect(url);
  }

  // Download or Range request: proxy through server
  try {
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) fetchHeaders.Range = rangeHeader;

    const response = await fetch(url, { headers: fetchHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("Empty body");

    const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\;,]/g, "").trim() || "download";
    const encodedName = encodeURIComponent(file.name).replace(/'/g, "%27");
    const isAudio = file.mimeType?.startsWith("audio/") ?? false;
    const isVideo = file.mimeType?.startsWith("video/") ?? false;
    const useInline = isInline || (!!rangeHeader && (isAudio || isVideo));
    const headers: Record<string, string> = {
      "Content-Type": file.mimeType || response.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `${useInline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    };

    if (response.status === 206) {
      const contentRange = response.headers.get("content-range");
      if (contentRange) headers["Content-Range"] = contentRange;
      const cl = response.headers.get("content-length");
      if (cl) headers["Content-Length"] = cl;
      return new NextResponse(response.body, { status: 206, headers });
    }

    headers["Content-Length"] = response.headers.get("content-length") ?? String(file.size);
    return new NextResponse(response.body, { headers });
  } catch (err) {
    console.error(`Failed to download "${file.name}":`, err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to download file. Please try again later." },
      { status: 502 },
    );
  }
}

export async function HEAD(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;
  const [file] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.projectId, id))).limit(1);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 200, headers: { "Content-Length": String(file.size), "Content-Type": file.mimeType || "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=60" } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id: rawId, fileId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.projectId, projectId)))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Extension lock: renaming may not change the file extension. The MIME
  // type was set at upload and downstream consumers (web preview, DAW
  // import) depend on it remaining consistent with the name suffix. Compare
  // case-insensitively. A name with no dot is treated as having an empty
  // extension; rename within "no extension" is permitted (e.g. "README" ->
  // "READMEv2") as long as the new name also lacks a dot.
  if (parsed.data.name !== undefined) {
    const extractExt = (name: string): string => {
      const idx = name.lastIndexOf(".");
      // idx === -1: no dot. idx === 0: leading dot only (e.g. ".gitignore",
      // ".env") — these are dotfiles with no extension, not "gitignore"-ext
      // files. Both cases → empty extension.
      return idx <= 0 ? "" : name.slice(idx + 1).toLowerCase();
    };
    const currentExt = extractExt(existing.name);
    const newExt = extractExt(parsed.data.name);
    if (currentExt !== newExt) {
      return NextResponse.json(
        { error: "extension_change_not_allowed", currentExt, newExt },
        { status: 422 },
      );
    }
  }

  const updates: { folderId?: string | null; name?: string } = {};

  if (Object.prototype.hasOwnProperty.call(parsed.data, "folderId")) {
    const nextFolderId = parsed.data.folderId ?? null;
    if (nextFolderId !== null) {
      const [folder] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(eq(folders.id, nextFolderId), eq(folders.projectId, projectId)),
        )
        .limit(1);
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 },
        );
      }
    }
    updates.folderId = nextFolderId;
  }

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
  }

  await db.update(files).set(updates).where(and(eq(files.id, fileId), eq(files.projectId, projectId)));

  const [updated] = await db
    .select({
      id: files.id,
      name: files.name,
      size: files.size,
      mimeType: files.mimeType,
      storageKey: files.storageKey,
      folderId: files.folderId,
      uploadedBy: files.uploadedBy,
      uploaderName: users.username,
      uploadedAt: files.uploadedAt,
    })
    .from(files)
    .innerJoin(users, eq(files.uploadedBy, users.id))
    .where(and(eq(files.id, fileId), eq(files.projectId, projectId)))
    .limit(1);

  return NextResponse.json({ file: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  // Look up the file FIRST so a missing/foreign file returns 404 without
  // consuming the user's delete challenge. Otherwise a typo'd fileId would
  // burn the one-shot claim and force the user to re-verify their password.
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.projectId, id)))
    .limit(1);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const challengeHeader = request.headers.get("x-delete-challenge");
  if (!challengeHeader) {
    return NextResponse.json({ error: "challenge_required" }, { status: 401 });
  }

  const hashed = createHash("sha256").update(challengeHeader).digest("hex");

  // Atomically claim the challenge. The WHERE clause guarantees only one
  // concurrent request can mark it used and receive a row back.
  const claim = await db.execute<{ id: string }>(
    sql`UPDATE delete_challenges
        SET used_at = now()
        WHERE challenge_hash = ${hashed}
          AND user_id = ${authResult.userId}
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING id`,
  );

  if (claim.rows.length === 0) {
    return NextResponse.json({ error: "challenge_invalid" }, { status: 401 });
  }

  await deleteFile(file.storageKey);
  await db.delete(files).where(eq(files.id, fileId));
  return NextResponse.json({ success: true });
}


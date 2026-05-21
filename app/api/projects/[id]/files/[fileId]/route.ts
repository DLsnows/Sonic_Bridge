import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { deleteFile } from "@/lib/storage";
import { head } from "@vercel/blob";

export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.projectId, id)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const isInline = request.nextUrl.searchParams.has("inline");
  const isAudio = file.mimeType?.startsWith("audio/") ?? false;
  const isVideo = file.mimeType?.startsWith("video/") ?? false;
  const rangeHeader = request.headers.get("range");

  try {
    const blob = await head(file.storageKey);
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) fetchHeaders.Range = rangeHeader;

    const response = await fetch(blob.downloadUrl, { headers: fetchHeaders });
    if (!response.ok) {
      throw new Error(`Blob fetch failed: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Blob fetch returned empty body");
    }

    const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\;,]/g, "").trim() || "download";
    const encodedName = encodeURIComponent(file.name).replace(/'/g, "%27");
    const useInline = isInline || ((isAudio || isVideo) && rangeHeader);
    const disposition = useInline
      ? `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
      : `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;

    const headers: Record<string, string> = {
      "Content-Type": file.mimeType || response.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": disposition,
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

    const contentLength = response.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(response.body, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to fetch file "${file.name}" (${file.storageKey}):`, message);
    return NextResponse.json(
      { error: "Failed to download file. The file may have been moved or deleted." },
      { status: 502 },
    );
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.projectId, id)))
    .limit(1);

  if (!file) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Length": String(file.size),
      "Content-Type": file.mimeType || "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.projectId, id)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await deleteFile(file.storageKey);
  await db.delete(files).where(eq(files.id, fileId));

  return NextResponse.json({ success: true });
}

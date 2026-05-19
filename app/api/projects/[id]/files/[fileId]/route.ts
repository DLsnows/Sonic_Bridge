import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { getFileUrl, deleteFile, getFileBody } from "@/lib/storage";

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
  const rangeHeader = request.headers.get("range");
  const isAudio = file.mimeType?.startsWith("audio/") ?? false;
  const isVideo = file.mimeType?.startsWith("video/") ?? false;

  // For files > 50MB, redirect to signed download URL to avoid server memory pressure
  if (file.size > 50 * 1024 * 1024 && !rangeHeader) {
    const url = await getFileUrl(file.storageKey);
    return NextResponse.redirect(url);
  }

  const result = await getFileBody(file.storageKey, {
    range: rangeHeader ?? undefined,
  });

  const useInline = isInline || ((isAudio || isVideo) && result.isRange);
  const disposition = useInline
    ? `inline; filename="${encodeURIComponent(file.name)}"`
    : `attachment; filename="${encodeURIComponent(file.name)}"`;

  const headers: Record<string, string> = {
    "Content-Type": result.contentType,
    "Content-Disposition": disposition,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=60",
  };

  if (result.isRange) {
    headers["Content-Range"] = `bytes ${result.rangeStart}-${result.rangeEnd}/${result.size}`;
    headers["Content-Length"] = String(result.contentLength);
    return new NextResponse(result.body, { status: 206, headers });
  }

  headers["Content-Length"] = String(result.contentLength);
  return new NextResponse(result.body, { headers });
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
    return NextResponse.json({ error: "File not found" }, { status: 404 });
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
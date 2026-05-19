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

  // For files > 50MB, redirect to signed download URL
  if (file.size > 50 * 1024 * 1024) {
    const url = await getFileUrl(file.storageKey);
    return NextResponse.redirect(url);
  }

  const rangeHeader = request.headers.get("range");
  const isInline = request.nextUrl.searchParams.has("inline");
  const isAudio = file.mimeType?.startsWith("audio/") ?? false;
  const isVideo = file.mimeType?.startsWith("video/") ?? false;

  const {
    body, contentType, size, contentLength, isRange, rangeStart, rangeEnd,
  } = await getFileBody(file.storageKey, { range: rangeHeader ?? undefined });

  // Use inline disposition for media when Range is present or explicit ?inline=1
  const useInline = isInline || ((isAudio || isVideo) && isRange);
  const disposition = useInline
    ? `inline; filename="${encodeURIComponent(file.name)}"`
    : `attachment; filename="${encodeURIComponent(file.name)}"`;

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Accept-Ranges", "bytes");
  responseHeaders.set("Content-Disposition", disposition);
  responseHeaders.set("Cache-Control", "private, max-age=60");

  if (isRange && body) {
    responseHeaders.set("Content-Range", `bytes ${rangeStart}-${rangeEnd}/${size}`);
    responseHeaders.set("Content-Length", String(contentLength));
    return new NextResponse(body, { status: 206, headers: responseHeaders });
  }

  responseHeaders.set("Content-Length", String(size));
  return new NextResponse(body, { headers: responseHeaders });
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
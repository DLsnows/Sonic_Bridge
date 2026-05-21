import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { deleteFile, normalizeKey } from "@/lib/storage";

export const maxDuration = 300;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;
  const [file] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.projectId, id))).limit(1);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const url = normalizeKey(file.storageKey);
  const isInline = request.nextUrl.searchParams.has("inline");

  if (isInline) {
    return NextResponse.redirect(url);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("Empty body");

    const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\;,]/g, "").trim() || "download";
    const encodedName = encodeURIComponent(file.name).replace(/'/g, "%27");

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": file.mimeType || response.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": response.headers.get("content-length") ?? String(file.size),
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
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
  return new NextResponse(null, { status: 200, headers: { "Content-Length": String(file.size), "Content-Type": file.mimeType || "application/octet-stream", "Cache-Control": "private, max-age=60" } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;
  const [file] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.projectId, id))).limit(1);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  await deleteFile(file.storageKey);
  await db.delete(files).where(eq(files.id, fileId));
  return NextResponse.json({ success: true });
}

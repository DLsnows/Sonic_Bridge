import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { deleteFile } from "@/lib/storage";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;
  const [file] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.projectId, id))).limit(1);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.redirect(file.storageKey);
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

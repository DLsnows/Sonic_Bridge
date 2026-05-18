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

  const { body, contentType, size } = await getFileBody(file.storageKey);
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
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
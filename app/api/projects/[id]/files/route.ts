import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files, folders, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { getMaxFileSize, detectMimeType } from "@/lib/storage";
import { createNotifications } from "@/lib/notifications";

export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  const folderId = request.nextUrl.searchParams.get("folderId");

  const fileList = await db
    .select({
      id: files.id,
      name: files.name,
      size: files.size,
      mimeType: files.mimeType,
      folderId: files.folderId,
      uploadedBy: files.uploadedBy,
      uploaderName: users.username,
      uploadedAt: files.uploadedAt,
    })
    .from(files)
    .innerJoin(users, eq(files.uploadedBy, users.id))
    .where(
      and(
        eq(files.projectId, id),
        folderId ? eq(files.folderId, folderId) : undefined,
      ),
    )
    .orderBy(files.uploadedAt);

  return NextResponse.json({ files: fileList, folderId: folderId ?? null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  let body: { files: Array<{ name: string; size: number; mimeType: string; storageKey: string; url?: string }>; folderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { files: fileList, folderId } = body;

  if (!fileList || fileList.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (folderId) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.projectId, id)))
      .limit(1);

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  for (const file of fileList) {
    if (!file.name || !file.storageKey) {
      return NextResponse.json(
        { error: "Each file must have name and storageKey" },
        { status: 400 },
      );
    }
    if (!file.storageKey.startsWith(`${id}/`)) {
      return NextResponse.json(
        { error: `storageKey must be prefixed with project ID` },
        { status: 400 },
      );
    }
    const { limit, category } = getMaxFileSize(file.name);
    if (file.size > limit) {
      const limitStr = limit >= 1073741824 ? `${(limit / 1073741824).toFixed(0)}GB` : `${(limit / 1048576).toFixed(0)}MB`;
      return NextResponse.json(
        { error: `File "${file.name}" exceeds ${limitStr} limit for ${category} files` },
        { status: 413 },
      );
    }
  }

  const results: Array<{
    id: string;
    name: string;
    size: number;
    mimeType: string;
    folderId: string | null;
    uploadedAt: Date;
  }> = [];

  for (const file of fileList) {
    const mimeType = detectMimeType(file.name, file.mimeType);

    const [record] = await db
      .insert(files)
      .values({
        projectId: id,
        folderId: folderId ?? null,
        name: file.name,
        size: file.size,
        mimeType,
        storageKey: file.storageKey,
        uploadedBy: authResult.userId,
      })
      .returning();

    if (record) {
      results.push({
        id: record.id,
        name: record.name,
        size: record.size,
        mimeType: record.mimeType,
        folderId: record.folderId,
        uploadedAt: record.uploadedAt,
      });
    }
  }

  for (const r of results) {
    createNotifications({
      type: "new_file",
      referenceId: r.id,
      referenceType: "file",
      projectId: id,
      actorUserId: authResult.userId,
    }).catch((e) => console.error("Notification creation failed:", e));
  }

  return NextResponse.json({ files: results }, { status: 201 });
}

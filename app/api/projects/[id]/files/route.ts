import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { resolveProjectId } from "@/lib/project-utils";
import { createNotifications } from "@/lib/notifications";
import { eq, and } from "drizzle-orm";
import { files, folders, users } from "@/lib/db/schema";

export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const id = await resolveProjectId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const folderId = request.nextUrl.searchParams.get("folderId");

  const fileList = await db
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
  const { id: rawId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let body: { files?: Array<{ name: string; size: number; mimeType: string; storageKey: string }>; folderId?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const uploadedFiles = body.files;
  const folderId = body.folderId ?? null;
  if (!uploadedFiles || uploadedFiles.length === 0) return NextResponse.json({ error: "No files provided" }, { status: 400 });

  if (folderId) {
    const [folder] = await db.select().from(folders).where(and(eq(folders.id, folderId), eq(folders.projectId, projectId))).limit(1);
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const results: Array<{ id: string; name: string; size: number; mimeType: string; folderId: string | null; uploadedAt: Date }> = [];

  for (const file of uploadedFiles) {
    const [record] = await db.insert(files).values({
      projectId, folderId: folderId ?? null, name: file.name, size: file.size,
      mimeType: file.mimeType, storageKey: file.storageKey, uploadedBy: authResult.userId,
    }).returning({ id: files.id, uploadedAt: files.uploadedAt });

    if (record) results.push({ id: record.id, name: file.name, size: file.size, mimeType: file.mimeType, folderId: folderId ?? null, uploadedAt: record.uploadedAt });
  }

  for (const r of results) {
    createNotifications({ type: "new_file", referenceId: r.id, referenceType: "file", projectId, actorUserId: authResult.userId }).catch((e) => console.error("Notification creation failed:", e));
  }

  return NextResponse.json({ files: results }, { status: 201 });
}

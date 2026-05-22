import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { files, folders, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { resolveProjectId } from "@/lib/project-utils";

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

const postFileSchema = z.object({
  storageKey: z.string().min(1),
  name: z.string().min(1),
  size: z.number().positive(),
  mimeType: z.string(),
  folderId: z.string().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { storageKey, name, size, mimeType, folderId } = parsed.data;

  if (storageKey.includes("..") || !storageKey.startsWith(`${projectId}/`)) {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
  }

  if (folderId) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.projectId, projectId)))
      .limit(1);
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const [record] = await db
    .insert(files)
    .values({
      projectId,
      folderId: folderId ?? null,
      name,
      size,
      mimeType,
      storageKey,
      uploadedBy: authResult.userId,
    })
    .returning({ id: files.id, uploadedAt: files.uploadedAt });

  return NextResponse.json({ file: { id: record?.id, name, size, mimeType, folderId: folderId ?? null, uploadedAt: record?.uploadedAt } }, { status: 201 });
}

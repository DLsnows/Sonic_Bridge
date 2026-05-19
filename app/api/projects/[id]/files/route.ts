import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files, folders, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { saveFile, getMaxFileSize } from "@/lib/storage";

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const uploadedFiles = formData.getAll("files") as File[];
  const folderId = formData.get("folderId") as string | null;

  if (uploadedFiles.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  let folderPath = "";
  if (folderId) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.projectId, id)))
      .limit(1);

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const allFolders = await db
      .select()
      .from(folders)
      .where(eq(folders.projectId, id));

    const pathParts: string[] = [folder.name];
    let current = folder;
    while (current.parentId) {
      const parent = allFolders.find((f) => f.id === current.parentId);
      if (!parent) break;
      pathParts.unshift(parent.name);
      current = parent;
    }
    folderPath = pathParts.join("/");
  }

  // Validate all files upfront to prevent partial uploads
  for (const file of uploadedFiles) {
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

  for (const file of uploadedFiles) {
    const { storageKey } = await saveFile(id, folderPath, file);

    const [record] = await db
      .insert(files)
      .values({
        projectId: id,
        folderId: folderId ?? null,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        storageKey,
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

  return NextResponse.json({ files: results }, { status: 201 });
}
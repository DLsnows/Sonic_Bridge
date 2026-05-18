import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders, files as filesTable } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> },
) {
  const { id, folderId } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

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

  const descendantIds = new Set<string>();
  function collectDescendants(parentId: string) {
    for (const f of allFolders) {
      if (f.parentId === parentId && !descendantIds.has(f.id)) {
        descendantIds.add(f.id);
        collectDescendants(f.id);
      }
    }
  }
  collectDescendants(folderId);

  const allAffectedIds = [folderId, ...descendantIds];

  const affectedFiles = await db
    .select({ storageKey: filesTable.storageKey })
    .from(filesTable)
    .where(inArray(filesTable.folderId, allAffectedIds));

  await Promise.allSettled(
    affectedFiles.map((f) => deleteFile(f.storageKey)),
  );

  if (descendantIds.size > 0) {
    await db
      .delete(folders)
      .where(inArray(folders.id, [...descendantIds]));
  }

  await db.delete(folders).where(eq(folders.id, folderId));

  return NextResponse.json({ success: true });
}
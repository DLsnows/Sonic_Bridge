import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "@/lib/api-auth";
import { z } from "zod";

const renameSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function PATCH(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [updated] = await db
    .update(folders)
    .set({ name: parsed.data.name })
    .where(eq(folders.id, folderId))
    .returning();

  return NextResponse.json({ folder: updated });
}

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

  // Refuse to delete non-empty folders. The user must clear direct children
  // (files + subfolders) before the folder itself can be removed. This
  // replaces the previous recursive cascade behaviour.
  const countsResult = await db.execute<{
    fileCount: number;
    subfolderCount: number;
  }>(
    sql`SELECT
      (SELECT COUNT(*)::int FROM files WHERE folder_id = ${folderId}) AS "fileCount",
      (SELECT COUNT(*)::int FROM folders WHERE parent_id = ${folderId}) AS "subfolderCount"`,
  );
  const counts = countsResult.rows[0];
  const fileCount = Number(counts?.fileCount ?? 0);
  const subfolderCount = Number(counts?.subfolderCount ?? 0);

  if (fileCount > 0 || subfolderCount > 0) {
    return NextResponse.json(
      { error: "folder_not_empty" },
      { status: 409 },
    );
  }

  await db.delete(folders).where(eq(folders.id, folderId));

  return NextResponse.json({ success: true });
}

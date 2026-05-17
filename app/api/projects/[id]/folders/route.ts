import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { authenticate } from "@/lib/api-auth";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  const folderList = await db
    .select()
    .from(folders)
    .where(eq(folders.projectId, id))
    .orderBy(folders.createdAt);

  return NextResponse.json({ folders: folderList });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, parentId } = parsed.data;

  if (parentId) {
    const [parent] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, parentId), eq(folders.projectId, id)))
      .limit(1);
    if (!parent) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }
  }

  const [folder] = await db
    .insert(folders)
    .values({
      projectId: id,
      name,
      parentId: parentId ?? null,
      createdBy: authResult.userId,
    })
    .returning();

  return NextResponse.json(folder, { status: 201 });
}
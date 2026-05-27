import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discussionPosts, users } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveProjectId } from "@/lib/project-utils";
import { authenticate } from "@/lib/api-auth";

const editPostSchema = z.object({
  content: z.string().min(1).max(10000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  const { id: rawId, postId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = authResult.userId;

  const [post] = await db
    .select()
    .from(discussionPosts)
    .where(
      and(
        eq(discussionPosts.id, postId),
        eq(discussionPosts.projectId, projectId),
      ),
    )
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.userId !== userId) {
    return NextResponse.json({ error: "Not your post" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = editPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const isAiGenerated = post.isAiGenerated || authResult.isToken;

  const [updated] = await db
    .update(discussionPosts)
    .set({
      content: parsed.data.content,
      isEdited: true,
      isAiGenerated,
      updatedAt: new Date(),
    })
    .where(eq(discussionPosts.id, postId))
    .returning();

  const [result] = await db
    .select({
      id: discussionPosts.id,
      projectId: discussionPosts.projectId,
      userId: discussionPosts.userId,
      username: users.username,
      title: discussionPosts.title,
      content: discussionPosts.content,
      parentId: discussionPosts.parentId,
      isEdited: discussionPosts.isEdited,
      isAiGenerated: discussionPosts.isAiGenerated,
      createdAt: discussionPosts.createdAt,
      updatedAt: discussionPosts.updatedAt,
    })
    .from(discussionPosts)
    .innerJoin(users, eq(discussionPosts.userId, users.id))
    .where(eq(discussionPosts.id, updated.id))
    .limit(1);

  return NextResponse.json(result);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  const { id: rawId, postId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = authResult.userId;

  const [post] = await db
    .select()
    .from(discussionPosts)
    .where(
      and(
        eq(discussionPosts.id, postId),
        eq(discussionPosts.projectId, projectId),
      ),
    )
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const isOwner = post.userId === userId;
  const isAdmin = authResult.membership.role === "admin";

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Not authorized to delete this post" },
      { status: 403 },
    );
  }

  // Use recursive CTE to find all descendants at the database level
  const result = await db.execute<{ id: string }>(
    sql`WITH RECURSIVE descendants AS (
      SELECT id FROM discussion_posts WHERE id = ${postId}
      UNION ALL
      SELECT dp.id FROM discussion_posts dp
      INNER JOIN descendants d ON dp.parent_id = d.id
    )
    SELECT id FROM descendants`
  );

  const idsToDelete = result.rows.map((r) => r.id);

  if (idsToDelete.length > 1) {
    await db
      .delete(discussionPosts)
      .where(inArray(discussionPosts.id, idsToDelete));
  } else {
    await db.delete(discussionPosts).where(eq(discussionPosts.id, postId));
  }

  return NextResponse.json({ success: true, deleted: idsToDelete.length });
}

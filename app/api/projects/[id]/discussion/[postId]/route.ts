import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { discussionPosts, projectMembers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const editPostSchema = z.object({
  content: z.string().min(1).max(10000),
});

function collectDescendantIds(
  postId: string,
  parentMap: Map<string, string[]>,
): string[] {
  const children = parentMap.get(postId) ?? [];
  const descendants = [...children];
  for (const childId of children) {
    descendants.push(...collectDescendantIds(childId, parentMap));
  }
  return descendants;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, postId } = await params;
  const userId = (session.user as any).id as string;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

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
    return NextResponse.json({ error: "Not the author" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = editPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(discussionPosts)
    .set({ content: parsed.data.content, isEdited: true, updatedAt: new Date() })
    .where(eq(discussionPosts.id, postId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, postId } = await params;
  const userId = (session.user as any).id as string;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

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

  const isAdmin = membership.role === "admin";
  if (post.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Collect all descendant IDs for cascade delete
  const allPosts = await db
    .select({ id: discussionPosts.id, parentId: discussionPosts.parentId })
    .from(discussionPosts)
    .where(eq(discussionPosts.projectId, projectId));

  const parentMap = new Map<string, string[]>();
  for (const p of allPosts) {
    if (p.parentId) {
      const children = parentMap.get(p.parentId) ?? [];
      children.push(p.id);
      parentMap.set(p.parentId, children);
    }
  }

  const toDelete = [postId, ...collectDescendantIds(postId, parentMap)];

  if (toDelete.length > 1) {
    await db.delete(discussionPosts).where(inArray(discussionPosts.id, toDelete));
  } else {
    await db.delete(discussionPosts).where(eq(discussionPosts.id, postId));
  }

  return NextResponse.json({ deleted: toDelete.length });
}

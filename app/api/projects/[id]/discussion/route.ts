import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { discussionPosts, projectMembers, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { resolveProjectId } from "@/lib/project-utils";
import { createNotifications } from "@/lib/notifications";

const createPostSchema = z.discriminatedUnion("hasParent", [
  z.object({
    hasParent: z.literal(false),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
  }),
  z.object({
    hasParent: z.literal(true),
    parentId: z.string().uuid(),
    content: z.string().min(1).max(10000),
  }),
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const projectId = await resolveProjectId(id);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = session.user.id as string;

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

  const posts = await db
    .select({
      id: discussionPosts.id,
      projectId: discussionPosts.projectId,
      userId: discussionPosts.userId,
      username: users.username,
      avatar: users.avatar,
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
    .where(eq(discussionPosts.projectId, projectId))
    .orderBy(desc(discussionPosts.createdAt));

  return NextResponse.json(posts);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const projectId = await resolveProjectId(id);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = session.user.id as string;

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

  const body = await request.json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data } = parsed;

  let title: string;
  let parentId: string | null = null;
  let parentUserId: string | null = null;

  if (data.hasParent) {
    title = "";
    parentId = data.parentId;

    const [parent] = await db
      .select({ id: discussionPosts.id, userId: discussionPosts.userId })
      .from(discussionPosts)
      .where(
        and(
          eq(discussionPosts.id, parentId),
          eq(discussionPosts.projectId, projectId),
        ),
      )
      .limit(1);

    if (!parent) {
      return NextResponse.json(
        { error: "Parent post not found" },
        { status: 404 },
      );
    }
    parentUserId = parent.userId;
  } else {
    title = data.title;
  }

  const [post] = await db
    .insert(discussionPosts)
    .values({
      projectId,
      userId,
      title,
      content: data.content,
      parentId,
    })
    .returning();

  // Emit notifications (fire-and-forget — don't block the response)
  createNotifications({
    type: parentId ? "new_reply" : "new_post",
    referenceId: post.id,
    referenceType: "discussion_post",
    projectId,
    actorUserId: userId,
    parentUserId: parentUserId ?? undefined,
  }).catch((e) => console.error("Notification creation failed:", e));

  const [result] = await db
    .select({
      id: discussionPosts.id,
      projectId: discussionPosts.projectId,
      userId: discussionPosts.userId,
      username: users.username,
      avatar: users.avatar,
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
    .where(eq(discussionPosts.id, post.id))
    .limit(1);

  return NextResponse.json(result, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discussionPosts, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { resolveProjectId } from "@/lib/project-utils";
import { authenticate } from "@/lib/api-auth";
import { createReplyNotifications, createThreadNotifications } from "@/lib/notifications";

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
  const { id: rawId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
  const { id: rawId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = authResult.userId;

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

  if (data.hasParent) {
    title = "";
    parentId = data.parentId;

    const [parent] = await db
      .select({ id: discussionPosts.id })
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
  } else {
    title = data.title;
  }

  let post: typeof discussionPosts.$inferSelect;
  try {
    const inserted = await db
      .insert(discussionPosts)
      .values({
        projectId,
        userId,
        title,
        content: data.content,
        parentId,
        isAiGenerated: authResult.isToken,
      })
      .returning();
    if (!inserted || inserted.length === 0) {
      throw new Error("Insert returned no rows");
    }
    post = inserted[0];
  } catch (e) {
    console.error("Discussion post insert failed:", e);
    return NextResponse.json(
      { error: "Failed to create discussion post. Please try again later." },
      { status: 500 },
    );
  }

  // Emit notifications to project members
  if (parentId) {
    createReplyNotifications({
      referenceId: post.id,
      projectId,
      actorUserId: userId,
      parentId,
    }).catch((e) => console.error("Reply notification creation failed:", e));
  } else {
    createThreadNotifications({
      referenceId: post.id,
      projectId,
      actorUserId: userId,
    }).catch((e) => console.error("Thread notification creation failed:", e));
  }

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

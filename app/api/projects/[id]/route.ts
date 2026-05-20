import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  projects,
  projectMembers,
  folders,
  files,
  scheduleEvents,
  discussionPosts,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const members = await db
    .select({
      userId: projectMembers.userId,
      username: users.username,
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, id));

  return NextResponse.json({ ...project, members, myRole: membership.role });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description } = body;

  const [updated] = await db
    .update(projects)
    .set({
      ...(name && { name }),
      ...(description !== undefined && { description }),
    })
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(files).where(eq(files.projectId, id));
    await tx.delete(scheduleEvents).where(eq(scheduleEvents.projectId, id));
    await tx.delete(discussionPosts).where(eq(discussionPosts.projectId, id));
    await tx.delete(folders).where(eq(folders.projectId, id));
    await tx.delete(projectMembers).where(eq(projectMembers.projectId, id));
    await tx.delete(projects).where(eq(projects.id, id));
  });

  return NextResponse.json({ success: true });
}

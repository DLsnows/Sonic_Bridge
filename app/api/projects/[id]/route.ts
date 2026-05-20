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
import { z } from "zod";
import { resolveProjectId } from "@/lib/project-utils";

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
  const userId = session.user.id;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
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
    .where(eq(projectMembers.projectId, projectId));

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
  const projectId = await resolveProjectId(id);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = session.user.id;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const updateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    status: z.enum(["not_started", "in_progress", "paused", "pending_release", "archived"]).optional(),
  });
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, description, status } = parsed.data;

  const setData: Record<string, unknown> = {};
  if (name !== undefined) setData.name = name;
  if (description !== undefined) setData.description = description;
  if (status !== undefined) setData.status = status;

  const [updated] = await db
    .update(projects)
    .set(setData)
    .where(eq(projects.id, projectId))
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
  const projectId = await resolveProjectId(id);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = session.user.id;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(files).where(eq(files.projectId, projectId));
    await tx.delete(scheduleEvents).where(eq(scheduleEvents.projectId, projectId));
    await tx.delete(discussionPosts).where(eq(discussionPosts.projectId, projectId));
    await tx.delete(folders).where(eq(folders.projectId, projectId));
    await tx.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
    await tx.delete(projects).where(eq(projects.id, projectId));
  });

  return NextResponse.json({ success: true });
}

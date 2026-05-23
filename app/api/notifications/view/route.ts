import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications, projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { upsertProjectView } from "@/lib/project-views";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const { projectId } = await request.json().catch(() => ({}));
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // Verify the user is a member of the project
  const [membership] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: "Not a project member" }, { status: 403 });
  }

  // Mark all new_post notifications as read for this project+user
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.projectId, projectId),
        eq(notifications.type, "new_post"),
        eq(notifications.isRead, false),
      ),
    );

  await upsertProjectView(userId, projectId);
  return NextResponse.json({ success: true });
}

/** Bulk update: mark all projects as viewed (called by "mark all read") */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const { projectIds } = await request.json().catch(() => ({}));
  if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
    return NextResponse.json({ error: "Missing projectIds" }, { status: 400 });
  }

  // Upsert viewed timestamp for all specified projects
  for (const projectId of projectIds) {
    await upsertProjectView(userId, projectId);
  }

  return NextResponse.json({ success: true });
}

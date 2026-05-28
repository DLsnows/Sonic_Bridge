import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { upsertProjectView } from "@/lib/project-views";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;

  const { projectId } = await request.json().catch(() => ({}));
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  const [membership] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  if (!membership) return NextResponse.json({ error: "Not a project member" }, { status: 403 });

  try { await upsertProjectView(userId, projectId); } catch { /* non-fatal */ }
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;

  const { projectIds } = await request.json().catch(() => ({}));
  if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
    return NextResponse.json({ error: "Missing projectIds" }, { status: 400 });
  }
  for (const pid of projectIds) {
    try { await upsertProjectView(userId, pid); } catch { /* non-fatal */ }
  }
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { resolveProjectId } from "@/lib/project-utils";

const joinSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = joinSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { projectId: projectIdInput } = parsed.data;

  const userId = session.user.id as string;

  const realProjectId = await resolveProjectId(projectIdInput);
  if (!realProjectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, realProjectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Already a member" }, { status: 409 });
  }

  await db.insert(projectMembers).values({
    projectId: realProjectId,
    userId,
    role: "member",
  });

  return NextResponse.json({ success: true });
}

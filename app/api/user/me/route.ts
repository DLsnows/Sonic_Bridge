import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, projectMembers, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authenticateUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser(request);
  if (authResult instanceof Response) return authResult;

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, authResult.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const memberships = await db
    .select({
      id: projects.id,
      customId: projects.customId,
      name: projects.name,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, authResult.userId));

  return NextResponse.json({
    user,
    projects: memberships,
  });
}

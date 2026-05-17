import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

export interface AuthResult {
  userId: string;
  username: string;
  membership: { role: "admin" | "member" };
}

export async function authenticate(
  request: Request,
  projectId: string,
): Promise<AuthResult | Response> {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer sb_")) {
    const rawToken = authHeader.slice(7);
    const hashed = createHash("sha256").update(rawToken).digest("hex");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.apiToken, hashed))
      .limit(1);

    if (!user) {
      return Response.json({ error: "Invalid API token" }, { status: 401 });
    }

    const [membership] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (!membership) {
      return Response.json(
        { error: "Not a member of this project" },
        { status: 403 },
      );
    }

    return {
      userId: user.id,
      username: user.username,
      membership: membership as { role: "admin" | "member" },
    };
  }

  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return Response.json({ error: "Not a member" }, { status: 403 });
  }

  return {
    userId,
    username: (session.user as any).username ?? (session.user as any).name ?? "User",
    membership: membership as { role: "admin" | "member" },
  };
}

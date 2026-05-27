import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { resolveProjectId } from "@/lib/project-utils";

function validateRole(role: unknown): "admin" | "member" {
  if (role !== "admin" && role !== "member") {
    throw new Error(`Invalid membership role: ${role}`);
  }
  return role;
}

export interface AuthResult {
  userId: string;
  username: string;
  membership: { role: "admin" | "member" };
  isToken: boolean;
}

export interface UserAuthResult {
  userId: string;
  username: string;
  email: string;
  isToken: boolean;
}

export async function authenticate(
  request: Request,
  projectIdOrCustomId: string,
): Promise<AuthResult | Response> {
  const projectId = await resolveProjectId(projectIdOrCustomId);
  if (!projectId) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

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
      membership: { role: validateRole(membership.role) },
      isToken: true,
    };
  }

  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

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
    username: session.user.username ?? session.user.name ?? "User",
    membership: { role: validateRole(membership.role) },
    isToken: false,
  };
}

/**
 * Authenticate a user (Bearer token OR session) without requiring project membership.
 * Returns 401 if neither auth method works.
 */
export async function authenticateUser(
  request: Request,
): Promise<UserAuthResult | Response> {
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

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      isToken: true,
    };
  }

  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch email since the session may not include it reliably.
  const [user] = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return {
    userId,
    username: session.user.username ?? session.user.name ?? user.username,
    email: user.email,
    isToken: false,
  };
}

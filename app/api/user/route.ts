import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  username: z.string().min(2).max(30).optional(),
  avatar: z.string().url().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};

  // Username update
  if (parsed.data.username) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, parsed.data.username))
      .limit(1);
    if (existing && existing.id !== userId) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 },
      );
    }
    updates.username = parsed.data.username;
  }

  // Avatar update
  if (parsed.data.avatar !== undefined) {
    updates.avatar = parsed.data.avatar;
  }

  // Password update
  if (parsed.data.currentPassword && parsed.data.newPassword) {
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const valid = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }
    updates.passwordHash = await hash(parsed.data.newPassword, 12);
  } else if (parsed.data.currentPassword || parsed.data.newPassword) {
    return NextResponse.json(
      { error: "Both current and new password are required" },
      { status: 400 },
    );
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  await db.delete(users).where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}

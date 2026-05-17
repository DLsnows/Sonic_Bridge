import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getLiveKitToken } from "@/lib/livekit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id as string;

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

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const username = user?.username ?? "Unknown";
  const roomName = `project-${id}`;

  try {
    const token = await getLiveKitToken(roomName, username, userId);
    return NextResponse.json({
      token,
      roomName,
      wsUrl: process.env.LIVEKIT_URL ?? "ws://localhost:7880",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to generate token" },
      { status: 500 },
    );
  }
}

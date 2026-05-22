import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { RoomServiceClient } from "livekit-server-sdk";
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

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, session.user.id as string)),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const livekitUrl = process.env.LIVEKIT_URL ?? "ws://localhost:7880";
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ participantCount: 0 });
  }

  try {
    const livekitHost = livekitUrl.replace(/^wss?:\/\//, "https://");
    const client = new RoomServiceClient(livekitHost, apiKey, apiSecret);
    const participants = await client.listParticipants(`project-${projectId}`);
    return NextResponse.json({ participantCount: participants.length });
  } catch {
    return NextResponse.json({ participantCount: 0 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

  await upsertProjectView(userId, projectId);
  return NextResponse.json({ success: true });
}

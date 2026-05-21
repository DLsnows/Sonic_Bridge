import { handleUpload } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveProjectId } from "@/lib/project-utils";
import { getMaxFileSize } from "@/lib/storage";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.type !== "blob.generate-client-token") {
    return Response.json({ error: "Unexpected request type" }, { status: 400 });
  }

  const { pathname, clientPayload } = body.payload ?? {};

  let projectId: string;
  let folderId: string | null;
  try {
    const parsed = clientPayload ? JSON.parse(clientPayload) : null;
    projectId = parsed?.projectId;
    folderId = parsed?.folderId ?? null;
  } catch {
    return Response.json({ error: "Invalid client payload" }, { status: 400 });
  }

  if (!projectId) {
    return Response.json({ error: "Missing projectId in client payload" }, { status: 400 });
  }

  const resolvedId = await resolveProjectId(projectId);
  if (!resolvedId) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, resolvedId),
        eq(projectMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Not a member of this project" }, { status: 403 });
  }

  if (!pathname || (!pathname.startsWith(`${resolvedId}/`) && !pathname.startsWith(`${projectId}/`)) || pathname.includes("..")) {
    return Response.json({ error: "Upload path must be scoped to the project" }, { status: 403 });
  }

  const filename = pathname.split("/").pop() ?? "";
  const { limit } = getMaxFileSize(filename);

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => ({
        maximumSizeInBytes: limit,
        tokenPayload: clientPayload,
      }),
      onUploadCompleted: async () => {
        // No-op: metadata is saved via the files API route
      },
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/api-auth";
import { resolveProjectId } from "@/lib/project-utils";
import { createPresignedUploadUrl } from "@/lib/storage";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const name = request.nextUrl.searchParams.get("name");
  const type = request.nextUrl.searchParams.get("type") ?? "application/octet-stream";
  const folderId = request.nextUrl.searchParams.get("folderId");

  if (!name) return NextResponse.json({ error: "Missing file name" }, { status: 400 });

  let folderPath = "files";
  if (folderId) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.projectId, projectId)))
      .limit(1);
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    folderPath = folder.name.replace(/\.\.|\//g, "_");
  }

  try {
    const { uploadUrl, publicUrl, storageKey } = await createPresignedUploadUrl(
      projectId, folderPath, name, type,
    );
    return NextResponse.json({ uploadUrl, publicUrl, storageKey });
  } catch (err) {
    console.error("Failed to create presigned URL:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}

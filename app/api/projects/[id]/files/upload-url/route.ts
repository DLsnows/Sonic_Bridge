import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/api-auth";
import { resolveProjectId } from "@/lib/project-utils";
import { createPresignedUploadUrl, getMaxFileSize, detectMimeType } from "@/lib/storage";
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

  const sizeStr = request.nextUrl.searchParams.get("size");
  if (name && sizeStr) {
    const size = parseInt(sizeStr, 10);
    if (!isNaN(size)) {
      const { limit, category } = getMaxFileSize(name);
      if (size > limit) {
        const limitStr = limit >= 1073741824
          ? `${(limit / 1073741824).toFixed(0)}GB`
          : `${(limit / 1048576).toFixed(0)}MB`;
        return NextResponse.json(
          { error: `File "${name}" exceeds ${limitStr} limit for ${category} files` },
          { status: 413 }
        );
      }
    }
  }

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
    const contentType = detectMimeType(name, type);
    const { uploadUrl, publicUrl, storageKey } = await createPresignedUploadUrl(
      projectId, folderPath, name, contentType,
    );
    return NextResponse.json({ uploadUrl, publicUrl, storageKey });
  } catch (err) {
    console.error("Failed to create presigned URL:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}

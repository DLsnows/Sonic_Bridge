import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/api-auth";
import { createPresignedPost } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await authenticate(request, id);
  if (authResult instanceof Response) return authResult;

  const filename = request.nextUrl.searchParams.get("filename");
  const contentType = request.nextUrl.searchParams.get("contentType") || "application/octet-stream";

  if (!filename) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }

  const { url, fields, storageKey } = await createPresignedPost(id, "files", filename, contentType);

  return NextResponse.json({ url, fields, storageKey });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { head } from "@vercel/blob";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const fallbackName = searchParams.get("name");

  const [user] = await db
    .select({ avatar: users.avatar, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const cacheHeaders = { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600" };
  const seedName = user?.username || fallbackName || userId;
  const dicebearUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seedName)}&backgroundColor=1a1a2e&textColor=00ff41`;

  if (!user?.avatar) {
    return NextResponse.redirect(dicebearUrl, { headers: cacheHeaders });
  }

  let storageKey: string;
  try {
    if (user.avatar.includes("blob.vercel-storage.com")) {
      storageKey = new URL(user.avatar).pathname.slice(1);
    } else {
      storageKey = user.avatar;
    }
  } catch (err) {
    console.error(`Avatar URL parse failed for user ${userId}:`, err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(dicebearUrl, { headers: cacheHeaders });
  }

  try {
    const blob = await head(storageKey);
    const response = await fetch(blob.downloadUrl);
    if (!response.ok) {
      return NextResponse.redirect(dicebearUrl, { headers: cacheHeaders });
    }
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || blob.contentType || "image/jpeg";
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
        "Content-Length": String(imageBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error(`Avatar fetch failed for user ${userId}:`, err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(dicebearUrl, { headers: cacheHeaders });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { head } from "@vercel/blob";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const [user] = await db
    .select({ avatar: users.avatar })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.avatar) {
    return NextResponse.redirect(
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(userId)}&backgroundColor=1a1a2e&textColor=00ff41`,
    );
  }

  let storageKey: string;
  try {
    if (user.avatar.includes("blob.vercel-storage.com")) {
      storageKey = new URL(user.avatar).pathname.slice(1);
    } else {
      storageKey = user.avatar;
    }
  } catch {
    return NextResponse.redirect(
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(userId)}&backgroundColor=1a1a2e&textColor=00ff41`,
    );
  }

  try {
    const blob = await head(storageKey);
    const response = await fetch(blob.downloadUrl);
    if (!response.ok) {
      return NextResponse.redirect(
        `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(userId)}&backgroundColor=1a1a2e&textColor=00ff41`,
      );
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
  } catch {
    return NextResponse.redirect(
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(userId)}&backgroundColor=1a1a2e&textColor=00ff41`,
    );
  }
}

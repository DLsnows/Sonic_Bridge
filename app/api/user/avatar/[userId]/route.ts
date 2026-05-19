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
    return new NextResponse(null, { status: 404 });
  }

  // Backward compat: extract pathname from old full URLs
  let storageKey: string;
  if (user.avatar.includes("blob.vercel-storage.com")) {
    storageKey = new URL(user.avatar).pathname.slice(1);
  } else {
    storageKey = user.avatar;
  }

  const blob = await head(storageKey);

  return NextResponse.redirect(blob.downloadUrl, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}

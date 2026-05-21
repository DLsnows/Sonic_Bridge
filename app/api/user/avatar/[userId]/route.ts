import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const fallbackName = searchParams.get("name");

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const cacheHeaders = { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600" };
  const seedName = user?.username || fallbackName || userId;
  const dicebearUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seedName)}&backgroundColor=1a1a2e&textColor=00ff41`;

  return NextResponse.redirect(dicebearUrl, { headers: cacheHeaders });
}

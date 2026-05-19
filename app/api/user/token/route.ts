import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const rawToken = `sb_${randomBytes(32).toString("hex")}`;
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  await db
    .update(users)
    .set({ apiToken: hashedToken })
    .where(eq(users.id, userId));

  return NextResponse.json(
    { token: rawToken },
    {
      headers: {
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
      },
    },
  );
}

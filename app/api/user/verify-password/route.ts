import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, deleteChallenges } from "@/lib/db/schema";
import { eq, lt, or, isNotNull } from "drizzle-orm";
import { compare } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

const bodySchema = z.object({
  password: z.string().min(1),
});

// In-memory rate limiter. Allows up to 5 failed attempts per user per 15min window.
// Keyed by userId; resets the window on the 6th attempt's response (i.e. 429).
interface RateRecord {
  count: number;
  windowStart: number;
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_FAILS = 5;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const rateMap = new Map<string, RateRecord>();

function isRateAllowed(userId: string): boolean {
  const now = Date.now();
  const rec = rateMap.get(userId);
  if (!rec || now - rec.windowStart > RATE_LIMIT_WINDOW_MS) {
    // No active window (or stale) → allowed; window opens on next failure.
    return true;
  }
  return rec.count < RATE_LIMIT_MAX_FAILS;
}

function recordFailure(userId: string) {
  const now = Date.now();
  const rec = rateMap.get(userId);
  if (!rec || now - rec.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(userId, { count: 1, windowStart: now });
  } else {
    rec.count += 1;
  }
}

function resetRate(userId: string) {
  rateMap.delete(userId);
}

// Export for tests — gated so production builds cannot reach the rate-map even
// if this module is imported by accident.
export const __test =
  process.env.NODE_ENV === "test"
    ? {
        rateMap,
        RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX_FAILS,
      }
    : undefined;

export async function POST(request: NextRequest) {
  // Security: this endpoint is session-only — a leaked Bearer token must NOT
  // be able to mint a delete challenge.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  // Rate limit BEFORE password compare to prevent timing leakage from being
  // amplified into a brute-force vector.
  if (!isRateAllowed(userId)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    recordFailure(userId);
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Success — reset rate limiter and mint a challenge.
  resetRate(userId);

  const rawChallenge = `ch_${randomBytes(32).toString("hex")}`;
  const hashed = createHash("sha256").update(rawChallenge).digest("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  // Best-effort cleanup of expired/used challenges to bound table growth.
  // Failures here must not impact the request, so swallow the error.
  await db
    .delete(deleteChallenges)
    .where(
      or(lt(deleteChallenges.expiresAt, new Date()), isNotNull(deleteChallenges.usedAt)),
    )
    .catch(() => {});

  await db.insert(deleteChallenges).values({
    userId,
    challengeHash: hashed,
    expiresAt,
  });

  return NextResponse.json(
    { challenge: rawChallenge, expiresAt: expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

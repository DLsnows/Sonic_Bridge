import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";

// When db.insert(deleteChallenges) throws (e.g. table missing because the
// migration was never applied to a target environment), the route must
// surface a 503 with a clear envelope instead of a bare 500. Round 2
// BUGS 5 + 6 were caused by web/CLI misreading a 500 as a credential failure.

const USER_ID = "11111111-1111-1111-1111-111111111111";

const insertCalls: unknown[] = [];

vi.mock("@/lib/api-auth", () => ({
  authenticateUser: async () => ({
    userId: USER_ID,
    username: "tester",
    email: "tester@example.com",
    isToken: true,
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              passwordHash: "$2a$10$" + "a".repeat(53),
            },
          ],
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        catch: () => Promise.resolve(),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        insertCalls.push(v);
        throw new Error('relation "delete_challenges" does not exist');
      },
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  users: { id: "id", passwordHash: "passwordHash" },
  deleteChallenges: {
    userId: "userId",
    challengeHash: "challengeHash",
    expiresAt: "expiresAt",
    usedAt: "usedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _and: args }),
  eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
  or: (...args: unknown[]) => ({ _or: args }),
  lt: (a: unknown, b: unknown) => ({ _lt: [a, b] }),
  isNotNull: (a: unknown) => ({ _isNotNull: a }),
}));

vi.mock("bcryptjs", () => ({
  compare: async (_a: string, _b: string) => true,
}));

vi.mock("next/server", () => {
  class FakeNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    }
  }
  return { NextRequest: Request, NextResponse: FakeNextResponse };
});

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  insertCalls.length = 0;
  consoleErrorSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function loadPOST() {
  const mod = await import("@/app/api/user/verify-password/route");
  return mod.POST;
}

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/user/verify-password — 503 envelope", () => {
  test("returns 503 challenge_mint_failed when the insert throws", async () => {
    const POST = await loadPOST();
    const res = await POST(makeRequest({ password: "correct horse" }));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error?: string; message?: string };
    expect(json.error).toBe("challenge_mint_failed");
    expect(json.message).toBeTypeOf("string");
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(insertCalls.length).toBeGreaterThan(0);
  });
});

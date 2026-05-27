/**
 * Tests that the verify-password endpoint enforces a 5-attempt rate limit
 * within a 15-minute window.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "22222222-2222-2222-2222-222222222222";

const state = vi.hoisted(() => ({
  sessionMock: { user: { id: "22222222-2222-2222-2222-222222222222" } } as
    | { user: { id: string } }
    | null,
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => state.sessionMock),
}));

vi.mock("bcryptjs", () => ({
  compare: vi.fn(async () => false),
}));

vi.mock("@/lib/db", () => {
  function makeSelectChain(rows: unknown[]) {
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(rows),
    };
    return chain;
  }
  return {
    db: {
      select: vi.fn(() => makeSelectChain([{ passwordHash: "x" }])),
      insert: vi.fn(() => ({
        values: async () => undefined,
      })),
    },
  };
});

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/user/verify-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong" }),
  });
}

beforeEach(async () => {
  const mod = await import("@/app/api/user/verify-password/route");
  (
    mod as unknown as { __test: { rateMap: Map<string, unknown> } }
  ).__test.rateMap.clear();
  state.sessionMock = { user: { id: USER_ID } };
});

describe("verify-password rate limit", () => {
  it("returns 429 on the 6th failed attempt within the window", async () => {
    const { POST } = await import("@/app/api/user/verify-password/route");

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(401);
    }
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });
});

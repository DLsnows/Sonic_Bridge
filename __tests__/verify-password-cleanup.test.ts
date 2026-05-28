/**
 * Tests that the verify-password endpoint best-effort-deletes expired/used
 * delete_challenges rows before inserting a new one, bounding table growth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "33333333-3333-3333-3333-333333333333";

const state = vi.hoisted(() => ({
  sessionMock: { user: { id: "33333333-3333-3333-3333-333333333333" } } as
    | { user: { id: string } }
    | null,
  // Pretend rows representing existing challenges. Expired/used rows should be
  // wiped by the cleanup step before the new row is inserted.
  rows: [
    { id: "expired-1", expiresAt: new Date(Date.now() - 60_000), usedAt: null },
    {
      id: "used-1",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    },
    { id: "fresh-1", expiresAt: new Date(Date.now() + 60_000), usedAt: null },
  ] as Array<{
    id: string;
    expiresAt: Date;
    usedAt: Date | null;
  }>,
  deleteWhereCalled: false,
  insertCalled: false,
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => state.sessionMock),
}));

vi.mock("bcryptjs", () => ({
  compare: vi.fn(async () => true),
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
        values: async () => {
          state.insertCalled = true;
          return undefined;
        },
      })),
      delete: vi.fn(() => ({
        // The route uses `.delete(table).where(cond).catch(...)` — the where()
        // call returns a thenable we resolve after applying the expired/used
        // predicate to our fake rows.
        where: () => {
          state.deleteWhereCalled = true;
          const now = Date.now();
          state.rows = state.rows.filter(
            (r) => r.expiresAt.getTime() >= now && r.usedAt === null,
          );
          return Promise.resolve(undefined);
        },
      })),
    },
  };
});

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/user/verify-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "correct" }),
  });
}

beforeEach(async () => {
  state.sessionMock = { user: { id: USER_ID } };
  state.rows = [
    { id: "expired-1", expiresAt: new Date(Date.now() - 60_000), usedAt: null },
    {
      id: "used-1",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    },
    { id: "fresh-1", expiresAt: new Date(Date.now() + 60_000), usedAt: null },
  ];
  state.deleteWhereCalled = false;
  state.insertCalled = false;
  const mod = await import("@/app/api/user/verify-password/route");
  (
    mod as unknown as {
      __test: { rateMap: Map<string, unknown> } | undefined;
    }
  ).__test?.rateMap.clear();
});

describe("verify-password cleanup of expired/used challenges", () => {
  it("removes expired + used rows before inserting the new challenge", async () => {
    const { POST } = await import("@/app/api/user/verify-password/route");

    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    // Cleanup must have run and removed the expired + used rows, leaving only
    // the still-fresh, still-unused one (the brand-new insert is not in
    // `state.rows` because our mock insert() is a no-op for the array).
    expect(state.deleteWhereCalled).toBe(true);
    expect(state.insertCalled).toBe(true);
    expect(state.rows.map((r) => r.id)).toEqual(["fresh-1"]);
  });
});

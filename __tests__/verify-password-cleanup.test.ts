/**
 * Tests that the verify-password endpoint best-effort-deletes expired/used
 * delete_challenges rows before inserting a new one, bounding table growth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_USER_ID = "44444444-4444-4444-4444-444444444444";

const state = vi.hoisted(() => ({
  sessionMock: { user: { id: "33333333-3333-3333-3333-333333333333" } } as
    | { user: { id: string } }
    | null,
  // Pretend rows representing existing challenges. Expired/used rows belonging
  // to the VERIFYING user should be wiped by the cleanup step before the new
  // row is inserted; rows belonging to OTHER users must survive (cleanup is
  // scoped per-user).
  rows: [
    {
      id: "expired-1",
      userId: "33333333-3333-3333-3333-333333333333",
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    },
    {
      id: "used-1",
      userId: "33333333-3333-3333-3333-333333333333",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    },
    {
      id: "fresh-1",
      userId: "33333333-3333-3333-3333-333333333333",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    },
    // A different user's expired row — must NOT be touched by this user's
    // cleanup. Catches accidental cross-user deletion.
    {
      id: "other-expired-1",
      userId: "44444444-4444-4444-4444-444444444444",
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    },
  ] as Array<{
    id: string;
    userId: string;
    expiresAt: Date;
    usedAt: Date | null;
  }>,
  deleteWhereCalled: false,
  insertCalled: false,
  verifyingUserId: "33333333-3333-3333-3333-333333333333",
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
        // call returns a thenable we resolve after applying the (userId-scoped)
        // expired/used predicate to our fake rows. Rows belonging to OTHER
        // users must survive.
        where: () => {
          state.deleteWhereCalled = true;
          const now = Date.now();
          const verifyingUserId = state.verifyingUserId;
          state.rows = state.rows.filter((r) => {
            if (r.userId !== verifyingUserId) return true; // scoped: other users untouched
            // verifying-user row: keep iff still fresh AND not used
            return r.expiresAt.getTime() >= now && r.usedAt === null;
          });
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
  state.verifyingUserId = USER_ID;
  state.rows = [
    {
      id: "expired-1",
      userId: USER_ID,
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    },
    {
      id: "used-1",
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    },
    {
      id: "fresh-1",
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    },
    {
      id: "other-expired-1",
      userId: OTHER_USER_ID,
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    },
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

    // Cleanup must have run and removed the verifying user's expired + used
    // rows, leaving their still-fresh, still-unused one AND any other user's
    // rows untouched. The brand-new insert is not in `state.rows` because our
    // mock insert() is a no-op for the array.
    expect(state.deleteWhereCalled).toBe(true);
    expect(state.insertCalled).toBe(true);
    expect(state.rows.map((r) => r.id).sort()).toEqual(
      ["fresh-1", "other-expired-1"].sort(),
    );
  });

  it("does not delete expired/used rows belonging to a different user", async () => {
    const { POST } = await import("@/app/api/user/verify-password/route");

    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    // The other user's expired row must survive — cleanup is scoped to the
    // verifying user only.
    const otherUserRows = state.rows.filter((r) => r.userId === OTHER_USER_ID);
    expect(otherUserRows.map((r) => r.id)).toEqual(["other-expired-1"]);
  });
});

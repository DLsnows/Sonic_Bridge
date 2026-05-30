/**
 * Tests that the verify-password endpoint enforces a 5-attempt rate limit
 * within a 15-minute window, AND accepts both session and Bearer auth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "22222222-2222-2222-2222-222222222222";

type AuthMock =
  | {
      userId: string;
      username: string;
      email: string;
      isToken: boolean;
    }
  | Response;

const state = vi.hoisted(() => ({
  // The route now uses authenticateUser(request); the mock returns this on
  // success or a Response on failure. Tests flip between session and Bearer
  // modes by toggling `isToken`.
  authMock: {
    userId: "22222222-2222-2222-2222-222222222222",
    username: "alice",
    email: "alice@example.com",
    isToken: false,
  } as AuthMock,
  passwordValid: false,
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateUser: vi.fn(async () => state.authMock),
}));

vi.mock("bcryptjs", () => ({
  compare: vi.fn(async () => state.passwordValid),
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
      delete: vi.fn(() => ({
        where: () => Promise.resolve(undefined),
      })),
    },
  };
});

function makeReq(opts?: { password?: string; bearer?: boolean }): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.bearer) {
    headers["Authorization"] = "Bearer sb_dummy_token_for_test";
  }
  return new NextRequest("http://localhost/api/user/verify-password", {
    method: "POST",
    headers,
    body: JSON.stringify({ password: opts?.password ?? "wrong" }),
  });
}

beforeEach(async () => {
  const mod = await import("@/app/api/user/verify-password/route");
  (
    mod as unknown as { __test: { rateMap: Map<string, unknown> } }
  ).__test.rateMap.clear();
  state.authMock = {
    userId: USER_ID,
    username: "alice",
    email: "alice@example.com",
    isToken: false,
  };
  state.passwordValid = false;
});

describe("verify-password rate limit", () => {
  it("returns 429 on the 6th failed attempt within the window (session)", async () => {
    const { POST } = await import("@/app/api/user/verify-password/route");

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(401);
    }
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });

  it("rate-limit counter increments across mixed session + bearer failures", async () => {
    const { POST, __test } = await import(
      "@/app/api/user/verify-password/route"
    );

    // 3 bearer failures
    state.authMock = {
      userId: USER_ID,
      username: "alice",
      email: "alice@example.com",
      isToken: true,
    };
    for (let i = 0; i < 3; i++) {
      const res = await POST(makeReq({ bearer: true }));
      expect(res.status).toBe(401);
    }

    // 2 more session failures (5 total → 6th should be 429)
    state.authMock = {
      userId: USER_ID,
      username: "alice",
      email: "alice@example.com",
      isToken: false,
    };
    for (let i = 0; i < 2; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(401);
    }

    // Counter should be 5 — the 6th attempt is rate-limited regardless of mode.
    const rec = (
      __test as unknown as {
        rateMap: Map<string, { count: number; windowStart: number }>;
      }
    ).rateMap.get(USER_ID);
    expect(rec?.count).toBe(5);

    const sixth = await POST(makeReq({ bearer: true }));
    expect(sixth.status).toBe(429);
  });
});

describe("verify-password Bearer auth mode", () => {
  it("returns 200 with a challenge when bearer auth + correct password", async () => {
    state.authMock = {
      userId: USER_ID,
      username: "alice",
      email: "alice@example.com",
      isToken: true,
    };
    state.passwordValid = true;

    const { POST } = await import("@/app/api/user/verify-password/route");

    const res = await POST(makeReq({ password: "correct", bearer: true }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { challenge?: string; expiresAt?: string };
    expect(typeof body.challenge).toBe("string");
    expect(body.challenge?.startsWith("ch_")).toBe(true);
    expect(typeof body.expiresAt).toBe("string");
  });

  it("returns 401 + increments rate limit when bearer auth + wrong password", async () => {
    state.authMock = {
      userId: USER_ID,
      username: "alice",
      email: "alice@example.com",
      isToken: true,
    };
    state.passwordValid = false;

    const { POST, __test } = await import(
      "@/app/api/user/verify-password/route"
    );

    const res = await POST(makeReq({ password: "wrong", bearer: true }));
    expect(res.status).toBe(401);

    const rec = (
      __test as unknown as {
        rateMap: Map<string, { count: number; windowStart: number }>;
      }
    ).rateMap.get(USER_ID);
    expect(rec?.count).toBe(1);
  });

  it("propagates the 401 Response from authenticateUser when neither auth works", async () => {
    // Simulate authenticateUser short-circuit by returning a Response.
    state.authMock = Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );

    const { POST } = await import("@/app/api/user/verify-password/route");

    const res = await POST(makeReq({ password: "anything" }));
    expect(res.status).toBe(401);
  });
});

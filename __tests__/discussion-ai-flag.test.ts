/**
 * Tests that POST /api/projects/:id/discussion stamps isAiGenerated based on
 * whether the caller authenticated via Bearer token vs session.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const RAW_TOKEN = "sb_abc123def456";
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

interface InsertedRow {
  isAiGenerated: boolean;
  userId: string;
  projectId: string;
  title: string;
  content: string;
  parentId: string | null;
}

// Hoisted so the vi.mock factory closures can capture stable references.
const state = vi.hoisted(() => ({
  sessionMock: null as { user: { id: string; username: string } } | null,
  useTokenAuth: false,
  insertedRows: [] as InsertedRow[],
  selectCallIndex: 0,
  PROJECT_ID: "11111111-1111-1111-1111-111111111111",
  USER_ID: "22222222-2222-2222-2222-222222222222",
  TOKEN_HASH: createHash("sha256").update("sb_abc123def456").digest("hex"),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => state.sessionMock),
}));

vi.mock("@/lib/notifications", () => ({
  createReplyNotifications: vi.fn(async () => {}),
  createThreadNotifications: vi.fn(async () => {}),
}));

const fakePost = {
  id: "33333333-3333-3333-3333-333333333333",
  projectId: PROJECT_ID,
  userId: USER_ID,
  username: "tester",
  avatar: null,
  title: "hello",
  content: "world",
  parentId: null,
  isEdited: false,
  isAiGenerated: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("@/lib/db", () => {
  function makeSelectChain(rows: unknown[]) {
    const chain = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      orderBy: () => chain,
      limit: () => Promise.resolve(rows),
    };
    return chain;
  }

  return {
    db: {
      select: vi.fn(() => {
        const idx = state.selectCallIndex++;
        if (idx === 0) {
          return makeSelectChain([{ id: state.PROJECT_ID }]);
        }
        if (state.useTokenAuth) {
          if (idx === 1) {
            return makeSelectChain([
              {
                id: state.USER_ID,
                username: "tester",
                email: "t@example.com",
                passwordHash: "x",
                avatar: null,
                apiToken: state.TOKEN_HASH,
              },
            ]);
          }
          if (idx === 2) {
            return makeSelectChain([{ role: "member" }]);
          }
        } else {
          if (idx === 1) {
            return makeSelectChain([{ role: "member" }]);
          }
        }
        return makeSelectChain([fakePost]);
      }),
      insert: vi.fn(() => ({
        values: (val: InsertedRow) => ({
          returning: async () => {
            state.insertedRows.push(val);
            return [{ ...fakePost, ...val }];
          },
        }),
      })),
    },
  };
});

beforeEach(() => {
  state.insertedRows.length = 0;
  state.selectCallIndex = 0;
});

function makeReq(headers: Record<string, string>): NextRequest {
  return new NextRequest(
    "http://localhost/api/projects/" + PROJECT_ID + "/discussion",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        hasParent: false,
        title: "hello",
        content: "world",
      }),
    },
  );
}

describe("POST /api/projects/:id/discussion isAiGenerated stamping", () => {
  it("Bearer-token authenticated POST sets isAiGenerated=true", async () => {
    state.sessionMock = null;
    state.useTokenAuth = true;
    const { POST } = await import("@/app/api/projects/[id]/discussion/route");

    const res = await POST(
      makeReq({ Authorization: `Bearer ${RAW_TOKEN}` }),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );

    expect(res.status).toBe(201);
    expect(state.insertedRows).toHaveLength(1);
    expect(state.insertedRows[0].isAiGenerated).toBe(true);
  });

  it("Session-authenticated POST sets isAiGenerated=false", async () => {
    state.sessionMock = { user: { id: USER_ID, username: "tester" } };
    state.useTokenAuth = false;
    const { POST } = await import("@/app/api/projects/[id]/discussion/route");

    const res = await POST(makeReq({}), {
      params: Promise.resolve({ id: PROJECT_ID }),
    });

    expect(res.status).toBe(201);
    expect(state.insertedRows).toHaveLength(1);
    expect(state.insertedRows[0].isAiGenerated).toBe(false);
  });
});

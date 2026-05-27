/**
 * Tests that DELETE /api/projects/:id/files/:fileId enforces the
 * X-Delete-Challenge header and one-shot claim semantics.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const FILE_ID = "55555555-5555-5555-5555-555555555555";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const CHALLENGE_RAW = "ch_abcdef0123456789";

const state = vi.hoisted(() => ({
  sessionMock: {
    user: {
      id: "22222222-2222-2222-2222-222222222222",
      username: "tester",
    },
  } as { user: { id: string; username: string } } | null,
  claimAvailable: true,
  selectCallIndex: 0,
  PROJECT_ID: "11111111-1111-1111-1111-111111111111",
  FILE_ID: "55555555-5555-5555-5555-555555555555",
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => state.sessionMock),
}));

vi.mock("@/lib/storage", () => ({
  deleteFile: vi.fn(async () => undefined),
  normalizeKey: vi.fn((k: string) => k),
}));

vi.mock("@/lib/db", () => {
  function makeSelectChain(rows: unknown[]) {
    const chain = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      limit: () => Promise.resolve(rows),
    };
    return chain;
  }

  return {
    db: {
      select: vi.fn(() => {
        const idx = state.selectCallIndex++;
        if (idx === 0) return makeSelectChain([{ id: state.PROJECT_ID }]);
        if (idx === 1) return makeSelectChain([{ role: "member" }]);
        return makeSelectChain([
          {
            id: state.FILE_ID,
            projectId: state.PROJECT_ID,
            storageKey: "11111111/file.bin",
            name: "f",
            size: 1,
            mimeType: "application/octet-stream",
          },
        ]);
      }),
      execute: vi.fn(async () => {
        if (state.claimAvailable) {
          state.claimAvailable = false;
          return { rows: [{ id: "claim-id" }] };
        }
        return { rows: [] };
      }),
      delete: vi.fn(() => ({
        where: async () => undefined,
      })),
    },
  };
});

beforeEach(() => {
  state.selectCallIndex = 0;
  state.sessionMock = {
    user: { id: USER_ID, username: "tester" },
  };
});

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${PROJECT_ID}/files/${FILE_ID}`,
    { method: "DELETE", headers },
  );
}

describe("File DELETE challenge enforcement", () => {
  it("returns 401 challenge_required when X-Delete-Challenge header is missing", async () => {
    state.claimAvailable = true;
    const { DELETE } = await import(
      "@/app/api/projects/[id]/files/[fileId]/route"
    );
    const res = await DELETE(makeReq(), {
      params: Promise.resolve({ id: PROJECT_ID, fileId: FILE_ID }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("challenge_required");
  });

  it("returns 200 on first use of a valid challenge and 401 challenge_invalid on reuse", async () => {
    state.claimAvailable = true;

    const { DELETE } = await import(
      "@/app/api/projects/[id]/files/[fileId]/route"
    );

    const first = await DELETE(
      makeReq({ "X-Delete-Challenge": CHALLENGE_RAW }),
      { params: Promise.resolve({ id: PROJECT_ID, fileId: FILE_ID }) },
    );
    expect(first.status).toBe(200);

    // Reset select counter so the auth + file lookup work again.
    // The challenge has been consumed (claimAvailable=false) so the next
    // claim returns no rows.
    state.selectCallIndex = 0;

    const second = await DELETE(
      makeReq({ "X-Delete-Challenge": CHALLENGE_RAW }),
      { params: Promise.resolve({ id: PROJECT_ID, fileId: FILE_ID }) },
    );
    expect(second.status).toBe(401);
    const body = await second.json();
    expect(body.error).toBe("challenge_invalid");
  });
});

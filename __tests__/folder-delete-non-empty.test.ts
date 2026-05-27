/**
 * Tests that DELETE /api/projects/:id/folders/:folderId refuses to delete a
 * folder that still has direct children, returning 409 folder_not_empty.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const FOLDER_ID = "44444444-4444-4444-4444-444444444444";
const USER_ID = "22222222-2222-2222-2222-222222222222";

const state = vi.hoisted(() => ({
  sessionMock: {
    user: {
      id: "22222222-2222-2222-2222-222222222222",
      username: "tester",
    },
  } as { user: { id: string; username: string } } | null,
  countsRows: [{ fileCount: 2, subfolderCount: 0 }] as {
    fileCount: number;
    subfolderCount: number;
  }[],
  selectCallIndex: 0,
  PROJECT_ID: "11111111-1111-1111-1111-111111111111",
  FOLDER_ID: "44444444-4444-4444-4444-444444444444",
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => state.sessionMock),
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
        if (idx === 2)
          return makeSelectChain([
            {
              id: state.FOLDER_ID,
              projectId: state.PROJECT_ID,
              name: "f",
              parentId: null,
            },
          ]);
        return makeSelectChain([]);
      }),
      execute: vi.fn(async () => ({ rows: state.countsRows })),
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

describe("Folder DELETE non-empty handling", () => {
  it("returns 409 folder_not_empty when folder contains files", async () => {
    state.countsRows = [{ fileCount: 2, subfolderCount: 0 }];
    const { DELETE } = await import(
      "@/app/api/projects/[id]/folders/[folderId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/projects/${PROJECT_ID}/folders/${FOLDER_ID}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: PROJECT_ID, folderId: FOLDER_ID }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("folder_not_empty");
  });

  it("returns 200 when folder is empty", async () => {
    state.countsRows = [{ fileCount: 0, subfolderCount: 0 }];
    const { DELETE } = await import(
      "@/app/api/projects/[id]/folders/[folderId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/projects/${PROJECT_ID}/folders/${FOLDER_ID}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: PROJECT_ID, folderId: FOLDER_ID }),
    });
    expect(res.status).toBe(200);
  });
});

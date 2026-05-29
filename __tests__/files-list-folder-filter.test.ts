import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";

// GET /api/projects/[id]/files filter rules:
//   all=1   → every file in the project, across folders
//   folderId given → files in that folder
//   neither → root files only (folderId IS NULL). Round 2 BUG 1 was that the
//             "neither" branch returned all files in the project.

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

// Captured `where` argument so we can assert which filter shape was built.
let capturedWhere: unknown = null;

vi.mock("@/lib/project-utils", () => ({
  resolveProjectId: async (id: string) =>
    id === PROJECT_ID ? PROJECT_ID : null,
}));

vi.mock("@/lib/api-auth", () => ({
  authenticate: async () => ({
    userId: "22222222-2222-2222-2222-222222222222",
    username: "tester",
    membership: { role: "admin" },
    isToken: false,
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ _kind: "eq", col, val }),
  and: (...args: unknown[]) => ({
    _kind: "and",
    args: args.filter((a) => a !== undefined),
  }),
  isNull: (col: unknown) => ({ _kind: "isNull", col }),
}));

vi.mock("@/lib/db/schema", () => ({
  files: {
    id: "files.id",
    name: "files.name",
    size: "files.size",
    mimeType: "files.mimeType",
    storageKey: "files.storageKey",
    folderId: "files.folderId",
    uploadedBy: "files.uploadedBy",
    uploadedAt: "files.uploadedAt",
    projectId: "files.projectId",
  },
  folders: { id: "folders.id" },
  users: { id: "users.id", username: "users.username" },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: (w: unknown) => {
            capturedWhere = w;
            return {
              orderBy: async () => [],
            };
          },
        }),
      }),
    }),
  },
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

beforeEach(() => {
  capturedWhere = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

async function loadGET() {
  const mod = await import("@/app/api/projects/[id]/files/route");
  return mod.GET;
}

function makeReq(url: string): NextRequest {
  // The route reads `request.nextUrl.searchParams`. Plain `Request` has no
  // `nextUrl`, so stub it with a real URL whose `.searchParams` matches.
  const req = new Request(url);
  Object.defineProperty(req, "nextUrl", {
    value: new URL(url),
    writable: false,
    configurable: true,
  });
  return req as unknown as NextRequest;
}

function paramsPromise() {
  return Promise.resolve({ id: PROJECT_ID });
}

interface AndShape {
  _kind: "and";
  args: { _kind: string }[];
}

describe("GET /api/projects/[id]/files — folder filter rules", () => {
  test("no folderId → uses isNull(files.folderId)", async () => {
    const GET = await loadGET();
    await GET(makeReq(`http://localhost/api/projects/${PROJECT_ID}/files`), {
      params: paramsPromise(),
    });
    const where = capturedWhere as AndShape;
    expect(where._kind).toBe("and");
    const kinds = where.args.map((a) => a._kind);
    expect(kinds).toContain("eq");
    expect(kinds).toContain("isNull");
  });

  test("folderId=<UUID> → uses eq(files.folderId, id)", async () => {
    const GET = await loadGET();
    await GET(
      makeReq(
        `http://localhost/api/projects/${PROJECT_ID}/files?folderId=33333333-3333-4333-8333-333333333333`,
      ),
      { params: paramsPromise() },
    );
    const where = capturedWhere as AndShape;
    expect(where._kind).toBe("and");
    const eqs = where.args.filter((a) => a._kind === "eq");
    // One eq for projectId, one for folderId.
    expect(eqs.length).toBeGreaterThanOrEqual(2);
    const isNulls = where.args.filter((a) => a._kind === "isNull");
    expect(isNulls.length).toBe(0);
  });

  test("all=1 → no folder filter at all (only projectId guard)", async () => {
    const GET = await loadGET();
    await GET(
      makeReq(`http://localhost/api/projects/${PROJECT_ID}/files?all=1`),
      { params: paramsPromise() },
    );
    const where = capturedWhere as AndShape;
    expect(where._kind).toBe("and");
    const isNulls = where.args.filter((a) => a._kind === "isNull");
    expect(isNulls.length).toBe(0);
    // Only the projectId eq survives — folderId-related arg was undefined and
    // filtered out by the `and(...)` mock.
    const eqs = where.args.filter((a) => a._kind === "eq");
    expect(eqs.length).toBe(1);
  });
});
